import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateCheckoutRequest {
  bookingId: string;
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
    // ✅ 1. VERIFICA AUTENTICAZIONE
    console.log('[STRIPE CHECKOUT] 🔐 Step 1: Verifying authentication');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[STRIPE CHECKOUT] ❌ No authorization header');
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
    console.log('[STRIPE CHECKOUT] 🔑 Token extracted, length:', token.length);
    
    // Initialize Supabase client for JWT verification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUP_PUB_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[STRIPE CHECKOUT] ❌ Authentication failed:', {
        authError: authError?.message,
        hasUser: !!user
      });
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

    console.log('[STRIPE CHECKOUT] ✅ User authenticated:', {
      userId: user.id,
      email: user.email
    });

    // ✅ 2. VALIDA INPUT
    console.log('[STRIPE CHECKOUT] 📝 Step 2: Validating input');
    const { bookingId }: CreateCheckoutRequest = await req.json();
    
    if (!bookingId) {
      return new Response(JSON.stringify({ 
        error: 'bookingId è obbligatorio',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUP_SECR_KEY') ?? ''
    );

    // Get booking with details
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, user_id, price_total, cart, status')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ 
        error: 'Prenotazione non trovata',
        success: false 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 3. VERIFICA OWNERSHIP - Il booking deve appartenere all'utente autenticato
    console.log('[STRIPE CHECKOUT] 🔒 Step 3: Verifying booking ownership');
    if (booking.user_id !== user.id) {
      console.error('[STRIPE CHECKOUT] ❌ Unauthorized access attempt:', {
        authenticatedUserId: user.id,
        bookingUserId: booking.user_id,
        bookingId: bookingId
      });
      return new Response(JSON.stringify({ 
        error: 'Non autorizzato ad accedere a questa prenotazione',
        success: false 
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    console.log('[STRIPE CHECKOUT] ✅ Booking ownership verified');

    // Verify booking is in cart
    if (!booking.cart) {
      return new Response(JSON.stringify({ 
        error: 'Questa prenotazione non è nel carrello',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Verify booking status is valid for checkout (cart or paymentError to allow retry)
    if (booking.status !== 'cart' && booking.status !== 'paymentError') {
      return new Response(JSON.stringify({ 
        error: `Impossibile procedere al pagamento: lo stato della prenotazione è '${booking.status}'`,
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Get booking details to build line items
    const { data: bookingDetails, error: detailsError } = await supabaseAdmin
      .from('booking_details')
      .select(`
        id,
        unit_id,
        price,
        start_date,
        end_date,
        product_units!inner(
          id,
          id_product_variant,
          product_variants!inner(
            id_product,
            products!inner(
              id,
              name
            )
          )
        )
      `)
      .eq('booking_id', bookingId);

    if (detailsError || !bookingDetails || bookingDetails.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Dettagli prenotazione non trovati',
        success: false 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Get user email for Stripe
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', booking.user_id)
      .single();

    const userEmail = profile?.email || null;
    const userName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null;

    // Get Stripe secret key
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('[STRIPE] STRIPE_SECRET_KEY not found in environment variables');
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

    // Get shop settings for base URL
    const { data: shopSettings } = await supabaseAdmin
      .from('shop_settings')
      .select('base_url')
      .maybeSingle();

    // Get base URL for success/cancel URLs
    const baseUrl = (shopSettings?.base_url || 'https://noleggioscicerreto.it/').replace(/\/$/, ''); // Remove trailing slash
    const successUrl = `${baseUrl}/payment-processing?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/cart?canceled=true`;

    // Build line items for Stripe (formato URL-encoded)
    const lineItemsParams: string[] = [];
    bookingDetails.forEach((detail: any, index: number) => {
      const productName = detail.product_units?.product_variants?.products?.name || 'Prodotto';
      const startDate = new Date(detail.start_date).toLocaleDateString('it-IT');
      const endDate = new Date(detail.end_date).toLocaleDateString('it-IT');
      const unitAmount = Math.round(Number(detail.price) * 100); // Convert to cents
      
      lineItemsParams.push(`line_items[${index}][price_data][currency]=eur`);
      lineItemsParams.push(`line_items[${index}][price_data][product_data][name]=${encodeURIComponent(`${productName} (${startDate} - ${endDate})`)}`);
      lineItemsParams.push(`line_items[${index}][price_data][product_data][description]=${encodeURIComponent(`Noleggio dal ${startDate} al ${endDate}`)}`);
      lineItemsParams.push(`line_items[${index}][price_data][unit_amount]=${unitAmount}`);
      lineItemsParams.push(`line_items[${index}][quantity]=1`);
    });

    // Build request body
    const bodyParams = new URLSearchParams();
    bodyParams.append('mode', 'payment');
    bodyParams.append('success_url', successUrl);
    bodyParams.append('cancel_url', cancelUrl);
    
    // Add line items
    bookingDetails.forEach((detail: any, index: number) => {
      const productName = detail.product_units?.product_variants?.products?.name || 'Prodotto';
      const startDate = new Date(detail.start_date).toLocaleDateString('it-IT');
      const endDate = new Date(detail.end_date).toLocaleDateString('it-IT');
      const unitAmount = Math.round(Number(detail.price) * 100);
      
      bodyParams.append(`line_items[${index}][price_data][currency]`, 'eur');
      bodyParams.append(`line_items[${index}][price_data][product_data][name]`, `${productName} (${startDate} - ${endDate})`);
      bodyParams.append(`line_items[${index}][price_data][product_data][description]`, `Noleggio dal ${startDate} al ${endDate}`);
      bodyParams.append(`line_items[${index}][price_data][unit_amount]`, unitAmount.toString());
      bodyParams.append(`line_items[${index}][quantity]`, '1');
    });
    
    if (userEmail) {
      bodyParams.append('customer_email', userEmail);
    }
    
    bodyParams.append('metadata[booking_id]', bookingId);
    bodyParams.append('metadata[user_id]', booking.user_id);
    bodyParams.append('payment_intent_data[metadata][booking_id]', bookingId);
    bodyParams.append('payment_intent_data[metadata][user_id]', booking.user_id);

    // Create Stripe Checkout Session
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      console.error('[STRIPE] Error creating checkout session:', errorText);
      return new Response(JSON.stringify({ 
        error: 'Errore nella creazione della sessione di pagamento',
        success: false 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const checkoutSession = await stripeResponse.json();

    // Save checkout session ID to booking
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ stripe_checkout_session_id: checkoutSession.id })
      .eq('id', bookingId);

    if (updateError) {
      console.error('[STRIPE] Error updating booking with checkout session ID:', updateError);
      // Don't fail the request, but log the error
    }

    return new Response(JSON.stringify({ 
      success: true,
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('[STRIPE] Error in create-stripe-checkout:', error);
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
        },
      }
    );
  }
};

serve(handler);

