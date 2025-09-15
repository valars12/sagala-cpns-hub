// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MIDTRANS_SERVER_KEY = Deno.env.get("MIDTRANS_SERVER_KEY")!;

async function sha512Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-512", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const payload = await req.json();
    const order_id = payload?.order_id as string;
    const status_code = payload?.status_code as string; // string number
    const gross_amount = payload?.gross_amount as string; // string number
    const signature_key = payload?.signature_key as string;
    const transaction_status = (payload?.transaction_status as string) || "";

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return new Response("Bad Request", { status: 400 });
    }

    const expected = await sha512Hex(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY);
    if (expected !== signature_key) {
      return new Response("Invalid signature", { status: 401 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let payment_status = "pending";
    let status = "pending";
    if (transaction_status === "capture" || transaction_status === "settlement") {
      payment_status = "paid";
      status = "active";
    } else if (
      transaction_status === "deny" ||
      transaction_status === "cancel" ||
      transaction_status === "expire"
    ) {
      payment_status = "failed";
      status = "pending";
    } else if (transaction_status === "refund" || transaction_status === "chargeback") {
      payment_status = "refunded";
      status = "cancelled";
    }

    await admin
      .from("enrollments")
      .update({ payment_status, status })
      .eq("payment_id", order_id);

    return new Response("OK", { status: 200 });
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }
});

