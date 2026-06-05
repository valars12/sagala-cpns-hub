import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import prisma from "../prisma";
import { PURCHASE_STATUS } from "../constants";
import {
  buildSessionSourceKey,
  buildEffectiveQuestionSourcePackageIds,
  buildSessionDefaultCode,
  buildSessionDefaultTitle,
  isSessionAccessibleForPackage,
  normalizeSessionType,
  parsePackageSourceIds,
  parseSessionSourceKeys,
  type QuestionSessionType
} from "../utils/package-session";

const router = Router();
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const profileUpdateSchema = z.object({
  name: z.string().min(3).optional(),
  phone: z.string().min(8).optional().or(z.literal(""))
});

const passwordUpdateSchema = z.object({
  currentPassword: z.string().min(6).optional(),
  newPassword: z.string().min(6)
});

const purchaseTrashSchema = z.object({
  trashed: z.boolean()
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

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn("Failed to parse JSON field", error);
    return fallback;
  }
};

const inferTryoutNumber = (sessionTitle: string, sessionCode: string) => {
  const candidates = [sessionTitle, sessionCode];
  for (const text of candidates) {
    const match = text.match(/(?:tryout|to)[\s\-_]*(?:ke[\s\-_]*)?0*(\d{1,4})/i);
    if (!match?.[1]) continue;
    const parsed = Number(match[1]);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

const sanitizeUser = (user: User) => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

router.get("/dashboard", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const currentUser = res.locals.user as { role?: string };
  const trashDeleteThreshold = new Date(Date.now() - TRASH_RETENTION_MS);

  await prisma.purchase.deleteMany({
    where: {
      userId,
      hiddenAt: {
        not: null,
        lt: trashDeleteThreshold
      }
    }
  });

  let purchases = await prisma.purchase.findMany({
    where: { userId },
    include: { package: true },
    orderBy: { createdAt: "desc" }
  });

  const purchasesMissingDates = purchases.filter(
    (purchase) => !purchase.startDate || !purchase.endDate
  );

  if (purchasesMissingDates.length) {
    await Promise.all(
      purchasesMissingDates.map((purchase) => {
        const startDate = purchase.startDate ?? purchase.createdAt;
        const endDate =
          purchase.endDate ?? new Date(startDate.getTime() + ONE_YEAR_MS);
        return prisma.purchase.update({
          where: { id: purchase.id },
          data: { startDate, endDate }
        });
      })
    );

    purchases = await prisma.purchase.findMany({
      where: { userId },
      include: { package: true },
      orderBy: { createdAt: "desc" }
    });
  }

  const now = new Date();
  const expiredIds = purchases
    .filter(
      (purchase) =>
        purchase.status === PURCHASE_STATUS.PAID &&
        purchase.endDate &&
        purchase.endDate < now
    )
    .map((purchase) => purchase.id);

  if (expiredIds.length) {
    await prisma.purchase.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: PURCHASE_STATUS.EXPIRED }
    });

    purchases = await prisma.purchase.findMany({
      where: { userId },
      include: { package: true },
      orderBy: { createdAt: "desc" }
    });
  }

  const paidPackageIds = new Set(
    purchases
      .filter((purchase) => purchase.status === PURCHASE_STATUS.PAID)
      .map((purchase) => purchase.packageId)
  );

  const deduplicatedPurchases = purchases.filter(
    (purchase) =>
      !(
        purchase.status === PURCHASE_STATUS.PENDING &&
        paidPackageIds.has(purchase.packageId)
      )
  );

  const visiblePurchases = deduplicatedPurchases.filter(
    (purchase) => !purchase.hiddenAt
  );
  const trashedPurchases = deduplicatedPurchases.filter((purchase) =>
    Boolean(purchase.hiddenAt)
  );

  const activePackages = visiblePurchases.filter(
    (purchase) => purchase.status === PURCHASE_STATUS.PAID
  );

  const stats = {
    totalPackages: visiblePurchases.length,
    activePackages: activePackages.length,
    pendingPackages: visiblePurchases.filter(
      (purchase) => purchase.status === PURCHASE_STATUS.PENDING
    ).length,
    completedPackages: visiblePurchases.filter(
      (purchase) => purchase.status === PURCHASE_STATUS.EXPIRED
    ).length
  };

  const serializePurchase = (purchase: (typeof purchases)[number]) => {
    const validityDays =
      purchase.startDate && purchase.endDate
        ? Math.max(
            0,
            Math.round(
              (purchase.endDate.getTime() - purchase.startDate.getTime()) /
                (24 * 60 * 60 * 1000)
            )
          )
        : undefined;

    return {
      id: purchase.id,
      orderCode: purchase.orderCode,
      status: purchase.status,
      isAdminGranted: purchase.isAdminGranted,
      startDate: purchase.startDate,
      endDate: purchase.endDate,
      hiddenAt: purchase.hiddenAt,
      validityDays,
      createdAt: purchase.createdAt,
      package: {
        id: purchase.package.id,
        slug: purchase.package.slug,
        title: purchase.package.title,
        subtitle: purchase.package.subtitle,
        description: purchase.package.description,
        category: purchase.package.category,
        imageUrl: purchase.package.imageUrl,
        badge: purchase.package.badge,
        price: purchase.package.price,
        discountPercent: purchase.package.discountPercent,
        durationDays: purchase.package.durationDays,
        tryoutDurationMinutes: purchase.package.tryoutDurationMinutes,
        latihanDurationMinutes: purchase.package.latihanDurationMinutes,
        tryoutAccessStart: purchase.package.tryoutAccessStart,
        tryoutAccessEnd: purchase.package.tryoutAccessEnd,
        latihanAccessStart: purchase.package.latihanAccessStart,
        latihanAccessEnd: purchase.package.latihanAccessEnd,
        sessionSourcePackageIds: parsePackageSourceIds(
          purchase.package.sessionSourcePackageIds
        ),
        sessionSourceSessionKeys: parseSessionSourceKeys(
          purchase.package.sessionSourcePackageIds
        ),
        features: parseJsonArray(purchase.package.features),
        whatsIncluded: parseJsonArray(purchase.package.whatsIncluded),
        highlights: parseJsonArray(purchase.package.highlights)
      }
    };
  };

  const activePackageIds = activePackages.map((item) => item.packageId);
  const packageMap = new Map(activePackages.map((item) => [item.packageId, item.package]));
  const questionSourceConfigMap = new Map<
    string,
    {
      sourcePackageIds: string[];
      sourceSessionKeys: Set<string>;
    }
  >();
  for (const packageId of activePackageIds) {
    const pkg = packageMap.get(packageId);
    if (!pkg) continue;

    const sourcePackageIds = buildEffectiveQuestionSourcePackageIds({
      packageId: pkg.id,
      sessionSourcePackageIds: pkg.sessionSourcePackageIds
    });
    questionSourceConfigMap.set(pkg.id, {
      sourcePackageIds,
      sourceSessionKeys: new Set(parseSessionSourceKeys(pkg.sessionSourcePackageIds))
    });
  }

  const classLinks = activePackageIds.length
    ? await prisma.classStudent.findMany({
        where: { studentId: userId },
        select: { studyClassId: true }
      })
    : [];
  const classIds = Array.from(new Set(classLinks.map((item) => item.studyClassId)));
  const classTryoutAssignments =
    classIds.length && activePackageIds.length
      ? await prisma.classTryoutAssignment.findMany({
          where: {
            studyClassId: { in: classIds },
            packageId: { in: activePackageIds },
            isActive: true
          },
          select: {
            packageId: true,
            sessionType: true,
            sessionOrder: true,
            startAt: true,
            endAt: true
          }
        })
      : [];

  const assignmentRowsByPackageId = new Map<string, typeof classTryoutAssignments>();
  const openSessionKeysByPackageId = new Map<string, Set<string>>();
  const nowForAssignments = new Date();
  for (const assignment of classTryoutAssignments) {
    const currentRows = assignmentRowsByPackageId.get(assignment.packageId) ?? [];
    currentRows.push(assignment);
    assignmentRowsByPackageId.set(assignment.packageId, currentRows);

    if (assignment.startAt <= nowForAssignments && assignment.endAt >= nowForAssignments) {
      const sessionType = normalizeSessionType(assignment.sessionType);
      const sessionOrder = assignment.sessionOrder > 0 ? assignment.sessionOrder : 1;
      const sessionKey = buildSessionSourceKey(sessionType, sessionOrder);
      const openKeys = openSessionKeysByPackageId.get(assignment.packageId) ?? new Set<string>();
      openKeys.add(sessionKey);
      openSessionKeysByPackageId.set(assignment.packageId, openKeys);
    }
  }

  const groupedSessions = activePackageIds.length
    ? await prisma.question.groupBy({
        by: ["packageId", "sessionType", "sessionCode", "sessionTitle", "sessionOrder"],
        _count: { _all: true }
      })
    : [];

  const sourceSessionMap = new Map<string, typeof groupedSessions>();
  for (const session of groupedSessions) {
    const current = sourceSessionMap.get(session.packageId) ?? [];
    current.push(session);
    sourceSessionMap.set(session.packageId, current);
  }

  const accessibleTryouts = activePackageIds
    .flatMap((packageId) => {
      const pkg = packageMap.get(packageId);
      if (!pkg) return [];

      const mergedSessionMap = new Map<
        string,
        {
          sessionType: QuestionSessionType;
          sessionCode: string;
          sessionTitle: string;
          sessionOrder: number;
          questionCount: number;
        }
      >();
      const sourceConfig = questionSourceConfigMap.get(pkg.id) ?? {
        sourcePackageIds: [pkg.id],
        sourceSessionKeys: new Set<string>()
      };
      const packageAssignments = assignmentRowsByPackageId.get(pkg.id) ?? [];
      const strictSessionSchedule = packageAssignments.length > 0;
      const openSessionKeys = openSessionKeysByPackageId.get(pkg.id) ?? new Set<string>();
      const hasSessionKeySources = sourceConfig.sourceSessionKeys.size > 0;
      const candidateSessions = hasSessionKeySources
        ? groupedSessions
        : sourceConfig.sourcePackageIds.flatMap(
            (sourceId) => sourceSessionMap.get(sourceId) ?? []
          );

      for (const session of candidateSessions) {
        const sessionType = normalizeSessionType(session.sessionType);
        const sessionOrder = session.sessionOrder > 0 ? session.sessionOrder : 1;
        const hasAccessToSession = isSessionAccessibleForPackage({
          sessionType,
          sessionOrder,
          pkg
        });
        if (!hasAccessToSession) continue;

        if (hasSessionKeySources) {
          const sourceSessionKey = buildSessionSourceKey(sessionType, sessionOrder);
          if (!sourceConfig.sourceSessionKeys.has(sourceSessionKey)) continue;
        }

        if (strictSessionSchedule) {
          const sessionKeyForSchedule = buildSessionSourceKey(sessionType, sessionOrder);
          if (!openSessionKeys.has(sessionKeyForSchedule)) continue;
        }

        const sessionKey = `${sessionType}:${sessionOrder}`;
        const defaultSessionCode = buildSessionDefaultCode(sessionType, sessionOrder);
        const defaultSessionTitle = buildSessionDefaultTitle(sessionType, sessionOrder);
        const nextSessionTitle = session.sessionTitle?.trim() || defaultSessionTitle;
        const current = mergedSessionMap.get(sessionKey);

        if (!current) {
          mergedSessionMap.set(sessionKey, {
            sessionType,
            sessionCode: defaultSessionCode,
            sessionTitle: nextSessionTitle,
            sessionOrder,
            questionCount: session._count._all
          });
          continue;
        }

        current.questionCount += session._count._all;
        if (
          current.sessionTitle === defaultSessionTitle &&
          nextSessionTitle !== defaultSessionTitle
        ) {
          current.sessionTitle = nextSessionTitle;
        }
      }

      return Array.from(mergedSessionMap.values()).map((session) => ({
        id: `${pkg.id}:${session.sessionType}:${session.sessionOrder}`,
        packageId: pkg.id,
        packageSlug: pkg.slug,
        packageTitle: pkg.title,
        category: pkg.category,
        sessionType: session.sessionType,
        sessionCode: session.sessionCode,
        sessionTitle: session.sessionTitle,
        sessionOrder: session.sessionOrder,
        questionCount: session.questionCount,
        tryoutNumber:
          session.sessionType === "TRYOUT"
            ? inferTryoutNumber(session.sessionTitle, session.sessionCode)
            : null
      }));
    })
    .sort((a, b) => {
      if (a.packageTitle !== b.packageTitle) {
        return a.packageTitle.localeCompare(b.packageTitle, "id");
      }
      if (a.sessionType !== b.sessionType) {
        if (a.sessionType === "TRYOUT") return -1;
        if (b.sessionType === "TRYOUT") return 1;
      }
      if (a.sessionOrder !== b.sessionOrder) {
        return a.sessionOrder - b.sessionOrder;
      }
      return a.sessionTitle.localeCompare(b.sessionTitle, "id");
    });

  const tryoutAttempts = await prisma.tryoutAttempt.findMany({
    where: { userId },
    include: {
      package: {
        select: {
          id: true,
          slug: true,
          title: true,
          category: true
        }
      }
    },
    orderBy: [{ completedAt: "desc" }]
  });

  const accessibleModules =
    currentUser?.role === "student"
      ? await prisma.module.findMany({
          where: activePackageIds.length
            ? {
                OR: [
                  {
                    accesses: {
                      some: { userId }
                    }
                  },
                  {
                    isPublished: true,
                    packageLinks: {
                      some: {
                        packageId: {
                          in: activePackageIds
                        }
                      }
                    }
                  }
                ]
              }
            : {
                accesses: {
                  some: { userId }
                }
              },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true
              }
            },
            packageLinks: {
              include: {
                package: {
                  select: {
                    id: true,
                    slug: true,
                    title: true
                  }
                }
              }
            }
          },
          orderBy: [{ updatedAt: "desc" }]
        })
      : [];

  return res.json({
    data: {
      stats,
      purchases: visiblePurchases.map(serializePurchase),
      trashedPurchases: trashedPurchases.map(serializePurchase),
      accessibleModules: accessibleModules.map((item) => ({
        id: item.id,
        title: item.title,
        bab: item.bab,
        subBab: item.subBab,
        summary: item.summary,
        content: item.content,
        pdfDataUrl: item.pdfDataUrl,
        pdfFileName: item.pdfFileName,
        pptDataUrl: item.pptDataUrl,
        pptFileName: item.pptFileName,
        isPublished: item.isPublished,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        createdBy: item.createdBy,
        packages: item.packageLinks
          .map((link) => link.package)
          .sort((a, b) => a.title.localeCompare(b.title, "id"))
      })),
      accessibleTryouts,
      tryoutHistory: tryoutAttempts.map((attempt) => ({
        id: attempt.id,
        package: attempt.package,
        sessionType: attempt.sessionType === "LATIHAN" ? "LATIHAN" : "TRYOUT",
        sessionCode: attempt.sessionCode,
        sessionTitle: attempt.sessionTitle,
        totalQuestions: attempt.totalQuestions,
        answeredCount: attempt.answeredCount,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        blankCount: attempt.blankCount,
        score: attempt.score,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        durationSeconds: attempt.durationSeconds,
        completedAt: attempt.completedAt,
        perCategory: parseJson<
          Array<{
            category: "TWK" | "TIU" | "TKP";
            total: number;
            correct: number;
            score: number;
            maxScore: number;
          }>
        >(attempt.perCategory, [])
      }))
    }
  });
});

router.patch("/purchases/:purchaseId/trash", requireAuth, async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { trashed } = purchaseTrashSchema.parse(req.body);
    const userId = req.user!.userId;

    const purchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        userId
      },
      select: {
        id: true,
        status: true,
        hiddenAt: true
      }
    });

    if (!purchase) {
      return res.status(404).json({ message: "Paket tidak ditemukan." });
    }

    if (trashed && purchase.status === PURCHASE_STATUS.PAID) {
      return res.status(400).json({
        message:
          "Paket aktif tidak bisa dibuang ke tong sampah. Silakan selesaikan atau tunggu status paket berubah."
      });
    }

    if (trashed === Boolean(purchase.hiddenAt)) {
      return res.json({
        message: trashed
          ? "Paket sudah ada di tong sampah."
          : "Paket sudah dipulihkan.",
        data: {
          id: purchase.id,
          hiddenAt: purchase.hiddenAt
        }
      });
    }

    const updated = await prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        hiddenAt: trashed ? new Date() : null
      },
      select: {
        id: true,
        hiddenAt: true
      }
    });

    return res.json({
      message: trashed
        ? "Paket berhasil dipindahkan ke tong sampah."
        : "Paket berhasil dipulihkan.",
      data: updated
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }
    console.error("Toggle purchase trash error:", error);
    return res.status(500).json({ message: "Gagal memperbarui paket." });
  }
});

router.delete("/purchases/:purchaseId/trash", requireAuth, async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const userId = req.user!.userId;

    const purchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        userId
      },
      select: {
        id: true,
        hiddenAt: true
      }
    });

    if (!purchase) {
      return res.status(404).json({ message: "Paket tidak ditemukan." });
    }

    if (!purchase.hiddenAt) {
      return res.status(400).json({
        message: "Paket belum ada di tong sampah."
      });
    }

    await prisma.purchase.delete({
      where: { id: purchase.id }
    });

    return res.json({
      message: "Paket berhasil dihapus permanen dari tong sampah."
    });
  } catch (error) {
    console.error("Delete purchase from trash error:", error);
    return res.status(500).json({ message: "Gagal menghapus paket dari tong sampah." });
  }
});

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const payload = profileUpdateSchema.parse(req.body);

    if (!Object.keys(payload).length) {
      return res.status(400).json({ message: "Tidak ada data profil yang diubah." });
    }

    const data: Record<string, unknown> = {};

    if (payload.name !== undefined) {
      data.name = payload.name.trim();
    }
    if (payload.phone !== undefined) {
      const phone = payload.phone.trim();
      data.phone = phone.length ? phone : null;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data
    });

    return res.json({
      message: "Profil berhasil diperbarui.",
      user: sanitizeUser(updated)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    console.error("Update profile error:", error);
    return res.status(500).json({ message: "Gagal memperbarui profil." });
  }
});

router.patch("/password", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const payload = passwordUpdateSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: "Akun tidak ditemukan." });
    }

    if (user.passwordHash) {
      if (!payload.currentPassword) {
        return res
          .status(400)
          .json({ message: "Password saat ini wajib diisi." });
      }

      const isValidPassword = await bcrypt.compare(
        payload.currentPassword,
        user.passwordHash
      );

      if (!isValidPassword) {
        return res.status(400).json({ message: "Password saat ini tidak sesuai." });
      }
    }

    const passwordHash = await bcrypt.hash(payload.newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    return res.json({ message: "Password berhasil diperbarui." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    console.error("Update password error:", error);
    return res.status(500).json({ message: "Gagal memperbarui password." });
  }
});

export default router;
