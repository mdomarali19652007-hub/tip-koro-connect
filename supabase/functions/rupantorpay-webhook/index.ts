import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  transaction_id: string;
  status: string;
  amount: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transaction_id, status, amount }: WebhookPayload = await req.json();

    console.log('Webhook received:', { transaction_id, status, amount });

    // Create Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify payment with RupantorPay
    const verifyResponse = await fetch("https://payment.rupantorpay.com/api/payment/verify-payment", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "X-API-KEY": Deno.env.get("RUPANTORPAY_API_KEY") ?? "",
        "content-type": "application/json"
      },
      body: JSON.stringify({ transaction_id })
    });

    const verification = await verifyResponse.json();
    console.log('Payment verification result:', verification);

    if (verification.status && verification.payment_status === 'completed') {
      // Update donation record if it's a donation
      if (transaction_id.startsWith('DON_')) {
        const { error: donationError } = await supabaseService
          .from('donations')
          .update({
            payment_status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('txn_id', transaction_id);

        if (donationError) {
          console.error('Error updating donation:', donationError);
        }
      }

      // Update subscription record if it's a subscription payment
      if (transaction_id.startsWith('SUB_')) {
        const { error: subscriptionError } = await supabaseService
          .from('subscriptions')
          .update({
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('last_payment_txn_id', transaction_id);

        if (subscriptionError) {
          console.error('Error updating subscription:', subscriptionError);
        }
      }
    } else {
      // Payment failed - update records accordingly
      if (transaction_id.startsWith('DON_')) {
        await supabaseService
          .from('donations')
          .update({
            payment_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('txn_id', transaction_id);
      }

      if (transaction_id.startsWith('SUB_')) {
        await supabaseService
          .from('subscriptions')
          .update({
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('last_payment_txn_id', transaction_id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Webhook processed successfully" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ 
        error: "Webhook processing failed",
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});