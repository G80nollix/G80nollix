import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateRefundRequest {
  booking_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('[CREATE-REFUND-REQUEST] 🚀 Function called', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[CREATE-REFUND-REQUEST] ✅ CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.error('[CREATE-REFUND-REQUEST] ❌ Invalid method:', req.method);
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
    console.log('[CREATE-REFUND-REQUEST] 🔐 Step 1: Verifying authentication');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[CREATE-REFUND-REQUEST] ❌ No authorization header');
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUP_PUB_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[CREATE-REFUND-REQUEST] ❌ Authentication failed:', {
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

    console.log('[CREATE-REFUND-REQUEST] ✅ User authenticated:', {
      userId: user.id,
      email: user.email
    });

    // ✅ 2. IDENTIFICA TIPO UTENTE (admin o individual)
    console.log('[CREATE-REFUND-REQUEST] 👤 Step 2: Identifying user type');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUP_SECR_KEY') ?? ''
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[CREATE-REFUND-REQUEST] ❌ Error fetching profile:', profileError);
      return new Response(JSON.stringify({ 
        error: 'Errore nel recupero del profilo utente',
        success: false 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const isAdmin = profile?.user_type === 'admin';
    const isIndividual = profile?.user_type === 'individual' || !isAdmin;

    console.log('[CREATE-REFUND-REQUEST] ✅ User type identified:', {
      isAdmin,
      isIndividual,
      userType: profile?.user_type
    });

    // ✅ 3. VALIDA INPUT
    console.log('[CREATE-REFUND-REQUEST] 📝 Step 3: Validating input');
    const { booking_id }: CreateRefundRequest = await req.json();
    console.log('[CREATE-REFUND-REQUEST] 📋 Received booking_id:', booking_id);
    
    if (!booking_id) {
      console.error('[CREATE-REFUND-REQUEST] ❌ Booking ID missing');
      return new Response(JSON.stringify({ 
        error: 'booking_id è obbligatorio',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 4. RECUPERA E VALIDA BOOKING
    console.log('[CREATE-REFUND-REQUEST] 📦 Step 4: Fetching booking');
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, user_id, status, price_total, stripe_payment_intent_id')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('[CREATE-REFUND-REQUEST] ❌ Booking not found:', bookingError);
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

    // Verifica che lo status sia 'confirmed'
    if (booking.status !== 'confirmed') {
      console.error('[CREATE-REFUND-REQUEST] ❌ Booking status is not confirmed:', booking.status);
      return new Response(JSON.stringify({ 
        error: 'Il rimborso può essere richiesto solo per prenotazioni confermate',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Verifica che l'utente sia il proprietario (se individual) o admin
    if (isIndividual && booking.user_id !== user.id) {
      console.error('[CREATE-REFUND-REQUEST] ❌ User is not the owner of the booking');
      return new Response(JSON.stringify({ 
        error: 'Non hai i permessi per richiedere il rimborso di questa prenotazione',
        success: false 
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Verifica che non esista già un rimborso in pending
    const { data: existingRefunds, error: refundsError } = await supabaseAdmin
      .from('refunds')
      .select('id, status')
      .eq('booking_id', booking_id)
      .eq('status', 'pending');

    if (refundsError) {
      console.error('[CREATE-REFUND-REQUEST] ❌ Error checking existing refunds:', refundsError);
      return new Response(JSON.stringify({ 
        error: 'Errore nel controllo dei rimborsi esistenti',
        success: false 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    if (existingRefunds && existingRefunds.length > 0) {
      console.error('[CREATE-REFUND-REQUEST] ❌ Refund already exists in pending status');
      return new Response(JSON.stringify({ 
        error: 'Esiste già una richiesta di rimborso in corso per questa prenotazione',
        message: 'Non è possibile richiedere un nuovo rimborso mentre ce n\'è già uno in elaborazione.',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 5. VERIFICA PAYMENT INTENT ID
    console.log('[CREATE-REFUND-REQUEST] 💳 Step 5: Verifying payment intent ID');
    if (!booking.stripe_payment_intent_id) {
      console.error('[CREATE-REFUND-REQUEST] ❌ Payment Intent ID not found');
      return new Response(JSON.stringify({ 
        error: 'Payment Intent non trovato',
        message: 'Impossibile procedere con il rimborso: il pagamento non è stato trovato. Contatta il supporto.',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 6. RECUPERA START_DATE MINIMA DA BOOKING_DETAILS
    console.log('[CREATE-REFUND-REQUEST] 📅 Step 6: Fetching booking details');
    const { data: bookingDetails, error: detailsError } = await supabaseAdmin
      .from('booking_details')
      .select('start_date')
      .eq('booking_id', booking_id);

    if (detailsError || !bookingDetails || bookingDetails.length === 0) {
      console.error('[CREATE-REFUND-REQUEST] ❌ Booking details not found:', detailsError);
      return new Response(JSON.stringify({ 
        error: 'Dettagli prenotazione non trovati',
        message: 'Impossibile procedere: i dettagli della prenotazione non sono stati trovati.',
        success: false 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Trova la start_date MINIMA
    const startDates = bookingDetails
      .map(detail => new Date(detail.start_date))
      .filter(date => !isNaN(date.getTime()));

    if (startDates.length === 0) {
      console.error('[CREATE-REFUND-REQUEST] ❌ Invalid start dates');
      return new Response(JSON.stringify({ 
        error: 'Date prenotazione non valide',
        message: 'Impossibile procedere: le date della prenotazione non sono valide.',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const minStartDate = new Date(Math.min(...startDates.map(d => d.getTime())));
    console.log('[CREATE-REFUND-REQUEST] ✅ Min start date:', minStartDate.toISOString());

    // ✅ 6.5. RECUPERA ORE_RIMBORSO_CONSENTITE DA SHOP_SETTINGS
    console.log('[CREATE-REFUND-REQUEST] ⚙️ Step 6.5: Fetching refund hours from shop settings');
    const { data: shopSettings, error: shopSettingsError } = await supabaseAdmin
      .from('shop_settings')
      .select('ore_rimborso_consentite')
      .maybeSingle();

    if (shopSettingsError) {
      console.error('[CREATE-REFUND-REQUEST] ⚠️ Error fetching shop settings:', shopSettingsError);
      // Non blocchiamo, usiamo il valore di default
    }

    // Usa il valore dinamico o fallback a 24 ore per retrocompatibilità
    const refundHours = shopSettings?.ore_rimborso_consentite ?? 24;
    console.log('[CREATE-REFUND-REQUEST] ✅ Refund hours configured:', refundHours);

    // ✅ 7. VERIFICA SE LA PRENOTAZIONE È INIZIATA (STESSO GIORNO)
    console.log('[CREATE-REFUND-REQUEST] ⏰ Step 7: Checking if booking has started');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDay = new Date(minStartDate.getFullYear(), minStartDate.getMonth(), minStartDate.getDate());
    
    console.log('[CREATE-REFUND-REQUEST] ⏰ Step 7: today', today);
    console.log('[CREATE-REFUND-REQUEST] ⏰ Step 7: startDay', startDay);

    if (startDay <= today) {
      console.error('[CREATE-REFUND-REQUEST] ❌ Booking has already started');
      return new Response(JSON.stringify({ 
        error: 'Rimborso non disponibile',
        message: 'Non è possibile richiedere il rimborso per una prenotazione già iniziata. Per assistenza, contatta direttamente l\'azienda.',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 8. CALCOLA PERCENTUALE RIMBORSO
    console.log('[CREATE-REFUND-REQUEST] 💰 Step 8: Calculating refund percentage');
    const hoursUntilStart = (minStartDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    console.log('[CREATE-REFUND-REQUEST] ⏱️ Hours until start:', hoursUntilStart);
    console.log('[CREATE-REFUND-REQUEST] ⏱️ Refund threshold hours:', refundHours);

    let refundPercentage: number;
    if (hoursUntilStart >= refundHours) {
      refundPercentage = 1.0; // 100%
    } else if (hoursUntilStart > 0) {
      refundPercentage = 0.5; // 50%
    } else {
      // Questo caso non dovrebbe mai verificarsi perché già bloccato al punto 7
      console.error('[CREATE-REFUND-REQUEST] ❌ Invalid time calculation');
      return new Response(JSON.stringify({ 
        error: 'Rimborso non disponibile',
        message: 'Non è possibile richiedere il rimborso per una prenotazione già iniziata. Per assistenza, contatta direttamente l\'azienda.',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const refundAmount = Number(booking.price_total) * refundPercentage;
    const refundAmountCents = Math.round(refundAmount * 100);

    console.log('[CREATE-REFUND-REQUEST] ✅ Refund calculated:', {
      percentage: refundPercentage,
      amount: refundAmount,
      amountCents: refundAmountCents
    });

    // ✅ 9. CREA RIMBORSO SU STRIPE
    console.log('[CREATE-REFUND-REQUEST] 🔄 Step 9: Creating refund on Stripe');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('[CREATE-REFUND-REQUEST] ❌ STRIPE_SECRET_KEY not found');
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

    const stripeRefundBody = new URLSearchParams();
    stripeRefundBody.append('payment_intent', booking.stripe_payment_intent_id);
    stripeRefundBody.append('amount', refundAmountCents.toString());
    stripeRefundBody.append('reason', 'requested_by_customer');
    stripeRefundBody.append('metadata[booking_id]', booking_id);
    stripeRefundBody.append('metadata[requested_by]', isAdmin ? 'admin' : 'customer');
    stripeRefundBody.append('metadata[refund_percentage]', refundPercentage.toString());
    stripeRefundBody.append('metadata[min_start_date]', minStartDate.toISOString());

    const stripeRefundResponse = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: stripeRefundBody.toString(),
    });

    if (!stripeRefundResponse.ok) {
      const errorData = await stripeRefundResponse.json().catch(() => ({}));
      console.error('[CREATE-REFUND-REQUEST] ❌ Stripe refund error:', errorData);
      return new Response(JSON.stringify({ 
        error: 'Errore nella creazione del rimborso',
        message: 'Si è verificato un errore durante la creazione del rimborso. Ti preghiamo di riprovare più tardi o contattare il supporto.',
        success: false 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const refundObject = await stripeRefundResponse.json();
    console.log('[CREATE-REFUND-REQUEST] ✅ Stripe refund created:', {
      id: refundObject.id,
      status: refundObject.status
    });

    // ✅ 10. SALVA IN DATABASE
    console.log('[CREATE-REFUND-REQUEST] 💾 Step 10: Saving refund to database');
    const { error: refundInsertError } = await supabaseAdmin
      .from('refunds')
      .insert({
        booking_id: booking_id,
        stripe_payment_intent_id: booking.stripe_payment_intent_id,
        stripe_refund_id: refundObject.id,
        amount: refundAmount,
        status: refundObject.status, // 'pending', 'succeeded', 'failed', 'canceled'
        requested_by_type: isAdmin ? 'admin' : 'individual'
      });

    if (refundInsertError) {
      console.error('[CREATE-REFUND-REQUEST] ❌ Error saving refund:', refundInsertError);
      return new Response(JSON.stringify({ 
        error: 'Errore nel salvataggio del rimborso',
        message: `Il rimborso è stato creato su Stripe ma c'è stato un problema nel database. Contatta il supporto con il codice: ${refundObject.id}`,
        success: false 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 11. AGGIORNA STATUS BOOKING IN BASE ALLO STATUS DEL REFUND
    console.log('[CREATE-REFUND-REQUEST] 📝 Step 11: Updating booking status based on refund status');
    const refundStatus = refundObject.status;
    
    let bookingStatusToSet: string | null = null;
    
    if (refundStatus === 'pending') {
      bookingStatusToSet = 'pendingRefund';
    } else if (refundStatus === 'succeeded') {
      bookingStatusToSet = 'succeededRefund';
    } else if (refundStatus === 'canceled' || refundStatus === 'failed') {
      // Non aggiornare lo status della tabella booking
      bookingStatusToSet = null;
      console.log('[CREATE-REFUND-REQUEST] ⏭️ Skipping booking status update for refund status:', refundStatus);
    } else {
      // Per altri status non previsti, non aggiorniamo
      bookingStatusToSet = null;
      console.log('[CREATE-REFUND-REQUEST] ⚠️ Unknown refund status, skipping booking update:', refundStatus);
    }

    if (bookingStatusToSet) {
      const { error: bookingUpdateError } = await supabaseAdmin
        .from('bookings')
        .update({ 
          status: bookingStatusToSet,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking_id);

      if (bookingUpdateError) {
        console.error('[CREATE-REFUND-REQUEST] ⚠️ Error updating booking status:', bookingUpdateError);
        // Non blocchiamo perché il refund è già stato creato
      } else {
        console.log('[CREATE-REFUND-REQUEST] ✅ Booking status updated to:', bookingStatusToSet);
      }
    }

    console.log('[CREATE-REFUND-REQUEST] ✅ Refund request completed successfully');

    // ✅ 12. RESPONSE FINALE
    return new Response(JSON.stringify({
      success: true,
      refund: {
        id: refundObject.id,
        amount: refundAmount,
        percentage: refundPercentage,
        status: refundObject.status,
        min_start_date: minStartDate.toISOString()
      },
      message: refundPercentage === 1.0 
        ? 'Rimborso totale richiesto con successo'
        : 'Rimborso parziale (50%) richiesto con successo'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('[CREATE-REFUND-REQUEST] ❌ Unexpected error:', error);
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




