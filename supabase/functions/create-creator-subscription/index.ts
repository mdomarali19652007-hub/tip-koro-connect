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

    // Generate dummy transaction ID
    const txnId = `SUB_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const subscriptionAmount = 100 * duration_months; // 100 BDT per month

    console.log('Processing creator subscription:', {
      user_id: user.id,
      amount: subscriptionAmount,
      duration_months,
      txn_id: txnId
    });

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

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
          is_active: true,
          last_payment_txn_id: txnId,
          payment_id: `dummy_payment_${txnId}`,
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
          is_active: true,
          last_payment_txn_id: txnId,
          payment_id: `dummy_payment_${txnId}`,
          status: 'active'
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
        paid_until: paidUntil.toISOString().split('T')[0],
        message: "Subscription processed successfully"
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