// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const XENDIT_CALLBACK_TOKEN = Deno.env.get("XENDIT_CALLBACK_TOKEN")!; // Set in Xendit Dashboard webhook

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const token = req.headers.get("x-callback-token");
  if (!token || token !== XENDIT_CALLBACK_TOKEN) return new Response("Unauthorized", { status: 401 });

  try {
    const payload = await req.json();
    // Xendit invoice webhook body fields
    // Reference: https://docs.xendit.co/accept-payments/invoices#callback-notifications
    const invoiceId = payload?.id;
    const status = payload?.status || payload?.data?.status;

    if (!invoiceId) return new Response("Bad Request", { status: 400 });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (status === "PAID" || status === "SETTLED") {
      await admin
        .from("enrollments")
        .update({ payment_status: "paid", status: "active" })
        .eq("payment_id", invoiceId);
    } else if (status === "EXPIRED" || status === "FAILED" || status === "VOIDED") {
      await admin
        .from("enrollments")
        .update({ payment_status: "failed", status: "pending" })
        .eq("payment_id", invoiceId);
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }
});

