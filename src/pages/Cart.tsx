import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import { format, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, CheckCircle, Trash2, Calendar, Clock, MapPin, Info, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { DEFAULT_IMAGES } from "@/constants";
import { useShopDaysOff, isDateWithEnabledBooking } from '@/hooks/useShopDaysOff';

interface BookingDetailInformation {
  id: string;
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
  products?: {
    id: string;
    title: string;
    brand: string;
    model: string;
    images: string[];
    variantAttributes?: { name: string; value: string; unit?: string }[];
  };
  informations?: BookingDetailInformation[];
}

interface CartBooking {
  id: string;
  user_id: string;
  cart: boolean;
  booking_details?: BookingDetail[];
}

export default function Cart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [expandedInformations, setExpandedInformations] = useState<Set<string>>(new Set());
  const { data: shopDaysOff = [] } = useShopDaysOff();
  
  // Check if payment was canceled
  useEffect(() => {
    if (searchParams.get('canceled') === 'true') {
      toast({
        title: "Pagamento annullato",
        description: "Il pagamento è stato annullato. Puoi riprovare quando sei pronto.",
        variant: "default",
      });
      // Remove the query parameter from URL
      navigate('/cart', { replace: true });
    }
  }, [searchParams, navigate, toast]);

  // Fetch cart booking with details
  const { data: cartData, isLoading, error: cartError } = useQuery({
    queryKey: ["cart", user?.id],
    staleTime: 0,
    queryFn: async () => {
      if (!user?.id) {
        console.log('[CART DEBUG] No user ID');
        return null;
      }

      console.log('[CART DEBUG] Fetching cart for user:', user.id);

      // First, let's check all bookings for this user to see what we have
      const { data: allBookings, error: allBookingsError } = await supabase
        .from("bookings")
        .select("id, user_id, cart, status")
        .eq("user_id", user.id);

      if (allBookingsError) {
        console.error('[CART DEBUG] Error fetching all bookings:', allBookingsError);
        throw allBookingsError;
      }

      console.log('[CART DEBUG] All bookings for user:', allBookings);
      console.log('[CART DEBUG] Bookings with cart=true:', allBookings?.filter(b => b.cart === true));
      console.log('[CART DEBUG] Bookings with cart=null:', allBookings?.filter(b => b.cart === null || b.cart === undefined));
      console.log('[CART DEBUG] Bookings with cart=false:', allBookings?.filter(b => b.cart === false));

      // Find booking with cart=true (explicitly true, not null or false)
      let cartBooking = allBookings?.find(b => b.cart === true);
      
      if (!cartBooking) {
        console.log('[CART DEBUG] No booking found with cart=true for user:', user.id);
        console.log('[CART DEBUG] Creating empty cart booking...');
        
        // Create empty cart booking
        const { data: newCartBooking, error: createError } = await supabase
          .from('bookings')
          .insert({
            user_id: user.id,
            price_total: 0, // Empty cart has 0 total
            delivery_method: 'pickup', // Default, can be changed later
            delivery_address: null,
            status: 'cart',
            cart: true,
          })
          .select('id, user_id, price_total, delivery_method, delivery_address, status, created_at, updated_at, rifPrenotazione, cart')
          .maybeSingle();
        
        if (createError) {
          console.error('[CART DEBUG] Error creating empty cart booking:', createError);
          throw createError;
        }
        
        if (!newCartBooking) {
          console.error('[CART DEBUG] Failed to create empty cart booking');
          return null;
        }
        
        console.log('[CART DEBUG] Created empty cart booking:', newCartBooking);
        cartBooking = newCartBooking;
      }

      // Get cart booking with full data
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("id, user_id, cart")
        .eq("id", cartBooking.id)
        .single();

      if (bookingError && bookingError.code !== 'PGRST116') {
        console.error('[CART DEBUG] Error fetching cart booking:', bookingError);
        throw bookingError;
      }

      if (!booking) {
        console.log('[CART DEBUG] No booking found with cart=true or null for user:', user.id);
        return null;
      }

      console.log('[CART DEBUG] Found booking:', booking);

      // Get booking details
      const { data: details, error: detailsError } = await supabase
        .from("booking_details")
        .select("*")
        .eq("booking_id", booking.id);

      if (detailsError) {
        console.error('[CART DEBUG] Error fetching booking_details:', detailsError);
        throw detailsError;
      }

      console.log('[CART DEBUG] Found booking_details:', details);

      if (!details || details.length === 0) {
        console.log('[CART DEBUG] No booking_details found for booking:', booking.id);
        return {
          ...booking,
          booking_details: []
        } as CartBooking;
      }

      // Get products separately
      // unit_id now refers to product_units, not products directly
      // We need to get product_units -> product_variants -> products
      const unitIds = [...new Set(details.map(d => d.unit_id).filter(Boolean) as string[])];
      
      let productsMap = new Map();
      if (unitIds.length > 0) {
        // Step 1: Get product_units with variant IDs
        const { data: productUnits, error: unitsError } = await supabase
          .from("product_units")
          .select("id, id_product_variant")
          .in("id", unitIds);

        if (unitsError) {
          console.error('[CART DEBUG] Error fetching product_units:', unitsError);
          throw unitsError;
        }

        if (!productUnits || productUnits.length === 0) {
          console.warn('[CART DEBUG] No product_units found for unit_ids:', unitIds);
        } else {
          // Step 2: Get variant IDs and fetch variants with attributes
          const variantIds = [...new Set(productUnits.map((u: any) => u.id_product_variant).filter(Boolean))];
          
          const { data: variants, error: variantsError } = await supabase
            .from("product_variants")
            .select(`
              id, 
              id_product, 
              images,
              product_variant_attribute_values(
                id_product_attribute_value,
                product_attributes_values!inner(
                  id,
                  value,
                  id_product_attribute,
                  product_attributes!inner(id, name, unit)
                )
              )
            `)
            .in("id", variantIds);

          if (variantsError) {
            console.error('[CART DEBUG] Error fetching product_variants:', variantsError);
            throw variantsError;
          }
          
          console.log('[CART DEBUG] Fetched variants:', variants);
          console.log('[CART DEBUG] First variant sample:', variants?.[0]);

          // Step 3: Get product IDs and fetch products
          const productIds = [...new Set((variants || []).map((v: any) => v.id_product).filter(Boolean))];
          
          const { data: products, error: productsError } = await supabase
            .from("products")
            .select(`
              id,
              name,
              product_brand:id_brand(id, name),
              product_model:id_model(id, name)
            `)
            .in("id", productIds);

          if (productsError) {
            console.error('[CART DEBUG] Error fetching products:', productsError);
            throw productsError;
          }

          console.log('[CART DEBUG] Fetched products:', products);
          console.log('[CART DEBUG] Product IDs:', productIds);
          console.log('[CART DEBUG] Product names:', products?.map((p: any) => ({ id: p.id, name: p.name })));

          // Step 4: Create maps for easy lookup
          const variantsMap = new Map((variants || []).map((v: any) => [v.id, v]));
          const productsMapById = new Map((products || []).map((p: any) => [p.id, p]));

          // Step 5: Map unit_id -> product info with variant attributes
          const mappedProducts = (productUnits || []).map((unit: any) => {
            const variant = variantsMap.get(unit.id_product_variant);
            const product = variant ? productsMapById.get(variant.id_product) : null;
            
            console.log('[CART DEBUG] Mapping unit:', unit.id, 'variant:', variant?.id, 'product:', product, 'product.name:', product?.name);
            
            // Extract variant attributes (stesso formato di ProductStock.tsx)
            const variantAttributes: { name: string; value: string; unit?: string }[] = [];
            if (variant?.product_variant_attribute_values) {
              console.log('[CART DEBUG] Variant attribute values:', variant.product_variant_attribute_values);
              (variant.product_variant_attribute_values || []).forEach((pvav: any) => {
                if (pvav.product_attributes_values) {
                  const attrValue = pvav.product_attributes_values;
                  // Gestisci sia array che oggetto singolo
                  const attrValueData = Array.isArray(attrValue) ? attrValue[0] : attrValue;
                  
                  if (attrValueData) {
                    const attrName = attrValueData.product_attributes?.name || '';
                    const attrUnit = attrValueData.product_attributes?.unit || '';
                    const value = attrValueData.value || '';
                    
                    if (attrName && value) {
                      variantAttributes.push({
                        name: attrName,
                        value: value,
                        unit: attrUnit || undefined
                      });
                    }
                  }
                }
              });
            }
            console.log('[CART DEBUG] Extracted variant attributes:', variantAttributes);
            
            const productTitle = product?.name ? 
              (product.name.trim() || 'Prodotto') : 
              'Prodotto';
            
            return {
              unitId: unit.id,
              product: product ? {
                id: product.id,
                title: productTitle, // Map 'name' from products table to 'title' for UI
                brand: product.product_brand?.name || '',
                model: product.product_model?.name || '',
                images: variant?.images || [],
                variantAttributes: variantAttributes.length > 0 ? variantAttributes : undefined,
              } : null
            };
          });

          // Create map: unit_id -> product info (only include non-null products)
          productsMap = new Map(
            mappedProducts
              .filter((p: any) => p.product !== null)
              .map((p: any) => [p.unitId, p.product])
          );
          console.log('[CART DEBUG] Products map:', productsMap);
          console.log('[CART DEBUG] Mapped products count:', mappedProducts.length);
          console.log('[CART DEBUG] Products in map count:', productsMap.size);
          console.log('[CART DEBUG] Product titles in map:', Array.from(productsMap.values()).map((p: any) => ({ id: p.id, title: p.title })));
          // Log per verificare gli attributi
          mappedProducts.forEach((p: any) => {
            if (p.product?.variantAttributes) {
              console.log(`[CART DEBUG] Product ${p.product.title} has ${p.product.variantAttributes.length} variant attributes:`, p.product.variantAttributes);
            }
          });
        }
      }

      // Get booking_details_informations for all details
      const detailIds = details.map(d => d.id);
      let informationsMap = new Map<string, BookingDetailInformation[]>();
      
      if (detailIds.length > 0) {
        // Prima prova con la join
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

        if (informationsError) {
          console.error('[CART DEBUG] Error fetching booking_details_informations with join:', informationsError);
          
          // Fallback: carica senza join e poi carica le informations separatamente
          const { data: bookingDetailsInformationsSimple, error: simpleError } = await supabase
            .from("booking_details_informations")
            .select("id, booking_details_id, information_id, value")
            .in("booking_details_id", detailIds);

          if (simpleError) {
            console.error('[CART DEBUG] Error fetching booking_details_informations (simple):', simpleError);
          } else if (bookingDetailsInformationsSimple) {
            // Carica le informations separatamente
            const informationIds = [...new Set(bookingDetailsInformationsSimple.map((i: any) => i.information_id).filter(Boolean))];
            let informationsDataMap = new Map<string | number, any>();
            
            if (informationIds.length > 0) {
              const { data: informationsData, error: infosError } = await supabase
                .from("informations")
                .select("id, name, type")
                .in("id", informationIds);

              if (!infosError && informationsData) {
                informationsData.forEach((info: any) => {
                  informationsDataMap.set(info.id, info);
                  informationsDataMap.set(String(info.id), info);
                });
              }
            }

            // Raggruppa per booking_details_id
            bookingDetailsInformationsSimple.forEach((info: any) => {
              const detailId = info.booking_details_id;
              if (!informationsMap.has(detailId)) {
                informationsMap.set(detailId, []);
              }
              
              const informationData = informationsDataMap.get(info.information_id) || informationsDataMap.get(String(info.information_id));
              
              const informationDataObj: BookingDetailInformation = {
                id: info.id,
                information_id: String(info.information_id),
                value: info.value,
                information: informationData ? {
                  id: String(informationData.id),
                  name: informationData.name,
                  type: String(informationData.type)
                } : undefined
              };
              
              informationsMap.get(detailId)!.push(informationDataObj);
            });
          }
        } else if (bookingDetailsInformations) {
          // Raggruppa per booking_details_id
          bookingDetailsInformations.forEach((info: any) => {
            const detailId = info.booking_details_id;
            if (!informationsMap.has(detailId)) {
              informationsMap.set(detailId, []);
            }
            
            // Gestisci sia il caso in cui informations è un oggetto che un array
            let informationObj = null;
            if (info.informations) {
              if (Array.isArray(info.informations) && info.informations.length > 0) {
                informationObj = info.informations[0];
              } else if (typeof info.informations === 'object') {
                informationObj = info.informations;
              }
            }
            
            // Trasforma i dati per matchare l'interfaccia
            const informationData: BookingDetailInformation = {
              id: info.id,
              information_id: String(info.information_id),
              value: info.value,
              information: informationObj ? {
                id: String(informationObj.id),
                name: informationObj.name,
                type: String(informationObj.type)
              } : undefined
            };
            
            informationsMap.get(detailId)!.push(informationData);
          });
        }
      }

      // Combine booking_details with products and informations
      const detailsWithProducts = details.map(detail => {
        const product = productsMap.get(detail.unit_id) || null;
        console.log('[CART DEBUG] Combining detail:', detail.id, 'unit_id:', detail.unit_id, 'product:', product, 'product.title:', product?.title);
        return {
          ...detail,
          products: product,
          informations: informationsMap.get(detail.id) || []
        };
      });

      console.log('[CART DEBUG] Combined data:', detailsWithProducts);
      console.log('[CART DEBUG] Product titles in combined data:', detailsWithProducts.map(d => ({ id: d.id, title: d.products?.title })));

      return {
        ...booking,
        booking_details: detailsWithProducts
      } as CartBooking;
    },
    enabled: !!user?.id
  });


  // Stripe checkout mutation
  const stripeCheckoutMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      // ✅ VERIFICA DISPONIBILITÀ PRIMA DI CHIAMARE L'EDGE FUNCTION
      console.log('[CART] Verifying availability before Stripe checkout');
      
      // Get booking details
      const { data: details, error: detailsError } = await supabase
        .from("booking_details")
        .select(`
          id,
          unit_id,
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
        .eq("booking_id", bookingId);

      if (detailsError) throw new Error(`Errore nel recupero dei dettagli: ${detailsError.message}`);
      if (!details || details.length === 0) {
        throw new Error("Nessun prodotto nel carrello");
      }

      const unavailableItems: string[] = [];
      const rentableStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b'; // ID dello status "Noleggiabile"

      for (const detail of details) {
        const originalUnitId = detail.unit_id || detail.product_units?.id;
        const variantId = detail.product_units?.id_product_variant;
        const startDateStr = detail.start_date;
        const endDateStr = detail.end_date;
        const productName = detail.product_units?.product_variants?.products?.name || 'Prodotto';

        if (!variantId) {
          unavailableItems.push(`${productName} - Variante prodotto non valida`);
          continue;
        }

        // ✅ VERIFICA: Se l'unità originale esiste, verifica che sia noleggiabile
        if (originalUnitId) {
          const { data: originalUnit, error: originalUnitError } = await supabase
            .from('product_units')
            .select('id, id_product_status')
            .eq('id', originalUnitId)
            .single();

          if (originalUnitError || !originalUnit) {
            console.warn('[CART] Original unit not found:', { originalUnitId, error: originalUnitError?.message });
            // L'unità non esiste più, cerchiamo un'altra unità noleggiabile disponibile
          } else if (originalUnit.id_product_status !== rentableStatusId) {
            console.warn('[CART] Original unit is not rentable:', {
              originalUnitId,
              status: originalUnit.id_product_status,
              expectedStatus: rentableStatusId
            });
            // L'unità non è noleggiabile, cerchiamo un'altra unità noleggiabile disponibile
          }
        }

        // Recupera SOLO le unità noleggiabili della variante
        const { data: rentableUnits, error: unitsError } = await supabase
          .from('product_units')
          .select('id')
          .eq('id_product_variant', variantId)
          .eq('id_product_status', rentableStatusId);

        if (unitsError && unitsError.code !== 'PGRST116') {
          unavailableItems.push(`${productName} - Errore nel recupero delle unità`);
          continue;
        }

        if (!rentableUnits || rentableUnits.length === 0) {
          unavailableItems.push(`${productName} - Nessuna unità noleggiabile disponibile per questa variante`);
          continue;
        }

        const unitIds = rentableUnits.map((u: any) => u.id);

        // Verifica disponibilità di tutte le unità noleggiabili della variante
        const { data: availabilityData, error: availabilityError } = await supabase
          .rpc('check_unit_availability', {
            p_unit_ids: unitIds,
            p_start_date: startDateStr,
            p_end_date: endDateStr
          });

        if (availabilityError) {
          unavailableItems.push(`${productName} - Errore nel controllo disponibilità`);
          continue;
        }

        // Trova le unità non disponibili (prenotate)
        const bookedUnitIds = new Set<string>();
        if (availabilityData && availabilityData.length > 0) {
          availabilityData.forEach((item: any) => {
            if (!item.is_available) {
              bookedUnitIds.add(item.unit_id);
            }
          });
        }

        // Trova la prima unità noleggiabile disponibile (non prenotata)
        const availableUnit = rentableUnits.find((u: any) => !bookedUnitIds.has(u.id));

        if (!availableUnit) {
          unavailableItems.push(`${productName} - Non più disponibile per il periodo selezionato. Tutte le unità noleggiabili sono già prenotate.`);
          continue;
        }

        // Se l'unità disponibile è diversa da quella nel booking_detail, aggiorna il booking_detail
        if (availableUnit.id !== originalUnitId) {
          console.log('[CART] Reassigning unit:', {
            bookingDetailId: detail.id,
            originalUnitId,
            newUnitId: availableUnit.id,
            productName
          });

          const { error: updateError } = await supabase
            .from('booking_details')
            .update({ unit_id: availableUnit.id })
            .eq('id', detail.id);

          if (updateError) {
            console.error('[CART] Error updating booking_detail unit_id:', updateError);
            unavailableItems.push(`${productName} - Errore nell'aggiornamento dell'unità`);
            continue;
          }

          console.log('[CART] Successfully reassigned unit:', {
            bookingDetailId: detail.id,
            newUnitId: availableUnit.id
          });
        }
      }

      // Se ci sono prodotti non disponibili, lancia un errore
      if (unavailableItems.length > 0) {
        throw new Error(
          `Alcuni prodotti non sono più disponibili:\n${unavailableItems.join('\n')}\n\nRimuovi i prodotti non disponibili dal carrello e riprova.`
        );
      }

      console.log('[CART] All products are available, proceeding with Stripe checkout');

      // Chiama l'edge function solo dopo la verifica
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        method: 'POST',
        body: { bookingId },
      });

      if (error) throw error;
      if (!data?.checkoutUrl) {
        throw new Error('URL di checkout non ricevuto');
      }

      // Redirect to Stripe
      window.location.href = data.checkoutUrl;
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore durante la creazione della sessione di pagamento: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Confirm booking mutation
  const confirmMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      // Get full booking data with rifPrenotazione
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("id, user_id, price_total, delivery_method, delivery_address, status, created_at, updated_at, rifPrenotazione, cart")
        .eq("id", bookingId)
        .single();

      if (bookingError) throw bookingError;
      if (!booking) throw new Error("Prenotazione non trovata");

      // Get all booking details with products
      const { data: details, error: detailsError } = await supabase
        .from("booking_details")
        .select("*")
        .eq("booking_id", bookingId);

      if (detailsError) throw detailsError;
      if (!details || details.length === 0) {
        throw new Error("Nessun prodotto nel carrello");
      }

      // ID dello status "Noleggiabile"
      const rentableStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b';

      // Verifica disponibilità per ogni booking_detail
      const unavailableItems: string[] = [];
      
      for (const detail of details) {
        const unitId = detail.unit_id;
        const startDateStr = detail.start_date;
        const endDateStr = detail.end_date;

        // Verifica che l'unità esista e sia noleggiabile
        const { data: unit, error: unitError } = await supabase
          .from('product_units')
          .select('id, id_product_status, id_product_variant, product_variants!inner(id_product, products!inner(id, name))')
          .eq('id', unitId)
          .eq('id_product_status', rentableStatusId)
          .single();

        if (unitError || !unit) {
          const productName = unit?.product_variants?.products?.name;
          unavailableItems.push(`${productName} - Unità non più disponibile`);
          continue;
        }

        // Verifica che l'unità non sia prenotata da altri (escludendo il carrello dell'utente corrente)
        // Use secure RPC function instead of direct query to avoid exposing sensitive data
        const { data: availabilityData, error: availabilityError } = await supabase
          .rpc('check_unit_availability', {
            p_unit_ids: [unitId],
            p_start_date: startDateStr,
            p_end_date: endDateStr
          });

        if (availabilityError) {
          console.error('Error checking availability:', availabilityError);
          continue;
        }

        // Check if unit is available
        const unitAvailability = availabilityData?.find((a: any) => a.unit_id === unitId);
        if (unitAvailability && !unitAvailability.is_available) {
          // Unit is not available, but we need to check if it's because of the current booking_detail
          // The RPC function only checks confirmed bookings (cart = false), so if it's not available,
          // it means there's a confirmed booking. However, we need to exclude the current booking_detail.
          // Since the RPC function doesn't support excluding a specific booking_detail, we check
          // if the current booking_detail is the only one blocking availability by verifying
          // if there are other confirmed bookings for this unit in this period.
          // For now, if the unit is not available, we consider it unavailable (the current
          // booking_detail exclusion is handled by the fact that confirmed bookings are what matter).
              const productName = unit?.product_variants?.products?.name ;
              unavailableItems.push(`${productName} - Non più disponibile per il periodo selezionato`);
        }
      }

      // Se ci sono prodotti non disponibili, lancia un errore
      if (unavailableItems.length > 0) {
        throw new Error(
          `Alcuni prodotti non sono più disponibili:\n${unavailableItems.join('\n')}\n\nRimuovi i prodotti non disponibili dal carrello e riprova.`
        );
      }

      // Get user profile data
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, first_name, last_name")
        .eq("id", booking.user_id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      }

      // Get products for all details
      // unit_id now refers to product_units, not products directly
      const unitIds = [...new Set(details?.map(d => d.unit_id).filter(Boolean) || [])] as string[];
      let productsMap = new Map();
      if (unitIds.length > 0) {
        // Step 1: Get product_units with variant IDs
        const { data: productUnits, error: unitsError } = await supabase
          .from("product_units")
          .select("id, id_product_variant")
          .in("id", unitIds);

        if (unitsError) throw unitsError;

        if (productUnits && productUnits.length > 0) {
          // Step 2: Get variant IDs and fetch variants
          const variantIds = [...new Set(productUnits.map((u: any) => u.id_product_variant).filter(Boolean))];
          
          const { data: variants, error: variantsError } = await supabase
            .from("product_variants")
            .select("id, id_product")
            .in("id", variantIds);

          if (variantsError) throw variantsError;

          // Step 3: Get product IDs and fetch products
          const productIds = [...new Set((variants || []).map((v: any) => v.id_product).filter(Boolean))];
          
          const { data: products, error: productsError } = await supabase
            .from("products")
            .select("id, name, product_brand:id_brand(id, name), product_model:id_model(id, name)")
            .in("id", productIds);

          if (productsError) throw productsError;

          // Step 4: Create maps for easy lookup
          const variantsMap = new Map((variants || []).map((v: any) => [v.id, v]));
          const productsMapById = new Map((products || []).map((p: any) => [p.id, p]));

          // Step 5: Map unit_id -> product info
          const mappedProducts = (productUnits || []).map((unit: any) => {
            const variant = variantsMap.get(unit.id_product_variant);
            const product = variant ? productsMapById.get(variant.id_product) : null;
            
            return {
              unitId: unit.id,
              product: {
                id: product?.id,
                title: product?.name || 'Prodotto', // Map 'name' to 'title' for email
                brand: product?.product_brand?.name || '',
                model: product?.product_model?.name || '',
              }
            };
          });

          // Create map: unit_id -> product info
          productsMap = new Map(mappedProducts.map((p: any) => [p.unitId, p.product]));
        }
      }

      // Update booking
      const { error: updateError } = await supabase
        .from("bookings")
        .update({ 
          cart: false,
          status: 'confirmed'
        })
        .eq("id", bookingId);

      if (updateError) throw updateError;

      // ✅ Aggiorna booking_details a 'toPickup'
      const { error: detailsUpdateError } = await supabase
        .from('booking_details')
        .update({ 
          status: 'toPickup'
        })
        .eq('booking_id', bookingId);

      if (detailsUpdateError) {
        console.error('Error updating booking_details:', detailsUpdateError);
        // Non bloccare il flusso, ma loggare l'errore
        // Il booking è già stato confermato, quindi continuiamo
      } else {
        console.log('✅ Booking details updated successfully to toPickup');
      }

      // Send confirmation email
      try {
        const userEmail = profile?.email || user?.email;
        const userFirstName = profile?.first_name || user?.user_metadata?.first_name || 'Utente';
        const userLastName = profile?.last_name || user?.user_metadata?.last_name || '';

        // Calculate total price
        const totalPrice = details?.reduce((sum, d) => sum + Number(d.price || 0), 0) || 0;

        // Get shop days off to check for closed days
        const { data: shopDaysOffData } = await supabase
          .from('shop_days_off')
          .select('date_from, date_to, enable_booking');

        // Build products list for email
        const productsList = details?.map(detail => {
          const product = productsMap.get(detail.unit_id);
          
          // Parse UTC dates correctly (dates are stored as YYYY-MM-DD in UTC)
          // We need to treat them as local dates, not UTC timestamps
          const startDateParts = detail.start_date.split('-');
          const startDate = new Date(
            parseInt(startDateParts[0]), 
            parseInt(startDateParts[1]) - 1, 
            parseInt(startDateParts[2])
          );
          
          const endDateParts = detail.end_date.split('-');
          const endDate = new Date(
            parseInt(endDateParts[0]), 
            parseInt(endDateParts[1]) - 1, 
            parseInt(endDateParts[2])
          );
          
          const startDateFormatted = startDate.toLocaleDateString('it-IT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          const endDateFormatted = endDate.toLocaleDateString('it-IT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          const deliveryMethodText = detail.delivery_method === 'pickup' ? 'Ritiro in sede' : 'Consegna a domicilio';
          const pickupTimeDisplay = detail.ritiro_fasciaoraria_inizio && detail.ritiro_fasciaoraria_fine 
            ? `${detail.ritiro_fasciaoraria_inizio.substring(0, 5)}-${detail.ritiro_fasciaoraria_fine.substring(0, 5)}` 
            : null;
          const returnTimeDisplay = detail.riconsegna_fasciaoraria_inizio && detail.riconsegna_fasciaoraria_fine
            ? `${detail.riconsegna_fasciaoraria_inizio.substring(0, 5)}-${detail.riconsegna_fasciaoraria_fine.substring(0, 5)}`
            : null;

          // Check if end_date has enable_booking=true
          let closedDayWarning = '';
          if (shopDaysOffData && shopDaysOffData.length > 0) {
            console.log('[DEBUG] Checking shop days off for email alert. End date:', detail.end_date);
            const isShopClosed = shopDaysOffData.some((dayOff: any) => {
              if (!dayOff.enable_booking) return false;
              
              // Parse dates as local dates (not UTC timestamps)
              const dateFromParts = dayOff.date_from.split('-');
              const dateFrom = new Date(
                parseInt(dateFromParts[0]), 
                parseInt(dateFromParts[1]) - 1, 
                parseInt(dateFromParts[2])
              );
              
              const dateToParts = dayOff.date_to.split('-');
              const dateTo = new Date(
                parseInt(dateToParts[0]), 
                parseInt(dateToParts[1]) - 1, 
                parseInt(dateToParts[2])
              );
              
              // endDate is already parsed correctly above
              const checkDate = new Date(endDate);
              dateFrom.setHours(0, 0, 0, 0);
              dateTo.setHours(0, 0, 0, 0);
              checkDate.setHours(0, 0, 0, 0);
              
              const matches = checkDate >= dateFrom && checkDate <= dateTo;
              if (matches) {
                console.log('[DEBUG] Found matching closed day with enable_booking=true:', dayOff);
              }
              return matches;
            });
            
            if (isShopClosed) {
              const nextDay = new Date(endDate);
              nextDay.setDate(nextDay.getDate() + 1);
              const nextDayFormatted = format(nextDay, "dd/MM/yyyy", { locale: it });
              console.log('[DEBUG] Adding closed day warning to customer email');
              closedDayWarning = `
                <div style="background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 6px; padding: 15px; margin-top: 15px;">
                  <p style="margin: 0; color: #856404; font-size: 14px; font-weight: 600; line-height: 1.5;">
                    ⚠️ <strong>ATTENZIONE:</strong> Il <strong>${format(endDate, "dd/MM/yyyy", { locale: it })}</strong> il negozio sarà chiuso, pertanto la riconsegna del prodotto dovrà avvenire il giorno successivo (<strong>${nextDayFormatted}</strong>), con il prezzo calcolato sui giorni di prenotazione selezionati.
                  </p>
                </div>
              `;
            } else {
              console.log('[DEBUG] No matching closed day found for end date');
            }
          } else {
            console.log('[DEBUG] No shop days off data available for email alert');
          }

          return `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 15px; background-color: #f9fafb;">
              <div style="font-weight: 600; color: #333; margin-bottom: 10px;">${product?.title }</div>
              ${product?.brand ? `<div style="color: #666; font-size: 14px; margin-bottom: 5px;">${product.brand}${product.model ? ` - ${product.model}` : ''}</div>` : ''}
              <div style="color: #666; font-size: 14px; margin-bottom: 5px;">Data inizio: ${startDateFormatted}</div>
              <div style="color: #666; font-size: 14px; margin-bottom: 5px;">Data fine: ${endDateFormatted}</div>
              <div style="color: #666; font-size: 14px; margin-bottom: 5px;">Modalità: ${deliveryMethodText}</div>
              ${pickupTimeDisplay ? `<div style="color: #666; font-size: 14px; margin-bottom: 5px;">Orario ritiro: ${pickupTimeDisplay}</div>` : ''}
              ${returnTimeDisplay ? `<div style="color: #666; font-size: 14px; margin-bottom: 5px;">Orario riconsegna: ${returnTimeDisplay}</div>` : ''}
              <div style="color: #16a34a; font-weight: 600; font-size: 16px; margin-top: 10px;">Prezzo: €${Number(detail.price || 0).toFixed(2)}</div>
              ${closedDayWarning}
            </div>
          `;
        }).join('') || '';

        // Create HTML email content
        const emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Conferma Prenotazione - Nollix</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                .header { background: linear-gradient(135deg, #16a34a 0%, #2563eb 100%); padding: 40px 20px; text-align: center; }
                .logo { width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; }
                .logo img { display: block; margin: auto; max-width: 100%; max-height: 100%; }
                .header-title { color: white; font-size: 28px; font-weight: bold; margin: 0; }
                .header-subtitle { color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0 0 0; }
                .content { padding: 40px 20px; }
                .welcome-text { font-size: 18px; color: #333; margin-bottom: 30px; }
                .booking-details { background-color: #f8f9fa; border-left: 4px solid #16a34a; padding: 20px; margin: 30px 0; border-radius: 4px; }
                .booking-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 15px; }
                .detail-item { margin-bottom: 10px; }
                .detail-label { font-weight: 600; color: #666; }
                .detail-value { color: #333; }
                .booking-ref { font-family: 'Courier New', monospace; background-color: #e9ecef; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; font-weight: bold; }
                .price-box { background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; padding: 15px; margin: 20px 0; }
                .price-text { color: #856404; font-size: 16px; font-weight: bold; margin: 0; }
                .info-box { background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 4px; padding: 15px; margin: 20px 0; }
                .info-text { color: #0c5460; font-size: 14px; margin: 0; }
                .button { display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #2563eb 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
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
                  <h1 class="header-title">Prenotazione Confermata!</h1>
                  <p class="header-subtitle">La tua prenotazione è stata registrata con successo</p>
                </div>
                
                <div class="content">
                  <p class="welcome-text">
                    Ciao <strong>${userFirstName} ${userLastName}</strong>,
                  </p>
                  
                  <p>La tua prenotazione è stata confermata! Ecco i dettagli:</p>
                  
                  <div class="booking-details">
                    <div class="booking-title">📋 Dettagli Prenotazione:</div>
                    <div class="detail-item">
                      <span class="detail-label">Riferimento:</span>
                      <span class="booking-ref">${booking.rifPrenotazione || ''}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Numero prodotti:</span>
                      <span class="detail-value">${details?.length || 0}</span>
                    </div>
                  </div>

                  <div class="booking-details">
                    <div class="booking-title">📦 Prodotti Prenotati:</div>
                    ${productsList}
                  </div>
                  
                  <div class="price-box">
                    <p class="price-text">💰 Importo totale: €${totalPrice.toFixed(2)}</p>
                  </div>
                  
                  <div class="info-box">
                    <p class="info-text">
                      <strong>Prossimi passi:</strong><br>
                      • Conserva questo riferimento: <strong>${booking.rifPrenotazione || ''}</strong><br>
                      • Ti contatteremo presto per confermare i dettagli<br>
                      • Per modifiche o cancellazioni, contattaci al più presto
                    </p>
                  </div>
                  
                  <p>Grazie per aver scelto Nollix!</p>
                  
                  <a href="https://app.cirqlo.it" class="button">Vai al Dashboard</a>
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
            to: userEmail,
            subject: `Conferma Prenotazione - ${booking.rifPrenotazione || ''}`,
            html: emailHtml,
          },
        });

        if (emailError) {
          console.error('[DEBUG] Error sending booking confirmation email:', emailError);
          // Don't fail the confirmation if email fails
        } else {
          console.log('[DEBUG] Booking confirmation email sent successfully');
        }

        // Send notification email to all administrators
        try {
          // Get all admin users
          const { data: adminUsers, error: adminError } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('user_type', 'admin');

          if (adminError) {
            console.error('[DEBUG] Error fetching admin users:', adminError);
          } else if (adminUsers && adminUsers.length > 0) {
            // Create admin notification email
            const adminEmailHtml = `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Nuova Prenotazione - Nollix</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                    .header { background: linear-gradient(135deg, #16a34a 0%, #2563eb 100%); padding: 40px 20px; text-align: center; }
                    .header-title { color: white; font-size: 28px; font-weight: bold; margin: 0; }
                    .header-subtitle { color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0 0 0; }
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
                      <div class="logo">
                        <img src="https://demo.nollix.it/Nollix_favicon.png" alt="Nollix Logo" style="width: 40px; height: 40px; object-fit: contain;">
                      </div>
                      <h1 class="header-title">📋 Nuova Prenotazione</h1>
                      <p class="header-subtitle">È stata confermata una nuova prenotazione</p>
                    </div>
                    
                    <div class="content">
                      <p class="welcome-text">
                        Una nuova prenotazione è stata confermata nel sistema.
                      </p>
                      
                      <div class="booking-details">
                        <div class="detail-item">
                          <span class="detail-label">Riferimento:</span>
                          <span class="booking-ref">${booking.rifPrenotazione || ''}</span>
                        </div>
                        <div class="detail-item">
                          <span class="detail-label">Cliente:</span> ${userFirstName} ${userLastName}
                        </div>
                        <div class="detail-item">
                          <span class="detail-label">Email:</span> ${userEmail}
                        </div>
                      </div>
                      
                      <h3>Prodotti prenotati:</h3>
                      ${productsList}
                      
                      <div class="price-box">
                        <p class="price-text">💰 Totale: €${totalPrice.toFixed(2)}</p>
                      </div>
                      
                      <a href="https://app.cirqlo.it/admin/bookings/${bookingId}" class="button">Vai alla Prenotazione</a>
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
                  await supabase.functions.invoke('send-email', {
                    method: 'POST',
                    body: {
                      to: admin.email,
                      subject: `🔔 Nuova Prenotazione - ${booking.rifPrenotazione || ''}`,
                      html: adminEmailHtml,
                    },
                  });
                  console.log('[DEBUG] Admin notification sent to:', admin.email);
                } catch (adminEmailError) {
                  console.error('[DEBUG] Error sending admin notification to:', admin.email, adminEmailError);
                }
              }
            }
          }
        } catch (adminNotificationError) {
          console.error('[DEBUG] Error in admin notification:', adminNotificationError);
          // Don't fail the confirmation if admin notification fails
        }
      } catch (emailError) {
        console.error('[DEBUG] Error in booking confirmation email:', emailError);
        // Don't fail the confirmation if email fails
      }

      return { rifPrenotazione: booking.rifPrenotazione };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({
        title: "Prenotazione confermata!",
        description: "La tua prenotazione è stata confermata con successo.",
      });
      navigate(`/booking-confirmation?rif=${data.rifPrenotazione}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore durante la conferma: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Remove item from cart mutation
  const removeItemMutation = useMutation({
    mutationFn: async (detailId: string) => {
      // Prima elimina le informazioni associate in booking_details_informations
      const { error: infoError } = await supabase
        .from("booking_details_informations")
        .delete()
        .eq("booking_details_id", detailId);
      
      if (infoError) {
        console.error('Error deleting booking_details_informations:', infoError);
        throw infoError;
      }
      
      // Poi elimina il booking_detail
      const { error: detailError } = await supabase
        .from("booking_details")
        .delete()
        .eq("id", detailId);
      
      if (detailError) {
        console.error('Error deleting booking_details:', detailError);
        throw detailError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast({
        title: "Prodotto rimosso",
        description: "Il prodotto è stato rimosso dal carrello.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore durante la rimozione: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleConfirm = () => {
    if (!cartData?.id) return;
    confirmMutation.mutate(cartData.id);
  };

  const handleStripeCheckout = () => {
    if (!cartData?.id) return;
    stripeCheckoutMutation.mutate(cartData.id);
  };

  const handleRemoveItem = (detailId: string) => {
    if (confirm("Sei sicuro di voler rimuovere questo prodotto dal carrello?")) {
      removeItemMutation.mutate(detailId);
    }
  };

  const calculateTotal = () => {
    if (!cartData?.booking_details) return 0;
    return cartData.booking_details.reduce((sum, detail) => sum + Number(detail.price || 0), 0);
  };

  const formatTimeSlot = (startTime: string | null, endTime: string | null) => {
    if (!startTime || !endTime) return "Da definire";
    const start = startTime.substring(0, 5);
    const end = endTime.substring(0, 5);
    if (start === end) return start;
    return `${start} - ${end}`;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <FixedNavbar />
        <div className="flex-1 container mx-auto px-4 py-8 pt-20 md:pt-24 max-w-3xl">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-600">
                Devi accedere per vedere il tuo carrello.
              </p>
              <div className="flex justify-center mt-4">
                <Button onClick={() => navigate("/auth")}>
                  Accedi
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <FixedNavbar />
        <div className="flex-1 container mx-auto px-4 py-8 pt-20 md:pt-24 max-w-3xl">
          <p className="text-center text-gray-600">Caricamento...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (cartError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <FixedNavbar />
        <div className="flex-1 container mx-auto px-4 py-8 pt-20 md:pt-24 max-w-3xl">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-600 mb-4">Errore nel caricamento del carrello</p>
                <p className="text-sm text-gray-600 mb-4">
                  {cartError instanceof Error ? cartError.message : 'Errore sconosciuto'}
                </p>
                <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["cart"] })}>
                  Riprova
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (!cartData || !cartData.booking_details || cartData.booking_details.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <FixedNavbar />
        <div className="flex-1 container mx-auto px-4 py-8 pt-20 md:pt-24 max-w-3xl">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Il tuo carrello è vuoto</h2>
                <p className="text-gray-600 mb-4">
                  Aggiungi prodotti al carrello per iniziare.
                </p>
                <Button onClick={() => navigate("/products")}>
                  Vai ai prodotti
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <FixedNavbar />
      <div className="flex-1 container mx-auto px-4 py-8 pt-20 md:pt-24 max-w-4xl">
        <div className="flex flex-col gap-4 mb-6">
          <Button 
            onClick={() => navigate("/products")}
            variant="outline"
            className="flex items-center gap-2 w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Torna ai prodotti</span>
            <span className="sm:hidden">Indietro</span>
          </Button>
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8" />
              Carrello
            </h1>
            <Badge variant="secondary" className="text-base sm:text-lg px-3 py-1">
              {cartData.booking_details.length} {cartData.booking_details.length === 1 ? 'prodotto' : 'prodotti'}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 mb-6">
          {cartData.booking_details.map((detail) => (
            <Card key={detail.id}>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  {/* Product Image */}
                  <div className="w-24 h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={detail.products?.images?.[0] || DEFAULT_IMAGES.PRODUCT}
                      alt={detail.products?.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_IMAGES.PRODUCT;
                      }}
                    />
                  </div>

                  {/* Product Details */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {detail.products?.title?.trim() || "Prodotto"}
                        </h3>
                        {/* Attributi variante */}
                        {(() => {
                          if (detail.products?.variantAttributes && detail.products.variantAttributes.length > 0) {
                            return (
                              <div className="mt-2 space-y-1">
                                {detail.products.variantAttributes.map((attr, idx) => (
                                  <p key={idx} className="text-sm text-gray-600">
                                    <span className="font-medium">{attr.name}:</span> {attr.value}{attr.unit ? ` ${attr.unit}` : ''}
                                  </p>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(detail.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Avviso negozio chiuso - esteso su tutta la card */}
                    {isDateWithEnabledBooking(new Date(detail.end_date), shopDaysOff) && (
                      <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-sm text-amber-900 flex items-start gap-2">
                          <span className="text-lg">⚠️</span>
                          <span>
                            Il <strong>{format(new Date(detail.end_date), "dd/MM/yyyy", { locale: it })}</strong> il negozio sarà chiuso, 
                            pertanto la riconsegna del prodotto avverrà il giorno successivo (<strong>{format(addDays(new Date(detail.end_date), 1), "dd/MM/yyyy", { locale: it })}</strong>). 
                            Il prezzo verrà comunque calcolato sui giorni di prenotazione selezionati.
                          </span>
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Data inizio</p>
                          <p className="text-sm font-medium">
                            {format(new Date(detail.start_date), "dd MMM yyyy", { locale: it })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Data fine</p>
                          <p className="text-sm font-medium">
                            {format(new Date(detail.end_date), "dd MMM yyyy", { locale: it })}
                          </p>
                        </div>
                      </div>

                      {detail.ritiro_fasciaoraria_inizio && (
                        <div className="flex items-start gap-2">
                          <Clock className="h-4 w-4 text-gray-500 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-500">Orario ritiro</p>
                            <p className="text-sm font-medium">
                              {formatTimeSlot(detail.ritiro_fasciaoraria_inizio, detail.ritiro_fasciaoraria_fine)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Informazioni aggiuntive - nella griglia */}
                      {detail.informations && detail.informations.length > 0 && (() => {
                        // Cerca nome e cognome tra le informazioni
                        const findInformationValue = (fieldName: string): string | null => {
                          const info = detail.informations?.find(i => {
                            const name = i.information?.name?.toLowerCase() || '';
                            return name === fieldName.toLowerCase() || 
                                   name.includes(fieldName.toLowerCase());
                          });
                          if (!info || !info.value) return null;
                          
                          try {
                            const parsed = JSON.parse(info.value);
                            if (Array.isArray(parsed)) {
                              return parsed.join(', ');
                            } else if (typeof parsed === 'object') {
                              return JSON.stringify(parsed);
                            } else {
                              return String(parsed);
                            }
                          } catch {
                            return info.value;
                          }
                        };

                        const nome = findInformationValue('nome');
                        const cognome = findInformationValue('cognome');
                        const displayName = nome && cognome 
                          ? `${nome} ${cognome}` 
                          : nome || cognome || null;

                        return (
                          <div className="flex items-start gap-2">
                            <Info className="h-4 w-4 text-gray-500 mt-0.5" />
                            <div className="flex-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedInformations(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(detail.id)) {
                                      newSet.delete(detail.id);
                                    } else {
                                      newSet.add(detail.id);
                                    }
                                    return newSet;
                                  });
                                }}
                                className="flex items-center justify-between w-full text-left hover:opacity-80 transition-opacity"
                              >
                                <div>
                                  <p className="text-xs text-gray-500">Dettagli</p>
                                  <p className="text-sm font-medium">
                                    {displayName || `${detail.informations.length} ${detail.informations.length === 1 ? 'campo' : 'campi'}`}
                                  </p>
                                </div>
                                {expandedInformations.has(detail.id) ? (
                                  <ChevronUp className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Contenuto espanso delle informazioni aggiuntive */}
                    {detail.informations && detail.informations.length > 0 && expandedInformations.has(detail.id) && (
                      <div className="mt-3 pt-3 border-t space-y-2">
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

                          // Se il tipo è "date" o il nome contiene "nascita" o "data", formatta la data all'italiana (dd/mm/yyyy)
                          const isDateField = info.information?.type === 'date' || 
                                             info.information?.name?.toLowerCase().includes('nascita') ||
                                             info.information?.name?.toLowerCase().includes('data');
                          
                          if (isDateField && displayValue) {
                            try {
                              // Prova a parsare la data in vari formati
                              let dateValue: Date | null = null;
                              
                              // Se è già una stringa in formato ISO (YYYY-MM-DD)
                              if (typeof displayValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(displayValue)) {
                                dateValue = new Date(displayValue);
                              } else {
                                dateValue = new Date(displayValue);
                              }
                              
                              if (dateValue && !isNaN(dateValue.getTime())) {
                                // Formatta come dd/mm/yyyy
                                const day = String(dateValue.getDate()).padStart(2, '0');
                                const month = String(dateValue.getMonth() + 1).padStart(2, '0');
                                const year = dateValue.getFullYear();
                                displayValue = `${day}/${month}/${year}`;
                              }
                            } catch (dateError) {
                              // Se la formattazione della data fallisce, mantieni il valore originale
                              console.warn('Error formatting date:', dateError);
                            }
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
                    )}

                    {detail.deposito && Number(detail.deposito) > 0 && (
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">
                          Cauzione: €{Number(detail.deposito).toFixed(2)}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: '#E31E24' }}>
                      €{Number(detail.price || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary Card */}
        <Card className="sticky bottom-0">
          <CardHeader>
            <CardTitle>Riepilogo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold">Totale</span>
              <span className="text-2xl font-bold" style={{ color: '#E31E24' }}>
                €{calculateTotal().toFixed(2)}
              </span>
            </div>
            <Button
              onClick={handleStripeCheckout}
              disabled={stripeCheckoutMutation.isPending}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-6 text-lg font-semibold"
            >
              {stripeCheckoutMutation.isPending ? (
                "Reindirizzamento a Stripe..."
              ) : (
                <>
                  <svg className="h-5 w-5 mr-2 inline" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 2.388 1.237 4.05 3.283 5.19 2.085 1.177 3.028 1.987 3.028 3.218 0 1.008-.84 1.545-2.12 1.545-1.688 0-4.617-.842-6.308-1.818L1.758 24c2.198 1.001 5.902 1.819 9.407 1.819 2.493 0 4.564-.491 6.104-1.649 1.624-1.188 2.465-3.023 2.465-5.347 0-2.365-1.131-4.009-3.03-5.13-1.938-1.14-2.97-1.931-2.97-3.218 0-.636.524-1.122 1.514-1.388l5.407-1.828L13.976 9.15z"/>
                  </svg>
                  Paga con Stripe
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}

