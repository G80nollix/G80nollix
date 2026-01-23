import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GetSessionRequest {
  sessionId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      error: 'Metodo non consentito',
      success: false 
    }), { 
      status: 405, 
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });
  }

  try {
    // Extract and verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ 
        error: 'Autenticazione richiesta',
        success: false 
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the token with Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Autenticazione richiesta',
        success: false 
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const { sessionId }: GetSessionRequest = await req.json();
    
    if (!sessionId) {
      return new Response(JSON.stringify({ 
        error: 'Session ID è obbligatorio',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Get Stripe secret key from environment
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('[GET-STRIPE-SESSION] STRIPE_SECRET_KEY not found in environment variables');
      return new Response(JSON.stringify({ 
        error: 'Configurazione Stripe mancante',
        success: false 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Call Stripe API to retrieve the session
    const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await stripeResponse.json();

    // Verify payment status if session was retrieved successfully
    // 
    // payment_status possibili valori per Checkout Sessions:
    // - 'paid': Pagamento completato con successo ✅
    // - 'unpaid': Pagamento non ancora completato (sessione aperta)
    // - 'no_payment_required': Nessun pagamento richiesto (es. coupon 100%, trial gratuito)
    //
    // status possibili valori per Checkout Sessions:
    // - 'complete': Sessione completata
    // - 'open': Sessione ancora aperta (pagamento in corso)
    // - 'expired': Sessione scaduta
    //
    let isPaymentCompleted = false;
    if (stripeResponse.ok && data) {
      // Payment is completed only if:
      // 1. payment_status is 'paid' (payment was successful)
      // 2. status is 'complete' (session is completed)
      isPaymentCompleted = 
        data.payment_status === 'paid' && 
        data.status === 'complete';
    }

    // Always return 200, but include the Stripe status in the body
    // This allows the frontend to properly read error details even for 429 errors
    return new Response(JSON.stringify({
      success: stripeResponse.ok,
      status: stripeResponse.status,
      statusText: stripeResponse.statusText,
      data: data,
      isPaymentCompleted: isPaymentCompleted, // ✅ Verifica esplicita del pagamento
      headers: {
        'retry-after': stripeResponse.headers.get('retry-after'),
      }
    }), {
      status: 200, // Always return 200 so frontend can read the body
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('[GET-STRIPE-SESSION] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Errore interno del server',
        success: false 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        }
      }
    );
  }
};

serve(handler);

