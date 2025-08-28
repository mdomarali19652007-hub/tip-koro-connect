import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DonationRequest {
  creator_id: string;
  amount: number;
  donor_name?: string;
  donor_email?: string;
  message?: string;
  is_anonymous: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { creator_id, amount, donor_name, donor_email, message, is_anonymous }: DonationRequest = await req.json();

    // Validate input
    if (!creator_id || !amount || amount < 10) {
      return new Response(
        JSON.stringify({ error: "Invalid donation data. Minimum amount is 10 BDT." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role key for database operations
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if creator exists and subscription is active
    const { data: creator } = await supabaseService
      .from('users')
      .select('id, role')
      .eq('id', creator_id)
      .eq('role', 'creator')
      .single();

    if (!creator) {
      return new Response(
        JSON.stringify({ error: "Creator not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if creator's subscription is active
    const { data: subscription } = await supabaseService
      .from('subscriptions')
      .select('paid_until, is_active')
      .eq('user_id', creator_id)
      .single();

    if (!subscription || !subscription.is_active || new Date(subscription.paid_until) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Creator's subscription is not active" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate transaction ID for donation
    const txnId = `DON_${creator_id.substring(0, 8)}_${Date.now()}`;

    console.log('Processing donation payment:', {
      creator_id,
      amount,
      donor_name: is_anonymous ? '[ANONYMOUS]' : donor_name,
      txn_id: txnId
    });

    // Call RupantorPay API to initiate payment
    const rupantorPayResponse = await fetch("https://payment.rupantorpay.com/api/payment/checkout", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "X-API-KEY": Deno.env.get("RUPANTORPAY_API_KEY") ?? "",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        success_url: `${req.headers.get("origin")}/thankyou/${txnId}`,
        cancel_url: `${req.headers.get("origin")}/u/${creator.username}`,
        webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/rupantorpay-webhook`,
        fullname: is_anonymous ? "Anonymous Donor" : (donor_name || "Anonymous Donor"),
        email: is_anonymous ? "anonymous@tipkoro.com" : (donor_email || "anonymous@tipkoro.com"),
        amount: amount.toString()
      })
    });

    const rupantorPayResult = await rupantorPayResponse.json();

    if (!rupantorPayResult.status) {
      throw new Error(`RupantorPay API error: ${rupantorPayResult.message || 'Unknown error'}`);
    }

    // Create donation record
    const { data: donation, error: donationError } = await supabaseService
      .from('donations')
      .insert({
        creator_id,
        amount,
        donor_name: is_anonymous ? null : donor_name,
        donor_email: is_anonymous ? null : donor_email,
        message,
        is_anonymous,
        payment_status: 'pending', // Will be updated via webhook
        txn_id: txnId,
        payment_id: rupantorPayResult.payment_id || `rupantorpay_${txnId}`
      })
      .select()
      .single();

    if (donationError) {
      console.error('Error creating donation:', donationError);
      return new Response(
        JSON.stringify({ error: "Failed to process donation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Don't update creator's balance here - will be done via webhook after payment confirmation

    console.log('Donation processed successfully:', {
      donation_id: donation.id,
      txn_id: txnId,
      amount,
      creator_id
    });

    return new Response(
      JSON.stringify({
        success: true,
        txn_id: txnId,
        donation_id: donation.id,
        payment_url: rupantorPayResult.payment_url,
        message: "Donation initiated, redirecting to payment gateway"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error('Error processing donation:', error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});