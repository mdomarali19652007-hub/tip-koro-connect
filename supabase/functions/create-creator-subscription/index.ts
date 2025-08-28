import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubscriptionRequest {
  duration_months?: number; // defaults to 1
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client using the anon key for user authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Retrieve authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { duration_months = 1 }: SubscriptionRequest = await req.json();

    // Create Supabase service client for database operations
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if user is a creator
    const { data: userProfile } = await supabaseService
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || userProfile.role !== 'creator') {
      return new Response(
        JSON.stringify({ error: "Only creators can purchase subscriptions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate transaction ID for subscription
    const txnId = `SUB_${user.id.substring(0, 8)}_${Date.now()}`;
    const subscriptionAmount = 100 * duration_months; // 100 BDT per month

    console.log('Processing creator subscription payment:', {
      user_id: user.id,
      amount: subscriptionAmount,
      duration_months,
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
        success_url: `${req.headers.get("origin")}/dashboard?payment=success&txn=${txnId}`,
        cancel_url: `${req.headers.get("origin")}/dashboard?payment=cancelled`,
        webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/rupantorpay-webhook`,
        fullname: userProfile.display_name || "TipKoro Creator",
        email: user.email || "creator@tipkoro.com",
        amount: subscriptionAmount.toString()
      })
    });

    const rupantorPayResult = await rupantorPayResponse.json();

    if (!rupantorPayResult.status) {
      throw new Error(`RupantorPay API error: ${rupantorPayResult.message || 'Unknown error'}`);
    }

    // Calculate subscription dates
    const today = new Date();
    const paidUntil = new Date(today);
    paidUntil.setMonth(paidUntil.getMonth() + duration_months);

    // Check if user already has a subscription
    const { data: existingSubscription } = await supabaseService
      .from('subscriptions')
      .select('id, paid_until')
      .eq('user_id', user.id)
      .single();

    let subscriptionResult;

    if (existingSubscription) {
      // Extend existing subscription
      const currentPaidUntil = new Date(existingSubscription.paid_until);
      const extendFrom = currentPaidUntil > today ? currentPaidUntil : today;
      const newPaidUntil = new Date(extendFrom);
      newPaidUntil.setMonth(newPaidUntil.getMonth() + duration_months);

      subscriptionResult = await supabaseService
        .from('subscriptions')
        .update({
          paid_until: newPaidUntil.toISOString().split('T')[0],
          is_active: false, // Will be activated via webhook
          last_payment_txn_id: txnId,
          payment_id: rupantorPayResult.payment_id || `rupantorpay_${txnId}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id)
        .select()
        .single();
    } else {
      // Create new subscription
      subscriptionResult = await supabaseService
        .from('subscriptions')
        .insert({
          user_id: user.id,
          amount: subscriptionAmount,
          paid_until: paidUntil.toISOString().split('T')[0],
          is_active: false, // Will be activated via webhook
          last_payment_txn_id: txnId,
          payment_id: rupantorPayResult.payment_id || `rupantorpay_${txnId}`,
          status: 'pending'
        })
        .select()
        .single();
    }

    if (subscriptionResult.error) {
      console.error('Error creating/updating subscription:', subscriptionResult.error);
      return new Response(
        JSON.stringify({ error: "Failed to process subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user's subscription status
    const { error: userUpdateError } = await supabaseService
      .from('users')
      .update({
        subscription_status: 'active',
        subscription_expires_at: paidUntil.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (userUpdateError) {
      console.error('Error updating user subscription status:', userUpdateError);
    }

    console.log('Subscription processed successfully:', {
      subscription_id: subscriptionResult.data.id,
      txn_id: txnId,
      amount: subscriptionAmount,
      user_id: user.id,
      paid_until: paidUntil
    });

    return new Response(
      JSON.stringify({
        success: true,
        txn_id: txnId,
        subscription_id: subscriptionResult.data.id,
        amount: subscriptionAmount,
        payment_url: rupantorPayResult.payment_url,
        message: "Subscription payment initiated, redirecting to payment gateway"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error('Error processing subscription:', error);
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