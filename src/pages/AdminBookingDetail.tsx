import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Calendar, User, Package, Clock, CheckCircle, XCircle, AlertCircle, DollarSign, Phone, MapPin, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminFooter from "@/components/admin/AdminFooter";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn, toItalianISOString } from "@/lib/utils";
  
interface Booking {
  id: string;
  rifPrenotazione: number;
  user_id: string;
  product_id: string;
  start_date: string;
  end_date: string;
  price_total: number;
  delivery_method: 'pickup' | 'delivery';
  delivery_address: string | null;
  status: 'cart' | 'confirmed' | 'cancelled' | 'completed' | 'inPayment' | 'pendingRefund' | 'succeededRefund';
  created_at: string;
  updated_at: string;
  ritiro_fasciaoraria_inizio: string | null;
  ritiro_fasciaoraria_fine: string | null;
  riconsegna_fasciaoraria_inizio: string | null;
  riconsegna_fasciaoraria_fine: string | null;
  price_daily: number | null;
  price_weekly: number | null;
  price_hour: number | null;
  price_month: number | null;
  deposito: number | null;
  // Joined data
  user_email?: string;
  user_name?: string;
  user_phone?: string;
  product_title?: string;
  product_brand?: string;
  product_model?: string;
}

interface BookingDetailInformation {
  id: number;
  information_id: string;
  value: string | null;
  information?: {
    id: string;
    name: string;
    type: string;
  };
}

interface BookingDetail {
  id: string;
  booking_id: string;
  unit_id: string;
  start_date: string;
  end_date: string;
  delivery_method: 'pickup' | 'delivery';
  ritiro_fasciaoraria_inizio: string | null;
  ritiro_fasciaoraria_fine: string | null;
  riconsegna_fasciaoraria_inizio: string | null;
  riconsegna_fasciaoraria_fine: string | null;
  price: number;
  price_daily: number | null;
  price_weekly: number | null;
  price_hour: number | null;
  price_month: number | null;
  deposito: number | null;
  status?: 'to_pickup' | 'picked_up' | 'to_return' | 'returned' | null;
  // Joined product data
  product_title?: string;
  product_brand?: string;
  product_model?: string;
  // Informations
  informations?: BookingDetailInformation[];
}

const AdminBookingDetail = () => {
  
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Check if we came from daily-bookings page
  const fromDailyBookings = location.state?.from === 'daily-bookings';
  const dailyBookingsDate = location.state?.date;
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingDetails, setBookingDetails] = useState<BookingDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);


  // Fetch booking details
  const fetchBooking = async () => {
    if (!id) return;
    
    try {
      setIsLoading(true);
      setError(null);

      // Get booking data (product_id, start_date, end_date don't exist in bookings anymore)
      const { data, error } = await supabase
        .from('bookings')
        .select('id, user_id, price_total, delivery_method, delivery_address, status, created_at, updated_at, rifPrenotazione, cart')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        // Fetch user profile data separately since user_id references auth.users
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, email, phone')
          .eq('id', data.user_id)
          .single();

        if (profileError) {
          console.error('Error fetching profile data:', profileError);
        }

        // Get booking_details to get dates, product info, and other fields
        const { data: bookingDetailsForDates, error: detailsForDatesError } = await supabase
          .from('booking_details')
          .select('start_date, end_date, unit_id, ritiro_fasciaoraria_inizio, ritiro_fasciaoraria_fine, riconsegna_fasciaoraria_inizio, riconsegna_fasciaoraria_fine, price_daily, price_weekly, price_hour, price_month, deposito')
          .eq('booking_id', id);

        if (detailsForDatesError) {
          console.error('Error fetching booking_details for dates:', detailsForDatesError);
        }

        // Get dates (min start_date, max end_date)
        let startDate = '';
        let endDate = '';
        const unitIds: string[] = [];
        
        // Get time slots and prices from first booking_detail (for compatibility)
        let ritiroFasciaorariaInizio: string | null = null;
        let ritiroFasciaorariaFine: string | null = null;
        let riconsegnaFasciaorariaInizio: string | null = null;
        let riconsegnaFasciaorariaFine: string | null = null;
        let priceDaily: number | null = null;
        let priceWeekly: number | null = null;
        let priceHour: number | null = null;
        let priceMonth: number | null = null;
        let deposito: number | null = null;
        
        if (bookingDetailsForDates && bookingDetailsForDates.length > 0) {
          const dates = bookingDetailsForDates.map((d: any) => ({
            start: new Date(d.start_date),
            end: new Date(d.end_date)
          }));
          
          startDate = toItalianISOString(new Date(Math.min(...dates.map(d => d.start.getTime()))));
          endDate = toItalianISOString(new Date(Math.max(...dates.map(d => d.end.getTime()))));
          
          unitIds.push(...bookingDetailsForDates.map((d: any) => d.unit_id).filter(Boolean));
          
          // Use first booking_detail for time slots and prices (for compatibility with UI)
          const firstDetail = bookingDetailsForDates[0];
          ritiroFasciaorariaInizio = firstDetail.ritiro_fasciaoraria_inizio;
          ritiroFasciaorariaFine = firstDetail.ritiro_fasciaoraria_fine;
          riconsegnaFasciaorariaInizio = firstDetail.riconsegna_fasciaoraria_inizio;
          riconsegnaFasciaorariaFine = firstDetail.riconsegna_fasciaoraria_fine;
          priceDaily = firstDetail.price_daily;
          priceWeekly = firstDetail.price_weekly;
          priceHour = firstDetail.price_hour;
          priceMonth = firstDetail.price_month;
          deposito = firstDetail.deposito;
        }

        // Get product info from product_units -> product_variants -> products
        let productTitle = 'Prodotto non trovato';
        let productBrand = '';
        let productModel = '';
        let productId = '';

        if (unitIds.length > 0) {
          // Get product_units
          const { data: productUnits, error: unitsError } = await supabase
            .from('product_units')
            .select('id, id_product_variant')
            .in('id', unitIds);

          if (!unitsError && productUnits && productUnits.length > 0) {
            const variantIds = [...new Set(productUnits.map((u: any) => u.id_product_variant).filter(Boolean))];
            
            // Get variants
            const { data: variants, error: variantsError } = await supabase
              .from('product_variants')
              .select('id, id_product')
              .in('id', variantIds);

            if (!variantsError && variants && variants.length > 0) {
              const productIdsFromVariants = [...new Set(variants.map((v: any) => v.id_product).filter(Boolean))];
              
              // Get products
              const { data: productsData, error: productsError } = await supabase
                .from('products')
                .select(`
                  id,
                  name,
                  product_brand:id_brand(id, name),
                  product_model:id_model(id, name)
                `)
                .in('id', productIdsFromVariants);

              if (!productsError && productsData && productsData.length > 0) {
                const firstProduct = productsData[0];
                productId = firstProduct.id;
                productTitle = firstProduct.name;
                productBrand = firstProduct.product_brand?.name || '';
                productModel = firstProduct.product_model?.name || '';
              }
            }
          }
        }

        const bookingData: Booking = {
          ...data,
          product_id: productId,
          start_date: startDate,
          end_date: endDate,
          ritiro_fasciaoraria_inizio: ritiroFasciaorariaInizio,
          ritiro_fasciaoraria_fine: ritiroFasciaorariaFine,
          riconsegna_fasciaoraria_inizio: riconsegnaFasciaorariaInizio,
          riconsegna_fasciaoraria_fine: riconsegnaFasciaorariaFine,
          price_daily: priceDaily,
          price_weekly: priceWeekly,
          price_hour: priceHour,
          price_month: priceMonth,
          deposito: deposito,
          user_email: profileData?.email || 'N/A',
          user_name: profileData?.first_name 
            ? `${profileData.first_name} ${profileData.last_name || ''}`.trim()
            : 'N/A',
          user_phone: profileData?.phone || 'N/A',
          product_title: productTitle,
          product_brand: productBrand,
          product_model: productModel,
        };
        setBooking(bookingData);

        // Fetch booking_details
        const { data: detailsData, error: detailsError } = await supabase
          .from('booking_details')
          .select('*')
          .eq('booking_id', id);

        if (detailsError) {
          console.error('Error fetching booking_details:', detailsError);
        } else if (detailsData && detailsData.length > 0) {
          // Get product data for each detail
          // unit_id refers to product_units, not products directly
          const unitIds = [...new Set(detailsData.map(d => d.unit_id).filter(Boolean))] as string[];
          
          if (unitIds.length > 0) {
            // Get product_units
            const { data: productUnits, error: unitsError } = await supabase
              .from('product_units')
              .select('id, id_product_variant')
              .in('id', unitIds);

            if (!unitsError && productUnits && productUnits.length > 0) {
              const variantIds = [...new Set(productUnits.map((u: any) => u.id_product_variant).filter(Boolean))];
              
              // Get variants
              const { data: variants, error: variantsError } = await supabase
                .from('product_variants')
                .select('id, id_product')
                .in('id', variantIds);

              if (!variantsError && variants && variants.length > 0) {
                const productIdsFromVariants = [...new Set(variants.map((v: any) => v.id_product).filter(Boolean))];
                
                // Get products
                const { data: productsData, error: productsError } = await supabase
                  .from('products')
                  .select(`
                    id,
                    name,
                    product_brand:id_brand(id, name),
                    product_model:id_model(id, name)
                  `)
                  .in('id', productIdsFromVariants);

                if (!productsError && productsData) {
                  // Create maps: unit_id -> variant_id -> product_id -> product
                  const unitToVariantMap = new Map((productUnits || []).map((u: any) => [u.id, u.id_product_variant]));
                  const variantToProductMap = new Map((variants || []).map((v: any) => [v.id, v.id_product]));
                  const productsMapById = new Map((productsData || []).map((p: any) => [p.id, {
                    id: p.id,
                    title: p.name,
                    brand: p.product_brand?.name || '',
                    model: p.product_model?.name || '',
                  }]));

                  // Map booking_details to products
                  const detailsWithProducts: BookingDetail[] = detailsData.map((detail: any) => {
                    const variantId = unitToVariantMap.get(detail.unit_id);
                    const productId = variantId ? variantToProductMap.get(variantId) : null;
                    const product = productId ? productsMapById.get(productId) : null;
                    
                    return {
                      ...detail,
                      status: detail.status || null, // Include status explicitly
                      product_title: product?.title || 'Prodotto non trovato',
                      product_brand: product?.brand || '',
                      product_model: product?.model || '',
                    };
                  });

                  // Fetch booking_details_informations for all details
                  const detailIds = detailsWithProducts.map(d => d.id);
                  let informationsMap = new Map<string, BookingDetailInformation[]>();
                  
                  if (detailIds.length > 0) {
                    const { data: bookingDetailsInformations, error: informationsError } = await supabase
                      .from("booking_details_informations")
                      .select(`
                        id,
                        booking_details_id,
                        information_id,
                        value,
                        informations:information_id (
                          id,
                          name,
                          type
                        )
                      `)
                      .in("booking_details_id", detailIds);

                    if (!informationsError && bookingDetailsInformations) {
                      // Raggruppa per booking_details_id
                      bookingDetailsInformations.forEach((info: any) => {
                        const detailId = String(info.booking_details_id);
                        if (!informationsMap.has(detailId)) {
                          informationsMap.set(detailId, []);
                        }
                        
                        let informationObj = null;
                        if (info.informations) {
                          if (Array.isArray(info.informations) && info.informations.length > 0) {
                            informationObj = info.informations[0];
                          } else if (typeof info.informations === 'object') {
                            informationObj = info.informations;
                          }
                        }
                        
                        informationsMap.get(detailId)!.push({
                          id: info.id,
                          information_id: String(info.information_id),
                          value: info.value,
                          information: informationObj ? {
                            id: String(informationObj.id),
                            name: informationObj.name,
                            type: String(informationObj.type)
                          } : undefined
                        });
                      });
                    } else if (informationsError) {
                      console.error('Error fetching booking_details_informations:', informationsError);
                    }
                  }

                  // Aggiungi informations a ogni detail
                  const detailsWithInformations = detailsWithProducts.map(detail => ({
                    ...detail,
                    informations: informationsMap.get(String(detail.id)) || []
                  }));

                  setBookingDetails(detailsWithInformations);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento della prenotazione');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking();
  }, [id]);

  // Funzione per annullare prenotazione con rimborso
  const handleCancelBookingWithRefund = async () => {
    if (!booking || !id) return;
    
    try {
      setIsProcessingRefund(true);
      
      // Chiama l'edge function create-refund-request
      const { data, error: refundError } = await supabase.functions.invoke(
        'create-refund-request',
        {
          method: 'POST',
          body: { booking_id: id },
        }
      );

      if (refundError) {
        throw refundError;
      }

      if (!data?.success) {
        throw new Error(data?.message || data?.error || 'Errore nella richiesta di rimborso');
      }

      // Mostra toast di successo
      toast({
        title: "Rimborso richiesto",
        description: data.message || "La richiesta di rimborso è stata inviata con successo. La prenotazione verrà aggiornata automaticamente.",
      });

      // Ricarica i dati della prenotazione per vedere gli aggiornamenti
      await fetchBooking();
      
      // Chiudi il dialog
      setShowCancelDialog(false);
    } catch (err) {
      console.error('Error processing refund:', err);
      toast({
        title: "Errore",
        description: err instanceof Error ? err.message : "Si è verificato un errore durante la richiesta di rimborso",
        variant: "destructive",
      });
    } finally {
      setIsProcessingRefund(false);
    }
  };

  const updateBookingStatus = async (newStatus: string) => {
    if (!booking) return;
    
    try {
      setIsUpdating(true);
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (error) throw error;

      // ✅ Aggiorna booking_details se status è 'confirmed'
      if (newStatus === 'confirmed') {
        const { error: detailsUpdateError } = await supabase
          .from('booking_details')
          .update({ 
            status: 'to_pickup'
          })
          .eq('booking_id', booking.id);

        if (detailsUpdateError) {
          console.error('Error updating booking_details:', detailsUpdateError);
          // Mostra un toast di warning ma non bloccare
          toast({
            title: "Prenotazione confermata",
            description: "La prenotazione è stata confermata, ma c'è stato un problema nell'aggiornamento dei dettagli.",
            variant: "destructive",
          });
        } else {
          console.log('✅ Booking details updated successfully to to_pickup');
        }
      }

      // ✅ Aggiorna booking_details a 'returned' se status è 'completed'
      if (newStatus === 'completed') {
        const { error: detailsUpdateError } = await supabase
          .from('booking_details')
          .update({ 
            status: 'returned'
          })
          .eq('booking_id', booking.id);

        if (detailsUpdateError) {
          console.error('Error updating booking_details:', detailsUpdateError);
          toast({
            title: "Errore",
            description: "La prenotazione è stata completata, ma c'è stato un problema nell'aggiornamento dello stato dei prodotti.",
            variant: "destructive",
          });
        } else {
          console.log('✅ Booking details updated successfully to returned');
        }
      }

      // Send cancellation email if booking is cancelled
      if (newStatus === 'cancelled' && booking.user_email) {
        try {
          // Format dates for email
          const startDateFormatted = booking.start_date 
            ? format(parseISO(booking.start_date), "dd/MM/yyyy", { locale: it })
            : 'Non specificato';
          const endDateFormatted = booking.end_date
            ? format(parseISO(booking.end_date), "dd/MM/yyyy", { locale: it })
            : 'Non specificato';
          
          // Format delivery method
          const deliveryMethodText = booking.delivery_method === 'pickup' ? 'Ritiro in sede' : 'Consegna a domicilio';

          // Create HTML email content
          const emailHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Cancellazione Prenotazione - Nollix</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                  .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                  .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 20px; text-align: center; }
                  .logo { width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; }
                .logo img { display: block; margin: auto; max-width: 100%; max-height: 100%; }
                  .logo-text { color: white; font-size: 24px; font-weight: bold; }
                  .header-title { color: white; font-size: 28px; font-weight: bold; margin: 0; }
                  .header-subtitle { color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0 0 0; }
                  .content { padding: 40px 20px; }
                  .welcome-text { font-size: 18px; color: #333; margin-bottom: 30px; }
                  .booking-details { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 30px 0; border-radius: 4px; }
                  .booking-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 15px; }
                  .detail-item { margin-bottom: 10px; }
                  .detail-label { font-weight: 600; color: #666; }
                  .detail-value { color: #333; }
                  .booking-ref { font-family: 'Courier New', monospace; background-color: #fee2e2; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; font-weight: bold; }
                  .info-box { background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 15px; margin: 20px 0; }
                  .info-text { color: #92400e; font-size: 14px; margin: 0; }
                  .button { display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
                  .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef; }
                  .footer-text { color: #666; font-size: 14px; margin: 0; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <div class="logo">
                      <img src="https://demo.nollix.it/Nollix_favicon.png" alt="Nollix Logo" style="width: 40px; height: 40px; object-fit: contain;">
                    </div>
                    <h1 class="header-title">Prenotazione Annullata</h1>
                    <p class="header-subtitle">La tua prenotazione è stata cancellata</p>
                  </div>
                  
                  <div class="content">
                    <p class="welcome-text">
                      Ciao <strong>${booking.user_name || 'Utente'}</strong>,
                    </p>
                    
                    <p>La tua prenotazione è stata annullata. Ecco i dettagli:</p>
                    
                    <div class="booking-details">
                      <div class="booking-title">📋 Dettagli Prenotazione Annullata:</div>
                      <div class="detail-item">
                        <span class="detail-label">Riferimento:</span>
                        <span class="booking-ref">${booking.rifPrenotazione}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Prodotto:</span>
                        <span class="detail-value">${booking.product_title}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Data inizio:</span>
                        <span class="detail-value">${startDateFormatted}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Data fine:</span>
                        <span class="detail-value">${endDateFormatted}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Modalità:</span>
                        <span class="detail-value">${deliveryMethodText}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Importo:</span>
                        <span class="detail-value">€${booking.price_total.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div class="info-box">
                      <p class="info-text">
                        <strong>Informazioni importanti:</strong><br>
                        • La prenotazione è stata annullata definitivamente<br>
                        • Se hai effettuato un pagamento, verrà rimborsato secondo i termini del servizio<br>
                        • Per nuove prenotazioni, visita il nostro catalogo<br>
                        • Per assistenza, contattaci tramite il nostro sito web
                      </p>
                    </div>
                    
                    <p>Ci dispiace per l'inconveniente. Grazie per aver scelto Nollix!</p>
                    
                    <a href="https://app.cirqlo.it" class="button">Vai al Catalogo</a>
                  </div>
                  
                  <div class="footer">
                    <p class="footer-text">
                      Questo è un messaggio automatico, per favore non rispondere a questa email.<br>
                      Per assistenza, contattaci tramite il nostro sito web.
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `;
          
                     const { error: emailError } = await supabase.functions.invoke('send-email', {
                      method: 'POST',
             body: {
               to: booking.user_email,
               subject: `Cancellazione Prenotazione - ${booking.rifPrenotazione}`,
               html: emailHtml,
             },
           });

           if (emailError) {
             console.error('[DEBUG] Error sending cancellation email:', emailError);
             toast({
               title: "Prenotazione annullata ma email non inviata",
               description: "La prenotazione è stata annullata con successo, ma l'email di cancellazione non è stata inviata. Contatta il cliente manualmente.",
               variant: "destructive",
             });
           } else {
             console.log('[DEBUG] Cancellation email sent successfully');
             toast({
               title: "Email inviata!",
               description: `Email di cancellazione inviata a ${booking.user_email}`,
             });
           }
         } catch (emailError) {
           console.error('[DEBUG] Error in cancellation email:', emailError);
           toast({
             title: "Prenotazione annullata ma email non inviata",
             description: "La prenotazione è stata annullata con successo, ma l'email di cancellazione non è stata inviata. Contatta il cliente manualmente.",
             variant: "destructive",
           });
         }

      }

      // Refresh booking data
      await fetchBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nell\'aggiornamento dello stato');
    } finally {
      setIsUpdating(false);
    }
  };

  const getProductStatusBadge = (status: string | null | undefined) => {
    if (!status) {
      // Se lo status è null o undefined, considera come 'to_pickup' se la prenotazione è confermata
      if (booking?.status === 'confirmed') {
        return <Badge variant="secondary" className="bg-red-900 text-red-100 border-red-800">Da ritirare</Badge>;
      }
      return null;
    }

    // Normalizza lo status (gestisce sia 'to_pickup' che 'toPickup' per compatibilità)
    let normalizedStatus = status;
    if (status === 'to_pickup' || status === 'idle' || !status) normalizedStatus = 'toPickup';
    if (status === 'picked_up') normalizedStatus = 'pickedUp';

    switch (normalizedStatus) {
      case 'toPickup':
      case 'idle':
        return <Badge variant="secondary" className="bg-red-900 text-red-100 border-red-800">Da ritirare</Badge>;
      case 'pickedUp':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">Ritirato</Badge>;
      case 'to_return':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Da riconsegnare</Badge>;
      case 'returned':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Riconsegnata</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calcola lo stato complessivo dei prodotti della prenotazione
  const getOverallProductsStatus = () => {
    if (!bookingDetails || bookingDetails.length === 0) {
      return null;
    }

    // Normalizza gli status dei prodotti (gestisce compatibilità)
    const normalizedStatuses = bookingDetails.map((detail) => {
      const status = detail.status;
      if (!status || status === 'to_pickup') return 'to_pickup';
      return status;
    });

    // Conta quanti prodotti sono ritirati e riconsegnati
    const pickedUpCount = normalizedStatuses.filter((s) => s === 'picked_up').length;
    const returnedCount = normalizedStatuses.filter((s) => s === 'returned').length;
    const totalCount = normalizedStatuses.length;

    // Se tutti i prodotti sono riconsegnati
    if (returnedCount === totalCount && totalCount > 0) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">Riconsegnata</Badge>;
    }

    // Se tutti i prodotti sono ritirati
    if (pickedUpCount === totalCount && totalCount > 0) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">Ritirata</Badge>;
    }

    // Se alcuni prodotti sono ritirati ma non tutti
    if (pickedUpCount > 0 && pickedUpCount < totalCount) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300">Parzi. Ritirato</Badge>;
    }

    // Se nessun prodotto è ritirato
    return null;
  };

  // Verifica se tutti i prodotti sono ritirati
  const areAllProductsPickedUp = () => {
    if (!bookingDetails || bookingDetails.length === 0) {
      return false;
    }

    // Controlla sia 'picked_up' (snake_case) che 'pickedUp' (camelCase) per compatibilità
    const pickedUpCount = bookingDetails.filter((detail) => {
      const status = detail.status;
      return status === 'picked_up' || status === 'pickedUp';
    }).length;
    const totalCount = bookingDetails.length;

    return pickedUpCount === totalCount && totalCount > 0;
  };

  // Verifica se tutti i prodotti sono riconsegnati
  const areAllProductsReturned = () => {
    if (!bookingDetails || bookingDetails.length === 0) {
      return false;
    }

    const normalizedStatuses = bookingDetails.map((detail) => {
      const status = detail.status;
      return status;
    });

    const returnedCount = normalizedStatuses.filter((s) => s === 'returned').length;
    const totalCount = normalizedStatuses.length;

    return returnedCount === totalCount && totalCount > 0;
  };

  // Verifica se tutti i prodotti sono da ritirare
  const areAllProductsToPickup = () => {
    if (!bookingDetails || bookingDetails.length === 0) {
      return false;
    }

    // Considera "da ritirare" tutti gli stati: null, 'idle', 'toPickup', 'to_pickup'
    const toPickupCount = bookingDetails.filter((detail) => {
      const status = detail.status;
      return !status || 
             status === 'idle' || 
             status === 'toPickup' || 
             status === 'to_pickup';
    }).length;
    const totalCount = bookingDetails.length;

    return toPickupCount === totalCount && totalCount > 0;
  };

  // Funzione per ritirare tutti i prodotti
  const handleRitiraTutto = async () => {
    if (!booking || !id) return;
    
    try {
      setIsUpdating(true);
      
      // Aggiorna tutti i booking_details collegati alla prenotazione che sono ancora da ritirare
      console.log('[ADMIN DEBUG] Updating booking_details to pickedUp for booking:', id);
      const { error: updateError, data: updateData } = await supabase
        .from('booking_details')
        .update({ status: 'pickedUp' })
        .eq('booking_id', id)
        .or('status.is.null,status.eq.idle,status.eq.toPickup,status.eq.to_pickup')
        .select();

      if (updateError) {
        console.error('[ADMIN DEBUG] Error updating booking_details:', updateError);
        toast({
          title: "Errore",
          description: "Errore durante l'aggiornamento dello stato dei prodotti",
          variant: "destructive",
        });
        return;
      }

      console.log('[ADMIN DEBUG] Successfully updated booking_details:', updateData?.length || 0, 'details');
      toast({
        title: "Successo",
        description: "Tutti i prodotti sono stati marcati come ritirati",
      });

      // Ricarica i dati per aggiornare la visualizzazione
      await fetchBooking();
    } catch (err) {
      console.error('Error in handleRitiraTutto:', err);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il ritiro",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Funzione per annullare il ritiro di tutti i prodotti
  const handleAnnullaRitiro = async () => {
    if (!booking || !id) return;
    
    try {
      setIsUpdating(true);
      
      // Aggiorna tutti i booking_details collegati alla prenotazione tornando a 'toPickup'
      console.log('[ADMIN DEBUG] Updating booking_details to toPickup for booking:', id);
      const { error: updateError, data: updateData } = await supabase
        .from('booking_details')
        .update({ status: 'toPickup' })
        .eq('booking_id', id)
        .or('status.eq.pickedUp,status.eq.picked_up')
        .select();

      if (updateError) {
        console.error('[ADMIN DEBUG] Error updating booking_details:', updateError);
        toast({
          title: "Errore",
          description: "Errore durante l'annullamento del ritiro",
          variant: "destructive",
        });
        return;
      }

      console.log('[ADMIN DEBUG] Successfully updated booking_details to toPickup:', updateData?.length || 0, 'details');
      toast({
        title: "Successo",
        description: "Il ritiro di tutti i prodotti è stato annullato",
      });

      // Ricarica i dati per aggiornare la visualizzazione
      await fetchBooking();
    } catch (err) {
      console.error('Error in handleAnnullaRitiro:', err);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'annullamento",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Funzione per annullare la riconsegna di tutti i prodotti
  const handleAnnullaRiconsegna = async () => {
    if (!booking || !id) return;
    
    try {
      setIsUpdating(true);
      
      // Aggiorna tutti i booking_details collegati alla prenotazione tornando a 'pickedUp'
      const { error: updateError } = await supabase
        .from('booking_details')
        .update({ status: 'pickedUp' })
        .eq('booking_id', id)
        .eq('status', 'returned');

      if (updateError) {
        console.error('Error updating booking_details:', updateError);
        toast({
          title: "Errore",
          description: "Errore durante l'annullamento della riconsegna",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Successo",
        description: "La riconsegna di tutti i prodotti è stata annullata",
      });

      // Ricarica i dati per aggiornare la visualizzazione
      fetchBooking();
    } catch (err) {
      console.error('Error in handleAnnullaRiconsegna:', err);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'annullamento",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Funzione per annullare il completamento della prenotazione
  const handleAnnullaCompletamento = async () => {
    if (!booking || !id) return;
    
    try {
      setIsUpdating(true);
      
      // Aggiorna lo status della prenotazione da 'completed' a 'confirmed'
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', id);

      if (bookingError) {
        console.error('Error updating booking:', bookingError);
        toast({
          title: "Errore",
          description: "Errore durante l'aggiornamento dello stato della prenotazione",
          variant: "destructive",
        });
        return;
      }

      // Aggiorna tutti i booking_details collegati alla prenotazione tornando a 'picked_up'
      // (riportiamo i prodotti allo stato precedente alla riconsegna)
      const { error: detailsError } = await supabase
        .from('booking_details')
        .update({ status: 'pickedUp' })
        .eq('booking_id', id)
        .eq('status', 'returned');

      if (detailsError) {
        console.error('Error updating booking_details:', detailsError);
        toast({
          title: "Errore",
          description: "Errore durante l'aggiornamento dello stato dei prodotti",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Successo",
        description: "Il completamento della prenotazione è stato annullato",
      });

      // Ricarica i dati per aggiornare la visualizzazione
      fetchBooking();
    } catch (err) {
      console.error('Error in handleAnnullaCompletamento:', err);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'annullamento del completamento",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Funzione per ritirare un singolo prodotto
  const handleRitiraSingolo = async (detailId: string) => {
    if (!booking || !id) return;
    
    try {
      setIsUpdating(true);
      
      // Aggiorna lo status del singolo booking_detail a 'pickedUp'
      const { error: updateError } = await supabase
        .from('booking_details')
        .update({ status: 'pickedUp' })
        .eq('id', detailId)
        .or('status.is.null,status.eq.idle,status.eq.toPickup,status.eq.to_pickup');

      if (updateError) {
        console.error('Error updating booking_detail:', updateError);
        toast({
          title: "Errore",
          description: "Errore durante l'aggiornamento dello stato del prodotto",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Successo",
        description: "Il prodotto è stato marcato come ritirato",
      });

      // Ricarica i dati per aggiornare la visualizzazione
      fetchBooking();
    } catch (err) {
      console.error('Error in handleRitiraSingolo:', err);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il ritiro",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Funzione per riconsegnare tutti i prodotti
  const handleRiconsegnaTutto = async () => {
    if (!booking || !id) return;
    
    try {
      setIsUpdating(true);
      
      // Aggiorna tutti i booking_details collegati alla prenotazione a 'returned'
      const { error: updateError } = await supabase
        .from('booking_details')
        .update({ status: 'returned' })
        .eq('booking_id', id)
        .or('status.eq.pickedUp,status.eq.picked_up');

      if (updateError) {
        console.error('Error updating booking_details:', updateError);
        toast({
          title: "Errore",
          description: "Errore durante l'aggiornamento dello stato dei prodotti",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Successo",
        description: "Tutti i prodotti sono stati marcati come riconsegnati",
      });

      // Ricarica i dati per aggiornare la visualizzazione
      await fetchBooking();
    } catch (err) {
      console.error('Error in handleRiconsegnaTutto:', err);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la riconsegna",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Funzione per riconsegnare un singolo prodotto
  const handleRiconsegnaSingolo = async (detailId: string) => {
    if (!booking || !id) return;
    
    try {
      setIsUpdating(true);
      
      // Aggiorna lo status del singolo booking_detail a 'returned'
      const { error: updateError } = await supabase
        .from('booking_details')
        .update({ status: 'returned' })
        .eq('id', detailId)
        .or('status.eq.pickedUp,status.eq.picked_up');

      if (updateError) {
        console.error('Error updating booking_detail:', updateError);
        toast({
          title: "Errore",
          description: "Errore durante l'aggiornamento dello stato del prodotto",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Successo",
        description: "Il prodotto è stato marcato come riconsegnato",
      });

      // Ricarica i dati per aggiornare la visualizzazione
      fetchBooking();
    } catch (err) {
      console.error('Error in handleRiconsegnaSingolo:', err);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la riconsegna",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Non specificato';
    try {
      return format(parseISO(dateString), "dd/MM/yyyy", { locale: it });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Data non valida';
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'N/A';
    return format(parseISO(`2000-01-01T${timeString}`), "HH:mm");
  };

  const calculateDuration = (startDate: string | undefined, endDate: string | undefined) => {
    if (!startDate || !endDate) return 0;
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      // Durata inclusiva: se inizio è 1 gen e fine è 3 gen, sono 3 giorni (1, 2, 3)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    } catch (error) {
      console.error('Error calculating duration:', error);
      return 0;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'cart':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Nel carrello</Badge>;
      case 'confirmed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">Confermata</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Annullata</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Completata</Badge>;
      case 'pendingRefund':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Rimborso in attesa</Badge>;
      case 'succeededRefund':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Rimborso completato</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDeliveryBadge = (method: string) => {
    switch (method) {
      case 'pickup':
        return <Badge variant="outline" className="border-blue-200 text-blue-700">Ritiro in sede</Badge>;
      case 'delivery':
        return <Badge variant="outline" className="border-green-200 text-green-700">Consegna a domicilio</Badge>;
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Caricamento dettagli prenotazione...</p>
            </div>
          </div>
        </div>
        <AdminFooter />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Errore</h2>
              <p className="text-gray-600 mb-4">{error || 'Prenotazione non trovata'}</p>
              <Button onClick={() => navigate('/admin/bookings')}>
                Torna alle prenotazioni
              </Button>
            </div>
          </div>
        </div>
        <AdminFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline" 
              onClick={() => {
                if (fromDailyBookings && dailyBookingsDate) {
                  navigate('/admin/daily-bookings', { state: { date: dailyBookingsDate } });
                } else {
                  navigate('/admin/bookings');
                }
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Indietro
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">
              Prenotazione #{booking.rifPrenotazione}
            </h1>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              {getStatusBadge(booking.status)}
              {getOverallProductsStatus()}
              {getDeliveryBadge(booking.delivery_method)}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-gray-600">
              Dettagli completi della prenotazione
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonna principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informazioni cliente */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informazioni Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nome completo</label>
                    <p className="text-gray-900 font-medium">{booking.user_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-900">{booking.user_email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Telefono</label>
                    <p className="text-gray-900 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {booking.user_phone}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Prodotti prenotati - Mostra booking_details se presenti, altrimenti mostra il prodotto principale */}
            {bookingDetails.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Prodotti Prenotati ({bookingDetails.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Pulsanti per ritirare/annullare tutti i prodotti */}
                  {booking?.status === 'confirmed' && (
                    <div className="flex gap-2 mb-4 pb-4 border-b">
                      {areAllProductsReturned() ? (
                        <Button
                          disabled={true}
                          className="flex-1 bg-purple-600 text-white opacity-50 cursor-not-allowed"
                          size="sm"
                        >
                          RICONSEGNA TUTTO
                        </Button>
                      ) : areAllProductsPickedUp() ? (
                        <Button
                          onClick={handleRiconsegnaTutto}
                          disabled={isUpdating}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                          size="sm"
                        >
                          {isUpdating ? "Elaborazione..." : "RICONSEGNA TUTTO"}
                        </Button>
                      ) : (
                        <Button
                          onClick={handleRitiraTutto}
                          disabled={isUpdating || areAllProductsPickedUp()}
                          className={cn(
                            "flex-1 bg-green-600 hover:bg-green-700 text-white",
                            areAllProductsPickedUp() && "opacity-50 cursor-not-allowed"
                          )}
                          size="sm"
                        >
                          {isUpdating ? "Elaborazione..." : "RITIRA TUTTO"}
                        </Button>
                      )}
                      {areAllProductsReturned() ? (
                        <Button
                          onClick={handleAnnullaRiconsegna}
                          disabled={isUpdating}
                          variant="outline"
                          className="flex-1 border-red-600 text-red-600 hover:bg-red-50"
                          size="sm"
                        >
                          {isUpdating ? "Elaborazione..." : "ANNULLA RICONSEGNA"}
                        </Button>
                      ) : (
                        <Button
                          onClick={handleAnnullaRitiro}
                          disabled={isUpdating || areAllProductsToPickup()}
                          variant="outline"
                          className={cn(
                            "flex-1 border-red-600 text-red-600 hover:bg-red-50",
                            areAllProductsToPickup() && "opacity-50 cursor-not-allowed"
                          )}
                          size="sm"
                        >
                          {isUpdating ? "Elaborazione..." : "ANNULLA RITIRO"}
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="space-y-4">
                    {bookingDetails.map((detail, index) => (
                      <div key={detail.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              Prodotto {index + 1}
                            </Badge>
                            {getProductStatusBadge(detail.status)}
                          </div>
                          <Badge variant="secondary" className="font-semibold">
                            €{detail.price.toFixed(2)}
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-gray-700">Titolo prodotto</label>
                            <p className="text-gray-900 font-medium">{detail.product_title || 'N/A'}</p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Marca</label>
                              <p className="text-gray-900">{detail.product_brand || 'N/A'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700">Modello</label>
                              <p className="text-gray-900">{detail.product_model || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Data inizio</label>
                              <p className="text-gray-900">{formatDate(detail.start_date)}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700">Data fine</label>
                              <p className="text-gray-900">{formatDate(detail.end_date)}</p>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">Modalità</label>
                            <p className="text-gray-900">{detail.delivery_method === 'pickup' ? 'Ritiro in sede' : 'Consegna a domicilio'}</p>
                          </div>
                          {(detail.ritiro_fasciaoraria_inizio || detail.riconsegna_fasciaoraria_inizio) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {detail.ritiro_fasciaoraria_inizio && (
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Fascia oraria ritiro</label>
                                  <p className="text-gray-900">
                                    {formatTime(detail.ritiro_fasciaoraria_inizio)} - {formatTime(detail.ritiro_fasciaoraria_fine)}
                                  </p>
                                </div>
                              )}
                              {detail.riconsegna_fasciaoraria_inizio && (
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Fascia oraria riconsegna</label>
                                  <p className="text-gray-900">
                                    {formatTime(detail.riconsegna_fasciaoraria_inizio)} - {formatTime(detail.riconsegna_fasciaoraria_fine)}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          {/* Informazioni aggiuntive dinamiche */}
                          {detail.informations && detail.informations.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <label className="text-sm font-medium text-gray-700 mb-2 block">Informazioni Aggiuntive</label>
                              <div className="space-y-2">
                                {detail.informations.map((info) => {
                                  // Parse il valore se è JSON
                                  let displayValue: string = '';
                                  try {
                                    if (info.value) {
                                      const parsed = JSON.parse(info.value);
                                      if (Array.isArray(parsed)) {
                                        displayValue = parsed.join(', ');
                                      } else if (typeof parsed === 'object') {
                                        displayValue = JSON.stringify(parsed, null, 2);
                                      } else {
                                        displayValue = String(parsed);
                                      }
                                    }
                                  } catch {
                                    // Se non è JSON, usa il valore direttamente
                                    displayValue = info.value || '';
                                  }

                                  return (
                                    <div key={info.id} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 text-sm">
                                      <span className="text-gray-600 font-medium min-w-[120px]">
                                        {info.information?.name || 'Campo'}:
                                      </span>
                                      <span className="text-gray-900 flex-1">
                                        {displayValue || <span className="text-gray-400 italic">Non specificato</span>}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {detail.deposito && Number(detail.deposito) > 0 && (
                            <div>
                              <label className="text-sm font-medium text-gray-700">Cauzione</label>
                              <p className="text-gray-900">€{detail.deposito.toFixed(2)}</p>
                            </div>
                          )}
                          {/* Pulsante per ritirare/riconsegnare singolarmente il prodotto */}
                          {booking?.status === 'confirmed' && (
                            <div className="pt-2 mt-2 border-t">
                              {areAllProductsReturned() ? (
                                <Button
                                  disabled={true}
                                  className="w-full bg-purple-600 text-white text-xs py-1 h-7 opacity-50 cursor-not-allowed"
                                  size="sm"
                                >
                                  RICONSEGNA PRODOTTO
                                </Button>
                              ) : (detail.status === 'picked_up' || detail.status === 'pickedUp') ? (
                                <Button
                                  onClick={() => handleRiconsegnaSingolo(detail.id)}
                                  disabled={isUpdating || areAllProductsReturned()}
                                  className={cn(
                                    "w-full bg-purple-600 hover:bg-purple-700 text-white text-xs py-1 h-7",
                                    areAllProductsReturned() && "opacity-50 cursor-not-allowed"
                                  )}
                                  size="sm"
                                >
                                  {isUpdating ? "Elaborazione..." : "RICONSEGNA PRODOTTO"}
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => handleRitiraSingolo(detail.id)}
                                  disabled={isUpdating || areAllProductsPickedUp()}
                                  className={cn(
                                    "w-full bg-green-600 hover:bg-green-700 text-white text-xs py-1 h-7",
                                    areAllProductsPickedUp() && "opacity-50 cursor-not-allowed"
                                  )}
                                  size="sm"
                                >
                                  {isUpdating ? "Elaborazione..." : "RITIRA PRODOTTO"}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Prodotto Noleggiato
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Titolo prodotto</label>
                      <p className="text-gray-900 font-medium text-lg">{booking.product_title}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Marca</label>
                        <p className="text-gray-900">{booking.product_brand || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Modello</label>
                        <p className="text-gray-900">{booking.product_model || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Date e orari */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Date e Orari
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Calcola le date dai bookingDetails */}
                  {(() => {
                    // Calcola data inizio (min) e data fine (max) dai bookingDetails
                    let calculatedStartDate: string | undefined = undefined;
                    let calculatedEndDate: string | undefined = undefined;
                    
                    if (bookingDetails && bookingDetails.length > 0) {
                      const validDetails = bookingDetails.filter((d: BookingDetail) => d.start_date && d.end_date);
                      
                      if (validDetails.length > 0) {
                        // Trova la data di inizio minima e la data di fine massima
                        const startDates = validDetails.map((d: BookingDetail) => new Date(d.start_date!));
                        const endDates = validDetails.map((d: BookingDetail) => new Date(d.end_date!));
                        
                        const minStart = new Date(Math.min(...startDates.map(d => d.getTime())));
                        const maxEnd = new Date(Math.max(...endDates.map(d => d.getTime())));
                        
                        // Converti in formato ISO string (YYYY-MM-DDTHH:mm:ss.sss)
                        calculatedStartDate = toItalianISOString(minStart);
                        calculatedEndDate = toItalianISOString(maxEnd);
                      }
                    }
                    
                    // Fallback alle date del booking se i bookingDetails non sono disponibili
                    const startDate = calculatedStartDate || booking.start_date;
                    const endDate = calculatedEndDate || booking.end_date;
                    
                    return (
                      <>
                        {/* Date principali */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <label className="text-sm font-medium text-blue-700">Data inizio noleggio</label>
                            <p className="text-blue-900 font-bold text-lg">{formatDate(startDate)}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg">
                            <label className="text-sm font-medium text-green-700">Data fine noleggio</label>
                            <p className="text-green-900 font-bold text-lg">{formatDate(endDate)}</p>
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <label className="text-sm font-medium text-gray-700">Durata totale</label>
                          <p className="text-gray-900 font-bold text-lg">
                            {calculateDuration(startDate, endDate)} giorni
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            {/* Azioni */}
            <Card>
              <CardHeader>
                <CardTitle>Azioni</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {booking.status === 'cart' && (
                    <>
                      <Button 
                        onClick={() => updateBookingStatus('confirmed')}
                        disabled={isUpdating}
                        className="w-full"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Conferma Prenotazione
                      </Button>
                      <Button 
                        onClick={() => setShowCancelDialog(true)}
                        disabled={isUpdating || isProcessingRefund}
                        variant="destructive"
                        className="w-full"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Annulla Prenotazione
                      </Button>
                    </>
                  )}
                  {booking.status === 'confirmed' && (
                    <>
                      <Button 
                        onClick={() => updateBookingStatus('completed')}
                        disabled={isUpdating}
                        className="w-full"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Segna come Completata
                      </Button>
                      <Button 
                        onClick={() => setShowCancelDialog(true)}
                        disabled={isUpdating || isProcessingRefund}
                        variant="destructive"
                        className="w-full"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Annulla Prenotazione
                      </Button>
                    </>
                  )}
                  {booking.status === 'completed' && (
                    <>
                      <Button 
                        onClick={handleAnnullaCompletamento}
                        disabled={isUpdating}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white text-sm py-2 h-9"
                        size="sm"
                      >
                        <XCircle className="h-3 w-3 mr-2" />
                        ANNULLA COMPLETAMENTO
                      </Button>
                      <Button 
                        onClick={() => setShowCancelDialog(true)}
                        disabled={isUpdating || isProcessingRefund}
                        variant="destructive"
                        className="w-full"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Annulla Prenotazione
                      </Button>
                    </>
                  )}
                  {booking.status === 'cancelled' && (
                    <p className="text-sm text-gray-600 text-center">
                      Prenotazione annullata - Nessuna azione disponibile
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Prezzi e pagamento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Prezzi e Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Totale */}
                  <div className="bg-green-50 p-4 rounded-lg">
                    <label className="text-sm font-medium text-green-700">Totale Prenotazione</label>
                    <p className="text-green-900 font-bold text-2xl">€{booking.price_total.toFixed(2)}</p>
                  </div>

                  {/* Cauzione */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <label className="text-sm font-medium text-blue-700">Cauzione</label>
                    <p className="text-blue-900 font-semibold text-lg">
                      {booking.deposito && Number(booking.deposito) > 0 
                        ? `€${booking.deposito.toFixed(2)}` 
                        : 'Non prevista'
                      }
                    </p>
                  </div>

                  {/* Dettaglio prezzi */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Dettaglio Prezzi</h4>
                    <div className="space-y-2 text-sm">
                      {booking.price_daily && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Prezzo giornaliero:</span>
                          <span className="font-medium">€{booking.price_daily.toFixed(2)}</span>
                        </div>
                      )}
                      {booking.price_weekly && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Prezzo settimanale:</span>
                          <span className="font-medium">€{booking.price_weekly.toFixed(2)}</span>
                        </div>
                      )}
                      {booking.price_month && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Prezzo mensile:</span>
                          <span className="font-medium">€{booking.price_month.toFixed(2)}</span>
                        </div>
                      )}
                      {booking.price_hour && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Prezzo orario:</span>
                          <span className="font-medium">€{booking.price_hour.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informazioni aggiuntive */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Informazioni Aggiuntive
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <label className="font-medium text-gray-700">Modalità di ritiro</label>
                    <p className="text-gray-900">{booking.delivery_method === 'pickup' ? 'Ritiro in sede' : 'Consegna a domicilio'}</p>
                  </div>
                  {booking.delivery_address && (
                    <div>
                      <label className="font-medium text-gray-700">Indirizzo di consegna</label>
                      <p className="text-gray-900 flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {booking.delivery_address}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="font-medium text-gray-700">Prenotazione creata</label>
                    <p className="text-gray-900 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {formatDate(booking.created_at)}
                    </p>
                  </div>
                  {booking.updated_at !== booking.created_at && (
                    <div>
                      <label className="font-medium text-gray-700">Ultimo aggiornamento</label>
                      <p className="text-gray-900">{formatDate(booking.updated_at)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
      
      <AdminFooter />

      {/* Dialog di conferma per annullare prenotazione */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Annullamento e Rimborso</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler annullare questa prenotazione e avviare la procedura di rimborso?
              <br /><br />
              Verrà creata una richiesta di rimborso su Stripe e la prenotazione verrà aggiornata automaticamente.
              {booking && (
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  <p className="text-sm font-medium">Prenotazione #{booking.rifPrenotazione}</p>
                  {booking.user_name && (
                    <p className="text-sm text-gray-600">Cliente: {booking.user_name}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">Importo: €{booking.price_total.toFixed(2)}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessingRefund}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBookingWithRefund}
              disabled={isProcessingRefund}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessingRefund ? "Elaborazione rimborso..." : "Conferma Annullamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminBookingDetail; 