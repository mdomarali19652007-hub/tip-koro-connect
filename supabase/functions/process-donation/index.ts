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

    // Generate dummy transaction ID
    const txnId = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    console.log('Processing dummy donation:', {
      creator_id,
      amount,
      donor_name: is_anonymous ? '[ANONYMOUS]' : donor_name,
      txn_id: txnId
    });

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

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
        payment_status: 'completed', // Dummy payment always succeeds
        txn_id: txnId,
        payment_id: `dummy_payment_${txnId}`
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

    // Update creator's current amount
    const { error: updateError } = await supabaseService
      .from('users')
      .update({ 
        current_amount: supabaseService.sql`current_amount + ${amount}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', creator_id);

    if (updateError) {
      console.error('Error updating creator balance:', updateError);
      // Note: In a real implementation, you'd want to handle this more carefully
      // Perhaps with database transactions or compensation logic
    }

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
        message: "Donation processed successfully"
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