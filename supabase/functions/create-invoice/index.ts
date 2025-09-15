// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const XENDIT_SECRET_KEY = Deno.env.get("XENDIT_SECRET_KEY")!; // Sandbox/Production secret key

type CreateInvoiceInput = {
  enrollmentId: string;
  programId: string;
  amount: number; // in IDR
  preferred_method?: "ewallet" | "bank" | "qris";
  customer?: { name?: string; email?: string; phone?: string };
  successUrl?: string;
  failureUrl?: string;
};

const base64 = (s: string) => btoa(s);

async function getUserFromAuthHeader(authHeader?: string) {
  if (!authHeader) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: SUPABASE_ANON_KEY,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.id ? data : null;
  } catch {
    return null;
  }
}

function buildAllowedMethods(pref?: string) {
  if (!pref) return undefined;
  const BANKS = ["BCA", "BNI", "BRI", "MANDIRI", "PERMATA", "CIMB", "BSI"];
  const EWALLETS = ["OVO", "DANA", "LINKAJA"];
  const QR = ["QRIS"];
  if (pref === "bank") return BANKS;
  if (pref === "ewallet") return EWALLETS;
  if (pref === "qris") return QR;
  return undefined;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization") || undefined;
    const currentUser = await getUserFromAuthHeader(authHeader);
    if (!currentUser) return new Response("Unauthorized", { status: 401 });

    const body = (await req.json()) as CreateInvoiceInput;
    const { enrollmentId, programId, amount, preferred_method, customer, successUrl, failureUrl } = body;
    if (!enrollmentId || !programId || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify enrollment belongs to current user
    const { data: enr, error: e1 } = await admin
      .from("enrollments")
      .select("id,user_id,program_id,payment_id")
      .eq("id", enrollmentId)
      .single();
    if (e1 || !enr) return new Response(JSON.stringify({ error: "Enrollment not found" }), { status: 404 });
    if (enr.user_id !== currentUser.id) return new Response("Forbidden", { status: 403 });

    const external_id = `enroll_${enrollmentId}`;
    const payload: Record<string, any> = {
      external_id,
      amount: Math.round(amount),
      payer_email: customer?.email,
      description: `Pembelian paket program ${programId}`,
      currency: "IDR",
      success_redirect_url: successUrl || `${new URL(req.url).origin}/?payment=success&enrollmentId=${enrollmentId}`,
      failure_redirect_url: failureUrl || `${new URL(req.url).origin}/?payment=failed&enrollmentId=${enrollmentId}`,
      invoice_duration: 86400, // 24h
    };

    const allowed = buildAllowedMethods(preferred_method);
    if (allowed) payload.payment_methods = allowed;

    const resp = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        Authorization: `Basic ${base64(`${XENDIT_SECRET_KEY}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const inv = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: inv?.error || "Failed to create invoice" }), { status: 500 });
    }

    // Save invoice id to enrollment
    await admin
      .from("enrollments")
      .update({ payment_id: inv.id, payment_status: "pending" })
      .eq("id", enrollmentId);

    return new Response(JSON.stringify({ invoiceId: inv.id, invoiceUrl: inv.invoice_url }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
