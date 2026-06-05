import { Router } from "express";
import { z } from "zod";
import type { TransactionPayload } from "midtrans-client";
import prisma from "../prisma";
import { requireAuth } from "../middleware/auth";
import { getSnapClient } from "../utils/midtrans";
import { PURCHASE_STATUS, PurchaseStatus } from "../constants";

const router = Router();
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const PAYMENT_METHODS = [
  "all",
  "bank_transfer",
  "e_wallet",
  "qris",
  "credit_card",
  "cstore"
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const paymentMethodMap: Record<PaymentMethod, string[] | null> = {
  all: null,
  bank_transfer: ["bank_transfer"],
  e_wallet: ["gopay", "shopeepay"],
  qris: ["qris"],
  credit_card: ["credit_card"],
  cstore: ["cstore"]
};

const createOrderSchema = z.object({
  packageId: z.string().min(1),
  paymentMethod: z.enum(PAYMENT_METHODS).optional()
});

const parseJsonArray = (value?: string | null) => {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Failed to parse JSON field", value, error);
    return [];
  }
};

router.post("/", requireAuth, async (req, res) => {
  try {
    const { packageId, paymentMethod } = createOrderSchema.parse(req.body);

    const pkg = await prisma.package.findUnique({
      where: { id: packageId }
    });

    if (!pkg) {
      return res.status(404).json({ message: "Paket tidak ditemukan" });
    }

    const userId = req.user!.userId;

    const existingActive = await prisma.purchase.findFirst({
      where: {
        userId,
        packageId: pkg.id,
        status: PURCHASE_STATUS.PAID
      }
    });

    if (existingActive) {
      return res.status(400).json({
        message: "Kamu sudah memiliki paket ini di dashboard."
      });
    }

    // batalkan pesanan tertunda lain untuk paket yang sama
    await prisma.purchase.updateMany({
      where: {
        userId,
        packageId: pkg.id,
        status: PURCHASE_STATUS.PENDING
      },
      data: { status: PURCHASE_STATUS.CANCELED }
    });

    const orderCode = `SB-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const snapClient = getSnapClient();

    let snapToken: string | null = null;
    let snapRedirectUrl: string | null = null;
    let status: PurchaseStatus = PURCHASE_STATUS.PENDING;
    let paidAt: Date | null = null;
    const selectedPaymentMethod: PaymentMethod = paymentMethod ?? "all";

    if (snapClient) {
      const enabledPayments = paymentMethodMap[selectedPaymentMethod];
      const payload: TransactionPayload = {
        transaction_details: {
          order_id: orderCode,
          gross_amount: pkg.price
        },
        item_details: [
          {
            id: pkg.id,
            price: pkg.price,
            quantity: 1,
            name: pkg.title,
            category: pkg.category
          }
        ],
        customer_details: {
          first_name: res.locals.user?.name ?? "Sagala Bimbel Student",
          email: res.locals.user?.email,
          phone: res.locals.user?.phone
        }
      };

      if (enabledPayments && enabledPayments.length) {
        payload.enabled_payments = enabledPayments;
      }

      const transaction = await snapClient.createTransaction(payload);

      snapToken = transaction.token;
      snapRedirectUrl = transaction.redirect_url;
    } else {
      status = PURCHASE_STATUS.PAID;
      paidAt = new Date();
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + ONE_YEAR_MS);

    const order = await prisma.purchase.create({
      data: {
        orderCode,
        userId,
        packageId: pkg.id,
        status,
        paymentMethod: selectedPaymentMethod,
        snapToken: snapToken ?? undefined,
        snapRedirectUrl: snapRedirectUrl ?? undefined,
        midtransOrderId: snapToken ? orderCode : null,
        startDate,
        endDate,
        paidAt,
        paymentType: snapClient ? null : "simulation",
        grossAmount: pkg.price
      },
      include: {
        package: true
      }
    });

    const serializedOrder = {
      ...order,
      package: {
        ...order.package,
        features: parseJsonArray(order.package.features),
        whatsIncluded: parseJsonArray(order.package.whatsIncluded),
        highlights: parseJsonArray(order.package.highlights)
      }
    };

    return res.json({
      data: serializedOrder,
      payment: {
        snapToken,
        snapRedirectUrl,
        isSimulation: !snapClient,
        message: snapClient
          ? "Silakan lanjutkan pembayaran melalui Midtrans."
          : "Pembayaran disimulasikan karena kunci Midtrans belum dikonfigurasi."
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }
    console.error("Create order error:", error);
    return res.status(500).json({ message: "Gagal membuat pesanan" });
  }
});

const confirmSchema = z.object({
  transactionStatus: z.string().optional(),
  paymentType: z.string().optional(),
  paidAt: z.coerce.date().optional()
});

router.post("/:orderCode/confirm", requireAuth, async (req, res) => {
  try {
    const { orderCode } = req.params;
    const body = confirmSchema.parse(req.body);

    const purchase = await prisma.purchase.findUnique({
      where: { orderCode },
      include: { package: true }
    });

    if (!purchase || purchase.userId !== req.user!.userId) {
      return res.status(404).json({ message: "Pesanan tidak ditemukan" });
    }

    if (purchase.status === PURCHASE_STATUS.PAID) {
      return res.json({ message: "Pesanan sudah aktif" });
    }

    const resolvedPaidAt = body.paidAt ?? purchase.paidAt ?? new Date();
    const startDate = purchase.startDate ?? resolvedPaidAt;
    const endDate = new Date(startDate.getTime() + ONE_YEAR_MS);

    const updated = await prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        status: PURCHASE_STATUS.PAID,
        startDate,
        endDate,
        paymentType: body.paymentType ?? purchase.paymentType,
        paidAt: resolvedPaidAt,
        hiddenAt: null
      },
      include: { package: true }
    });

    await prisma.purchase.updateMany({
      where: {
        userId: purchase.userId,
        packageId: purchase.packageId,
        status: PURCHASE_STATUS.PENDING,
        id: { not: purchase.id }
      },
      data: { status: PURCHASE_STATUS.CANCELED }
    });

    const serialized = {
      ...updated,
      package: {
        ...updated.package,
        features: parseJsonArray(updated.package.features),
        whatsIncluded: parseJsonArray(updated.package.whatsIncluded),
        highlights: parseJsonArray(updated.package.highlights)
      }
    };

    return res.json({
      message: "Pembelian dikonfirmasi",
      data: serialized
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }
    console.error("Confirm order error:", error);
    return res.status(500).json({ message: "Gagal mengonfirmasi pesanan" });
  }
});

router.post("/midtrans/webhook", async (req, res) => {
  const notification = req.body;

  if (!notification.order_id) {
    return res.status(400).json({ message: "Payload webhook tidak valid" });
  }

  try {
    const purchase = await prisma.purchase.findUnique({
      where: { orderCode: notification.order_id },
      include: { package: true }
    });

    if (!purchase) {
      return res.status(404).json({ message: "Pesanan tidak ditemukan" });
    }

    if (
      notification.transaction_status === "capture" ||
      notification.transaction_status === "settlement"
    ) {
      const startDate = purchase.startDate ?? new Date();
      const endDate = new Date(startDate.getTime() + ONE_YEAR_MS);
      const resolvedPaidAt =
        notification.transaction_time &&
        !Number.isNaN(Date.parse(notification.transaction_time))
          ? new Date(notification.transaction_time)
          : new Date();

      await prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          status: PURCHASE_STATUS.PAID,
          startDate,
          endDate,
          paymentType: notification.payment_type ?? purchase.paymentType,
          paidAt: resolvedPaidAt,
          hiddenAt: null
        }
      });

      await prisma.purchase.updateMany({
        where: {
          userId: purchase.userId,
          packageId: purchase.packageId,
          status: PURCHASE_STATUS.PENDING,
          id: { not: purchase.id }
        },
        data: { status: PURCHASE_STATUS.CANCELED }
      });
    } else if (
      notification.transaction_status === "expire" ||
      notification.transaction_status === "cancel"
    ) {
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          status: PURCHASE_STATUS.EXPIRED
        }
      });
    }

    return res.json({ message: "Webhook diterima" });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ message: "Gagal memproses webhook" });
  }
});

export default router;
