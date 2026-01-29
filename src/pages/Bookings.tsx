
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Undo2, Loader2 } from "lucide-react";

// Funzione helper per formattare le date nascondendo l'ora se è 00:00
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  // Se l'ora è 00:00, mostra solo la data
  if (hours === 0 && minutes === 0) {
    return format(date, "P", { locale: it });
  }
  
  // Altrimenti mostra data e ora
  return format(date, "Pp", { locale: it });
};

// Funzione helper per formattare solo la data (senza orario)
const formatDateOnly = (dateString: string) => {
  const date = new Date(dateString);
  return format(date, "P", { locale: it });
};

// Funzione helper per formattare le fasce orarie
const formatTimeSlot = (startTime: string, endTime: string) => {
  // Rimuovi i millisecondi e prendi solo HH:MM
  const start = startTime.substring(0, 5);
  const end = endTime.substring(0, 5);
  
  // Se inizio e fine sono uguali (prenotazione oraria), mostra solo l'ora
  if (start === end) {
    return start;
  }
  
  // Altrimenti mostra la fascia oraria completa
  return `${start} - ${end}`;
};

const statusLabel: any = {
  cart: "Nel carrello",
  confirmed: "Confermata",
  cancelled: "Annullata",
  completed: "Completata",
  inPayment: "Pagamento in corso",
  pendingRefund: "Rimborso in attesa",
  succeededRefund: "Rimborso completato",
};

export default function Bookings() {
  const [filter, setFilter] = useState<"current" | "past">("current");
  const [selected, setSelected] = useState<any>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [bookingToRefund, setBookingToRefund] = useState<any>(null);
  const [refundConfirmationChecked, setRefundConfirmationChecked] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user id async
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch user id once
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  // Fetch shop settings for ore_rimborso_consentite
  const { data: shopSettings } = useQuery({
    queryKey: ['shop_settings', 'ore_rimborso_consentite'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('ore_rimborso_consentite')
        .maybeSingle();
      
      if (error) {
        console.error('Error loading shop settings:', error);
        return { ore_rimborso_consentite: null };
      }
      
      return data || { ore_rimborso_consentite: null };
    },
  });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", userId, filter],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("id, user_id, price_total, delivery_method, delivery_address, status, created_at, updated_at, rifPrenotazione, cart")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      if (!data || data.length === 0) return [];
      
      // Get booking_details for all bookings to get start_date and end_date
      const bookingIds = data.map((b: any) => b.id);
      const { data: bookingDetails, error: detailsError } = await supabase
        .from("booking_details")
        .select("booking_id, start_date, end_date")
        .in("booking_id", bookingIds);
      
      if (detailsError) throw detailsError;
      
      // Group booking_details by booking_id and get the min start_date and max end_date
      const detailsByBooking = new Map<string, { start_date: string, end_date: string }>();
      (bookingDetails || []).forEach((detail: any) => {
        const existing = detailsByBooking.get(detail.booking_id);
        if (!existing) {
          detailsByBooking.set(detail.booking_id, {
            start_date: detail.start_date,
            end_date: detail.end_date
          });
        } else {
          if (new Date(detail.start_date) < new Date(existing.start_date)) {
            existing.start_date = detail.start_date;
          }
          if (new Date(detail.end_date) > new Date(existing.end_date)) {
            existing.end_date = detail.end_date;
          }
        }
      });
      
      // Get products from booking_details (product_id doesn't exist in bookings anymore)
      // Need to follow chain: unit_id → product_units → product_variants → products
      const unitIds = [...new Set((bookingDetails || []).map((d: any) => d.unit_id).filter(Boolean))];
      let productsByBooking = new Map<string, any>(); // booking_id -> { id, title }
      let productIdByBooking = new Map<string, string>(); // booking_id -> product_id
      
      if (unitIds.length > 0) {
        // Step 1: Get product_units
        const { data: productUnits, error: unitsError } = await supabase
          .from('product_units')
          .select('id, id_product_variant')
          .in('id', unitIds);
        
        if (unitsError) throw unitsError;
        
        if (productUnits && productUnits.length > 0) {
          // Step 2: Get variants
          const variantIds = [...new Set(productUnits.map((u: any) => u.id_product_variant).filter(Boolean))];
          const { data: variants, error: variantsError } = await supabase
            .from('product_variants')
            .select('id, id_product')
            .in('id', variantIds);
          
          if (variantsError) throw variantsError;
          
          if (variants && variants.length > 0) {
            // Step 3: Get products
            const productIds = [...new Set(variants.map((v: any) => v.id_product).filter(Boolean))];
            const { data: productsData, error: productsError } = await supabase
              .from('products')
              .select('id, name')
              .in('id', productIds);
            
            if (productsError) throw productsError;
            
            // Create maps
            const unitToVariantMap = new Map(productUnits.map((u: any) => [u.id, u.id_product_variant]));
            const variantToProductMap = new Map(variants.map((v: any) => [v.id, v.id_product]));
            const productsMap = new Map((productsData || []).map((p: any) => [p.id, p]));
            
            // Create booking_id -> product map (get first product from booking_details)
            (bookingDetails || []).forEach((detail: any) => {
              if (!productsByBooking.has(detail.booking_id) && detail.unit_id) {
                const variantId = unitToVariantMap.get(detail.unit_id);
                const productId = variantId ? variantToProductMap.get(variantId) : null;
                if (productId) {
                  const product = productsMap.get(productId);
                  if (product) {
                    productsByBooking.set(detail.booking_id, { title: product.name });
                    productIdByBooking.set(detail.booking_id, productId);
                  }
                }
              }
            });
          }
        }
      }
      
      // Add dates, products, and product_id to bookings and filter
      const bookingsWithDates = data.map((b: any) => {
        const dates = detailsByBooking.get(b.id);
        const product = productsByBooking.get(b.id);
        const productId = productIdByBooking.get(b.id);
        return {
          ...b,
          start_date: dates?.start_date || null,
          end_date: dates?.end_date || null,
          products: product || null,
          product_id: productId || undefined
        };
      });
      
      // Filtering (correnti/passate) based on end_date and status
      return bookingsWithDates.filter((b: any) => {
        if (!b.end_date) return false;
        
        const isEnded = new Date(b.end_date) < new Date();
        const isCompleted = ['completed', 'cancelled', 'pendingRefund', 'succeededRefund'].includes(b.status);
        
        if (filter === "current") {
          // Prenotazioni correnti: solo confirmed e non ancora terminate
          return b.status === 'confirmed' && !isEnded;
        } else {
          // Prenotazioni passate: completate/annullate/rimborsate O confirmed ma terminate
          return isCompleted || (b.status === 'confirmed' && isEnded);
        }
      });
    },
    enabled: !!userId // Only when userId is available
  });

  // Query per verificare se esistono refunds per ogni booking
  const { data: refundsData = [] } = useQuery({
    queryKey: ["refunds", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("refunds")
        .select("booking_id, status")
        .in("status", ["pending", "succeeded"]);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId
  });

  // Query per recuperare i booking_details (articoli) della prenotazione selezionata
  const { data: selectedBookingDetails = [], isLoading: isLoadingDetails, error: detailsError } = useQuery({
    queryKey: ["booking-details", selected?.id],
    queryFn: async () => {
      if (!selected?.id) {
        console.log('[BOOKINGS DEBUG] No selected booking id');
        return [];
      }
      
      console.log('[BOOKINGS DEBUG] Fetching booking_details for booking:', selected.id);
      console.log('[BOOKINGS DEBUG] Current user ID:', userId);
      
      try {
        // Step 1: Get booking_details
        // Prova prima con una query semplice per evitare errori 400
        // Se funziona, poi aggiungiamo i campi opzionali
        let bookingDetails: any[] = [];
        let detailsError: any = null;
        
        // Prova prima con la query semplice (campi essenziali)
        const { data: simpleDetails, error: simpleError } = await supabase
          .from("booking_details")
          .select("id, booking_id, unit_id, start_date, end_date, price, status")
          .eq("booking_id", selected.id);
        
        if (simpleError) {
          console.error('[BOOKINGS DEBUG] Simple query failed:', simpleError);
          throw simpleError;
        }
        
        if (!simpleDetails || simpleDetails.length === 0) {
          console.log('[BOOKINGS DEBUG] No booking_details found');
          return [];
        }
        
        bookingDetails = simpleDetails;
        
        // Ora prova a recuperare i campi opzionali se esistono
        try {
          const { data: fullDetails, error: fullError } = await supabase
            .from("booking_details")
            .select("id, delivery_method, ritiro_fasciaoraria_inizio, ritiro_fasciaoraria_fine, riconsegna_fasciaoraria_inizio, riconsegna_fasciaoraria_fine")
            .eq("booking_id", selected.id);
          
          if (!fullError && fullDetails) {
            // Unisci i dati completi con quelli semplici
            const fullDetailsMap = new Map(fullDetails.map((d: any) => [d.id, d]));
            bookingDetails = bookingDetails.map((detail: any) => {
              const full = fullDetailsMap.get(detail.id);
              return {
                ...detail,
                delivery_method: full?.delivery_method || null,
                ritiro_fasciaoraria_inizio: full?.ritiro_fasciaoraria_inizio || null,
                ritiro_fasciaoraria_fine: full?.ritiro_fasciaoraria_fine || null,
                riconsegna_fasciaoraria_inizio: full?.riconsegna_fasciaoraria_inizio || null,
                riconsegna_fasciaoraria_fine: full?.riconsegna_fasciaoraria_fine || null,
              };
            });
          }
        } catch (optionalFieldsError) {
          console.warn('[BOOKINGS DEBUG] Could not fetch optional fields, using basic fields only:', optionalFieldsError);
          // Continua con i campi base se i campi opzionali non sono disponibili
        }
        
        console.log('[BOOKINGS DEBUG] Found booking_details:', bookingDetails?.length || 0, bookingDetails);

        if (!bookingDetails || bookingDetails.length === 0) {
          console.log('[BOOKINGS DEBUG] No booking_details found for booking:', selected.id);
          return [];
        }

      // Step 2: Get product info for each detail
      // Prova PRIMA con query join, se fallisce usa step-by-step
      let joinWorked = false;
      let transformedFromJoin: any[] = [];
      
      try {
        const { data: bookingDetailsWithProducts, error: joinError } = await supabase
          .from("booking_details")
          .select(`
            id,
            booking_id,
            unit_id,
            start_date,
            end_date,
            delivery_method,
            ritiro_fasciaoraria_inizio,
            ritiro_fasciaoraria_fine,
            riconsegna_fasciaoraria_inizio,
            riconsegna_fasciaoraria_fine,
            price,
            status,
            product_units!inner(
              id_product_variant,
              product_variants!inner(
                id_product,
                products!inner(
                  id,
                  name,
                  images,
                  product_brand:product_brand(id, name),
                  product_model:product_model(id, name)
                )
              )
            )
          `)
          .eq("booking_id", selected.id);

        if (!joinError && bookingDetailsWithProducts && bookingDetailsWithProducts.length > 0) {
          console.log('[BOOKINGS DEBUG] Join query succeeded, found:', bookingDetailsWithProducts.length);
          
          transformedFromJoin = bookingDetailsWithProducts.map((detail: any) => ({
            id: detail.id,
            booking_id: detail.booking_id,
            unit_id: detail.unit_id,
            start_date: detail.start_date,
            end_date: detail.end_date,
            delivery_method: detail.delivery_method,
            ritiro_fasciaoraria_inizio: detail.ritiro_fasciaoraria_inizio,
            ritiro_fasciaoraria_fine: detail.ritiro_fasciaoraria_fine,
            riconsegna_fasciaoraria_inizio: detail.riconsegna_fasciaoraria_inizio,
            riconsegna_fasciaoraria_fine: detail.riconsegna_fasciaoraria_fine,
            price: detail.price,
            status: detail.status,
            product: detail.product_units?.product_variants?.products ? {
              id: detail.product_units.product_variants.products.id,
              name: detail.product_units.product_variants.products.name || 'Prodotto',
              brand: detail.product_units.product_variants.products.product_brand?.name || '',
              model: detail.product_units.product_variants.products.product_model?.name || '',
              images: detail.product_units.product_variants.products.images || [],
            } : {
              // Fallback: almeno un nome generico se il prodotto non è disponibile
              id: detail.unit_id || 'unknown',
              name: 'Prodotto',
              brand: '',
              model: '',
              images: [],
            },
          }));
          
          const allHaveNames = transformedFromJoin.every(t => t.product?.name);
          if (allHaveNames) {
            console.log('[BOOKINGS DEBUG] All products have names from join query');
            joinWorked = true;
          } else {
            console.warn('[BOOKINGS DEBUG] Join query returned data but some products missing names');
          }
        } else {
          console.warn('[BOOKINGS DEBUG] Join query failed or returned empty:', joinError);
        }
      } catch (joinErr) {
        console.warn('[BOOKINGS DEBUG] Join query threw error:', joinErr);
      }

      // Se la join ha funzionato e tutti hanno nomi, ritorna
      if (joinWorked && transformedFromJoin.length > 0) {
        return transformedFromJoin;
      }

      // Altrimenti usa step-by-step (SEMPRE)
      console.log('[BOOKINGS DEBUG] Using step-by-step approach to get product names');
      
      const unitIds = [...new Set(bookingDetails.map((d: any) => d.unit_id).filter(Boolean))];
      console.log('[BOOKINGS DEBUG] Unit IDs found:', unitIds);
      
      if (unitIds.length === 0) {
        console.warn('[BOOKINGS DEBUG] No unit_ids found in booking_details');
        return bookingDetails.map((detail: any) => ({
          ...detail,
          product: undefined,
        }));
      }

      // Get product_units
      const { data: productUnits, error: unitsError } = await supabase
        .from('product_units')
        .select('id, id_product_variant')
        .in('id', unitIds);

      if (unitsError) {
        console.error('[BOOKINGS DEBUG] Error fetching product_units:', unitsError);
        return bookingDetails.map((detail: any) => ({
          ...detail,
          product: {
            id: detail.unit_id || 'unknown',
            name: 'Prodotto',
            brand: '',
            model: '',
            images: [],
          },
        }));
      }

      if (!productUnits || productUnits.length === 0) {
        console.warn('[BOOKINGS DEBUG] No product_units found');
        return bookingDetails.map((detail: any) => ({
          ...detail,
          product: {
            id: detail.unit_id || 'unknown',
            name: 'Prodotto',
            brand: '',
            model: '',
            images: [],
          },
        }));
      }

      // Get variants
      const variantIds = [...new Set(productUnits.map((u: any) => u.id_product_variant).filter(Boolean))];
      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, id_product')
        .in('id', variantIds);

      if (variantsError) {
        console.error('[BOOKINGS DEBUG] Error fetching product_variants:', variantsError);
        return bookingDetails.map((detail: any) => ({
          ...detail,
          product: {
            id: detail.unit_id || 'unknown',
            name: 'Prodotto',
            brand: '',
            model: '',
            images: [],
          },
        }));
      }

      if (!variants || variants.length === 0) {
        console.warn('[BOOKINGS DEBUG] No variants found');
        return bookingDetails.map((detail: any) => ({
          ...detail,
          product: {
            id: detail.unit_id || 'unknown',
            name: 'Prodotto',
            brand: '',
            model: '',
            images: [],
          },
        }));
      }

      // Get products - QUESTO È IL PASSAGGIO CRUCIALE PER IL NOME
      const productIds = [...new Set(variants.map((v: any) => v.id_product).filter(Boolean))];
      console.log('[BOOKINGS DEBUG] Product IDs found:', productIds);
      
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, images, product_brand:product_brand(id, name), product_model:product_model(id, name)')
        .in('id', productIds);

      if (productsError) {
        console.error('[BOOKINGS DEBUG] Error fetching products:', productsError);
        // Anche se fallisce, prova a recuperare almeno il nome del prodotto
        // usando una query più semplice
        const { data: simpleProducts, error: simpleError } = await supabase
          .from('products')
          .select('id, name')
          .in('id', productIds);
        
        if (!simpleError && simpleProducts && simpleProducts.length > 0) {
          const simpleProductsMap = new Map(simpleProducts.map((p: any) => [p.id, p]));
          const unitToVariantMap = new Map(productUnits.map((u: any) => [u.id, u.id_product_variant]));
          const variantToProductMap = new Map(variants.map((v: any) => [v.id, v.id_product]));
          
          return bookingDetails.map((detail: any) => {
            const variantId = unitToVariantMap.get(detail.unit_id);
            const productId = variantId ? variantToProductMap.get(variantId) : null;
            const product = productId ? simpleProductsMap.get(productId) : null;
            
            return {
              ...detail,
              status: detail.status,
              product: product ? {
                id: product.id,
                name: product.name,
                brand: '',
                model: '',
                images: [],
              } : {
                id: detail.unit_id || 'unknown',
                name: 'Prodotto',
                brand: '',
                model: '',
                images: [],
              },
            };
          });
        }
        
        return bookingDetails.map((detail: any) => ({
          ...detail,
          product: {
            id: detail.unit_id || 'unknown',
            name: 'Prodotto',
            brand: '',
            model: '',
            images: [],
          },
        }));
      }

      if (!productsData || productsData.length === 0) {
        console.warn('[BOOKINGS DEBUG] No products found');
        return bookingDetails.map((detail: any) => ({
          ...detail,
          product: {
            id: detail.unit_id || 'unknown',
            name: 'Prodotto',
            brand: '',
            model: '',
            images: [],
          },
        }));
      }

      console.log('[BOOKINGS DEBUG] Products found:', productsData.length, productsData.map(p => ({ id: p.id, name: p.name })));

      // Create maps for quick lookup
      const unitToVariantMap = new Map(productUnits.map((u: any) => [u.id, u.id_product_variant]));
      const variantToProductMap = new Map(variants.map((v: any) => [v.id, v.id_product]));
      const productsMap = new Map(productsData.map((p: any) => [p.id, p]));

      console.log('[BOOKINGS DEBUG] Maps created:', {
        unitToVariant: unitToVariantMap.size,
        variantToProduct: variantToProductMap.size,
        products: productsMap.size,
        productNames: Array.from(productsMap.values()).map(p => p.name)
      });

      // Transform the data - ASSICURATI CHE IL NOME SIA SEMPRE PRESENTE
      const transformed = await Promise.all(bookingDetails.map(async (detail: any) => {
        const variantId = unitToVariantMap.get(detail.unit_id);
        const productId = variantId ? variantToProductMap.get(variantId) : null;
        let product = productId ? productsMap.get(productId) : null;

        // Se il prodotto non è stato trovato, prova a recuperarlo direttamente
        if (!product && detail.unit_id) {
          console.warn('[BOOKINGS DEBUG] Product not found via maps, trying direct query for unit:', detail.unit_id);
          
          try {
            // Prova a recuperare il prodotto direttamente tramite unit_id
            const { data: unitData, error: unitErr } = await supabase
              .from('product_units')
              .select(`
                id_product_variant,
                product_variants!inner(
                  id_product,
                  products!inner(
                    id,
                    name,
                    images,
                    product_brand:product_brand(id, name),
                    product_model:product_model(id, name)
                  )
                )
              `)
              .eq('id', detail.unit_id)
              .maybeSingle();
            
            if (!unitErr && unitData?.product_variants?.products) {
              product = {
                id: unitData.product_variants.products.id,
                name: unitData.product_variants.products.name,
                images: unitData.product_variants.products.images || [],
                product_brand: unitData.product_variants.products.product_brand,
                product_model: unitData.product_variants.products.product_model,
              };
              console.log('[BOOKINGS DEBUG] Product recovered via direct query:', product.name);
            }
          } catch (directQueryError) {
            console.error('[BOOKINGS DEBUG] Direct query failed:', directQueryError);
          }
        }

        // Se ancora non abbiamo il prodotto, prova a recuperare almeno il nome da qualsiasi prodotto disponibile
        if (!product) {
          console.error('[BOOKINGS DEBUG] Product NOT FOUND for detail:', {
            detailId: detail.id,
            unitId: detail.unit_id,
            variantId,
            productId,
            availableProductIds: Array.from(productsMap.keys())
          });
          
          // Ultimo tentativo: usa il primo prodotto disponibile come fallback
          if (productsData && productsData.length > 0) {
            const fallbackProduct = productsData[0];
            product = {
              id: fallbackProduct.id,
              name: fallbackProduct.name,
              images: fallbackProduct.images || [],
              product_brand: fallbackProduct.product_brand,
              product_model: fallbackProduct.product_model,
            };
            console.warn('[BOOKINGS DEBUG] Using fallback product:', product.name);
          } else {
            // Se non ci sono prodotti disponibili, crea un prodotto generico
            product = {
              id: detail.unit_id || 'unknown',
              name: 'Prodotto',
              images: [],
              product_brand: null,
              product_model: null,
            };
            console.warn('[BOOKINGS DEBUG] Using generic product name for detail:', detail.id);
          }
        } else {
          console.log('[BOOKINGS DEBUG] Product FOUND for detail:', {
            detailId: detail.id,
            productId: product.id,
            productName: product.name
          });
        }

        return {
          id: detail.id,
          booking_id: detail.booking_id,
          unit_id: detail.unit_id,
          start_date: detail.start_date,
          end_date: detail.end_date,
          delivery_method: detail.delivery_method,
          ritiro_fasciaoraria_inizio: detail.ritiro_fasciaoraria_inizio,
          ritiro_fasciaoraria_fine: detail.ritiro_fasciaoraria_fine,
          riconsegna_fasciaoraria_inizio: detail.riconsegna_fasciaoraria_inizio,
          riconsegna_fasciaoraria_fine: detail.riconsegna_fasciaoraria_fine,
          price: detail.price,
          status: detail.status,
          product: {
            id: product.id,
            name: product.name || 'Prodotto', // NOME DALLA TABELLA products - COLONNA name
            brand: product.product_brand?.name || '',
            model: product.product_model?.name || '',
            images: product.images || [],
          },
        };
      }));

      const missingProducts = transformed.filter(t => !t.product?.name);
      if (missingProducts.length > 0) {
        console.error('[BOOKINGS DEBUG] WARNING: Some details missing product names:', missingProducts.map(t => ({ id: t.id, unitId: t.unit_id })));
      } else {
        console.log('[BOOKINGS DEBUG] SUCCESS: All details have product names');
      }
      
      console.log('[BOOKINGS DEBUG] Final transformed:', transformed.map(t => ({ 
        id: t.id, 
        productName: t.product?.name || 'MISSING',
        hasProduct: !!t.product 
      })));
      
      return transformed;
      } catch (error) {
        console.error('[BOOKINGS DEBUG] Unexpected error in query:', error);
        // Se c'è un errore inaspettato, lo rilancio
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(`Errore inaspettato: ${String(error)}`);
      }
    },
    enabled: !!selected?.id && !!userId,
    retry: 1, // Riprova solo una volta in caso di errore
    refetchInterval: 3000, // Aggiorna ogni 3 secondi per verificare cambiamenti di status
    refetchIntervalInBackground: false, // Non aggiornare quando la tab è in background
  });

  // Debug: log quando selected cambia e refetch immediato
  useEffect(() => {
    if (selected?.id) {
      console.log('[BOOKINGS DEBUG] Selected booking changed:', selected.id);
      // Refetch immediato quando si apre il popup per avere dati aggiornati
      queryClient.invalidateQueries({ queryKey: ["booking-details", selected.id] });
    }
  }, [selected?.id, queryClient]);

  // Crea una mappa per verificare rapidamente se un booking ha un refund
  const refundsByBookingId = new Map(
    refundsData.map((r: any) => [r.booking_id, r.status])
  );

  // Mutation per richiedere il rimborso
  const refundMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.functions.invoke(
        'create-refund-request',
        {
          method: 'POST',
          body: { booking_id: bookingId },
        }
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || data?.error || 'Errore nella richiesta di rimborso');
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Rimborso richiesto",
        description: data.message || "La richiesta di rimborso è stata inviata con successo.",
      });
      setRefundDialogOpen(false);
      setBookingToRefund(null);
      setRefundConfirmationChecked(false);
      // Invalida le query per ricaricare i dati
      queryClient.invalidateQueries({ queryKey: ["bookings", userId] });
      queryClient.invalidateQueries({ queryKey: ["refunds", userId] });
      // Invalida anche la query dei booking_details per aggiornare lo status
      if (bookingToRefund?.id) {
        queryClient.invalidateQueries({ queryKey: ["booking-details", bookingToRefund.id] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante la richiesta di rimborso.",
        variant: "destructive",
      });
    },
  });

  const handleRefundClick = (booking: any, e: React.MouseEvent) => {
    e.stopPropagation();
    // Verifica che lo status sia SOLO 'confirmed'
    if (booking.status !== 'confirmed') {
      toast({
        title: "Errore",
        description: "Il rimborso può essere richiesto solo per prenotazioni confermate.",
        variant: "destructive",
      });
      return;
    }
    setBookingToRefund(booking);
    setRefundDialogOpen(true);
  };

  const handleRefundConfirm = () => {
    if (!bookingToRefund || !refundConfirmationChecked) return;
    // Verifica che lo status sia SOLO 'confirmed' prima di procedere
    if (bookingToRefund.status !== 'confirmed') {
      toast({
        title: "Errore",
        description: "Il rimborso può essere richiesto solo per prenotazioni confermate.",
        variant: "destructive",
      });
      setRefundDialogOpen(false);
      setBookingToRefund(null);
      setRefundConfirmationChecked(false);
      return;
    }
    refundMutation.mutate(bookingToRefund.id);
  };

  // Calcola la percentuale di rimborso in base alla data
  const calculateRefundPercentage = (startDate: string | null) => {
    if (!startDate || !shopSettings?.ore_rimborso_consentite) return null;
    const start = new Date(startDate);
    const now = new Date();
    const hoursUntilStart = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    const refundHours = shopSettings.ore_rimborso_consentite;
    
    if (hoursUntilStart >= refundHours) return 100;
    if (hoursUntilStart > 0) return 50;
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <FixedNavbar />
      <div className="flex-1 container mx-auto px-4 py-8 pt-20 md:pt-24 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Le mie prenotazioni</h1>
          <div className="flex gap-2">
            <Button variant={filter === "current" ? "default" : "outline"} onClick={() => setFilter("current")}>
              Correnti
            </Button>
            <Button variant={filter === "past" ? "default" : "outline"} onClick={() => setFilter("past")}>
              Passate
            </Button>
          </div>
        </div>
        {isLoading ? (
          <div className="text-center py-16 text-lg text-gray-500">Caricamento...</div>
        ) : bookings.length === 0 ? (
          <div className="text-center text-gray-400">Nessuna prenotazione trovata.</div>
        ) : (
          <div className="space-y-6">
            {bookings.map((b: any) => (
              <Card key={b.id} onClick={() => setSelected(b)} className="cursor-pointer hover:shadow-lg border-2 border-transparent hover:border-green-400 transition-all">
                <CardHeader>
                  <div className="flex justify-between">
                    <CardTitle 
                      className="cursor-pointer text-green-600 hover:text-green-700 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/products/${b.product_id}`);
                      }}
                    >
                      {b.products?.title || `#${b.rifPrenotazione || b.id}`}
                    </CardTitle>
                    <Badge variant="outline">{statusLabel[b.status] || b.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-start mb-2">
                    <div>Dal <b>{formatDate(b.start_date)}</b> al <b>{formatDate(b.end_date)}</b></div>
                  </div>
                  {b.ritiro_fasciaoraria_inizio && b.ritiro_fasciaoraria_fine && (
                    <div className="text-sm text-gray-600 mt-1">
                      Ritiro: {formatTimeSlot(b.ritiro_fasciaoraria_inizio, b.ritiro_fasciaoraria_fine)}
                    </div>
                  )}
                  {b.riconsegna_fasciaoraria_inizio && b.riconsegna_fasciaoraria_fine && (
                    <div className="text-sm text-gray-600 mt-1">
                      Riconsegna: {formatTimeSlot(b.riconsegna_fasciaoraria_inizio, b.riconsegna_fasciaoraria_fine)}
                    </div>
                  )}
                  <div className="font-medium mt-2">Totale: € {Number(b.price_total).toFixed(2)}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Cauzione: {b.deposito && b.deposito > 0 ? `€ ${Number(b.deposito).toFixed(2)}` : 'non prevista'}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dettaglio prenotazione */}
        {selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="rounded-lg bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-lg relative">
              <button onClick={() => setSelected(null)} className="absolute right-3 top-3 text-gray-500 hover:text-black font-bold text-xl">&times;</button>
              <h2 className="text-xl font-bold mb-4">Dettaglio prenotazione</h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <strong>Codice:</strong> <Badge variant="outline" className="ml-1">#{selected.rifPrenotazione}</Badge>
                </div>
                <div>
                  <strong>Inizio:</strong> {formatDateOnly(selected.start_date)}
                </div>
                <div>
                  <strong>Fine:</strong> {formatDateOnly(selected.end_date)}
                </div>
                {selected.ritiro_fasciaoraria_inizio && selected.ritiro_fasciaoraria_fine && (
                  <div>
                    <strong>Fascia oraria ritiro:</strong> {formatTimeSlot(selected.ritiro_fasciaoraria_inizio, selected.ritiro_fasciaoraria_fine)}
                  </div>
                )}
                {selected.riconsegna_fasciaoraria_inizio && selected.riconsegna_fasciaoraria_fine && (
                  <div>
                    <strong>Fascia oraria riconsegna:</strong> {formatTimeSlot(selected.riconsegna_fasciaoraria_inizio, selected.riconsegna_fasciaoraria_fine)}
                  </div>
                )}
                <div>
                  <strong>Modalità:</strong> {selected.delivery_method === "pickup" ? "Ritiro in sede" : "Consegna a domicilio"}
                </div>
                {selected.delivery_address && (
                  <div>
                    <strong>Indirizzo consegna:</strong> {selected.delivery_address}
                  </div>
                )}
                <div>
                  <strong>Totale:</strong> <span className="text-lg font-bold text-green-700">€ {Number(selected.price_total).toFixed(2)}</span>
                </div>
                <div>
                  <strong>Cauzione:</strong> <span className="text-lg font-bold text-blue-700">
                    {selected.deposito && selected.deposito > 0 ? `€ ${Number(selected.deposito).toFixed(2)}` : 'non prevista'}
                  </span>
                </div>
                <div>
                  <strong>Stato:</strong> <Badge variant="outline">{statusLabel[selected.status]}</Badge>
                </div>
              </div>

              {/* Articoli della prenotazione */}
              <div className="border-t pt-4 mb-6">
                <h3 className="text-lg font-semibold mb-3">Articoli prenotati</h3>
                {isLoadingDetails ? (
                  <div className="text-center py-4 text-gray-500">Caricamento articoli...</div>
                ) : detailsError ? (
                  <div className="text-center py-4 text-red-500">
                    <div className="font-semibold mb-2">Errore nel caricamento</div>
                    <div className="text-sm">
                      {detailsError instanceof Error 
                        ? detailsError.message 
                        : typeof detailsError === 'object' && detailsError !== null
                        ? JSON.stringify(detailsError, null, 2)
                        : String(detailsError)}
                    </div>
                    <div className="text-xs mt-2 text-gray-500">
                      Controlla la console per maggiori dettagli
                    </div>
                  </div>
                ) : selectedBookingDetails.length > 0 ? (
                  <div className="space-y-3">
                    {selectedBookingDetails.map((detail: any) => {
                      // Il nome del prodotto DEVE venire da detail.product.name (tabella products)
                      const productName = detail.product?.name;
                      
                      if (!productName) {
                        console.error('[BOOKINGS DEBUG RENDERING] Product name missing for detail:', detail.id, {
                          hasProduct: !!detail.product,
                          productData: detail.product,
                          unitId: detail.unit_id,
                          fullDetail: detail
                        });
                      }
                      
                      return (
                      <Card key={detail.id} className="p-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold text-green-600 mb-1">
                              {productName || (isLoadingDetails ? "Caricamento..." : "Prodotto")}
                            </div>
                            {detail.product?.brand && (
                              <div className="text-sm text-gray-600">Marca: {detail.product.brand}</div>
                            )}
                            {detail.product?.model && (
                              <div className="text-sm text-gray-600">Modello: {detail.product.model}</div>
                            )}
                            <div className="text-sm text-gray-600 mt-1">
                              Dal {formatDateOnly(detail.start_date)} al {formatDateOnly(detail.end_date)}
                            </div>
                            {detail.delivery_method && (
                              <div className="text-sm text-gray-600">
                                {detail.delivery_method === "pickup" ? "Ritiro in sede" : "Consegna a domicilio"}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-700">€ {Number(detail.price).toFixed(2)}</div>
                          </div>
                        </div>
                      </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    Nessun articolo trovato
                    {selected?.id && (
                      <div className="text-xs mt-2">Booking ID: {selected.id}</div>
                    )}
                  </div>
                )}
              </div>

              {/* IMPORTANTE: Il rimborso può essere richiesto SOLO ED ESCLUSIVAMENTE se lo status è 'confirmed' e ore_rimborso_consentite è presente */}
              {selected.status === 'confirmed' && !refundsByBookingId.has(selected.id) && shopSettings?.ore_rimborso_consentite && (() => {
                // Verifica che TUTTI i prodotti siano in stato "idle" o "toPickup"
                // Gli status possibili sono: idle, toPickup, pickedUp, returned
                // Se almeno uno è in uno stato diverso (pickedUp, returned), il pulsante deve essere disabilitato
                
                // Se non ci sono booking_details, non permettere l'annullamento
                if (!selectedBookingDetails || selectedBookingDetails.length === 0) {
                  console.log('[BOOKINGS DEBUG] No booking details found, cannot cancel');
                  return null;
                }
                
                // Verifica se almeno un prodotto ha una data di ritiro precedente o uguale a oggi
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const hasPastOrTodayPickupDate = selectedBookingDetails.some((detail: any) => {
                  if (!detail.start_date) return false;
                  const pickupDate = new Date(detail.start_date);
                  pickupDate.setHours(0, 0, 0, 0);
                  // Blocca se la data è precedente o uguale a oggi (giorno stesso)
                  return pickupDate <= today;
                });
                
                // Verifica lo status di ogni prodotto
                // IMPORTANTE: ogni() su array vuoto restituisce true, quindi controlliamo prima la lunghezza
                const allProductsCanBeCancelled = selectedBookingDetails.length > 0 && 
                  selectedBookingDetails.every((detail: any) => {
                    const status = detail.status;
                    // Accetta: null, undefined, 'idle', 'toPickup', 'to_pickup' (per compatibilità)
                    // Rifiuta: 'pickedUp', 'picked_up', 'returned', o qualsiasi altro valore
                    const canCancelThisProduct = !status || 
                      status === 'idle' || 
                      status === 'toPickup' || 
                      status === 'to_pickup'; // Compatibilità con formato vecchio
                    
                    // Esplicitamente rifiuta gli status che non permettono l'annullamento
                    if (status === 'pickedUp' || status === 'picked_up' || status === 'returned') {
                      return false;
                    }
                    
                    if (!canCancelThisProduct) {
                      console.log('[BOOKINGS DEBUG] Product cannot be cancelled:', {
                        detailId: detail.id,
                        status: status,
                        productName: detail.product?.name
                      });
                    }
                    
                    return canCancelThisProduct;
                  });
                
                console.log('[BOOKINGS DEBUG] Can cancel booking:', {
                  allProductsCanBeCancelled,
                  hasPastOrTodayPickupDate,
                  totalDetails: selectedBookingDetails.length,
                  statuses: selectedBookingDetails.map((d: any) => ({ 
                    id: d.id, 
                    status: d.status, 
                    productName: d.product?.name,
                    startDate: d.start_date,
                    canCancel: !d.status || d.status === 'idle' || d.status === 'toPickup'
                  }))
                });
                
                // Il pulsante è disabilitato se:
                // 1. Almeno un prodotto non può essere cancellato (stato non valido)
                // 2. Almeno un prodotto ha una data di ritiro precedente o uguale a oggi (giorno stesso)
                const canCancel = allProductsCanBeCancelled && !hasPastOrTodayPickupDate;
                
                return (
                  <div className="mt-6 pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="default"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefundClick(selected, e);
                      }}
                      disabled={!canCancel}
                      className="w-full font-semibold"
                    >
                      <Undo2 className="h-5 w-5 mr-2" />
                      Annulla prenotazione
                    </Button>
                    {!canCancel && selectedBookingDetails.length > 0 && (
                      <p className="text-sm text-gray-500 mt-2 text-center">
                        {hasPastOrTodayPickupDate 
                          ? "Non è possibile richiedere il rimborso: almeno un prodotto ha una data di ritiro di oggi o precedente."
                          : "Non è possibile annullare la prenotazione: almeno un prodotto è già stato ritirato o è in un altro stato."}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Dialog per conferma rimborso */}
        <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Richiedi rimborso</DialogTitle>
              <DialogDescription>
                Conferma che desideri richiedere il rimborso per questa prenotazione.
              </DialogDescription>
            </DialogHeader>
            {bookingToRefund && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <div>
                    <strong>Prodotto:</strong> {bookingToRefund.products?.title || `#${bookingToRefund.rifPrenotazione || bookingToRefund.id}`}
                  </div>
                  <div>
                    <strong>Periodo:</strong> Dal {formatDate(bookingToRefund.start_date)} al {formatDate(bookingToRefund.end_date)}
                  </div>
                  <div>
                    <strong>Importo totale:</strong> € {Number(bookingToRefund.price_total).toFixed(2)}
                  </div>
                  {(() => {
                    const refundPercentage = calculateRefundPercentage(bookingToRefund.start_date);
                    if (refundPercentage !== null) {
                      const refundAmount = Number(bookingToRefund.price_total) * (refundPercentage / 100);
                      return (
                        <div className="mt-4 p-3 bg-blue-50 rounded-md">
                          <div className="font-semibold text-blue-900">
                            Rimborso previsto: {refundPercentage}% (€ {refundAmount.toFixed(2)})
                          </div>
                          <div className="text-sm text-blue-700 mt-1">
                            {refundPercentage === 100 
                              ? `Rimborso totale: la prenotazione è almeno ${shopSettings?.ore_rimborso_consentite || 24} ore prima dell'inizio.`
                              : `Rimborso parziale: la prenotazione è entro le ${shopSettings?.ore_rimborso_consentite || 24} ore dall'inizio.`}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="refund-confirmation"
                    checked={refundConfirmationChecked}
                    onChange={(e) => setRefundConfirmationChecked(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="refund-confirmation" className="text-sm">
                    Confermo di voler richiedere il rimborso per questa prenotazione
                  </label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRefundDialogOpen(false);
                  setBookingToRefund(null);
                  setRefundConfirmationChecked(false);
                }}
                disabled={refundMutation.isPending}
              >
                Annulla
              </Button>
              <Button
                onClick={handleRefundConfirm}
                disabled={!refundConfirmationChecked || refundMutation.isPending}
                variant="destructive"
              >
                {refundMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Elaborazione...
                  </>
                ) : (
                  "Conferma rimborso"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Footer />
    </div>
  );
}
