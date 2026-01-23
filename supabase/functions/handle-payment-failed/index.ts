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
    console.error('[HANDLE-PAYMENT-FAILED] Error verifying signature:', error);
    return false;
  }
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
    // Use a specific webhook secret for this endpoint
    // Each Stripe webhook endpoint has its own unique signing secret
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_PAYMENT_FAILED');
    if (!stripeWebhookSecret) {
      console.error('[HANDLE-PAYMENT-FAILED] STRIPE_WEBHOOK_SECRET_PAYMENT_FAILED not found');
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

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('[HANDLE-PAYMENT-FAILED] Missing stripe-signature header');
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

    // Verify webhook signature
    const isValid = await verifyStripeSignature(body, signature, stripeWebhookSecret);
    if (!isValid) {
      console.error('[HANDLE-PAYMENT-FAILED] Invalid signature');
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

    // Parse event
    let event: any;
    try {
      event = JSON.parse(body);
    } catch (e) {
      console.error('[HANDLE-PAYMENT-FAILED] Error parsing event:', e);
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

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUP_SECR_KEY') ?? ''
    );

    // Handle payment_intent.payment_failed event
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata?.booking_id;

      console.log('[HANDLE-PAYMENT-FAILED] payment_intent.payment_failed event received');
      console.log('[HANDLE-PAYMENT-FAILED] Payment Intent ID:', paymentIntent.id);
      console.log('[HANDLE-PAYMENT-FAILED] Payment Intent status:', paymentIntent.status);
      console.log('[HANDLE-PAYMENT-FAILED] Booking ID from metadata:', bookingId);

      if (!bookingId) {
        console.error('[HANDLE-PAYMENT-FAILED] No booking_id in payment intent metadata');
        return new Response(JSON.stringify({ 
          error: 'booking_id mancante nei metadati',
          success: false 
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      // Get booking
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select('id, user_id, status')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('[HANDLE-PAYMENT-FAILED] Booking not found:', bookingId);
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

      // Update booking status to paymentError
      console.log('[HANDLE-PAYMENT-FAILED] Attempting to update booking status to paymentError:', bookingId);
      
      const { data: updatedBooking, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({ 
          status: 'paymentError',
        })
        .eq('id', bookingId)
        .select('id, status');

      if (updateError) {
        console.error('[HANDLE-PAYMENT-FAILED] Error updating booking status:', updateError);
        console.error('[HANDLE-PAYMENT-FAILED] Error details:', JSON.stringify(updateError, null, 2));
        return new Response(JSON.stringify({ 
          error: 'Errore nell\'aggiornamento dello status della prenotazione',
          success: false,
          details: updateError.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      if (updatedBooking && updatedBooking.length > 0) {
        console.log('[HANDLE-PAYMENT-FAILED] Booking status updated to paymentError successfully:', updatedBooking[0]);
      } else {
        console.warn('[HANDLE-PAYMENT-FAILED] Update returned no rows - booking might not exist or RLS blocked update');
      }

      console.log('[HANDLE-PAYMENT-FAILED] Payment failed - booking status updated to paymentError:', bookingId);
    } else {
      console.log('[HANDLE-PAYMENT-FAILED] Event type not handled:', event.type);
      return new Response(JSON.stringify({ 
        error: 'Evento non supportato',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      received: true 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('[HANDLE-PAYMENT-FAILED] Error:', error);
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



