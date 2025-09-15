// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MIDTRANS_SERVER_KEY = Deno.env.get("MIDTRANS_SERVER_KEY")!; // Sandbox/Production Server Key
const MIDTRANS_IS_PRODUCTION = (Deno.env.get("MIDTRANS_IS_PRODUCTION") || "false").toLowerCase() === "true";

type CreateSnapInput = {
  enrollmentId: string;
  programId: string;
  amount: number; // IDR
  preferred_method?: "ewallet" | "bank" | "qris";
  customer?: { name?: string; email?: string; phone?: string };
  successUrl?: string;
  failureUrl?: string;
};

async function getUserFromAuthHeader(authHeader?: string) {
  if (!authHeader) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.id ? data : null;
  } catch {
    return null;
  }
}

function enabledPayments(pref?: string) {
  if (pref === "bank") {
    // VA Banks: BCA, BNI, BRI, Permata, CIMB; Mandiri bill payment via echannel
    return ["bca_va", "bni_va", "bri_va", "permata_va", "cimb_va", "echannel"];
  }
  if (pref === "ewallet") {
    // Midtrans Snap supports GoPay & ShopeePay. DANA/OVO/LinkAja dapat melalui QRIS.
    return ["gopay", "shopeepay"];
  }
  if (pref === "qris") {
    return ["qris"];
  }
  return undefined; // show all active
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const authHeader = req.headers.get("Authorization") || undefined;
    const currentUser = await getUserFromAuthHeader(authHeader);
    if (!currentUser) return new Response("Unauthorized", { status: 401 });

    const body = (await req.json()) as CreateSnapInput;
    const { enrollmentId, programId, amount, preferred_method, customer } = body;
    if (!enrollmentId || !programId || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: enr, error: e1 } = await admin
      .from("enrollments")
      .select("id,user_id,program_id,payment_id")
      .eq("id", enrollmentId)
      .single();
    if (e1 || !enr) return new Response(JSON.stringify({ error: "Enrollment not found" }), { status: 404 });
    if (enr.user_id !== currentUser.id) return new Response("Forbidden", { status: 403 });

    const order_id = `enroll_${enrollmentId}_${Date.now()}`;
    const snapUrl = MIDTRANS_IS_PRODUCTION
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const payload: Record<string, any> = {
      transaction_details: { order_id, gross_amount: Math.round(amount) },
      customer_details: {
        first_name: customer?.name || "Customer",
        email: customer?.email,
        phone: customer?.phone,
      },
      enabled_payments: enabledPayments(preferred_method),
      item_details: [
        { id: programId, price: Math.round(amount), quantity: 1, name: `Program ${programId}` },
      ],
    };

    const resp = await fetch(snapUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(MIDTRANS_SERVER_KEY + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data?.status_message || "Failed to create transaction" }), { status: 500 });
    }

    await admin
      .from("enrollments")
      .update({ payment_id: order_id, payment_status: "pending" })
      .eq("id", enrollmentId);

    return new Response(JSON.stringify({ token: data.token, redirectUrl: data.redirect_url }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});

