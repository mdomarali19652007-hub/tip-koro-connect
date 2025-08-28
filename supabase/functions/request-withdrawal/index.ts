import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WithdrawalRequest {
  amount: number;
  method: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
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

    const { amount, method, bank_name, bank_account_name, bank_account_number }: WithdrawalRequest = await req.json();

    // Validate input
    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid withdrawal amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase service client for database operations
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if user is a creator and has sufficient balance
    const { data: userProfile } = await supabaseService
      .from('users')
      .select('role, current_amount')
      .eq('id', user.id)
      .single();

    if (!userProfile || userProfile.role !== 'creator') {
      return new Response(
        JSON.stringify({ error: "Only creators can request withdrawals" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userProfile.current_amount < amount) {
      return new Response(
        JSON.stringify({ 
          error: "Insufficient balance",
          available_balance: userProfile.current_amount
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create withdrawal request
    const { data: withdrawal, error: withdrawalError } = await supabaseService
      .from('withdrawals')
      .insert({
        user_id: user.id,
        amount,
        method,
        bank_name,
        bank_account_name,
        bank_account_number,
        status: 'pending'
      })
      .select()
      .single();

    if (withdrawalError) {
      console.error('Error creating withdrawal request:', withdrawalError);
      return new Response(
        JSON.stringify({ error: "Failed to create withdrawal request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct amount from user balance (hold it until processed)
    const { error: updateError } = await supabaseService
      .from('users')
      .update({ 
        current_amount: supabaseService.sql`current_amount - ${amount}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user balance:', updateError);
      // Rollback withdrawal creation if balance update fails
      await supabaseService
        .from('withdrawals')
        .delete()
        .eq('id', withdrawal.id);
      
      return new Response(
        JSON.stringify({ error: "Failed to process withdrawal request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Withdrawal request created successfully:', {
      withdrawal_id: withdrawal.id,
      user_id: user.id,
      amount
    });

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_id: withdrawal.id,
        message: "Withdrawal request submitted successfully"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error('Error processing withdrawal request:', error);
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