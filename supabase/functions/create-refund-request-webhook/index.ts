import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify Stripe webhook signature
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Stripe signature format: t=timestamp,v1=signature,v0=signature
    const elements = signature.split(',');
    const timestamp = elements.find((e) => e.startsWith('t='))?.split('=')[1];
    const signatures = elements.filter((e) => e.startsWith('v1=')).map((e) => e.split('=')[1]);

    if (!timestamp || signatures.length === 0) {
      return false;
    }

    // Create signed payload
    const signedPayload = `${timestamp}.${payload}`;

    // Verify each signature
    for (const sig of signatures) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBytes = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(signedPayload)
      );

      // Convert to hex
      const hexSignature = Array.from(new Uint8Array(signatureBytes))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (hexSignature === sig) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[CREATE-REFUND-REQUEST-WEBHOOK] Error verifying signature:', error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log('[CREATE-REFUND-REQUEST-WEBHOOK] 🚀 Function called', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] ✅ CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.error('[CREATE-REFUND-REQUEST-WEBHOOK] ❌ Invalid method:', req.method);
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
    // ✅ 1. VERIFICA WEBHOOK SECRET
    // Use a specific webhook secret for this endpoint
    // Each Stripe webhook endpoint has its own unique signing secret
    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] 🔐 Step 1: Verifying webhook secret');
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_REFUND_CREATED');
    if (!stripeWebhookSecret) {
      console.error('[CREATE-REFUND-REQUEST-WEBHOOK] ❌ STRIPE_WEBHOOK_SECRET_REFUND_CREATED not found');
      return new Response(JSON.stringify({ 
        error: 'Configurazione webhook mancante',
        success: false 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 2. VERIFICA FIRMA WEBHOOK
    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] 🔐 Step 2: Verifying webhook signature');
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('[CREATE-REFUND-REQUEST-WEBHOOK] ❌ Missing stripe-signature header');
      return new Response(JSON.stringify({ 
        error: 'Firma mancante',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const isValid = await verifyStripeSignature(body, signature, stripeWebhookSecret);
    if (!isValid) {
      console.error('[CREATE-REFUND-REQUEST-WEBHOOK] ❌ Invalid signature');
      return new Response(JSON.stringify({ 
        error: 'Firma non valida',
        success: false 
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 3. PARSE EVENTO
    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] 📝 Step 3: Parsing event');
    let event: any;
    try {
      event = JSON.parse(body);
    } catch (e) {
      console.error('[CREATE-REFUND-REQUEST-WEBHOOK] ❌ Error parsing event:', e);
      return new Response(JSON.stringify({ 
        error: 'Evento non valido',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 4. VERIFICA TIPO EVENTO
    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] 🔍 Step 4: Checking event type');
    if (event.type !== 'refund.created') {
      console.error('[CREATE-REFUND-REQUEST-WEBHOOK] ❌ Invalid event type:', event.type);
      return new Response(JSON.stringify({ 
        error: 'Tipo evento non supportato',
        message: `Questa funzione gestisce solo refund.created, ricevuto: ${event.type}`,
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] ✅ Event type valid:', event.type);

    // ✅ 5. ESTRAZIONE DATI REFUND
    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] 📦 Step 5: Extracting refund data');
    const refundObject = event.data.object;
    const stripeRefundId = refundObject.id;
    const refundStatus = refundObject.status; // 'pending', 'succeeded', 'failed', 'canceled'
    const paymentIntentId = refundObject.payment_intent;
    const refundAmountCents = refundObject.amount; // Stripe usa centesimi
    const refundAmount = refundAmountCents / 100; // Converti in euro
    const metadata = refundObject.metadata || {};

    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] 📋 Refund data:', {
      stripeRefundId,
      refundStatus,
      paymentIntentId,
      refundAmount,
      metadata
    });

    // ✅ 6. INIZIALIZZA SUPABASE ADMIN CLIENT
    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] 🔧 Step 6: Initializing Supabase admin client');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUP_SECR_KEY') ?? ''
    );

    // ✅ 7. VERIFICA ESISTENZA REFUND NEL DB
    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] 🔍 Step 7: Checking if refund exists in database');
    const { data: existingRefund, error: refundError } = await supabaseAdmin
      .from('refunds')
      .select('id, booking_id, status')
      .eq('stripe_refund_id', stripeRefundId)
      .single();

    if (existingRefund) {
      console.log('[CREATE-REFUND-REQUEST-WEBHOOK] ⏭️ Refund already exists, skipping');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Refund già esistente nel database',
        refund: {
          id: existingRefund.id,
          stripe_refund_id: stripeRefundId,
          status: existingRefund.status
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 8. RECUPERO BOOKING TRAMITE PAYMENT INTENT
    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] 📦 Step 8: Fetching booking via payment intent');
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, user_id, status, price_total, stripe_payment_intent_id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (bookingError || !booking) {
      console.error('[CREATE-REFUND-REQUEST-WEBHOOK] ⚠️ Booking not found:', {
        paymentIntentId,
        error: bookingError?.message
      });
      // Creiamo comunque il refund senza booking_id per tracciare il rimborso
      // ma logghiamo l'errore per investigazione
    }

    // ✅ 9. CREA REFUND NEL DATABASE
    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] 💾 Step 9: Creating refund in database');
    const { data: newRefund, error: refundInsertError } = await supabaseAdmin
      .from('refunds')
      .insert({
        booking_id: booking?.id || null,
        stripe_payment_intent_id: paymentIntentId,
        stripe_refund_id: stripeRefundId,
        amount: refundAmount,
        status: refundStatus, // 'pending', 'succeeded', 'failed', 'canceled'
        requested_by_type: 'admin' // Sempre admin perché viene da Stripe dashboard
      })
      .select()
      .single();

    if (refundInsertError) {
      console.error('[CREATE-REFUND-REQUEST-WEBHOOK] ❌ Error creating refund:', refundInsertError);
      return new Response(JSON.stringify({ 
        error: 'Errore nel salvataggio del refund',
        message: refundInsertError.message,
        success: false 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] ✅ Refund created successfully:', {
      id: newRefund.id,
      stripe_refund_id: stripeRefundId
    });

    // ✅ 10. AGGIORNAMENTO STATUS BOOKING
    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] 📝 Step 10: Updating booking status based on refund status');
    let bookingStatusToSet: string | null = null;

    if (refundStatus === 'pending') {
      bookingStatusToSet = 'pendingRefund';
      console.log('[CREATE-REFUND-REQUEST-WEBHOOK] 📋 Refund is pending, setting booking to pendingRefund');
    } else if (refundStatus === 'succeeded') {
      bookingStatusToSet = 'succeededRefund';
      console.log('[CREATE-REFUND-REQUEST-WEBHOOK] ✅ Refund succeeded, setting booking to succeededRefund');
    } else if (refundStatus === 'canceled' || refundStatus === 'failed') {
      // Non aggiornare lo status della tabella booking
      bookingStatusToSet = null;
      console.log('[CREATE-REFUND-REQUEST-WEBHOOK] ⏭️ Skipping booking status update for refund status:', refundStatus);
    } else {
      // Per altri status non previsti, non aggiorniamo
      bookingStatusToSet = null;
      console.log('[CREATE-REFUND-REQUEST-WEBHOOK] ⚠️ Unknown refund status, skipping booking update:', refundStatus);
    }

    if (bookingStatusToSet && booking) {
      const { error: bookingUpdateError } = await supabaseAdmin
        .from('bookings')
        .update({ 
          status: bookingStatusToSet,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (bookingUpdateError) {
        console.error('[CREATE-REFUND-REQUEST-WEBHOOK] ⚠️ Error updating booking status:', bookingUpdateError);
        // Non blocchiamo perché il refund è già stato creato
      } else {
        console.log('[CREATE-REFUND-REQUEST-WEBHOOK] ✅ Booking status updated to:', bookingStatusToSet);
      }
    } else if (!booking) {
      console.warn('[CREATE-REFUND-REQUEST-WEBHOOK] ⚠️ Booking not found, skipping booking status update');
    }

    // ✅ 11. RESPONSE FINALE
    console.log('[CREATE-REFUND-REQUEST-WEBHOOK] ✅ Refund creation completed successfully');
    return new Response(JSON.stringify({
      success: true,
      refund: {
        id: newRefund.id,
        stripe_refund_id: stripeRefundId,
        status: refundStatus,
        amount: refundAmount
      },
      booking: booking ? {
        id: booking.id,
        status: bookingStatusToSet || booking.status
      } : null,
      message: 'Refund creato con successo dal webhook'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('[CREATE-REFUND-REQUEST-WEBHOOK] ❌ Unexpected error:', error);
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

