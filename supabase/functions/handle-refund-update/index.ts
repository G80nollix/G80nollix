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
    console.error('[HANDLE-REFUND-UPDATE] Error verifying signature:', error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log('[HANDLE-REFUND-UPDATE] 🚀 Function called', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[HANDLE-REFUND-UPDATE] ✅ CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.error('[HANDLE-REFUND-UPDATE] ❌ Invalid method:', req.method);
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
    console.log('[HANDLE-REFUND-UPDATE] 🔐 Step 1: Verifying webhook secret');
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_REFUND_UPDATE');
    if (!stripeWebhookSecret) {
      console.error('[HANDLE-REFUND-UPDATE] ❌ STRIPE_WEBHOOK_SECRET_REFUND_UPDATE not found');
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
    console.log('[HANDLE-REFUND-UPDATE] 🔐 Step 2: Verifying webhook signature');
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('[HANDLE-REFUND-UPDATE] ❌ Missing stripe-signature header');
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
      console.error('[HANDLE-REFUND-UPDATE] ❌ Invalid signature');
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
    console.log('[HANDLE-REFUND-UPDATE] 📝 Step 3: Parsing event');
    let event: any;
    try {
      event = JSON.parse(body);
    } catch (e) {
      console.error('[HANDLE-REFUND-UPDATE] ❌ Error parsing event:', e);
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
    console.log('[HANDLE-REFUND-UPDATE] 🔍 Step 4: Checking event type');
    if (event.type !== 'refund.updated' && event.type !== 'refund.failed') {
      console.error('[HANDLE-REFUND-UPDATE] ❌ Invalid event type:', event.type);
      return new Response(JSON.stringify({ 
        error: 'Tipo evento non supportato',
        message: `Questa funzione gestisce solo refund.updated e refund.failed, ricevuto: ${event.type}`,
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    console.log('[HANDLE-REFUND-UPDATE] ✅ Event type valid:', event.type);

    // ✅ 5. ESTRAZIONE DATI REFUND
    console.log('[HANDLE-REFUND-UPDATE] 📦 Step 5: Extracting refund data');
    const refundObject = event.data.object;
    const stripeRefundId = refundObject.id;
    const refundStatus = refundObject.status; // 'pending', 'succeeded', 'failed', 'canceled'
    const paymentIntentId = refundObject.payment_intent;

    console.log('[HANDLE-REFUND-UPDATE] 📋 Refund data:', {
      stripeRefundId,
      refundStatus,
      paymentIntentId
    });

    // ✅ 6. INIZIALIZZA SUPABASE ADMIN CLIENT
    console.log('[HANDLE-REFUND-UPDATE] 🔧 Step 6: Initializing Supabase admin client');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUP_SECR_KEY') ?? ''
    );

    // ✅ 7. VERIFICA ESISTENZA REFUND NEL DB
    console.log('[HANDLE-REFUND-UPDATE] 🔍 Step 7: Checking if refund exists in database');
    const { data: existingRefund, error: refundError } = await supabaseAdmin
      .from('refunds')
      .select('id, booking_id, status, stripe_payment_intent_id')
      .eq('stripe_refund_id', stripeRefundId)
      .single();

    if (refundError || !existingRefund) {
      console.error('[HANDLE-REFUND-UPDATE] ❌ Refund not found in database:', {
        stripeRefundId,
        error: refundError?.message
      });
      return new Response(JSON.stringify({ 
        error: 'Refund non trovato nel database',
        message: `Il refund con ID ${stripeRefundId} non è stato trovato nel database.`,
        success: false 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    console.log('[HANDLE-REFUND-UPDATE] ✅ Refund found:', {
      id: existingRefund.id,
      booking_id: existingRefund.booking_id,
      currentStatus: existingRefund.status,
      newStatus: refundStatus
    });

    // ✅ 8. VERIFICA SE LO STATUS È CAMBIATO
    if (existingRefund.status === refundStatus) {
      console.log('[HANDLE-REFUND-UPDATE] ⏭️ Status unchanged, skipping update');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Status non modificato',
        refund: {
          id: existingRefund.id,
          status: refundStatus
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ✅ 9. RECUPERO BOOKING E DATA FINE PRENOTAZIONE
    console.log('[HANDLE-REFUND-UPDATE] 📅 Step 9: Fetching booking and end date');
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, status')
      .eq('id', existingRefund.booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('[HANDLE-REFUND-UPDATE] ⚠️ Booking not found:', {
        booking_id: existingRefund.booking_id,
        error: bookingError?.message
      });
      // Continueremo ad aggiornare il refund anche se il booking non esiste
    }

    // Recupera la data di fine dalla tabella booking_details
    const { data: bookingDetails, error: detailsError } = await supabaseAdmin
      .from('booking_details')
      .select('end_date')
      .eq('booking_id', existingRefund.booking_id);

    let maxEndDate: Date | null = null;
    if (!detailsError && bookingDetails && bookingDetails.length > 0) {
      // Trova la data di fine massima (più recente)
      const endDates = bookingDetails
        .map(d => new Date(d.end_date))
        .filter(date => !isNaN(date.getTime()));
      
      if (endDates.length > 0) {
        maxEndDate = new Date(Math.max(...endDates.map(d => d.getTime())));
        console.log('[HANDLE-REFUND-UPDATE] ✅ Max end date found:', maxEndDate.toISOString());
      }
    } else {
      console.warn('[HANDLE-REFUND-UPDATE] ⚠️ No booking_details found or error:', detailsError?.message);
    }

    // ✅ 10. AGGIORNAMENTO STATUS REFUND
    console.log('[HANDLE-REFUND-UPDATE] 💾 Step 10: Updating refund status');
    const { error: updateRefundError } = await supabaseAdmin
      .from('refunds')
      .update({ 
        status: refundStatus,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_refund_id', stripeRefundId);

    if (updateRefundError) {
      console.error('[HANDLE-REFUND-UPDATE] ❌ Error updating refund status:', updateRefundError);
      return new Response(JSON.stringify({ 
        error: 'Errore nell\'aggiornamento del refund',
        message: updateRefundError.message,
        success: false 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    console.log('[HANDLE-REFUND-UPDATE] ✅ Refund status updated successfully');

    // ✅ 11. AGGIORNAMENTO BOOKING STATUS
    console.log('[HANDLE-REFUND-UPDATE] 📝 Step 11: Updating booking status based on refund status');
    let bookingStatusToSet: string | null = null;

    if (refundStatus === 'pending') {
      bookingStatusToSet = 'pendingRefund';
      console.log('[HANDLE-REFUND-UPDATE] 📋 Refund is pending, setting booking to pendingRefund');
    } else if (refundStatus === 'succeeded') {
      bookingStatusToSet = 'succeededRefund';
      console.log('[HANDLE-REFUND-UPDATE] ✅ Refund succeeded, setting booking to succeededRefund');
    } else if (refundStatus === 'canceled' || refundStatus === 'failed') {
      // Logica speciale: verifica la data di fine prenotazione
      if (!maxEndDate) {
        console.warn('[HANDLE-REFUND-UPDATE] ⚠️ No end_date found, defaulting to confirmed');
        bookingStatusToSet = 'confirmed';
      } else {
        const now = new Date();
        const endDate = new Date(maxEndDate);
        
        // Se la data di fine è nel futuro (prenotazione non ancora terminata)
        if (endDate > now) {
          bookingStatusToSet = 'confirmed';
          console.log('[HANDLE-REFUND-UPDATE] 📅 End date in future, setting booking to confirmed');
        } else {
          // Se la data di fine è nel passato (prenotazione già terminata)
          bookingStatusToSet = 'completed';
          console.log('[HANDLE-REFUND-UPDATE] 📅 End date in past, setting booking to completed');
        }
      }
    } else {
      // Per altri status non previsti
      bookingStatusToSet = null;
      console.log('[HANDLE-REFUND-UPDATE] ⚠️ Unknown refund status, skipping booking update:', refundStatus);
    }

    if (bookingStatusToSet && booking) {
      const { error: bookingUpdateError } = await supabaseAdmin
        .from('bookings')
        .update({ 
          status: bookingStatusToSet,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRefund.booking_id);

      if (bookingUpdateError) {
        console.error('[HANDLE-REFUND-UPDATE] ⚠️ Error updating booking status:', bookingUpdateError);
        // Non blocchiamo perché il refund è già stato aggiornato
      } else {
        console.log('[HANDLE-REFUND-UPDATE] ✅ Booking status updated to:', bookingStatusToSet);
      }
    } else if (!booking) {
      console.warn('[HANDLE-REFUND-UPDATE] ⚠️ Booking not found, skipping booking status update');
    }

    // ✅ 12. RESPONSE FINALE
    console.log('[HANDLE-REFUND-UPDATE] ✅ Refund update completed successfully');
    return new Response(JSON.stringify({
      success: true,
      refund: {
        id: existingRefund.id,
        stripe_refund_id: stripeRefundId,
        status: refundStatus,
        previous_status: existingRefund.status
      },
      booking: booking ? {
        id: booking.id,
        status: bookingStatusToSet || booking.status
      } : null,
      message: 'Refund aggiornato con successo'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('[HANDLE-REFUND-UPDATE] ❌ Unexpected error:', error);
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


