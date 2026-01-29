import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckPaymentRequest {
  sessionId: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('[CHECK-AND-CONFIRM-PAYMENT] 🚀 Function called', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[CHECK-AND-CONFIRM-PAYMENT] ✅ CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Invalid method:', req.method);
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
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 🔐 Step 1: Verifying authentication');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ No authorization header');
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
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 🔑 Token extracted, length:', token.length);
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUP_PUB_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Authentication failed:', {
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

    console.log('[CHECK-AND-CONFIRM-PAYMENT] ✅ User authenticated:', {
      userId: user.id,
      email: user.email
    });

    // ✅ 2. VALIDA INPUT
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📝 Step 2: Validating input');
    const { sessionId }: CheckPaymentRequest = await req.json();
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📋 Received sessionId:', sessionId);
    
    if (!sessionId) {
      console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Session ID missing');
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

    // ✅ 3. VALIDAZIONE FORMATO SESSION ID
    const isValidFormat = /^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId);
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 🔍 Session ID format validation:', isValidFormat);
    if (!isValidFormat) {
      console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Invalid session ID format');
      return new Response(JSON.stringify({ 
        error: 'Session ID non valido',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 4. INIZIALIZZA SUPABASE ADMIN
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 🔧 Step 4: Initializing Supabase Admin client');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUP_SECR_KEY') ?? ''
    );

    // ✅ 5. VERIFICA SE IL DATABASE È GIÀ AGGIORNATO (ottimizzazione)
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 🔍 Step 5: Checking if booking already exists in database');
    const { data: existingBooking, error: bookingCheckError } = await supabaseAdmin
      .from('bookings')
      .select('id, user_id, cart, status, rifPrenotazione')
      .eq('stripe_checkout_session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📊 Database check result:', {
      hasBooking: !!existingBooking,
      bookingError: bookingCheckError?.message,
      bookingStatus: existingBooking?.status,
      bookingCart: existingBooking?.cart,
      bookingId: existingBooking?.id
    });

    // Se già confermato, restituisci subito
    if (existingBooking && existingBooking.status === 'confirmed' && existingBooking.cart === false) {
      console.log('[CHECK-AND-CONFIRM-PAYMENT] ✅ Booking already confirmed in database, returning early');
      const earlyExitResponse = {
        success: true,
        isPaymentCompleted: true,
        confirmed: true,
        source: 'database',
        paymentIntentStatus: 'succeeded', // Assumiamo che se è confirmed, il PaymentIntent è succeeded
        bookingStatus: 'confirmed',
        booking: {
          id: existingBooking.id,
          status: existingBooking.status,
          rifPrenotazione: existingBooking.rifPrenotazione,
        }
      };
      console.log('[CHECK-AND-CONFIRM-PAYMENT] 📤 Returning response (early exit):', {
        success: earlyExitResponse.success,
        isPaymentCompleted: earlyExitResponse.isPaymentCompleted,
        confirmed: earlyExitResponse.confirmed,
        source: earlyExitResponse.source,
        paymentIntentStatus: earlyExitResponse.paymentIntentStatus,
        bookingStatus: earlyExitResponse.bookingStatus,
        bookingId: earlyExitResponse.booking.id
      });
      return new Response(JSON.stringify(earlyExitResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 6. CHIAMA STRIPE API PER VERIFICARE IL PAGAMENTO
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 💳 Step 6: Calling Stripe API');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ STRIPE_SECRET_KEY not found');
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

    // ✅ 6.1. Recupera Checkout Session per ottenere PaymentIntent ID
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📞 Step 6.1: Fetching Checkout Session from Stripe');
    const stripeSessionResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📥 Checkout Session response:', {
      status: stripeSessionResponse.status,
      ok: stripeSessionResponse.ok
    });

    if (!stripeSessionResponse.ok) {
      const errorData = await stripeSessionResponse.json().catch(() => ({}));
      console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Error retrieving Checkout Session:', {
        status: stripeSessionResponse.status,
        error: errorData
      });
      return new Response(JSON.stringify({
        success: false,
        error: 'Errore nel recupero della Checkout Session',
        message: 'Qualcosa è andato storto durante la verifica del pagamento'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const sessionData = await stripeSessionResponse.json();
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📋 Checkout Session data:', {
      id: sessionData.id,
      status: sessionData.status,
      payment_status: sessionData.payment_status,
      payment_intent: sessionData.payment_intent,
      payment_intent_type: typeof sessionData.payment_intent
    });

    // ✅ 6.2. Estrai PaymentIntent ID dalla Checkout Session
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 🔍 Step 6.2: Extracting PaymentIntent ID');
    const paymentIntentId = typeof sessionData.payment_intent === 'string' 
      ? sessionData.payment_intent 
      : sessionData.payment_intent?.id || sessionData.payment_intent;

    console.log('[CHECK-AND-CONFIRM-PAYMENT] 🆔 PaymentIntent ID extracted:', {
      paymentIntentId,
      hasPaymentIntent: !!paymentIntentId,
      originalType: typeof sessionData.payment_intent,
      isString: typeof sessionData.payment_intent === 'string',
      isObject: typeof sessionData.payment_intent === 'object'
    });

    // ✅ 6.3. VERIFICA: Se non c'è PaymentIntent, restituisci errore
    if (!paymentIntentId) {
      console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ PaymentIntent non disponibile nella Checkout Session');
      console.error('[CHECK-AND-CONFIRM-PAYMENT] 📊 Session data for debugging:', {
        payment_intent: sessionData.payment_intent,
        payment_intent_type: typeof sessionData.payment_intent
      });
      return new Response(JSON.stringify({
        success: false,
        error: 'PaymentIntent non disponibile',
        message: 'Qualcosa è andato storto durante la verifica del pagamento'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 6.4. Recupera PaymentIntent object da Stripe
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📞 Step 6.4: Fetching PaymentIntent from Stripe');
    let paymentIntent;
    try {
      const paymentIntentResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      console.log('[CHECK-AND-CONFIRM-PAYMENT] 📥 PaymentIntent response:', {
        status: paymentIntentResponse.status,
        ok: paymentIntentResponse.ok
      });

      if (!paymentIntentResponse.ok) {
        const errorData = await paymentIntentResponse.json().catch(() => ({}));
        console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Error retrieving PaymentIntent:', {
          status: paymentIntentResponse.status,
          error: errorData
        });
        return new Response(JSON.stringify({
          success: false,
          error: 'Errore nel recupero del PaymentIntent',
          message: 'Qualcosa è andato storto durante la verifica del pagamento'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      paymentIntent = await paymentIntentResponse.json();
      console.log('[CHECK-AND-CONFIRM-PAYMENT] ✅ PaymentIntent retrieved:', {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      });
      console.log('[CHECK-AND-CONFIRM-PAYMENT] 💾 Saving PaymentIntent ID to booking:', paymentIntent.id);
    } catch (error) {
      console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Exception accessing PaymentIntent:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'PaymentIntent non accessibile',
        message: 'Qualcosa è andato storto durante la verifica del pagamento'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 6.5. Determina lo status da aggiornare in base al PaymentIntent status
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 🎯 Step 6.5: Determining booking status from PaymentIntent');
    let newBookingStatus: string;
    switch (paymentIntent.status) {
      case 'canceled':
        newBookingStatus = 'cancelled';
        break;
      case 'processing':
        newBookingStatus = 'inPayment';
        break;
      case 'succeeded':
        newBookingStatus = 'confirmed';
        break;
      default:
        // Per tutti gli altri stati (requires_payment_method, requires_confirmation, requires_action, requires_capture, ecc.)
        newBookingStatus = 'inPayment';
    }
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📊 Status mapping:', {
      paymentIntentStatus: paymentIntent.status,
      newBookingStatus,
      existingBookingStatus: existingBooking?.status
    });

    // ✅ 7. PAGAMENTO CONFERMATO: TROVA LA PRENOTAZIONE
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 🔍 Step 7: Finding booking in database');
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, user_id, cart, status, rifPrenotazione')
      .eq('stripe_checkout_session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📊 Booking lookup result:', {
      hasBooking: !!booking,
      bookingError: bookingError?.message,
      bookingId: booking?.id,
      bookingStatus: booking?.status,
      bookingCart: booking?.cart
    });

    if (bookingError || !booking) {
      console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Booking not found:', bookingError);
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

    // ✅ 7. AGGIORNA IL DATABASE in base allo status del PaymentIntent
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 💾 Step 7: Updating database');
    let updatedBooking = existingBooking;
    // Aggiorna sempre se lo status è diverso o se cart è ancora true
    const needsUpdate = !existingBooking || 
                       existingBooking.status !== newBookingStatus || 
                       existingBooking.cart !== false;

    console.log('[CHECK-AND-CONFIRM-PAYMENT] 🔄 Update check:', {
      needsUpdate,
      hasExistingBooking: !!existingBooking,
      statusChanged: existingBooking?.status !== newBookingStatus,
      cartStillTrue: existingBooking?.cart !== false,
      currentStatus: existingBooking?.status,
      newStatus: newBookingStatus,
      currentCart: existingBooking?.cart
    });

    if (needsUpdate) {
      console.log('[CHECK-AND-CONFIRM-PAYMENT] 📝 Updating booking with:', {
        cart: false,
        status: newBookingStatus,
        stripe_payment_intent_id: paymentIntent.id,
        bookingId: booking.id
      });
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({ 
          cart: false,
          status: newBookingStatus,
          stripe_checkout_session_id: sessionId,
          stripe_payment_intent_id: paymentIntent.id,
          terms_accepted: new Date().toISOString(),
        })
        .eq('id', booking.id)
        .select('id, cart, status, rifPrenotazione, stripe_payment_intent_id')
        .single();

      if (updateError) {
        console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Error updating booking:', updateError);
        return new Response(JSON.stringify({ 
          error: 'Errore nell\'aggiornamento della prenotazione',
          success: false 
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      console.log('[CHECK-AND-CONFIRM-PAYMENT] ✅ Booking updated successfully:', {
        id: updated.id,
        status: updated.status,
        cart: updated.cart
      });
      updatedBooking = updated;
      
      // ✅ Aggiorna booking_details solo se status è 'confirmed' E è stato fatto un update
      if (newBookingStatus === 'confirmed') {
        console.log('[CHECK-AND-CONFIRM-PAYMENT] 📦 Updating booking_details status to toPickup');
        const { error: detailsUpdateError } = await supabaseAdmin
          .from('booking_details')
          .update({ 
            status: 'toPickup'
          })
          .eq('booking_id', booking.id);

        if (detailsUpdateError) {
          console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Error updating booking_details:', detailsUpdateError);
          // Non bloccare il flusso, ma loggare l'errore
        } else {
          console.log('[CHECK-AND-CONFIRM-PAYMENT] ✅ Booking details updated successfully to toPickup');
        }
      }
    } else {
      console.log('[CHECK-AND-CONFIRM-PAYMENT] ⏭️ No update needed, using existing booking');
      // ✅ NON aggiornare booking_details nell'early exit - sono già aggiornati
    }

    // ✅ 8. INVIA EMAIL DI CONFERMA (solo se status è succeeded e appena aggiornato)
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📧 Step 8: Checking if email should be sent');
    let emailSent = false;
    const shouldSendEmail = paymentIntent.status === 'succeeded' && (!existingBooking || existingBooking.status !== 'confirmed');
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📧 Email check:', {
      paymentIntentStatus: paymentIntent.status,
      shouldSendEmail,
      hasExistingBooking: !!existingBooking,
      existingStatus: existingBooking?.status
    });
    if (shouldSendEmail) {
      console.log('[CHECK-AND-CONFIRM-PAYMENT] 📧 Sending confirmation email');
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('id', user.id)
          .single();

        const { data: bookingDetails } = await supabaseAdmin
          .from('booking_details')
          .select(`
            id,
            price,
            start_date,
            end_date,
            product_units!inner(
              id_product_variant,
              product_variants!inner(
                id_product,
                products!inner(
                  id,
                  name,
                  product_brand:product_brand(id, name),
                  product_model:product_model(id, name)
                )
              )
            )
          `)
          .eq('booking_id', booking.id);

        const { data: bookingWithRef } = await supabaseAdmin
          .from('bookings')
          .select('rifPrenotazione')
          .eq('id', booking.id)
          .single();

        // Get shop settings for email personalization
        const { data: shopSettings } = await supabaseAdmin
          .from('shop_settings')
          .select('nome_negozio, base_url, shopIcon_url')
          .maybeSingle();

        const shopName = shopSettings?.nome_negozio || 'Nollix';
        const baseUrl = shopSettings?.base_url || '';
        let shopIconUrl = shopSettings?.shopIcon_url || '';
        
        // Validate shopIconUrl - must be a public URL (not localhost)
        if (shopIconUrl) {
          const urlLower = shopIconUrl.toLowerCase();
          if (urlLower.includes('localhost') || 
              urlLower.includes('127.0.0.1') || 
              urlLower.includes('0.0.0.0') ||
              (!urlLower.startsWith('http://') && !urlLower.startsWith('https://'))) {
            console.warn('[CHECK-AND-CONFIRM-PAYMENT] Invalid shopIcon_url (contains localhost or invalid):', shopIconUrl);
            shopIconUrl = '';
          }
        }
        
        const logoUrl = shopIconUrl || 'https://demo.nollix.it/Nollix_favicon.png';

        // Get shop days off for closed day warnings
        const { data: shopDaysOffData } = await supabaseAdmin
          .from('shop_days_off')
          .select('date_from, date_to, enable_booking');

        // Helper function to extract date part (YYYY-MM-DD) from timestamptz string
        const extractDatePart = (timestamptz: string): string => {
          if (timestamptz.includes('T')) {
            return timestamptz.split('T')[0];
          }
          return timestamptz.substring(0, 10);
        };

        // Helper function to create local Date from YYYY-MM-DD string
        const createLocalDate = (dateStr: string): Date => {
          const parts = dateStr.split('-');
          return new Date(
            parseInt(parts[0]), 
            parseInt(parts[1]) - 1, 
            parseInt(parts[2])
          );
        };

        // Helper function to format date as dd/MM/yyyy
        const formatDate = (date: Date): string => {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        };

        if (profile && bookingDetails && bookingWithRef) {
          const userEmail = profile.email;
          const userFirstName = profile.first_name || 'Utente';
          const userLastName = profile.last_name || '';
          const totalPrice = bookingDetails.reduce((sum: number, d: any) => sum + Number(d.price || 0), 0);
          const bookingRef = bookingWithRef.rifPrenotazione || booking.id.substring(0, 8).toUpperCase();

          // Build products list HTML
          const productsList = bookingDetails.map((detail: any) => {
            const product = detail.product_units?.product_variants?.products;
            
            // Extract date parts from timestamptz and create local dates
            const startDateStr = extractDatePart(detail.start_date);
            const endDateStr = extractDatePart(detail.end_date);
            const startDateObj = createLocalDate(startDateStr);
            const endDateObj = createLocalDate(endDateStr);
            
            const startDate = startDateObj.toLocaleDateString('it-IT', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            const endDate = endDateObj.toLocaleDateString('it-IT', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });

            // Check if end_date has enable_booking=true (shop closed)
            let closedDayWarning = '';
            if (shopDaysOffData && shopDaysOffData.length > 0) {
              const isShopClosed = shopDaysOffData.some((dayOff: any) => {
                if (!dayOff.enable_booking) return false;
                
                const dateFrom = createLocalDate(dayOff.date_from);
                const dateTo = createLocalDate(dayOff.date_to);
                
                dateFrom.setHours(0, 0, 0, 0);
                dateTo.setHours(0, 0, 0, 0);
                endDateObj.setHours(0, 0, 0, 0);
                
                return endDateObj >= dateFrom && endDateObj <= dateTo;
              });
              
              if (isShopClosed) {
                const nextDay = new Date(endDateObj);
                nextDay.setDate(nextDay.getDate() + 1);
                const endDateFormatted = formatDate(endDateObj);
                const nextDayFormatted = formatDate(nextDay);
                
                closedDayWarning = `
                  <div style="background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 6px; padding: 15px; margin-top: 15px;">
                    <p style="margin: 0; color: #856404; font-size: 14px; font-weight: 600; line-height: 1.5;">
                      ⚠️ <strong>ATTENZIONE:</strong> Il <strong>${endDateFormatted}</strong> il negozio sarà chiuso, pertanto la riconsegna del prodotto dovrà avvenire il giorno successivo (<strong>${nextDayFormatted}</strong>), con il prezzo calcolato sui giorni di prenotazione selezionati.
                    </p>
                  </div>
                `;
              }
            }

            return `
              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 15px; background-color: #f9fafb;">
                <div style="font-weight: 600; color: #333; margin-bottom: 10px;">${product?.name || 'Prodotto'}</div>
                <div style="color: #666; font-size: 14px; margin-bottom: 5px;">Data inizio: ${startDate}</div>
                <div style="color: #666; font-size: 14px; margin-bottom: 5px;">Data fine: ${endDate}</div>
                <div style="color: #16a34a; font-weight: 600; font-size: 16px; margin-top: 10px;">Prezzo: €${Number(detail.price || 0).toFixed(2)}</div>
                ${closedDayWarning}
              </div>
            `;
          }).join('');

          // Build email HTML
          const customerEmailHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Prenotazione Confermata - ${shopName}</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                  .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                  .header { background-color: #ffffff; padding: 40px 20px; text-align: center; }
                  .logo { width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; }
                  .header-title { color: #333; font-size: 28px; font-weight: bold; margin: 0; }
                  .content { padding: 40px 20px; }
                  .welcome-text { font-size: 18px; color: #333; margin-bottom: 30px; }
                  .price-box { background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; padding: 15px; margin: 20px 0; }
                  .price-text { color: #856404; font-size: 16px; font-weight: bold; margin: 0; }
                  .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    ${logoUrl && logoUrl !== '#' ? '<div class="logo" style="width: 60px; height: 60px; background-color: transparent; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto;"><img src="' + logoUrl + '" alt="' + shopName + ' Logo" style="width: 60px; height: 60px; object-fit: contain; display: block; border: 0; outline: none; text-decoration: none; margin: 0 auto;" width="60" height="60"></div>' : ''}
                    <h1 class="header-title">Prenotazione Confermata!</h1>
                  </div>
                  <div class="content">
                    <p class="welcome-text">Ciao <strong>${userFirstName} ${userLastName}</strong>,</p>
                    <p>La tua prenotazione è stata confermata e il pagamento è stato completato con successo!</p>
                    <p><strong>Riferimento prenotazione: ${bookingRef}</strong></p>
                    ${productsList}
                    <div class="price-box">
                      <p class="price-text">💰 Importo totale pagato: €${totalPrice.toFixed(2)}</p>
                    </div>
                    <p>Grazie per aver scelto ${shopName}!</p>
                  </div>
                  <div class="footer">
                    ${baseUrl ? `<p style="color: #666; font-size: 14px; margin-bottom: 10px;"><a href="${baseUrl}" style="color: #2563eb; text-decoration: none;">Visita ${shopName}</a></p>` : ''}
                    <p style="color: #666; font-size: 14px; margin: 0;">Questo è un messaggio automatico.</p>
                  </div>
                </div>
              </body>
            </html>
          `;

          await supabaseAdmin.functions.invoke('send-email', {
            method: 'POST',
            body: {
              to: userEmail,
              subject: `Prenotazione Confermata - ${shopName} - #${bookingRef}`,
              html: customerEmailHtml,
            },
          });
          console.log('[CHECK-AND-CONFIRM-PAYMENT] ✅ Customer confirmation email sent to:', userEmail);

          // ✅ INVIA EMAIL AGLI ADMIN SUBITO DOPO QUELLA ALL'UTENTE
          // L'email agli admin viene sempre inviata quando viene inviata quella all'utente
          console.log('[CHECK-AND-CONFIRM-PAYMENT] 📧 Now sending notification email to all administrators...');
          // Send notification email to all administrators
          try {
            console.log('[CHECK-AND-CONFIRM-PAYMENT] 📧 Fetching admin users...');
            const { data: adminUsers, error: adminError } = await supabaseAdmin
              .from('profiles')
              .select('email, first_name, last_name')
              .eq('user_type', 'admin');

            console.log('[CHECK-AND-CONFIRM-PAYMENT] 📧 Admin users query result:', {
              hasError: !!adminError,
              error: adminError?.message,
              adminCount: adminUsers?.length || 0,
              adminEmails: adminUsers?.map((a: any) => a.email) || []
            });

            if (adminError) {
              console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Error fetching admin users:', adminError);
            } else if (adminUsers && adminUsers.length > 0) {
              console.log('[CHECK-AND-CONFIRM-PAYMENT] ✅ Found', adminUsers.length, 'admin users, preparing email...');
              // Build admin products list HTML
              const adminProductsList = bookingDetails.map((detail: any) => {
                const product = detail.product_units?.product_variants?.products;
                
                const startDateStr = extractDatePart(detail.start_date);
                const endDateStr = extractDatePart(detail.end_date);
                const startDateObj = createLocalDate(startDateStr);
                const endDateObj = createLocalDate(endDateStr);
                
                const startDate = startDateObj.toLocaleDateString('it-IT', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
                const endDate = endDateObj.toLocaleDateString('it-IT', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });

                return `
                  <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 15px; background-color: #f9fafb;">
                    <div style="font-weight: 600; color: #333; margin-bottom: 10px;">${product?.name || 'Prodotto'}</div>
                    <div style="color: #666; font-size: 14px; margin-bottom: 5px;">Data inizio: ${startDate}</div>
                    <div style="color: #666; font-size: 14px; margin-bottom: 5px;">Data fine: ${endDate}</div>
                    <div style="color: #16a34a; font-weight: 600; font-size: 16px; margin-top: 10px;">Prezzo: €${Number(detail.price || 0).toFixed(2)}</div>
                  </div>
                `;
              }).join('');

              // Build admin booking URL using base_url
              // Ensure baseUrl ends with / for proper URL construction
              const normalizedBaseUrl = baseUrl ? (baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`) : '';
              const adminBookingUrl = normalizedBaseUrl ? `${normalizedBaseUrl}admin/bookings/${booking.id}` : `#`;
              
              console.log('[CHECK-AND-CONFIRM-PAYMENT] Admin email - Logo URL:', { logoUrl, adminBookingUrl });

              // Create admin notification email (same style as stripe-webhook)
              const adminEmailHtml = `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Nuova Prenotazione - ${shopName}</title>
                    <style>
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff; }
                      .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                      .header { background-color: #ffffff; padding: 40px 20px; text-align: center; }
                      .logo-container { display: flex; justify-content: center; align-items: center; margin-bottom: 20px; }
                      .logo { display: block; margin: 0 auto; }
                      .header-title { color: #333; font-size: 28px; font-weight: bold; margin: 0; }
                      .header-subtitle { color: #666; font-size: 16px; margin: 10px 0 0 0; }
                      .content { padding: 40px 20px; }
                      .welcome-text { font-size: 18px; color: #333; margin-bottom: 30px; }
                      .booking-details { background-color: #f8f9fa; border-left: 4px solid #16a34a; padding: 20px; margin: 30px 0; border-radius: 4px; }
                      .detail-item { margin-bottom: 10px; }
                      .detail-label { font-weight: 600; color: #666; }
                      .booking-ref { font-family: 'Courier New', monospace; background-color: #e9ecef; padding: 8px 12px; border-radius: 4px; display: inline-block; font-weight: bold; }
                      .price-box { background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; padding: 15px; margin: 20px 0; }
                      .price-text { color: #856404; font-size: 16px; font-weight: bold; margin: 0; }
                      .button { display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #2563eb 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
                      .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        ${logoUrl && logoUrl !== '#' ? `
                        <div class="logo-container">
                          <img src="${logoUrl}" alt="${shopName} Logo" class="logo" style="width: 80px; height: 80px; object-fit: contain; display: block; border: 0; outline: none; text-decoration: none; margin: 0 auto;" width="80" height="80">
                        </div>
                        ` : ''}
                        <h1 class="header-title">📋 Nuova Prenotazione</h1>
                      </div>
                      
                      <div class="content">
                        <p class="welcome-text">
                          È stata confermata una nuova prenotazione
                        </p>
                        
                        <div class="booking-details">
                          <div class="detail-item">
                            <span class="detail-label">Riferimento:</span>
                            <span class="booking-ref">${bookingRef}</span>
                          </div>
                          <div class="detail-item">
                            <span class="detail-label">Cliente:</span> ${userFirstName} ${userLastName}
                          </div>
                          <div class="detail-item">
                            <span class="detail-label">Email:</span> ${userEmail}
                          </div>
                        </div>
                        
                        <h3>Prodotti prenotati:</h3>
                        ${adminProductsList}
                        
                        <div class="price-box">
                          <p class="price-text">💰 Totale: €${totalPrice.toFixed(2)}</p>
                        </div>
                        
                        <a href="${adminBookingUrl}" class="button">Vai alla Prenotazione</a>
                      </div>
                      
                      <div class="footer">
                        <p style="color: #666; font-size: 14px; margin: 0;">
                          Questo è un messaggio automatico di notifica.
                        </p>
                      </div>
                    </div>
                  </body>
                </html>
              `;

              // Send email to each admin - sempre inviata quando viene inviata quella all'utente
              console.log('[CHECK-AND-CONFIRM-PAYMENT] 📧 Starting to send emails to', adminUsers.length, 'admins...');
              
              for (const admin of adminUsers) {
                if (admin.email) {
                  try {
                    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📧 Attempting to send email to admin:', admin.email);
                    const emailResponse = await supabaseAdmin.functions.invoke('send-email', {
                      method: 'POST',
                      body: {
                        to: admin.email,
                        subject: `🔔 Nuova Prenotazione - #${bookingRef}`,
                        html: adminEmailHtml,
                      },
                    });
                    
                    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📧 Email response status:', emailResponse.status, 'ok:', emailResponse.ok);
                    
                    if (!emailResponse.ok) {
                      const errorText = await emailResponse.text().catch(() => 'Unable to read error');
                      console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Email response not OK:', {
                        status: emailResponse.status,
                        statusText: emailResponse.statusText,
                        error: errorText
                      });
                    } else {
                      const emailResult = await emailResponse.json().catch((e) => {
                        console.error('[CHECK-AND-CONFIRM-PAYMENT] ⚠️ Error parsing email response JSON:', e);
                        return { success: false, parseError: true };
                      });
                      console.log('[CHECK-AND-CONFIRM-PAYMENT] ✅ Admin notification sent to:', admin.email, 'Response:', emailResult);
                    }
                  } catch (adminEmailError) {
                    console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Error sending admin notification to:', admin.email, {
                      error: adminEmailError,
                      message: adminEmailError instanceof Error ? adminEmailError.message : String(adminEmailError),
                      stack: adminEmailError instanceof Error ? adminEmailError.stack : undefined
                    });
                  }
                } else {
                  console.warn('[CHECK-AND-CONFIRM-PAYMENT] ⚠️ Admin user has no email:', admin);
                }
              }
              
              console.log('[CHECK-AND-CONFIRM-PAYMENT] 📧 Finished sending emails to admins');
            } else {
              console.warn('[CHECK-AND-CONFIRM-PAYMENT] ⚠️ No admin users found or empty array');
            }
          } catch (adminNotificationError) {
            console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Error in admin notification:', {
              error: adminNotificationError,
              message: adminNotificationError instanceof Error ? adminNotificationError.message : String(adminNotificationError),
              stack: adminNotificationError instanceof Error ? adminNotificationError.stack : undefined
            });
          }

          emailSent = true;
          console.log('[CHECK-AND-CONFIRM-PAYMENT] Email sent successfully to:', userEmail);
        }
      } catch (emailError) {
        console.error('[CHECK-AND-CONFIRM-PAYMENT] Error sending email:', emailError);
        // Non fallire se l'email fallisce
      }
    }

    // ✅ 9. RESTITUISCI RISPOSTA COMPLETA
    const responseData = {
      success: true,
      paymentIntentStatus: paymentIntent.status,
      bookingStatus: newBookingStatus,
      isPaymentCompleted: paymentIntent.status === 'succeeded',
      confirmed: paymentIntent.status === 'succeeded',
      source: 'stripe-api',
      emailSent: emailSent,
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        rifPrenotazione: updatedBooking.rifPrenotazione,
      },
      stripeData: {
        status: sessionData.status,
        payment_status: sessionData.payment_status,
      }
    };

    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📤 Step 9: Returning final response');
    console.log('[CHECK-AND-CONFIRM-PAYMENT] 📊 Response data:', {
      success: responseData.success,
      paymentIntentStatus: responseData.paymentIntentStatus,
      bookingStatus: responseData.bookingStatus,
      isPaymentCompleted: responseData.isPaymentCompleted,
      confirmed: responseData.confirmed,
      source: responseData.source,
      emailSent: responseData.emailSent,
      bookingId: responseData.booking.id,
      bookingStatusInResponse: responseData.booking.status
    });

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('[CHECK-AND-CONFIRM-PAYMENT] ❌ Unhandled exception:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
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












