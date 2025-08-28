import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  transaction_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transaction_id }: VerifyRequest = await req.json();

    console.log('Verifying payment for transaction:', transaction_id);

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
    console.log('RupantorPay verification result:', verification);

    return new Response(
      JSON.stringify({
        success: verification.status || false,
        payment_status: verification.payment_status || 'unknown',
        transaction_id,
        message: verification.message || 'Payment verification completed'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error('Payment verification error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Payment verification failed",
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});