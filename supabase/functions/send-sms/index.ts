import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeadersPost = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function getSecret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret: ${name}`);
  return value;
}

function makeAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersPost });
  }

  try {
    const { to, message, provider } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "to and message are required" }),
        { status: 400, headers: corsHeadersPost }
      );
    }

    const smsProvider = provider || getSecret("SMS_PROVIDER");
    const accountSid = getSecret("TWILIO_ACCOUNT_SID");
    const authToken = getSecret("TWILIO_AUTH_TOKEN");
    const fromNumber = getSecret("TWILIO_FROM_NUMBER");

    let status = "sent";
    let error_message = null;

    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const body = new URLSearchParams();
      body.append("To", to);
      body.append("From", fromNumber);
      body.append("Body", message);

      const response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errData = await response.json();
        status = "failed";
        error_message = errData.message || "Twilio API error";
      }
    } catch (err) {
      status = "failed";
      error_message = err.message;
    }

    const admin = makeAdmin();
    await admin.from("sms_logs").insert({
      to_number: to,
      message,
      provider: smsProvider,
      status,
      error_message,
    });

    return new Response(
      JSON.stringify({ success: status === "sent", status, error_message }),
      { headers: corsHeadersPost }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeadersPost }
    );
  }
});
