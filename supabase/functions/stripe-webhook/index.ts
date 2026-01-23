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
    console.error('[STRIPE WEBHOOK] Error verifying signature:', error);
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
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!stripeWebhookSecret) {
      console.error('[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET not found');
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
      console.error('[STRIPE WEBHOOK] Missing stripe-signature header');
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
      console.error('[STRIPE WEBHOOK] Invalid signature');
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
      console.error('[STRIPE WEBHOOK] Error parsing event:', e);
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

    // Handle different event types
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata?.booking_id;

      console.log('[STRIPE WEBHOOK] payment_intent.succeeded event received');
      console.log('[STRIPE WEBHOOK] Payment Intent ID:', paymentIntent.id);
      console.log('[STRIPE WEBHOOK] Payment Intent status:', paymentIntent.status);
      console.log('[STRIPE WEBHOOK] Booking ID from metadata:', bookingId);

      if (!bookingId) {
        console.error('[STRIPE WEBHOOK] No booking_id in payment intent metadata');
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

      // With payment_intent.succeeded, the payment is already confirmed
      // No need to check payment_status - the event itself confirms success
      console.log('[STRIPE WEBHOOK] Payment confirmed - proceeding with update');
      
      // Get booking
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select('id, user_id, cart, status, stripe_checkout_session_id')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('[STRIPE WEBHOOK] Booking not found:', bookingId);
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

      // Update booking: remove from cart and confirm
      // Note: We keep the existing stripe_checkout_session_id if it exists
      // The PaymentIntent doesn't directly contain the checkout session ID
      console.log('[STRIPE WEBHOOK] Attempting to update booking:', bookingId);
      console.log('[STRIPE WEBHOOK] Update values: cart=false, status=confirmed');
      console.log('[STRIPE WEBHOOK] Saving PaymentIntent ID:', paymentIntent.id);
      
      const { data: updatedBooking, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({ 
          cart: false,
          status: 'confirmed',
          stripe_payment_intent_id: paymentIntent.id,
          // Keep existing stripe_checkout_session_id if it exists
          ...(booking.stripe_checkout_session_id ? { stripe_checkout_session_id: booking.stripe_checkout_session_id } : {}),
        })
        .eq('id', bookingId)
        .select('id, cart, status, stripe_checkout_session_id, stripe_payment_intent_id');

        if (updateError) {
          console.error('[STRIPE WEBHOOK] Error updating booking:', updateError);
          console.error('[STRIPE WEBHOOK] Error details:', JSON.stringify(updateError, null, 2));
          return new Response(JSON.stringify({ 
            error: 'Errore nell\'aggiornamento della prenotazione',
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
          console.log('[STRIPE WEBHOOK] Booking updated successfully:', updatedBooking[0]);
          
          // ✅ Aggiorna booking_details a 'toPickup'
          console.log('[STRIPE WEBHOOK] Updating booking_details status to toPickup');
          const { error: detailsUpdateError } = await supabaseAdmin
            .from('booking_details')
            .update({ 
              status: 'toPickup'
            })
            .eq('booking_id', bookingId);

          if (detailsUpdateError) {
            console.error('[STRIPE WEBHOOK] Error updating booking_details:', detailsUpdateError);
            // Non bloccare il flusso, ma loggare l'errore
            // Il booking è già stato confermato, quindi continuiamo
          } else {
            console.log('[STRIPE WEBHOOK] ✅ Booking details updated successfully to toPickup');
          }
        } else {
          console.warn('[STRIPE WEBHOOK] Update returned no rows - booking might not exist or RLS blocked update');
        }

        // Aggiorna lo status di booking_details a 'to_pickup' quando la prenotazione viene confermata
        const { error: detailsUpdateError } = await supabaseAdmin
          .from('booking_details')
          .update({ 
            status: 'to_pickup'
          })
          .eq('booking_id', bookingId);

        if (detailsUpdateError) {
          console.error('[STRIPE WEBHOOK] Error updating booking_details status:', detailsUpdateError);
          // Non blocchiamo la risposta se l'aggiornamento dei dettagli fallisce
          // ma loggiamo l'errore per il debug
        } else {
          console.log('[STRIPE WEBHOOK] Booking details status updated to to_pickup for booking:', bookingId);
        }

        // Get booking details for emails
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('id', booking.user_id)
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
          .eq('booking_id', bookingId);
        
        console.log('[STRIPE WEBHOOK] Booking details retrieved:', {
          count: bookingDetails?.length || 0,
          details: bookingDetails?.map((d: any) => ({
            id: d.id,
            start_date: d.start_date,
            end_date: d.end_date,
            start_date_type: typeof d.start_date,
            end_date_type: typeof d.end_date,
            product_name: d.product_units?.product_variants?.products?.name
          }))
        });

        // Get booking reference
        const { data: bookingWithRef } = await supabaseAdmin
          .from('bookings')
          .select('rifPrenotazione')
          .eq('id', bookingId)
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
          // Check if URL contains localhost, 127.0.0.1, or is not a valid HTTP/HTTPS URL
          if (urlLower.includes('localhost') || 
              urlLower.includes('127.0.0.1') || 
              urlLower.includes('0.0.0.0') ||
              (!urlLower.startsWith('http://') && !urlLower.startsWith('https://'))) {
            console.warn('[STRIPE WEBHOOK] Invalid shopIcon_url (contains localhost or invalid):', shopIconUrl);
            shopIconUrl = ''; // Reset to empty to use fallback
          }
        }
        
        // Use fallback if shopIconUrl is not available or invalid
        const logoUrl = shopIconUrl || 'https://demo.nollix.it/Nollix_favicon.png';
        
        console.log('[STRIPE WEBHOOK] Logo URL validation:', { 
          shopIconUrl: shopSettings?.shopIcon_url, 
          validatedShopIconUrl: shopIconUrl,
          finalLogoUrl: logoUrl 
        });

        // Get shop days off for closed day warnings
        const { data: shopDaysOffData } = await supabaseAdmin
          .from('shop_days_off')
          .select('date_from, date_to, enable_booking');
        
        console.log('[STRIPE WEBHOOK] Shop days off data:', JSON.stringify(shopDaysOffData, null, 2));

        // Helper function to extract date part (YYYY-MM-DD) from timestamptz string
        const extractDatePart = (timestamptz: string): string => {
          console.log('[STRIPE WEBHOOK] Extracting date from timestamptz:', timestamptz);
          // Handle both ISO format (2024-01-15T10:30:00.000Z) and date format (2024-01-15)
          let datePart: string;
          if (timestamptz.includes('T')) {
            datePart = timestamptz.split('T')[0];
          } else {
            datePart = timestamptz.substring(0, 10);
          }
          console.log('[STRIPE WEBHOOK] Extracted date part:', datePart);
          return datePart;
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
          const bookingRef = bookingWithRef.rifPrenotazione || bookingId.substring(0, 8).toUpperCase();

          // Build products list HTML
          const productsList = bookingDetails.map((detail: any) => {
            const product = detail.product_units?.product_variants?.products;
            
            console.log('[STRIPE WEBHOOK] Processing booking detail:', {
              productName: product?.name,
              originalStartDate: detail.start_date,
              originalEndDate: detail.end_date,
              startDateType: typeof detail.start_date,
              endDateType: typeof detail.end_date
            });
            
            // Extract date parts from timestamptz and create local dates
            const startDateStr = extractDatePart(detail.start_date);
            const endDateStr = extractDatePart(detail.end_date);
            const startDateObj = createLocalDate(startDateStr);
            const endDateObj = createLocalDate(endDateStr);
            
            console.log('[STRIPE WEBHOOK] Date objects created:', {
              startDateStr,
              endDateStr,
              startDateObj: startDateObj.toISOString(),
              endDateObj: endDateObj.toISOString(),
              startDateLocal: startDateObj.toLocaleDateString('it-IT'),
              endDateLocal: endDateObj.toLocaleDateString('it-IT')
            });
            
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
            
            console.log('[STRIPE WEBHOOK] Formatted dates:', { startDate, endDate });

            // Check if end_date has enable_booking=true (shop closed)
            let closedDayWarning = '';
            if (shopDaysOffData && shopDaysOffData.length > 0) {
              console.log('[STRIPE WEBHOOK] Checking shop days off for end date:', endDateStr);
              const isShopClosed = shopDaysOffData.some((dayOff: any) => {
                if (!dayOff.enable_booking) {
                  console.log('[STRIPE WEBHOOK] Skipping day off (enable_booking=false):', dayOff);
                  return false;
                }
                
                // Parse dates as local dates (not UTC timestamps)
                const dateFrom = createLocalDate(dayOff.date_from);
                const dateTo = createLocalDate(dayOff.date_to);
                
                // Set hours to 0 for comparison
                dateFrom.setHours(0, 0, 0, 0);
                dateTo.setHours(0, 0, 0, 0);
                endDateObj.setHours(0, 0, 0, 0);
                
                const matches = endDateObj >= dateFrom && endDateObj <= dateTo;
                console.log('[STRIPE WEBHOOK] Comparing dates:', {
                  dayOff: { date_from: dayOff.date_from, date_to: dayOff.date_to },
                  endDateObj: endDateObj.toISOString(),
                  dateFrom: dateFrom.toISOString(),
                  dateTo: dateTo.toISOString(),
                  matches
                });
                
                return matches;
              });
              
              console.log('[STRIPE WEBHOOK] Shop closed check result:', isShopClosed);
              
              if (isShopClosed) {
                const nextDay = new Date(endDateObj);
                nextDay.setDate(nextDay.getDate() + 1);
                const endDateFormatted = formatDate(endDateObj);
                const nextDayFormatted = formatDate(nextDay);
                
                console.log('[STRIPE WEBHOOK] Adding closed day warning:', {
                  endDateFormatted,
                  nextDayFormatted
                });
                
                closedDayWarning = `
                  <div style="background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 6px; padding: 15px; margin-top: 15px;">
                    <p style="margin: 0; color: #856404; font-size: 14px; font-weight: 600; line-height: 1.5;">
                      ⚠️ <strong>ATTENZIONE:</strong> Il <strong>${endDateFormatted}</strong> il negozio sarà chiuso, pertanto la riconsegna del prodotto dovrà avvenire il giorno successivo (<strong>${nextDayFormatted}</strong>), con il prezzo calcolato sui giorni di prenotazione selezionati.
                    </p>
                  </div>
                `;
              } else {
                console.log('[STRIPE WEBHOOK] No closed day warning needed');
              }
            } else {
              console.log('[STRIPE WEBHOOK] No shop days off data available');
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

          // Send confirmation email to customer
          try {
            const customerEmailHtml = `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Prenotazione Confermata - ${shopName}</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                    .header { background-color: #ffffff; padding: 40px 20px; text-align: center; }
                    .logo-container { display: flex; justify-content: center; align-items: center; margin-bottom: 20px; }
                    .logo { display: block; margin: 0 auto; }
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
                      ${logoUrl && logoUrl !== '#' ? `
                      <div class="logo-container">
                        <img src="${logoUrl}" alt="${shopName} Logo" class="logo" style="width: 80px; height: 80px; object-fit: contain; display: block; border: 0; outline: none; text-decoration: none; margin: 0 auto;" width="80" height="80">
                      </div>
                      ` : ''}
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
            console.log('[STRIPE WEBHOOK] Customer confirmation email sent to:', userEmail);

            // Send notification email to all administrators
            try {
              // Get all admin users
              const { data: adminUsers, error: adminError } = await supabaseAdmin
                .from('profiles')
                .select('email, first_name, last_name')
                .eq('user_type', 'admin');

              if (adminError) {
                console.error('[STRIPE WEBHOOK] Error fetching admin users:', adminError);
              } else if (adminUsers && adminUsers.length > 0) {
                // Build admin products list HTML (same format as customer email)
                const adminProductsList = bookingDetails.map((detail: any) => {
                  const product = detail.product_units?.product_variants?.products;
                  
                  console.log('[STRIPE WEBHOOK] Processing admin email - booking detail:', {
                    productName: product?.name,
                    originalStartDate: detail.start_date,
                    originalEndDate: detail.end_date
                  });
                  
                  // Extract date parts from timestamptz and create local dates
                  const startDateStr = extractDatePart(detail.start_date);
                  const endDateStr = extractDatePart(detail.end_date);
                  const startDateObj = createLocalDate(startDateStr);
                  const endDateObj = createLocalDate(endDateStr);
                  
                  console.log('[STRIPE WEBHOOK] Admin email - Date objects:', {
                    startDateStr,
                    endDateStr,
                    startDateObj: startDateObj.toISOString(),
                    endDateObj: endDateObj.toISOString()
                  });
                  
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
                const adminBookingUrl = normalizedBaseUrl ? `${normalizedBaseUrl}admin/bookings/${bookingId}` : `#`;
                // logoUrl is already validated and set above
                
                console.log('[STRIPE WEBHOOK] Admin email - Logo URL:', { logoUrl, adminBookingUrl });

                // Create admin notification email
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

                // Send email to each admin
                for (const admin of adminUsers) {
                  if (admin.email) {
                    try {
                      await supabaseAdmin.functions.invoke('send-email', {
                        method: 'POST',
                        body: {
                          to: admin.email,
                          subject: `🔔 Nuova Prenotazione - ${bookingRef}`,
                          html: adminEmailHtml,
                        },
                      });
                      console.log('[STRIPE WEBHOOK] Admin notification sent to:', admin.email);
                    } catch (adminEmailError) {
                      console.error('[STRIPE WEBHOOK] Error sending admin notification to:', admin.email, adminEmailError);
                    }
                  }
                }
              }
            } catch (adminNotificationError) {
              console.error('[STRIPE WEBHOOK] Error in admin notification:', adminNotificationError);
              // Don't fail the webhook if admin notification fails
            }
          } catch (emailError) {
            console.error('[STRIPE WEBHOOK] Error sending customer confirmation email:', emailError);
            // Don't fail the webhook if email fails
          }
        }

        console.log('[STRIPE WEBHOOK] Booking confirmed successfully:', bookingId);
    } else {
      console.log('[STRIPE WEBHOOK] Event type not handled:', event.type);
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
    console.error('[STRIPE WEBHOOK] Error:', error);
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

