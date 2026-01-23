import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import { ArrowLeft, Calendar, Clock, MapPin, Truck, Home, CheckCircle, LogIn, Shield, Plus, Copy } from "lucide-react";
import { useProduct } from "@/hooks/useProducts";
import { useBookings } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProductCategories } from "@/hooks/useProductCategories";
import { useProductSubcategories } from "@/hooks/useProductSubcategories";
import { useProductConditions } from "@/hooks/useProductConditions";
import { BookingService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, differenceInCalendarDays, isSameDay, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import { useShopDaysOff, isDateWithEnabledBooking } from '@/hooks/useShopDaysOff';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_IMAGES } from "@/constants";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import CreateCustomerDialog from "@/components/admin/CreateCustomerDialog";
import { DynamicFormField } from "@/components/DynamicFormField";
import { useCheckoutInformations, filterInformationsBySubcategory } from "@/hooks/useCheckoutInformations";
import type { Information } from "@/hooks/useCheckoutInformations";
import type { CreateBookingData } from "@/types";
import type { Customer } from "@/hooks/useCustomers";
import { calculateRentalPrice, findHourlyPricePeriodId, findPricePeriodId } from "@/lib/pricing";
import { toItalianISOString } from "@/lib/utils";

// Fasce orarie disponibili per il ritiro e riconsegna
const timeSlots = [
  { value: "08:00-09:00", label: "08:00 - 09:00", start: "08:00", end: "09:00" },
  { value: "09:00-10:00", label: "09:00 - 10:00", start: "09:00", end: "10:00" },
  { value: "10:00-11:00", label: "10:00 - 11:00", start: "10:00", end: "11:00" },
  { value: "11:00-12:00", label: "11:00 - 12:00", start: "11:00", end: "12:00" },
  { value: "12:00-13:00", label: "12:00 - 13:00", start: "12:00", end: "13:00" },
  { value: "13:00-14:00", label: "13:00 - 14:00", start: "13:00", end: "14:00" },
  { value: "14:00-15:00", label: "14:00 - 15:00", start: "14:00", end: "15:00" },
  { value: "15:00-16:00", label: "15:00 - 16:00", start: "15:00", end: "16:00" },
  { value: "16:00-17:00", label: "16:00 - 17:00", start: "16:00", end: "17:00" },
  { value: "17:00-18:00", label: "17:00 - 18:00", start: "17:00", end: "18:00" },
  { value: "18:00-19:00", label: "18:00 - 19:00", start: "18:00", end: "19:00" },
  { value: "19:00-20:00", label: "19:00 - 20:00", start: "19:00", end: "20:00" },
];

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
  delivery_method: 'pickup' | 'delivery' | null;
  price: number;
  products?: {
    id: string;
    name: string;
    brand: string;
    model: string;
    images: string[];
    can_be_delivered: boolean;
    can_be_picked_up: boolean;
    id_product_subcategory?: string | null;
  };
  informations?: BookingDetailInformation[];
}

interface CartBooking {
  id: string;
  user_id: string;
  booking_details?: BookingDetail[];
}

interface DetailFormData {
  deliveryMethod: 'pickup' | 'delivery' | '';
}

const Checkout = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: shopDaysOff = [] } = useShopDaysOff();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<'pickup' | 'delivery' | ''>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] = useState(false);
  const [customerListKey, setCustomerListKey] = useState(0);

  // Get URL parameters for new product to add
  const urlProductId = searchParams.get("productId");
  const urlVariantId = searchParams.get("variantId");
  const urlQuantity = searchParams.get("quantity");
  const urlRelatedVariantIds = searchParams.get("relatedVariantIds"); // Prodotti correlati selezionati
  
  // State per nuovo prodotto da aggiungere (se ci sono parametri URL)
  const [newProductData, setNewProductData] = useState<{
    productId: string;
    startDate: Date;
    endDate: Date;
    variantId: string;
    startTime: string;
    endTime: string;
    quantity: number;
    product: any;
    variant: any;
    formData: DetailFormData;
  } | null>(null);

  // State per ogni booking_detail nel carrello
  const [detailsFormData, setDetailsFormData] = useState<{ [detailId: string]: DetailFormData }>({});

  // State per prodotti correlati selezionati (caricati da URL)
  const [relatedProducts, setRelatedProducts] = useState<Array<{
    variantId: string;
    variant: any;
    product: any;
  }>>([]);

  // State per i valori del form dinamico
  const [dynamicFormValues, setDynamicFormValues] = useState<{ [informationId: string]: any }>({});

  // State per i form data per ogni unità quando quantity > 1
  const [newProductFormDataByUnit, setNewProductFormDataByUnit] = useState<{ [unitIndex: number]: DetailFormData }>({});
  const [newProductDynamicFormValuesByUnit, setNewProductDynamicFormValuesByUnit] = useState<{ [unitIndex: number]: { [informationId: string]: any } }>({});

  // State per gli attributi della variante selezionata
  const [variantAttributes, setVariantAttributes] = useState<{ name: string; value: string; unit?: string }[]>([]);

  // State per gli errori di validazione dei campi dinamici
  // Include sia errori di campi obbligatori che errori di formato (email, phone)
  const [validationErrors, setValidationErrors] = useState<{ [unitIndex: number]: { [informationId: string]: string } }>({});
  
  // State per tracciare gli errori di validazione del formato (email, phone) per ogni campo
  const [formatValidationErrors, setFormatValidationErrors] = useState<{ [unitIndex: number]: { [informationId: string]: string } }>({});

  // State per tracciare quale opzione della tendina è selezionata (per ogni unità)
  const [selectedCartInformation, setSelectedCartInformation] = useState<{ [unitIndex: number]: string }>({});

  // State per lo stepper quando quantity > 1
  const [currentStep, setCurrentStep] = useState<number>(0);

  // State per il prezzo calcolato del nuovo prodotto (per display)
  const [newProductPrice, setNewProductPrice] = useState<{ totalPrice: number; priceBreakdown: string } | null>(null);
  
  // State per i prezzi calcolati dei prodotti correlati
  const [relatedProductsPrices, setRelatedProductsPrices] = useState<{ [variantId: string]: number }>({});

  // Carica le impostazioni del negozio per verificare le modalità disponibili
  const { data: shopSettings, isLoading: isLoadingShopSettings } = useQuery({
    queryKey: ['shop_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('ritiroInNegozio, consegna, precompilazioneCampi')
        .maybeSingle();
      
      if (error) {
        console.error('Error loading shop settings:', error);
        // Ritorna valori di default se c'è un errore
        // precompilazioneCampi default a false (non precompilare se non specificato)
        return { ritiroInNegozio: true, consegna: true, precompilazioneCampi: false };
      }
      
      // Se data è null o undefined, usa default con precompilazioneCampi = false
      const settings = data || { ritiroInNegozio: true, consegna: true, precompilazioneCampi: false };
      // Se precompilazioneCampi non è definito, imposta a false
      if (settings.precompilazioneCampi === undefined || settings.precompilazioneCampi === null) {
        settings.precompilazioneCampi = false;
      }
      return settings;
    },
  });

  // Determina se mostrare la selezione della modalità
  const showDeliveryMethodSelection = shopSettings?.ritiroInNegozio && shopSettings?.consegna;
  const availableDeliveryMethods = {
    pickup: shopSettings?.ritiroInNegozio ?? true,
    delivery: shopSettings?.consegna ?? true,
  };

  // TEST RAPIDO: Verifica se la tabella esiste e funziona (eseguito una volta al mount)
  useEffect(() => {
    const testPriceTable = async () => {
      console.log('[TEST] ========================================');
      console.log('[TEST] Verifica tabella product_variant_price_list...');
      try {
        const { data, error } = await supabase
          .from('product_variant_price_list')
          .select('*')
          .limit(5);
        console.log('[TEST] Risultato query test:', { 
          data, 
          error,
          hasData: !!data,
          dataLength: data?.length || 0
        });
        
        if (error) {
          console.error('[TEST] ❌ Errore nella query:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
        } else {
          console.log('[TEST] ✅ Tabella esiste e query funziona!');
          if (data && data.length > 0) {
            console.log('[TEST] Esempio di record:', data[0]);
            console.log('[TEST] Colonne disponibili:', Object.keys(data[0]));
          } else {
            console.warn('[TEST] ⚠️ Tabella esiste ma è vuota');
          }
        }
      } catch (err) {
        console.error('[TEST] ❌ Errore nel test:', err);
      }
      console.log('[TEST] ========================================');
    };
    
    // Esegui il test una volta quando il componente si monta
    testPriceTable();
  }, []); // Array vuoto = eseguito solo al mount

  // Close auth dialog when user logs in
  useEffect(() => {
    if (user && authDialogOpen) {
      setAuthDialogOpen(false);
    }
  }, [user, authDialogOpen]);

  // Handle customer creation
  const handleCustomerCreated = () => {
    // Refresh the customer list in the autocomplete by changing the key
    setIsCreateCustomerDialogOpen(false);
    setCustomerListKey(prev => prev + 1);
  };



  // Get date filters from URL parameters and convert to Date objects
  const urlStartDate = searchParams.get("startDate");
  const urlEndDate = searchParams.get("endDate");
  const urlStartTime = searchParams.get("startTime");
  const urlEndTime = searchParams.get("endTime");
  
  // Convert string dates to Date objects
  const startDate = urlStartDate ? new Date(urlStartDate) : undefined;
  const endDate = urlEndDate ? new Date(urlEndDate) : undefined;
  const startTime = urlStartTime || "";
  const endTime = urlEndTime || "";

  // Use the product hook (only if id is provided, not for URL params)
  const { product, isLoading: isLoadingProduct, error } = useProduct(id || "");
  const { bookings } = useBookings(id);
  const { data: productConditions, isLoading: loadingConditions } = useProductConditions();
  const { data: categories, isLoading: loadingCategories } = useProductCategories();
  const productSubcategory = (product as any)?.product_subcategory;
  const categoryId = productSubcategory?.product_category_id;
  const { data: subcategories, isLoading: loadingSubcategories } = useProductSubcategories(categoryId || "");

  // Fetch cart booking with details
  // Se l'admin ha selezionato un cliente, carica il carrello del cliente, altrimenti carica il carrello dell'admin
  const effectiveUserId = isAdmin && selectedCustomer ? selectedCustomer.id : user?.id;
  const { data: cartData, isLoading: isLoadingCart } = useQuery({
    queryKey: ["cart", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;

      const { data: allBookings } = await supabase
        .from("bookings")
        .select("id, user_id, cart")
        .eq("user_id", effectiveUserId);

      const cartBooking = allBookings?.find(b => b.cart === true);
      
      if (!cartBooking) return null;

      const { data: bookingDetails, error } = await supabase
        .from("booking_details")
        .select(`
          id,
          booking_id,
          unit_id,
          start_date,
          end_date,
          delivery_method,
          price,
          product_units!inner(
            id_product_variant,
            product_variants!inner(
              id_product,
              products!inner(
                id,
                name,
                images,
                can_be_delivered,
                can_be_picked_up,
                id_product_subcategory,
                product_brand:product_brand(id, name),
                product_model:product_model(id, name)
              )
            )
          )
        `)
        .eq("booking_id", cartBooking.id);

      if (error) throw error;

      // Get booking_details_informations for all details
      const detailIds = (bookingDetails || []).map((d: any) => d.id);
      let informationsMap = new Map<string, any[]>();
      
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
          bookingDetailsInformations.forEach((info: any) => {
            const detailId = info.booking_details_id;
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
        }
      }

      // Transform the data to match our interface
      const transformedDetails: BookingDetail[] = (bookingDetails || []).map((detail: any) => ({
        id: detail.id,
        booking_id: detail.booking_id,
        unit_id: detail.unit_id,
        start_date: detail.start_date,
        end_date: detail.end_date,
        delivery_method: detail.delivery_method,
        price: detail.price,
        products: detail.product_units?.product_variants?.products ? {
          id: detail.product_units.product_variants.products.id,
          name: detail.product_units.product_variants.products.name,
          brand: detail.product_units.product_variants.products.product_brand?.name || '',
          model: detail.product_units.product_variants.products.product_model?.name || '',
          images: detail.product_units.product_variants.products.images || [],
          can_be_delivered: detail.product_units.product_variants.products.can_be_delivered,
          can_be_picked_up: detail.product_units.product_variants.products.can_be_picked_up,
          id_product_subcategory: detail.product_units.product_variants.products.id_product_subcategory,
        } : undefined,
        informations: informationsMap.get(detail.id) || [],
      }));

      return {
        id: cartBooking.id,
        user_id: cartBooking.user_id,
        booking_details: transformedDetails,
      } as CartBooking;
    },
    enabled: !!user?.id,
  });

  // Carica tutte le informazioni (senza filtrare per sottocategoria)
  // Le informazioni verranno filtrate lato client in base alla sottocategoria del prodotto specifico
  // IMPORTANTE: Questo hook deve essere chiamato prima di tutti gli useEffect che usano informations
  const { data: allInformations, isLoading: isLoadingInformations } = useCheckoutInformations();

  // Controlla se c'è un carrello pendente da localStorage (dopo login)
  useEffect(() => {
    const loadPendingCartItem = async () => {
      if (!user?.id || urlProductId) return; // Se ci sono già parametri URL, non fare nulla
      
      const pendingCartItem = localStorage.getItem('pendingCartItem');
      if (!pendingCartItem) return;
      
      try {
        const cartData = JSON.parse(pendingCartItem);
        
        // Rimuovi il carrello pendente subito per evitare loop
        localStorage.removeItem('pendingCartItem');
        
        if (!cartData.productId || !cartData.variantId || !cartData.startDate || !cartData.endDate) {
          console.error('Pending cart item missing required data');
          return;
        }
        
        const startDate = new Date(cartData.startDate);
        const endDate = new Date(cartData.endDate);
        
        // Fetch product and variant data
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            images,
            can_be_delivered,
            can_be_picked_up,
            has_variants,
            id_product_subcategory,
            product_brand:product_brand(id, name),
            product_model:product_model(id, name),
            product_variants(
              id,
              is_active
            )
          `)
          .eq('id', cartData.productId)
          .single();
        
        if (productError) throw productError;
        
        // Get selected variant
        let variantId: string | null = cartData.variantId;
        let selectedVariant: any = productData.product_variants?.find((v: any) => v.id === variantId);
        
        if (!selectedVariant && productData.has_variants === true && productData.product_variants) {
          const activeVariant = productData.product_variants.find((v: any) => v.is_active === true);
          if (activeVariant) {
            variantId = activeVariant.id;
            selectedVariant = activeVariant;
          }
        }
        
        if (!variantId || !selectedVariant) {
          throw new Error('Prodotto senza varianti valide.');
        }
        
        const quantity = cartData.quantity ? parseInt(cartData.quantity.toString()) : 1;
        
        setNewProductData({
          productId: cartData.productId,
          startDate,
          endDate,
          variantId,
          startTime: cartData.startTime || '',
          endTime: cartData.endTime || '',
          quantity: quantity > 0 ? quantity : 1,
          product: productData,
          variant: selectedVariant,
          formData: {
            deliveryMethod: '',
          },
        });
      } catch (error) {
        console.error('Error loading pending cart item:', error);
        toast({
          title: "Errore",
          description: error instanceof Error ? error.message : 'Errore nel caricamento del prodotto dal carrello pendente',
          variant: "destructive",
        });
      }
    };
    
    loadPendingCartItem();
  }, [user?.id, urlProductId, toast]);

  // Carica dati del prodotto quando ci sono parametri URL
  useEffect(() => {
    const loadNewProductData = async () => {
      if (!user?.id || !urlProductId || !urlStartDate || !urlEndDate) {
        setNewProductData(null);
        return;
      }

      try {
        const startDate = new Date(urlStartDate);
        const endDate = new Date(urlEndDate);

        // Fetch product and variant data
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            images,
            can_be_delivered,
            can_be_picked_up,
            has_variants,
            id_product_subcategory,
            product_brand:product_brand(id, name),
            product_model:product_model(id, name),
            product_variants(
              id,
              is_active
            )
          `)
          .eq('id', urlProductId)
          .single();
        
        if (productError) throw productError;

        // Get selected variant
        let variantId: string | null = null;
        let selectedVariant: any = null;
        
        if (urlVariantId) {
          variantId = urlVariantId;
          selectedVariant = productData.product_variants?.find((v: any) => v.id === variantId);
        } else if (productData.has_variants === true && productData.product_variants) {
          const activeVariant = productData.product_variants.find((v: any) => v.is_active === true);
          if (activeVariant) {
            variantId = activeVariant.id;
            selectedVariant = activeVariant;
          }
        } else {
          // I prezzi non sono più nella tabella product_variants, sono in product_variant_price_list
          const { data: fallbackVariants } = await supabase
            .from('product_variants')
            .select('id')
            .eq('id_product', urlProductId)
            .limit(1);
          if (fallbackVariants && fallbackVariants.length > 0) {
            variantId = fallbackVariants[0].id;
            selectedVariant = fallbackVariants[0];
          }
        }

        if (!variantId || !selectedVariant) {
          throw new Error('Prodotto senza varianti valide.');
        }

        const quantity = urlQuantity ? parseInt(urlQuantity) : 1;
        
        setNewProductData({
          productId: urlProductId,
          startDate,
          endDate,
          variantId,
          startTime: urlStartTime || '',
          endTime: urlEndTime || '',
          quantity: quantity > 0 ? quantity : 1,
          product: productData,
          variant: selectedVariant,
          formData: {
            deliveryMethod: '',
          },
        });
      } catch (error) {
        console.error('Error loading product data:', error);
        toast({
          title: "Errore",
          description: error instanceof Error ? error.message : 'Errore nel caricamento del prodotto',
          variant: "destructive",
        });
        navigate(-1);
      }
    };

    loadNewProductData();
  }, [user?.id, urlProductId, urlStartDate, urlEndDate, urlVariantId, urlStartTime, urlEndTime, navigate, toast]);

  // Carica i prodotti correlati selezionati
  useEffect(() => {
    const loadRelatedProducts = async () => {
      if (!urlRelatedVariantIds) {
        setRelatedProducts([]);
        return;
      }

      try {
        const relatedVariantIds = urlRelatedVariantIds.split(',').filter(id => id.trim());
        console.log('[Checkout] Caricamento prodotti correlati:', relatedVariantIds);

        if (relatedVariantIds.length === 0) {
          setRelatedProducts([]);
          return;
        }

        // Filtra il prodotto principale dai prodotti correlati per evitare duplicazioni
        // Il prodotto principale viene aggiunto separatamente, non deve essere nei correlati
        const mainVariantId = urlVariantId;
        let filteredRelatedVariantIds = relatedVariantIds;
        
        if (mainVariantId) {
          filteredRelatedVariantIds = relatedVariantIds.filter(id => {
            const isMainProduct = id.trim() === mainVariantId.trim();
            if (isMainProduct) {
              console.log('[Checkout] Rimosso prodotto principale dai correlati:', id);
            }
            return !isMainProduct;
          });
        }
        
        console.log('[Checkout] Prodotti correlati dopo filtro:', {
          original: relatedVariantIds,
          filtered: filteredRelatedVariantIds,
          mainVariantId,
          originalCount: relatedVariantIds.length,
          filteredCount: filteredRelatedVariantIds.length
        });
        
        // Se dopo il filtro non ci sono prodotti correlati, verifica se erano tutti il prodotto principale
        // Se la lista originale aveva prodotti e dopo il filtro è vuota, significa che erano tutti il prodotto principale
        if (filteredRelatedVariantIds.length === 0) {
          if (relatedVariantIds.length > 0 && mainVariantId) {
            const wasAllMainProduct = relatedVariantIds.every(id => id.trim() === mainVariantId.trim());
            if (wasAllMainProduct) {
              console.log('[Checkout] Tutti i prodotti correlati erano il prodotto principale, nessun prodotto correlato da aggiungere');
            } else {
              console.warn('[Checkout] Nessun prodotto correlato dopo filtro, ma non erano tutti il prodotto principale. Lista originale:', relatedVariantIds);
            }
          } else {
            console.log('[Checkout] Nessun prodotto correlato da caricare');
          }
          setRelatedProducts([]);
          return;
        }

        // Carica le varianti e i prodotti correlati
        // I prezzi non sono più nella tabella product_variants, sono in product_variant_price_list
        const { data: relatedVariants, error } = await supabase
          .from('product_variants')
          .select(`
            id,
            id_product,
            deposit,
            products!inner(
              id,
              name,
              description,
              images,
              id_product_subcategory
            )
          `)
          .in('id', filteredRelatedVariantIds);

        if (error) {
          console.error('[Checkout] Errore nel caricamento prodotti correlati:', error);
          setRelatedProducts([]);
          return;
        }

        const transformed = (relatedVariants || []).map((rv: any) => ({
          variantId: rv.id,
          variant: rv,
          product: rv.products
        }));

        console.log('[Checkout] Prodotti correlati caricati:', transformed);
        setRelatedProducts(transformed);
      } catch (error) {
        console.error('[Checkout] Errore nel caricamento prodotti correlati:', error);
        setRelatedProducts([]);
      }
    };

    loadRelatedProducts();
  }, [urlRelatedVariantIds, urlVariantId]);

  // Carica gli attributi della variante quando viene selezionata
  useEffect(() => {
    const loadVariantAttributes = async () => {
      if (!newProductData?.variantId) {
        setVariantAttributes([]);
        return;
      }

      try {
        // Carica gli attributi della variante tramite la tabella di giunzione
        const { data: variantAttributeValues, error: attributesError } = await supabase
          .from('product_variant_attribute_values')
          .select(`
            id_product_attribute_value,
            product_attributes_values!inner(
              id,
              value,
              id_product_attribute,
              product_attributes!inner(
                id,
                name,
                unit
              )
            )
          `)
          .eq('id_product_variant', newProductData.variantId);

        if (attributesError) {
          console.error('Error loading variant attributes:', attributesError);
          setVariantAttributes([]);
          return;
        }

        if (variantAttributeValues && variantAttributeValues.length > 0) {
          const attributes = variantAttributeValues
            .map((vav: any) => {
              const attrValue = vav.product_attributes_values;
              if (!attrValue) return null;
              
              return {
                name: attrValue.product_attributes?.name || '',
                value: attrValue.value || '',
                unit: attrValue.product_attributes?.unit || undefined,
              };
            })
            .filter((attr: any) => attr !== null);
          
          // Variant attributes loaded
          setVariantAttributes(attributes);
        } else {
          // No variant attributes found for variant
          setVariantAttributes([]);
        }
      } catch (error) {
        console.error('Error loading variant attributes:', error);
        setVariantAttributes([]);
      }
    };

    loadVariantAttributes();
  }, [newProductData?.variantId]);

  // Calcola il prezzo del nuovo prodotto quando cambiano i dati
  useEffect(() => {
    const calculatePrice = async () => {
      if (!newProductData?.variantId || !newProductData?.startDate || !newProductData?.endDate) {
        setNewProductPrice(null);
        return;
      }

      const startDate = newProductData.startDate;
      const endDate = newProductData.endDate;
      const isSameDayBooking = isSameDay(startDate, endDate);
      const rentalDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
      const rentalHours = newProductData.startTime && newProductData.endTime && isSameDayBooking
        ? Math.max(1, parseInt(newProductData.endTime.split(":")[0]) - parseInt(newProductData.startTime.split(":")[0]))
        : 0;

      const useHourlyPrice = rentalHours > 0 && isSameDayBooking;

      try {
        let totalPrice = await calculateRentalPrice(
          newProductData.variantId,
          rentalDays,
          rentalHours,
          isSameDayBooking
        );

        // Recupera il prezzo giornaliero per il breakdown e per il calcolo fallback
        let dailyPrice = 0;
        if (!useHourlyPrice) {
          const dailyPeriodId = await findPricePeriodId(1); // Periodo per 1 giorno
          
          if (dailyPeriodId) {
            const { data: dailyPriceEntry } = await supabase
              .from('product_variant_price_list')
              .select('price')
              .eq('id_product_variant', newProductData.variantId)
              .eq('id_price_period', dailyPeriodId)
              .maybeSingle();
            
            if (dailyPriceEntry && dailyPriceEntry.price !== null && dailyPriceEntry.price !== undefined) {
              dailyPrice = Number(dailyPriceEntry.price);
            }
          }
          
          // Se findPricePeriodId(1) non funziona, cerca tra tutti i prezzi un periodo che corrisponde a 1 giorno
          if (dailyPrice === 0) {
            const { data: allPrices } = await supabase
              .from('product_variant_price_list')
              .select('id_price_period, price')
              .eq('id_product_variant', newProductData.variantId);
            
            const { data: allPeriods } = await supabase
              .from('price_periods')
              .select('*');
            
            if (allPrices && allPeriods) {
              for (const priceEntry of allPrices) {
                if (!priceEntry.price) continue;
                
                const period = allPeriods.find((p: any) => p.id === priceEntry.id_price_period);
                if (!period) continue;
                
                // Cerca campi che potrebbero rappresentare giorni
                const possibleFields = ['days', 'day', 'num_days', 'duration_days', 'min_days', 'days_from', 'start_days'];
                for (const field of possibleFields) {
                  if (field in period && typeof period[field] === 'number' && period[field] === 1) {
                    dailyPrice = Number(priceEntry.price);
                    break;
                  }
                }
                if (dailyPrice > 0) break;
              }
            }
          }
          
          // Se abbiamo trovato il prezzo giornaliero, verifica se il prezzo restituito
          // corrisponde al prezzo giornaliero (non moltiplicato) e, in quel caso, moltiplicalo per i giorni
          if (dailyPrice > 0 && rentalDays > 1) {
            const expectedPrice = dailyPrice * rentalDays;
            const priceDifference = Math.abs(totalPrice - dailyPrice);
            const isDailyPriceOnly = priceDifference < 0.01;
            
            // Se il prezzo è 0, molto basso, corrisponde al prezzo giornaliero, o è molto più basso di quello atteso,
            // calcola il prezzo moltiplicando il prezzo giornaliero per i giorni
            if (totalPrice === 0 || totalPrice < 1 || isDailyPriceOnly || totalPrice < expectedPrice * 0.8) {
              totalPrice = dailyPrice * rentalDays;
              console.log('[Checkout] Calcolato prezzo usando prezzo giornaliero:', {
                dailyPrice,
                rentalDays,
                totalPrice
              });
            }
          }
        }

        let priceBreakdown = '';
        if (useHourlyPrice) {
          // Per il breakdown, recuperiamo il prezzo orario dalla tabella usando id_price_period
          const hourlyPeriodId = await findHourlyPricePeriodId();
          if (hourlyPeriodId) {
            const { data: hourlyPriceEntry } = await supabase
              .from('product_variant_price_list')
              .select('price')
              .eq('id_product_variant', newProductData.variantId)
              .eq('id_price_period', hourlyPeriodId)
              .maybeSingle();
            
            const hourlyPrice = hourlyPriceEntry?.price ? Number(hourlyPriceEntry.price) : 0;
            priceBreakdown = `€${hourlyPrice.toFixed(2)} × ${rentalHours} ${rentalHours === 1 ? 'ora' : 'ore'}`;
          } else {
            priceBreakdown = `${rentalHours} ${rentalHours === 1 ? 'ora' : 'ore'}`;
          }
        } else {
          // Mostra il prezzo giornaliero nel breakdown se disponibile
          if (dailyPrice > 0) {
            priceBreakdown = `€${dailyPrice.toFixed(2)} × ${rentalDays} ${rentalDays === 1 ? 'giorno' : 'giorni'}`;
          } else {
            priceBreakdown = `${rentalDays} ${rentalDays === 1 ? 'giorno' : 'giorni'}`;
          }
        }

        setNewProductPrice({ totalPrice, priceBreakdown });
      } catch (error) {
        console.error('Error calculating price:', error);
        setNewProductPrice(null);
      }
    };

    calculatePrice();
  }, [newProductData?.variantId, newProductData?.startDate, newProductData?.endDate, newProductData?.startTime, newProductData?.endTime]);

  // Calcola i prezzi dei prodotti correlati quando cambiano i dati
  useEffect(() => {
    // TEST RAPIDO: Verifica se la tabella esiste e funziona
    const testPriceTable = async () => {
      console.log('[TEST] Verifica tabella product_variant_price_list...');
      try {
        const { data, error } = await supabase
          .from('product_variant_price_list')
          .select('*')
          .limit(5);
        console.log('[TEST] Risultato query test:', { 
          data, 
          error,
          hasData: !!data,
          dataLength: data?.length || 0
        });
        
        if (error) {
          console.error('[TEST] ❌ Errore nella query:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
        } else {
          console.log('[TEST] ✅ Tabella esiste e query funziona!');
          if (data && data.length > 0) {
            console.log('[TEST] Esempio di record:', data[0]);
            console.log('[TEST] Colonne disponibili:', Object.keys(data[0]));
          } else {
            console.warn('[TEST] ⚠️ Tabella esiste ma è vuota');
          }
        }
      } catch (err) {
        console.error('[TEST] ❌ Errore nel test:', err);
      }
    };
    
    // Esegui il test una volta quando il componente si monta
    testPriceTable();

    const calculateRelatedPrices = async () => {
      if (!newProductData || relatedProducts.length === 0) {
        setRelatedProductsPrices({});
        return;
      }

      const startDate = newProductData.startDate;
      const endDate = newProductData.endDate;
      if (!startDate || !endDate) {
        setRelatedProductsPrices({});
        return;
      }

      const isSameDayBooking = isSameDay(startDate, endDate);
      const rentalDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
      const rentalHours = newProductData.startTime && newProductData.endTime && isSameDayBooking
        ? Math.max(1, parseInt(newProductData.endTime.split(":")[0]) - parseInt(newProductData.startTime.split(":")[0]))
        : 0;

      console.log('[Checkout] Calcolo prezzi prodotti correlati:', {
        relatedProductsCount: relatedProducts.length,
        rentalDays,
        rentalHours,
        isSameDayBooking
      });

      const prices: { [variantId: string]: number } = {};

      for (const relatedProduct of relatedProducts) {
        try {
          console.log(`[Checkout] Calcolo prezzo per prodotto correlato:`, {
            variantId: relatedProduct.variantId,
            productName: relatedProduct.product?.name,
            variant: relatedProduct.variant
          });

          console.log(`[Checkout] Parametri per calcolo prezzo:`, {
            variantId: relatedProduct.variantId,
            rentalDays,
            rentalHours,
            isSameDayBooking
          });

          let totalPrice = await calculateRentalPrice(
            relatedProduct.variantId,
            rentalDays,
            rentalHours,
            isSameDayBooking
          );

          // Se non è un noleggio orario, verifica se il prezzo va moltiplicato per i giorni
          if (!(rentalHours > 0 && isSameDayBooking) && rentalDays > 1) {
            const dailyPeriodId = await findPricePeriodId(1);
            
            if (dailyPeriodId) {
              const { data: dailyPriceEntry } = await supabase
                .from('product_variant_price_list')
                .select('price')
                .eq('id_product_variant', relatedProduct.variantId)
                .eq('id_price_period', dailyPeriodId)
                .maybeSingle();
              
              if (dailyPriceEntry && dailyPriceEntry.price !== null && dailyPriceEntry.price !== undefined) {
                const dailyPrice = Number(dailyPriceEntry.price);
                const expectedPrice = dailyPrice * rentalDays;
                const priceDifference = Math.abs(totalPrice - dailyPrice);
                const isDailyPriceOnly = priceDifference < 0.01;
                
                if (totalPrice === 0 || totalPrice < 1 || isDailyPriceOnly || totalPrice < expectedPrice * 0.8) {
                  totalPrice = dailyPrice * rentalDays;
                  console.log(`[Checkout] Calcolato prezzo prodotto correlato usando prezzo giornaliero:`, {
                    variantId: relatedProduct.variantId,
                    dailyPrice,
                    rentalDays,
                    totalPrice
                  });
                }
              }
            }
          }

          console.log(`[Checkout] ✅ Prezzo calcolato per prodotto correlato ${relatedProduct.variantId} (${relatedProduct.product?.name}):`, totalPrice);
          prices[relatedProduct.variantId] = totalPrice;
        } catch (error) {
          console.error(`[Checkout] ❌ Errore nel calcolo prezzo per prodotto correlato ${relatedProduct.variantId}:`, error);
          prices[relatedProduct.variantId] = 0;
        }
      }

      console.log('[Checkout] Prezzi prodotti correlati calcolati:', prices);
      setRelatedProductsPrices(prices);
    };

    calculateRelatedPrices();
  }, [relatedProducts, newProductData?.startDate, newProductData?.endDate, newProductData?.startTime, newProductData?.endTime]);

  // Inizializza i form data quando i dati vengono caricati
  useEffect(() => {
    if (cartData?.booking_details) {
      const initialData: { [detailId: string]: DetailFormData } = {};
      cartData.booking_details.forEach((detail) => {
        initialData[detail.id] = {
          deliveryMethod: detail.delivery_method || '',
        };
      });
      setDetailsFormData(initialData);
    }
  }, [cartData]);

  // Reset currentStep quando cambia la quantity
  useEffect(() => {
    if (newProductData) {
      setCurrentStep(0);
      // Reset anche gli errori di validazione quando cambia la quantità
      setValidationErrors({});
      setFormatValidationErrors({});
    }
  }, [newProductData?.quantity]);

  // Carica il profilo dell'utente per pre-compilare i campi
  const { data: userProfile } = useQuery({
    queryKey: ['user_profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading user profile:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  // Pre-compila i campi con i dati del profilo quando il carrello è vuoto
  useEffect(() => {
    // Disattiva la precompilazione se precompilazioneCampi è false o non è true
    // La precompilazione deve essere esplicitamente true per essere attivata
    if (shopSettings?.precompilazioneCampi !== true) {
      console.log('[Checkout] Precompilazione disattivata (precompilazioneCampi non è true):', shopSettings?.precompilazioneCampi);
      return;
    }
    
    // Precompilazione attivata (solo se precompilazioneCampi === true)
    
    // Solo se il carrello è vuoto (nessun booking_detail) e ci sono informazioni con profile_field_link
    const isCartEmpty = !cartData?.booking_details || cartData.booking_details.length === 0;
    
    if (!newProductData || !isCartEmpty || !allInformations || allInformations.length === 0 || !userProfile) {
      return;
    }

    // Usa la funzione helper per ottenere tutte le informazioni unificate (prodotto principale + correlati)
    const informations = getMergedInformations();

    if (informations.length === 0) {
      return;
    }

    // Verifica se i form sono già compilati (per non sovrascrivere dati già inseriti)
    const hasExistingValues = newProductData.quantity > 1
      ? Object.keys(newProductDynamicFormValuesByUnit).some(unitIndex => {
          const unitValues = newProductDynamicFormValuesByUnit[parseInt(unitIndex)];
          return unitValues && Object.keys(unitValues).length > 0;
        })
      : Object.keys(dynamicFormValues).length > 0;

    // Se ci sono già valori, non precompilare
    if (hasExistingValues) {
      return;
    }

    // Pre-compila i campi con i dati del profilo
    const values: { [informationId: string]: any } = {};
    
    informations.forEach((info) => {
      if (info.profile_field_link) {
        // Il campo profile_field_link contiene il nome del campo della tabella profiles
        const profileFieldValue = (userProfile as any)[info.profile_field_link];
        if (profileFieldValue !== null && profileFieldValue !== undefined) {
          values[info.id] = profileFieldValue;
        }
      }
    });

    // Se ci sono valori da pre-compilare, applicali
    if (Object.keys(values).length > 0) {
      if (newProductData.quantity > 1) {
        // Pre-compila per tutte le unità
        const updatedValues: { [unitIndex: number]: { [informationId: string]: any } } = {};
        for (let unitIndex = 0; unitIndex < newProductData.quantity; unitIndex++) {
          updatedValues[unitIndex] = { ...values };
        }
        setNewProductDynamicFormValuesByUnit(updatedValues);
      } else {
        // Pre-compila per la singola unità
        setDynamicFormValues(values);
      }
      
      // Pre-filled form fields with profile data
    }
  }, [newProductData, cartData?.booking_details, allInformations, userProfile, newProductData?.quantity, newProductDynamicFormValuesByUnit, dynamicFormValues, shopSettings?.precompilazioneCampi]);

  // Preseleziona automaticamente le ultime informazioni inserite quando si apre la pagina (solo se il carrello non è vuoto)
  useEffect(() => {
    // Disattiva la precompilazione se precompilazioneCampi è false o non è true
    // La precompilazione deve essere esplicitamente true per essere attivata
    if (shopSettings?.precompilazioneCampi !== true) {
      console.log('[Checkout] Precompilazione dal carrello disattivata (precompilazioneCampi non è true):', shopSettings?.precompilazioneCampi);
      return;
    }
    
    // Precompilazione dal carrello attivata (solo se precompilazioneCampi === true)
    
    // Solo se il carrello NON è vuoto
    const isCartEmpty = !cartData?.booking_details || cartData.booking_details.length === 0;
    
    if (!newProductData || isCartEmpty || !cartData?.booking_details || !allInformations || allInformations.length === 0) {
      return;
    }

    // Usa la funzione helper per ottenere tutte le informazioni unificate (prodotto principale + correlati)
    const informations = getMergedInformations();

    if (informations.length === 0) {
      return;
    }

    // Trova l'ultima prenotazione nel carrello con informazioni
    const detailsWithInformations = cartData.booking_details
      .filter(detail => detail.informations && detail.informations.length > 0)
      .sort((a, b) => {
        // Ordina per ID (converti in stringa per sicurezza)
        const aId = String(a.id);
        const bId = String(b.id);
        return bId.localeCompare(aId);
      });

    if (detailsWithInformations.length === 0) {
      return;
    }

    // Prendi l'ultima prenotazione
    const lastDetail = detailsWithInformations[0];

    // Verifica se i form sono già compilati (per non sovrascrivere dati già inseriti)
    const hasExistingValues = newProductData.quantity > 1
      ? Object.keys(newProductDynamicFormValuesByUnit).some(unitIndex => {
          const unitValues = newProductDynamicFormValuesByUnit[parseInt(unitIndex)];
          return unitValues && Object.keys(unitValues).length > 0;
        })
      : Object.keys(dynamicFormValues).length > 0;

    // Se ci sono già valori, non precompilare
    if (hasExistingValues) {
      return;
    }

    // Converti le informazioni in un oggetto chiave-valore
    const values: { [informationId: string]: any } = {};
    lastDetail.informations?.forEach((info) => {
      let parsedValue: any = info.value;
      try {
        parsedValue = JSON.parse(info.value || '');
      } catch {
        // Se non è JSON, usa il valore direttamente
      }
      values[info.information_id] = parsedValue;
    });

    // Trova il label corrispondente per impostare la selezione nella tendina
    // Cerca nome e cognome - prima cerca match esatto, poi cerca campi che iniziano con il nome
    const findValue = (fieldName: string): string | null => {
      const fieldNameLower = fieldName.toLowerCase();
      // Prima cerca match esatto
      let info = lastDetail.informations?.find(i => {
        const name = i.information?.name?.toLowerCase() || '';
        return name === fieldNameLower;
      });
      // Se non trova match esatto, cerca campi che iniziano con il nome seguito da underscore o trattino
      if (!info) {
        info = lastDetail.informations?.find(i => {
          const name = i.information?.name?.toLowerCase() || '';
          return name.startsWith(fieldNameLower + '_') || name.startsWith(fieldNameLower + '-');
        });
      }
      if (!info || !info.value) return null;
      
      try {
        const parsed = JSON.parse(info.value);
        if (Array.isArray(parsed)) return parsed.join(', ');
        if (typeof parsed === 'object') return JSON.stringify(parsed);
        const value = String(parsed).trim();
        // Rimuovi duplicati se il valore contiene lo stesso testo ripetuto
        if (value.length > 0 && value.length % 2 === 0) {
          const half = value.length / 2;
          if (value.substring(0, half) === value.substring(half)) {
            return value.substring(0, half);
          }
        }
        return value;
      } catch {
        const value = info.value.trim();
        // Rimuovi duplicati se il valore contiene lo stesso testo ripetuto
        if (value.length > 0 && value.length % 2 === 0) {
          const half = value.length / 2;
          if (value.substring(0, half) === value.substring(half)) {
            return value.substring(0, half);
          }
        }
        return value;
      }
    };

    const nome = findValue('nome')?.trim() || null;
    const cognome = findValue('cognome')?.trim() || null;
    const label = nome && cognome ? `${nome} ${cognome}` : nome || cognome || `Prenotazione ${lastDetail.id.substring(0, 8)}`;

    // Precompila i form per tutte le unità se quantity > 1, altrimenti solo il form singolo
    if (newProductData.quantity > 1) {
      const updatedValues: { [unitIndex: number]: { [informationId: string]: any } } = {};
      const updatedSelections: { [unitIndex: number]: string } = {};
      for (let i = 0; i < newProductData.quantity; i++) {
        updatedValues[i] = { ...values };
        updatedSelections[i] = label;
      }
      setNewProductDynamicFormValuesByUnit(updatedValues);
      setSelectedCartInformation(updatedSelections);
    } else {
      setDynamicFormValues(values);
      setSelectedCartInformation({ 0: label });
    }
  }, [newProductData, cartData, allInformations, shopSettings?.precompilazioneCampi]);

  // Initialize delivery method based on product availability
  useEffect(() => {
    if (product && !urlProductId) {
      // Only initialize if we're using the product from id, not from URL params
      if (product.pickup_on_site && product.delivery) {
        // Both available, default to pickup
        setSelectedDeliveryMethod('pickup');
      } else if (product.pickup_on_site) {
        setSelectedDeliveryMethod('pickup');
      } else if (product.delivery) {
        setSelectedDeliveryMethod('delivery');
      } else {
        setSelectedDeliveryMethod('pickup'); // Fallback
      }
    }
  }, [product, urlProductId]);

  // Auto-set delivery method for newProductData when only one option is available
  useEffect(() => {
    if (!newProductData) return;
    
    // Usa i campi nuovi se disponibili, altrimenti fallback ai campi legacy
    const productCanPickup = newProductData.product.can_be_picked_up ?? newProductData.product.pickup_on_site ?? true;
    const productCanDelivery = newProductData.product.can_be_delivered ?? newProductData.product.delivery ?? false;
    // Usa valori di default se shopSettings non è ancora caricato
    const ritiroInNegozio = shopSettings?.ritiroInNegozio ?? true;
    const consegna = shopSettings?.consegna ?? true;
    const canPickup = ritiroInNegozio && productCanPickup;
    const canDelivery = consegna && productCanDelivery;
    const showSelection = canPickup && canDelivery;
    
    // Se solo una modalità è disponibile, impostala automaticamente per tutte le unità
    if (!showSelection) {
      const autoMethod = canPickup && !canDelivery ? 'pickup' : 
                        canDelivery && !canPickup ? 'delivery' : null;
      
      if (autoMethod) {
        // Imposta per tutte le unità
        setNewProductFormDataByUnit(prev => {
          const updated = { ...prev };
          let hasChanges = false;
          
          for (let i = 0; i < newProductData.quantity; i++) {
            const currentData = updated[i] || { deliveryMethod: '' };
            if (!currentData.deliveryMethod) {
              updated[i] = { ...currentData, deliveryMethod: autoMethod };
              hasChanges = true;
            }
          }
          
          // Se quantity === 1, aggiorna anche newProductData.formData
          if (newProductData.quantity === 1 && !newProductData.formData.deliveryMethod) {
            setNewProductData(prev => prev ? {
              ...prev,
              formData: { ...prev.formData, deliveryMethod: autoMethod }
            } : null);
          }
          
          return hasChanges ? updated : prev;
        });
      }
    }
  }, [newProductData, shopSettings]);

  // Update mutation for cart items
  const updateDetailMutation = useMutation({
    mutationFn: async ({ detailId, formData }: { detailId: string; formData: DetailFormData }) => {
      const updateData: any = {
        delivery_method: formData.deliveryMethod,
      };

      const { error } = await supabase
        .from("booking_details")
        .update(updateData)
        .eq("id", detailId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const handleUpdateDetail = (detailId: string, formData: DetailFormData) => {
    setDetailsFormData(prev => ({ ...prev, [detailId]: formData }));
    updateDetailMutation.mutate({ detailId, formData });
  };

  // Funzione helper per unire i campi richiesti del prodotto principale e dei prodotti correlati
  const getMergedInformations = (): Information[] => {
    if (!allInformations || allInformations.length === 0) {
      console.log('[getMergedInformations] Nessuna informazione disponibile');
      return [];
    }

    // Raccogli tutte le sottocategorie: prodotto principale + prodotti correlati
    const subcategoryIds = new Set<string>();
    
    // Aggiungi sottocategoria del prodotto principale
    if (newProductData?.product?.id_product_subcategory) {
      const mainSubcategoryId = String(newProductData.product.id_product_subcategory);
      subcategoryIds.add(mainSubcategoryId);
      console.log('[getMergedInformations] Aggiunta sottocategoria prodotto principale:', mainSubcategoryId);
    }
    
    // Aggiungi sottocategorie dei prodotti correlati
    console.log('[getMergedInformations] Prodotti correlati da processare:', relatedProducts.length);
    relatedProducts.forEach((relatedProduct, index) => {
      const subcategoryId = relatedProduct.product?.id_product_subcategory;
      console.log(`[getMergedInformations] Prodotto correlato ${index + 1}:`, {
        productId: relatedProduct.product?.id,
        productName: relatedProduct.product?.name,
        subcategoryId: subcategoryId,
        hasSubcategory: !!subcategoryId
      });
      if (subcategoryId) {
        subcategoryIds.add(String(subcategoryId));
        console.log(`[getMergedInformations] Aggiunta sottocategoria prodotto correlato ${index + 1}:`, String(subcategoryId));
      }
    });

    console.log('[getMergedInformations] Sottocategorie totali trovate:', Array.from(subcategoryIds));
    
    if (subcategoryIds.size === 0) {
      console.log('[getMergedInformations] Nessuna sottocategoria trovata');
      return [];
    }

    // Filtra le informazioni per tutte le sottocategorie e rimuovi duplicati
    const informationsMap = new Map<string, Information>();
    
    subcategoryIds.forEach(subcategoryId => {
      const filtered = filterInformationsBySubcategory(allInformations, subcategoryId);
      console.log(`[getMergedInformations] Informazioni per sottocategoria ${subcategoryId}:`, filtered.length);
      filtered.forEach(info => {
        // Usa l'ID come chiave per evitare duplicati
        if (!informationsMap.has(info.id)) {
          informationsMap.set(info.id, info);
        }
      });
    });

    const result = Array.from(informationsMap.values()).sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });

    console.log('[getMergedInformations] Informazioni unificate totali:', result.length);
    console.log('[getMergedInformations] Nomi informazioni:', result.map(i => i.name));
    
    return result;
  };

  // Funzione per validare i campi obbligatori
  const validateRequiredFields = (): { isValid: boolean; errors: { [unitIndex: number]: { [informationId: string]: string } } } => {
    const errors: { [unitIndex: number]: { [informationId: string]: string } } = {};
    const quantity = newProductData?.quantity || 1;

    // Usa la funzione helper per ottenere tutte le informazioni unificate
    const informations = getMergedInformations();

    if (informations.length === 0) {
      return { isValid: true, errors: {} };
    }

    // Filtra solo i campi obbligatori (required deve essere true)
    // Usa un controllo robusto che gestisce sia booleani che conversioni
    const requiredInformations = informations.filter(info => {
      // Converti a booleano in modo esplicito per gestire tutti i casi
      if (typeof info.required === 'boolean') {
        return info.required === true;
      } else if (typeof info.required === 'string') {
        return info.required.toLowerCase() === 'true';
      }
      // Se è null/undefined o altro, considera come false (non obbligatorio)
      return false;
    });

    if (requiredInformations.length === 0) {
      return { isValid: true, errors: {} };
    }

    let hasErrors = false;

    // Valida per ogni unità
    for (let unitIndex = 0; unitIndex < quantity; unitIndex++) {
      const unitErrors: { [informationId: string]: string } = {};
      
      // Ottieni i valori del form per questa unità
      const unitDynamicFormValues = quantity > 1
        ? (newProductDynamicFormValuesByUnit[unitIndex] || {})
        : dynamicFormValues;

      // Valida ogni campo obbligatorio
      for (const info of requiredInformations) {
        const value = unitDynamicFormValues[info.id];
        let isEmpty = false;

        // Controlla se il valore è vuoto in base al tipo
        if (value === null || value === undefined) {
          isEmpty = true;
        } else if (typeof value === 'string' && value.trim() === '') {
          isEmpty = true;
        } else if (Array.isArray(value) && value.length === 0) {
          isEmpty = true;
        } else if (typeof value === 'object' && Object.keys(value).length === 0) {
          isEmpty = true;
        }

        if (isEmpty) {
          unitErrors[info.id] = `Il campo "${info.name}" è obbligatorio`;
          hasErrors = true;
        }
      }

      if (Object.keys(unitErrors).length > 0) {
        errors[unitIndex] = unitErrors;
      }
    }

    return { isValid: !hasErrors, errors };
  };

  // Funzione per aggiungere il nuovo prodotto al carrello
  const handleAddToCart = async () => {
    if (!user?.id || !newProductData) return;

    // Usa la funzione helper per ottenere tutte le informazioni unificate (prodotto principale + correlati)
    const informations = getMergedInformations();

    // VALIDAZIONE: Verifica che tutti i campi obbligatori siano compilati
    if (informations && informations.length > 0) {
      const validation = validateRequiredFields();
      setValidationErrors(validation.errors);

      if (!validation.isValid) {
        // Trova i nomi dei campi mancanti per mostrare un messaggio più dettagliato
        const missingFields: string[] = [];
        Object.values(validation.errors).forEach(unitErrors => {
          Object.entries(unitErrors).forEach(([infoId, errorMsg]) => {
            const info = informations.find(i => i.id === infoId);
            if (info && !missingFields.includes(info.name)) {
              missingFields.push(info.name);
            }
          });
        });

        toast({
          title: "Attenzione",
          description: missingFields.length > 0
            ? `Compila i seguenti campi obbligatori: ${missingFields.join(', ')}`
            : "Compila tutti i campi obbligatori prima di procedere.",
          variant: "destructive",
        });
        setIsAddingToCart(false);
        return;
      }
    }

    // Verifica le modalità disponibili
    // Usa i campi nuovi se disponibili, altrimenti fallback ai campi legacy
    const productCanPickup = newProductData.product.can_be_picked_up ?? newProductData.product.pickup_on_site ?? true;
    const productCanDelivery = newProductData.product.can_be_delivered ?? newProductData.product.delivery ?? false;
    // Usa valori di default se shopSettings non è ancora caricato
    const ritiroInNegozio = shopSettings?.ritiroInNegozio ?? true;
    const consegna = shopSettings?.consegna ?? true;
    const canPickup = ritiroInNegozio && productCanPickup;
    const canDelivery = consegna && productCanDelivery;
    const showSelection = canPickup && canDelivery;
    
    // Se solo una modalità è disponibile, impostala automaticamente se non è già impostata
    let finalDeliveryMethod = newProductData.formData.deliveryMethod;
    if (!showSelection) {
      if (canPickup && !canDelivery) {
        finalDeliveryMethod = 'pickup';
      } else if (canDelivery && !canPickup) {
        finalDeliveryMethod = 'delivery';
      }
    }
    
    // Validazione - verifica che la modalità sia selezionata (solo se entrambe disponibili)
    if (showSelection && !finalDeliveryMethod) {
      toast({
        title: "Attenzione",
        description: "Seleziona la modalità di ritiro.",
        variant: "destructive",
      });
      setIsAddingToCart(false);
      return;
    }
    
    if (!finalDeliveryMethod) {
      toast({
        title: "Errore",
        description: "Nessuna modalità di ritiro disponibile.",
        variant: "destructive",
      });
      setIsAddingToCart(false);
      return;
    }

    setIsAddingToCart(true);

    try {
      const startDate = newProductData.startDate;
      const endDate = newProductData.endDate;
      const isSameDayBooking = isSameDay(startDate, endDate);
      const rentalDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
      const rentalHours = newProductData.startTime && newProductData.endTime && isSameDayBooking
        ? Math.max(1, parseInt(newProductData.endTime.split(":")[0]) - parseInt(newProductData.startTime.split(":")[0]))
        : 0;

      // Calculate pricing using new price list system
      let totalPrice = await calculateRentalPrice(
        newProductData.variantId,
        rentalDays,
        rentalHours,
        isSameDayBooking
      );

      // Se non è un noleggio orario, verifica se il prezzo va moltiplicato per i giorni
      if (!(rentalHours > 0 && isSameDayBooking) && rentalDays > 1) {
        const dailyPeriodId = await findPricePeriodId(1);
        
        if (dailyPeriodId) {
          const { data: dailyPriceEntry } = await supabase
            .from('product_variant_price_list')
            .select('price')
            .eq('id_product_variant', newProductData.variantId)
            .eq('id_price_period', dailyPeriodId)
            .maybeSingle();
          
          if (dailyPriceEntry && dailyPriceEntry.price !== null && dailyPriceEntry.price !== undefined) {
            const dailyPrice = Number(dailyPriceEntry.price);
            const expectedPrice = dailyPrice * rentalDays;
            const priceDifference = Math.abs(totalPrice - dailyPrice);
            const isDailyPriceOnly = priceDifference < 0.01;
            
            if (totalPrice === 0 || totalPrice < 1 || isDailyPriceOnly || totalPrice < expectedPrice * 0.8) {
              totalPrice = dailyPrice * rentalDays;
              console.log('[Checkout] Calcolato prezzo usando prezzo giornaliero (add to cart):', {
                dailyPrice,
                rentalDays,
                totalPrice
              });
            }
          }
        }
      }

      // Check availability and get available units (for quantity)
      const quantity = newProductData.quantity || 1;
      const { data: allUnits, error: allUnitsError } = await supabase
        .from('product_units')
        .select('id')
        .eq('id_product_variant', newProductData.variantId);

      if (allUnitsError) throw new Error(`Errore nel recupero delle unità: ${allUnitsError.message}`);
      if (!allUnits || allUnits.length === 0) {
        throw new Error('Prodotto non disponibile. Nessuna unità disponibile per questo prodotto.');
      }

      const unitIds = allUnits.map((u: any) => u.id);
      const startDateStr = toItalianISOString(startDate);
      const endDateStr = toItalianISOString(endDate);
      
      // Use secure RPC function instead of direct query to avoid exposing sensitive data
      const { data: availabilityData, error: availabilityError } = await supabase
        .rpc('check_unit_availability', {
          p_unit_ids: unitIds,
          p_start_date: startDateStr,
          p_end_date: endDateStr
        });
      
      if (availabilityError) throw new Error(`Errore nel controllo disponibilità: ${availabilityError.message}`);
      
      // Get booked unit IDs (units that are not available)
      // Note: The RPC function only checks confirmed bookings (cart = false),
      // so cart bookings are not considered as blocking availability
      let bookedUnitIds = new Set<string>();
      if (availabilityData && availabilityData.length > 0) {
        availabilityData.forEach((item: any) => {
          if (!item.is_available) {
            bookedUnitIds.add(item.unit_id);
          }
        });
      }
      
      // Find available units (for quantity)
      const availableUnits = allUnits.filter((u: any) => !bookedUnitIds.has(u.id));
      if (availableUnits.length < quantity) {
        throw new Error(`Non ci sono abbastanza unità disponibili. Richieste: ${quantity}, Disponibili: ${availableUnits.length}`);
      }
      
      // Select the first N available units
      const selectedUnits = availableUnits.slice(0, quantity);

      // Determina l'utente per cui creare la prenotazione (cliente selezionato se admin, altrimenti utente corrente)
      const userId = isAdmin && selectedCustomer ? selectedCustomer.id : user.id;

      // Get or create cart booking
      const { data: existingCartBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('user_id', userId)
        .eq('cart', true)
        .maybeSingle();

      let bookingId: string;
      if (existingCartBooking) {
        bookingId = existingCartBooking.id;
      } else {
        // Assicurati che finalDeliveryMethod sia sempre impostato
        if (!finalDeliveryMethod) {
          // Se non è stato impostato, usa un default basato sulle impostazioni
          if (canPickup && !canDelivery) {
            finalDeliveryMethod = 'pickup';
          } else if (canDelivery && !canPickup) {
            finalDeliveryMethod = 'delivery';
          } else {
            // Fallback: usa pickup come default
            finalDeliveryMethod = 'pickup';
          }
        }
        
        const bookingData: CreateBookingData = {
          user_id: userId,
          // product_id, start_date, end_date removed - not used in bookings table, go in booking_details
          price_total: totalPrice,
          delivery_method: finalDeliveryMethod as 'pickup' | 'delivery',
          delivery_address: null,
          status: 'cart',
          cart: true,
          price_daily: null,
          price_weekly: null,
          price_hour: null,
          price_month: null,
          deposito: null,
        };
        
        const result = await BookingService.createBooking(bookingData);
        if (result.error) throw new Error(result.error);
        if (!result.data) throw new Error('Errore: prenotazione non creata');
        bookingId = result.data.id;
      }

      // Create booking_details for each unit (quantity) with specific form data
      const bookingDetailsToInsert = selectedUnits.map((unit: any, index: number) => {
        // Determina il delivery_method per questa unità
        let unitDeliveryMethod = finalDeliveryMethod;
        if (quantity > 1) {
          const unitFormData = newProductFormDataByUnit[index] || { deliveryMethod: '' };
          // Usa i campi nuovi se disponibili, altrimenti fallback ai campi legacy
          const productCanPickup = newProductData.product.can_be_picked_up ?? newProductData.product.pickup_on_site ?? true;
          const productCanDelivery = newProductData.product.can_be_delivered ?? newProductData.product.delivery ?? false;
          // Usa valori di default se shopSettings non è ancora caricato
          const ritiroInNegozio = shopSettings?.ritiroInNegozio ?? true;
          const consegna = shopSettings?.consegna ?? true;
          const canPickup = ritiroInNegozio && productCanPickup;
          const canDelivery = consegna && productCanDelivery;
          const showSelection = canPickup && canDelivery;
          
          if (unitFormData.deliveryMethod) {
            unitDeliveryMethod = unitFormData.deliveryMethod as 'pickup' | 'delivery';
          } else if (!showSelection) {
            // Se solo una modalità è disponibile, usa quella
            if (canPickup && !canDelivery) {
              unitDeliveryMethod = 'pickup';
            } else if (canDelivery && !canPickup) {
              unitDeliveryMethod = 'delivery';
            }
          }
        }
        
        return {
          booking_id: bookingId,
          user_id: userId,
          unit_id: unit.id,
          start_date: startDateStr,
          end_date: endDateStr,
          delivery_method: unitDeliveryMethod,
          price: totalPrice / quantity, // Price per unit
          price_daily: newProductData.variant.price_daily,
          price_weekly: newProductData.variant.price_weekly,
          price_hour: newProductData.variant.price_hour,
          price_month: newProductData.variant.price_monthly,
          deposito: newProductData.variant.deposit,
          status: 'idle',
        };
      });

      // Prepara booking_details per prodotti correlati
      const relatedProductsBookingDetails: any[] = [];
      let totalPriceWithRelated = totalPrice;

      console.log('[Checkout] Inizio aggiunta prodotti correlati al carrello:', {
        relatedProductsCount: relatedProducts.length,
        relatedProducts: relatedProducts.map(rp => ({
          variantId: rp.variantId,
          productName: rp.product?.name
        })),
        urlRelatedVariantIds,
        urlVariantId
      });

      // Carica unità e calcola prezzi per ogni prodotto correlato
      if (relatedProducts.length === 0) {
        console.warn('[Checkout] ⚠️ ATTENZIONE: Nessun prodotto correlato da aggiungere!', {
          urlRelatedVariantIds,
          urlVariantId,
          relatedProductsState: relatedProducts
        });
      }
      
      for (const relatedProduct of relatedProducts) {
        console.log('[Checkout] Processando prodotto correlato:', {
          variantId: relatedProduct.variantId,
          productName: relatedProduct.product?.name
        });
        // Carica unità disponibili per il prodotto correlato
        const { data: relatedUnits, error: relatedUnitsError } = await supabase
          .from('product_units')
          .select('id')
          .eq('id_product_variant', relatedProduct.variantId)
          .eq('id_product_status', '2a5f05a8-6dbe-4246-ac06-ffe869efab8b') // Solo unità noleggiabili
          .limit(1); // Solo 1 unità per prodotto correlato

        if (relatedUnitsError) {
          console.error('[Checkout] ❌ Errore nel recupero unità prodotto correlato:', {
            variantId: relatedProduct.variantId,
            productName: relatedProduct.product?.name,
            error: relatedUnitsError
          });
          continue;
        }

        if (!relatedUnits || relatedUnits.length === 0) {
          console.error('[Checkout] ❌ Nessuna unità noleggiabile disponibile per prodotto correlato:', {
            variantId: relatedProduct.variantId,
            productName: relatedProduct.product?.name
          });
          continue;
        }

        console.log('[Checkout] ✅ Unità trovata per prodotto correlato:', {
          variantId: relatedProduct.variantId,
          productName: relatedProduct.product?.name,
          unitId: relatedUnits[0].id
        });

        // Verifica disponibilità per il prodotto correlato
        // NOTA: La disponibilità è già stata verificata nella RentalQuoteCard prima di mostrare il popup
        // Quindi qui possiamo essere più permissivi e aggiungere comunque il prodotto
        const { data: relatedAvailabilityData, error: relatedAvailabilityError } = await supabase
          .rpc('check_unit_availability', {
            p_unit_ids: relatedUnits.map((u: any) => u.id),
            p_start_date: startDateStr,
            p_end_date: endDateStr
          });

        if (relatedAvailabilityError) {
          console.warn('[Checkout] ⚠️ Errore nel controllo disponibilità prodotto correlato (continua comunque):', {
            variantId: relatedProduct.variantId,
            productName: relatedProduct.product?.name,
            error: relatedAvailabilityError
          });
          // Non facciamo continue, aggiungiamo comunque il prodotto
        } else {
          // Verifica se l'unità è disponibile
          const isAvailable = relatedAvailabilityData?.find((a: any) => 
            a.unit_id === relatedUnits[0].id && a.is_available === true
          );

          if (!isAvailable) {
            console.warn('[Checkout] ⚠️ Unità prodotto correlato potrebbe non essere disponibile (continua comunque):', {
              variantId: relatedProduct.variantId,
              productName: relatedProduct.product?.name,
              unitId: relatedUnits[0].id,
              availabilityData: relatedAvailabilityData
            });
            // Non facciamo continue, aggiungiamo comunque il prodotto
            // La disponibilità è già stata verificata nella RentalQuoteCard
          } else {
            console.log('[Checkout] ✅ Unità prodotto correlato disponibile:', {
              variantId: relatedProduct.variantId,
              productName: relatedProduct.product?.name,
              unitId: relatedUnits[0].id
            });
          }
        }

        // Calcola prezzo per il prodotto correlato usando calculateRentalPrice
        let relatedPrice = 0;
        try {
          relatedPrice = await calculateRentalPrice(
            relatedProduct.variantId,
            rentalDays,
            rentalHours,
            isSameDayBooking
          );
          
          // Se il prezzo è 0 o molto basso, verifica se va moltiplicato per i giorni
          if (relatedPrice === 0 || (relatedPrice < 1 && rentalDays > 1)) {
            const dailyPeriodId = await findPricePeriodId(1);
            
            if (dailyPeriodId) {
              const { data: dailyPriceEntry } = await supabase
                .from('product_variant_price_list')
                .select('price')
                .eq('id_product_variant', relatedProduct.variantId)
                .eq('id_price_period', dailyPeriodId)
                .maybeSingle();
              
              if (dailyPriceEntry && dailyPriceEntry.price !== null && dailyPriceEntry.price !== undefined) {
                const dailyPrice = Number(dailyPriceEntry.price);
                const expectedPrice = dailyPrice * rentalDays;
                const priceDifference = Math.abs(relatedPrice - dailyPrice);
                const isDailyPriceOnly = priceDifference < 0.01;
                
                if (relatedPrice === 0 || relatedPrice < 1 || isDailyPriceOnly || relatedPrice < expectedPrice * 0.8) {
                  relatedPrice = dailyPrice * rentalDays;
                  console.log('[Checkout] Calcolato prezzo prodotto correlato usando prezzo giornaliero:', {
                    variantId: relatedProduct.variantId,
                    dailyPrice,
                    rentalDays,
                    relatedPrice
                  });
                }
              }
            }
          }
          
          console.log('[Checkout] Prezzo prodotto correlato calcolato:', {
            variantId: relatedProduct.variantId,
            productName: relatedProduct.product?.name,
            price: relatedPrice
          });
        } catch (priceError) {
          console.error('[Checkout] Errore nel calcolo prezzo prodotto correlato:', priceError);
          relatedPrice = 0;
        }

        totalPriceWithRelated += relatedPrice;

        // Aggiungi booking_detail per il prodotto correlato
        // I prezzi non sono più nella tabella product_variants, sono in product_variant_price_list
        relatedProductsBookingDetails.push({
          booking_id: bookingId,
          user_id: userId,
          unit_id: relatedUnits[0].id,
          start_date: startDateStr,
          end_date: endDateStr,
          delivery_method: finalDeliveryMethod,
          price: relatedPrice, // Prezzo calcolato usando calculateRentalPrice
          price_daily: null, // Non più disponibile in product_variants
          price_weekly: null, // Non più disponibile in product_variants
          price_hour: null, // Non più disponibile in product_variants
          price_month: null, // Non più disponibile in product_variants
          deposito: relatedProduct.variant.deposit,
          status: 'idle',
        });
        
        console.log('[Checkout] ✅ Booking detail prodotto correlato preparato:', {
          variantId: relatedProduct.variantId,
          productName: relatedProduct.product?.name,
          unitId: relatedUnits[0].id,
          price: relatedPrice
        });
      }

      console.log('[Checkout] Riepilogo prodotti correlati da aggiungere:', {
        totalRelatedProducts: relatedProducts.length,
        bookingDetailsPreparati: relatedProductsBookingDetails.length,
        bookingDetails: relatedProductsBookingDetails.map(bd => ({
          unitId: bd.unit_id,
          price: bd.price
        }))
      });

      // Combina booking_details del prodotto principale con quelli dei prodotti correlati
      const allBookingDetailsToInsert = [...bookingDetailsToInsert, ...relatedProductsBookingDetails];

      // Aggiorna il prezzo totale del booking se ci sono prodotti correlati
      if (relatedProducts.length > 0 && totalPriceWithRelated !== totalPrice) {
        await supabase
          .from('bookings')
          .update({ price_total: totalPriceWithRelated })
          .eq('id', bookingId);
      }

      // Insert all booking_details (prodotto principale + correlati)
      const { data: createdBookingDetails, error: bookingDetailsError } = await supabase
        .from('booking_details')
        .insert(allBookingDetailsToInsert)
        .select('id');

      if (bookingDetailsError) throw new Error(`Errore nella creazione dei dettagli: ${bookingDetailsError.message}`);
      
      if (!createdBookingDetails || createdBookingDetails.length === 0) {
        throw new Error('Errore: booking_details non creati');
      }

      console.log('[Checkout] Booking details creati:', {
        total: createdBookingDetails.length,
        mainProduct: bookingDetailsToInsert.length,
        relatedProducts: relatedProductsBookingDetails.length
      });

      // Salva i valori del form dinamico per TUTTI i booking_details (stesse informazioni per tutti)
      // Usa i valori del form principale (non per unità) per tutti i booking_details
      const formValuesToUse = dynamicFormValues; // Usa sempre i valori del form principale
      
      for (let index = 0; index < createdBookingDetails.length; index++) {
        const bookingDetailsId = createdBookingDetails[index].id;
        // Per i prodotti correlati, usa sempre i valori del form principale
        // Per il prodotto principale, usa i valori per unità se quantity > 1, altrimenti form principale
        const isMainProduct = index < bookingDetailsToInsert.length;
        const unitDynamicFormValues = isMainProduct && quantity > 1
          ? (newProductDynamicFormValuesByUnit[index] || dynamicFormValues)
          : formValuesToUse;

        if (Object.keys(unitDynamicFormValues).length > 0) {
          const informationsToSave = Object.entries(unitDynamicFormValues)
            .filter(([_, value]) => {
              // Filtra solo i valori non vuoti
              if (value === null || value === undefined) return false;
              if (typeof value === 'string' && value.trim() === '') return false;
              if (Array.isArray(value) && value.length === 0) return false;
              return true;
            })
            .map(([informationId, value]) => {
              // Converti il valore in stringa se necessario
              let valueString: string | null = null;
              if (value !== null && value !== undefined) {
                if (Array.isArray(value)) {
                  valueString = JSON.stringify(value);
                } else if (typeof value === 'object') {
                  valueString = JSON.stringify(value);
                } else {
                  valueString = String(value);
                }
              }
              
              return {
                booking_details_id: bookingDetailsId,
                information_id: parseInt(informationId, 10), // Converti a numero per il bigint
                value: valueString
              };
            });

          if (informationsToSave.length > 0) {
            // Saving dynamic form values for unit
            const { error: informationsError } = await supabase
              .from('booking_details_informations')
              .insert(informationsToSave);

            if (informationsError) {
              console.error('Error saving dynamic form values:', informationsError);
              throw new Error(`Errore nel salvataggio delle informazioni aggiuntive: ${informationsError.message}`);
            }
            
            // Dynamic form values saved successfully
          }
        }
      }

      // Update booking price_total
      const { data: allDetails } = await supabase
        .from('booking_details')
        .select('price')
        .eq('booking_id', bookingId);

      if (allDetails) {
        const totalPriceSum = allDetails.reduce((sum: number, detail: any) => sum + (Number(detail.price) || 0), 0);
        await supabase
          .from('bookings')
          .update({ price_total: totalPriceSum })
          .eq('id', bookingId);
      }

      // Invalidate and refetch queries, wait for completion before navigating
      await queryClient.refetchQueries({ queryKey: ["cart"] });
      await queryClient.refetchQueries({ queryKey: ["cartCount"] });
      
      // Clear new product data and form values
      setNewProductData(null);
      setDynamicFormValues({});
      setNewProductFormDataByUnit({});
      setNewProductDynamicFormValuesByUnit({});
      
      toast({
        title: "Prodotto aggiunto!",
        description: "Il prodotto è stato aggiunto al carrello.",
      });

      // Navigate to cart after queries have been refetched
      navigate('/cart');
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : 'Errore sconosciuto',
        variant: "destructive",
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleContinue = () => {
    // Verifica che tutti i dettagli abbiano una modalità di ritiro selezionata
    if (!cartData?.booking_details) return;

    const allDetailsHaveMethod = cartData.booking_details.every(detail => {
      const formData = detailsFormData[detail.id];
      return formData?.deliveryMethod;
    });

    if (!allDetailsHaveMethod) {
      toast({
        title: "Attenzione",
        description: "Seleziona la modalità di ritiro per tutti i prodotti.",
        variant: "destructive",
      });
      return;
    }

    // Verifica che per i pickup siano selezionate le fasce orarie
    const pickupDetailsNeedTimeSlots = cartData.booking_details.filter(detail => {
      const formData = detailsFormData[detail.id];
      return formData?.deliveryMethod === 'pickup';
    });

    const allPickupDetailsHaveTimeSlots = pickupDetailsNeedTimeSlots.every(detail => {
      const formData = detailsFormData[detail.id];
      const startDate = new Date(detail.start_date);
      const endDate = new Date(detail.end_date);
      const isSameDay = startDate.toDateString() === endDate.toDateString();
      
      // Se è stesso giorno, non serve fascia oraria
      return true;
    });


    // Naviga al carrello per la conferma finale
    navigate('/cart');
  };

  // Calculate rental details
  const rentalDays = startDate && endDate ? differenceInCalendarDays(endDate, startDate) + 1 : 0;
  const isSameDayBooking = startDate && endDate && isSameDay(startDate, endDate);
  
  const rentalHours = (() => {
    if (startDate && endDate && startTime && endTime && isSameDayBooking) {
      const startHour = parseInt(startTime.split(":")[0]);
      const endHour = parseInt(endTime.split(":")[0]);
      return Math.max(1, endHour - startHour);
    }
    return 0;
  })();

  const pricingBreakdown = (() => {
    const dailyPrice = Number(product?.price_daily) || 0;
    const weeklyPrice = product?.price_weekly ? Number(product.price_weekly) : null;
    const monthlyPrice = product?.price_month ? Number(product.price_month) : null;
    const hourlyPrice = Number(product?.price_hour) || 0;
    
    let totalPrice = 0;
    let appliedDiscount = null;
    let discountAmount = 0;
    let originalPrice = 0;

    if (rentalHours > 0 && isSameDayBooking) {
      totalPrice = hourlyPrice * rentalHours;
      originalPrice = totalPrice;
    } else {
      totalPrice = dailyPrice * rentalDays;
      originalPrice = dailyPrice * rentalDays;

      // Apply monthly discount first (priority)
      if (monthlyPrice && rentalDays >= 30) {
        const months = Math.floor(rentalDays / 30);
        const remainingDays = rentalDays % 30;
        const monthlyTotal = (months * monthlyPrice) + (remainingDays * dailyPrice);
        
        if (monthlyTotal < totalPrice) {
          discountAmount = totalPrice - monthlyTotal;
          totalPrice = monthlyTotal;
          appliedDiscount = 'monthly';
        }
      }
      // Apply weekly discount if monthly not applied
      else if (weeklyPrice && rentalDays >= 7) {
        const weeks = Math.floor(rentalDays / 7);
        const remainingDays = rentalDays % 7;
        const weeklyTotal = (weeks * weeklyPrice) + (remainingDays * dailyPrice);
        
        if (weeklyTotal < totalPrice) {
          discountAmount = totalPrice - weeklyTotal;
          totalPrice = weeklyTotal;
          appliedDiscount = 'weekly';
        }
      }
    }
    return { dailyPrice, hourlyPrice, totalPrice, appliedDiscount, discountAmount, originalPrice, rentalHours };
  })();

  // Function to get delivery text
  const getDeliveryText = () => {
    if (!product) return 'Non specificato';
    
    if (selectedDeliveryMethod === 'pickup') {
      return 'Ritiro in sede';
    } else if (selectedDeliveryMethod === 'delivery') {
      return 'Consegna a domicilio';
    }
    
    return 'Non specificato';
  };

  const handleConfirmBooking = async () => {
    // Check if user is logged in
    if (!user) {
      setAuthDialogOpen(true);
      return;
    }
    
    // Check if we have all required data
    if (!startDate || !endDate || !product) {
      alert('Dati mancanti per la prenotazione');
      return;
    }

    // Check if delivery method is selected
    if (!selectedDeliveryMethod) {
      alert('Seleziona una modalità di ritiro');
      return;
    }


    // Check if admin has selected a customer
    if (isAdmin && !selectedCustomer) {
      alert('Seleziona un cliente per la prenotazione');
      return;
    }
    
    setIsCreatingBooking(true);
    
    try {
      // Verify availability before creating booking
      // Get product variants to calculate total stock
      const { data: productDataForAvailability, error: productError } = await supabase
        .from('products')
        .select(`
          id,
          has_variants,
          product_variants(
            id,
            is_active
          )
        `)
        .eq('id', product.id)
        .single();

      if (productError) {
        throw new Error(`Errore nel recupero del prodotto: ${productError.message}`);
      }
      
      // Stock is now calculated from actual product_units, not qty_stock
      // We'll check availability by counting actual product_units below
      
      // Check booked units in the selected date range
      // unit_id in booking_details refers to product_units, not products
      // We need to get all product_units for this product and check their bookings
      const startDateStr = toItalianISOString(startDate);
      const endDateStr = toItalianISOString(endDate);
      
      // Step 1: Get all variants for this product
      let variantIds: string[] = [];
      if (productDataForAvailability.has_variants === true && productDataForAvailability.product_variants) {
        variantIds = productDataForAvailability.product_variants
          .filter((v: any) => v.is_active === true)
          .map((v: any) => v.id);
      } else {
        // If no variants, try to get any variant for this product
        const { data: fallbackVariants, error: fallbackError } = await supabase
          .from('product_variants')
          .select('id')
          .eq('id_product', product.id)
          .limit(1);
        
        if (!fallbackError && fallbackVariants && fallbackVariants.length > 0) {
          variantIds = fallbackVariants.map((v: any) => v.id);
        }
      }
      
      if (variantIds.length === 0) {
        throw new Error('Prodotto senza varianti valide. Impossibile verificare la disponibilità.');
      }
      
      // Step 2: Get all product_units for these variants - ONLY those with "Noleggiabile" status
      // ID dello stato "Noleggiabile"
      const rentableStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b';
      
      const { data: productUnits, error: productUnitsError } = await supabase
        .from('product_units')
        .select('id')
        .in('id_product_variant', variantIds)
        .eq('id_product_status', rentableStatusId);
      
      if (productUnitsError) {
        throw new Error(`Errore nel recupero delle unità: ${productUnitsError.message}`);
      }
      
      if (!productUnits || productUnits.length === 0) {
        // No units exist - product is not available
        throw new Error('Prodotto non disponibile. Nessuna unità disponibile per questo prodotto.');
      } else {
        // Step 3: Check unit availability using secure RPC function
        // Two periods overlap if: start_date <= endDate AND end_date >= startDate
        const unitIds = productUnits.map((u: any) => u.id);
        const { data: availabilityData, error: availabilityError } = await supabase
          .rpc('check_unit_availability', {
            p_unit_ids: unitIds,
            p_start_date: startDateStr,
            p_end_date: endDateStr
          });
        
        if (availabilityError) {
          throw new Error(`Errore nel controllo disponibilità: ${availabilityError.message}`);
        }
        
        // Step 4: Get booked unit IDs (units that are not available)
        // The RPC function only checks confirmed bookings (cart = false),
        // so cart bookings are not considered as blocking availability
        let bookedUnitIds = new Set<string>();
        if (availabilityData && availabilityData.length > 0) {
          availabilityData.forEach((item: any) => {
            if (!item.is_available) {
              bookedUnitIds.add(item.unit_id);
            }
          });
        }
        
        // Check if there's at least one unit available among existing units
        const availableUnits = productUnits.filter((u: any) => !bookedUnitIds.has(u.id));
        if (availableUnits.length === 0) {
          throw new Error('Prodotto non disponibile per il periodo selezionato. Tutte le unità sono già prenotate.');
        }
      }
      // Calculate duration for display purposes (not stored in DB)
      let durationDisplay: string;
      
      if (rentalHours > 0 && isSameDayBooking) {
        durationDisplay = `${rentalHours} ${rentalHours === 1 ? 'ora' : 'ore'}`;
      } else {
        durationDisplay = `${rentalDays} ${rentalDays === 1 ? 'giorno' : 'giorni'}`;
      }
      
      // Use the selected delivery method
      const deliveryMethod = selectedDeliveryMethod as 'pickup' | 'delivery';
      
      // For delivery method, set times to null (will be arranged with the store)
      const pickupStartTime = null;
      const pickupEndTime = null;
      const returnStartTime = null;
      const returnEndTime = null;
      
      const userId = isAdmin && selectedCustomer ? selectedCustomer.id : user.id;

      // Check if there's already a booking with cart=true for this user
      const { data: existingCartBooking, error: checkError } = await supabase
        .from('bookings')
        .select('id')
        .eq('user_id', userId)
        .eq('cart', true)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Errore nel controllo del carrello: ${checkError.message}`);
      }

      let bookingId: string;

      if (existingCartBooking) {
        // Use existing cart booking
        bookingId = existingCartBooking.id;
        // Using existing cart booking
      } else {
        // Create new booking with cart=true (without product-specific data)
        // product_id, start_date, end_date not included - not used in bookings table, go in booking_details
        const bookingData: CreateBookingData = {
          user_id: userId,
          price_total: pricingBreakdown.totalPrice, // Will be updated when adding more products
          delivery_method: deliveryMethod,
          delivery_address: null, // User can add this later
          status: 'cart', // Set to cart since it's in the cart
          cart: true, // Mark as cart item
          price_daily: null, // Not used in bookings table
          price_weekly: null, // Not used in bookings table
          price_hour: null, // Not used in bookings table
          price_month: null, // Not used in bookings table
          deposito: null, // Not used in bookings table
        };
        
        // Creating new cart booking
        
        // Create the booking
        const result = await BookingService.createBooking(bookingData);
        
        if (result.error) {
          throw new Error(result.error);
        }

        if (!result.data) {
          throw new Error('Errore: prenotazione non creata');
        }

        bookingId = result.data.id;
        // Created new cart booking
      }

      // Get or create a product unit for this product
      // unit_id must reference product_units, not products
      let unitId: string;
      
      // Get product variants to find a unit
      const { data: productData, error: productDataError } = await supabase
        .from('products')
        .select(`
          id,
          has_variants,
          product_variants(
            id,
            is_active
          )
        `)
        .eq('id', product.id)
        .single();

      if (productDataError) {
        throw new Error(`Errore nel recupero del prodotto: ${productDataError.message}`);
      }

      let variantId: string | null = null;
      
      if (productData.has_variants === true) {
        // Product has variants - get first active variant
        if (productData.product_variants && productData.product_variants.length > 0) {
          const activeVariant = productData.product_variants.find((v: any) => v.is_active === true);
          if (activeVariant) {
            variantId = activeVariant.id;
          } else {
            // If no active variant, use first variant
            variantId = productData.product_variants[0].id;
          }
        }
      } else {
        // Product without variants - we need to create a default variant or handle differently
        // For now, try to get any variant associated with this product (in case has_variants flag is wrong)
        const { data: fallbackVariants, error: fallbackError } = await supabase
          .from('product_variants')
          .select('id')
          .eq('id_product', product.id)
          .limit(1);
        
        if (!fallbackError && fallbackVariants && fallbackVariants.length > 0) {
          variantId = fallbackVariants[0].id;
        } else {
          // If no variants exist, we cannot create a booking without a unit
          throw new Error('Prodotto senza varianti. Impossibile creare la prenotazione. Contattare l\'amministratore.');
        }
      }

      if (!variantId) {
        throw new Error('Prodotto senza varianti valide. Impossibile creare la prenotazione.');
      }

      // Get all product units for this variant
      const { data: allUnits, error: allUnitsError } = await supabase
        .from('product_units')
        .select('id')
        .eq('id_product_variant', variantId);

      if (allUnitsError && allUnitsError.code !== 'PGRST116') {
        throw new Error(`Errore nel recupero delle unità: ${allUnitsError.message}`);
      }

      // If no units exist, product is not available
      if (!allUnits || allUnits.length === 0) {
        throw new Error('Prodotto non disponibile. Nessuna unità disponibile per questo prodotto.');
      }
      
      // Find an available unit for the selected period
      {
        // Find an available unit for the selected period
        const unitIds = allUnits.map((u: any) => u.id);
        const startDateStr = toItalianISOString(startDate);
        const endDateStr = toItalianISOString(endDate);
        
        // Use secure RPC function instead of direct query to avoid exposing sensitive data
        const { data: availabilityData, error: availabilityError } = await supabase
          .rpc('check_unit_availability', {
            p_unit_ids: unitIds,
            p_start_date: startDateStr,
            p_end_date: endDateStr
          });
        
        if (availabilityError) {
          throw new Error(`Errore nel controllo disponibilità: ${availabilityError.message}`);
        }
        
        // Get booked unit IDs (units that are not available)
        // The RPC function only checks confirmed bookings (cart = false),
        // so cart bookings are not considered as blocking availability
        let bookedUnitIds = new Set<string>();
        if (availabilityData && availabilityData.length > 0) {
          availabilityData.forEach((item: any) => {
            if (!item.is_available) {
              bookedUnitIds.add(item.unit_id);
            }
          });
        }
        
        // Find an available unit (not in bookedUnitIds)
        const availableUnit = allUnits.find((u: any) => !bookedUnitIds.has(u.id));
        
        if (availableUnit) {
          unitId = availableUnit.id;
        } else {
          // All units are booked - product is not available for this period
          throw new Error('Prodotto non disponibile per il periodo selezionato. Tutte le unità sono già prenotate.');
        }
      }

      // Create booking_details entry (always create this, whether using existing or new booking)
      // Each product added to cart gets its own booking_details row
      console.log('[Checkout] Inserimento booking_details - Date prima della conversione:', {
        startDate,
        endDate,
        startDateType: typeof startDate,
        endDateType: typeof endDate,
      });
      
      const startDateISO = toItalianISOString(startDate);
      const endDateISO = toItalianISOString(endDate);
      
      console.log('[Checkout] Inserimento booking_details - Date dopo la conversione:', {
        startDateISO,
        endDateISO,
      });
      
      const { error: bookingDetailsError } = await supabase
        .from('booking_details')
        .insert({
          booking_id: bookingId,
          user_id: userId,
          unit_id: unitId, // Use the product unit ID, not product ID
          start_date: startDateISO,
          end_date: endDateISO,
          delivery_method: deliveryMethod,
          price: pricingBreakdown.totalPrice,
          price_daily: product.price_daily,
          price_weekly: product.price_weekly,
          price_hour: product.price_hour,
          price_month: product.price_month,
          deposito: product.deposit,
          status: 'idle',
        });

      if (bookingDetailsError) {
        console.error('Error creating booking_details:', bookingDetailsError);
        throw new Error(`Errore nella creazione dei dettagli prenotazione: ${bookingDetailsError.message}`);
      }

      // Update booking price_total to sum all booking_details prices
      const { data: allDetails, error: detailsSumError } = await supabase
        .from('booking_details')
        .select('price')
        .eq('booking_id', bookingId);

      if (detailsSumError) {
        console.error('Error fetching booking_details for sum:', detailsSumError);
        // Don't throw, just log - the booking_details was created successfully
      } else {
        const totalPrice = (allDetails || []).reduce((sum: number, detail: any) => {
          return sum + (Number(detail.price) || 0);
        }, 0);

        // Update booking with total price
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ price_total: totalPrice })
          .eq('id', bookingId);

        if (updateError) {
          console.error('Error updating booking price_total:', updateError);
          // Don't throw, just log - the booking_details was created successfully
        }
      }

      // Success! Show toast and stay on page (user can add more bookings)
      toast({
        title: "Prenotazione aggiunta al carrello!",
        description: "La prenotazione è stata aggiunta al carrello. Puoi continuare ad aggiungere altre prenotazioni.",
      });

      // Reset form fields for next booking (optional - user might want to keep dates)
      // Uncomment if you want to reset after each booking:
      // setSelectedPickupTimeSlot("");
      // setSelectedReturnTimeSlot("");
      // setSelectedDeliveryMethod('');
      
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: "Errore",
        description: `Errore durante la creazione della prenotazione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
        variant: "destructive",
      });
    } finally {
      setIsCreatingBooking(false);
    }
  };

  const isLoading = isLoadingProduct || isLoadingCart || authLoading || adminLoading || isLoadingShopSettings;
  const hasCartItems = cartData?.booking_details && cartData.booking_details.length > 0;
  const showEmptyState = !newProductData && !hasCartItems && (!id || error || !product);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <FixedNavbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-16 text-lg text-gray-500">Caricamento...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (id && (error || !product)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <FixedNavbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <div className="text-red-600 text-lg mb-2">Errore durante il caricamento del prodotto</div>
            <Button onClick={() => navigate('/products')} className="mt-4">
              Torna ai prodotti
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (showEmptyState) {
    return (
      <div className="min-h-screen bg-gray-50">
        <FixedNavbar />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 mb-4">Nessun prodotto da configurare.</p>
                <Button onClick={() => navigate('/')}>Torna alla home</Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FixedNavbar />
      
      <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          {!hasCartItems && (
            <Button variant="ghost" onClick={() => navigate(-1)} className="flex gap-2 items-center">
              <ArrowLeft className="h-4 w-4" /> Torna indietro
            </Button>
          )}
        </div>

        {/* Sezione Admin - Selezione Cliente (sempre visibile se admin) */}
        {isAdmin && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-600" />
                Sezione Amministratore
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Seleziona il cliente per cui stai creando la prenotazione:
                </p>
                
                <CustomerAutocomplete
                  key={customerListKey}
                  selectedCustomer={selectedCustomer}
                  onCustomerSelect={setSelectedCustomer}
                  placeholder="Cerca e seleziona un cliente..."
                />
                
                {selectedCustomer && (
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <p className="text-sm text-purple-800">
                      <strong>Cliente selezionato:</strong> {selectedCustomer.first_name && selectedCustomer.last_name 
                        ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` 
                        : selectedCustomer.first_name || selectedCustomer.last_name || 'N/A'}
                    </p>
                    <p className="text-xs text-purple-600">
                      Email: {selectedCustomer.email}
                      {selectedCustomer.age && ` • Età: ${selectedCustomer.age} anni`}
                    </p>
                  </div>
                )}

                {/* Bottone per creare nuovo cliente */}
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateCustomerDialogOpen(true)}
                    className="w-full bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crea Nuovo Cliente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Layout a 2 colonne: Form a sinistra, Riepilogo a destra */}
        {newProductData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Colonna sinistra: Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Stepper quando quantity > 1, altrimenti form singola */}
              {newProductData.quantity > 1 ? (
                <Card>
                  <CardHeader className="pb-4">
                    {/* Stepper visuale - centrato */}
                    <div className="flex items-center justify-center mb-3">
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: newProductData.quantity }).map((_, index) => (
                          <React.Fragment key={index}>
                            <div className="flex items-center gap-1.5">
                              <div
                                className={`
                                  w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0
                                  ${index === currentStep 
                                    ? 'bg-blue-600 text-white' 
                                    : index < currentStep 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-gray-200 text-gray-600'
                                  }
                                `}
                                style={{ lineHeight: '1' }}
                              >
                                <span className="leading-none">{index < currentStep ? '✓' : index + 1}</span>
                              </div>
                              {index < newProductData.quantity - 1 && (
                                <div
                                  className={`
                                    h-0.5 w-8
                                    ${index < currentStep ? 'bg-green-600' : 'bg-gray-200'}
                                  `}
                                />
                              )}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-4">
                    {/* Mostra solo la form dello step corrente */}
                    {(() => {
                      const unitIndex = currentStep;
                      const unitFormData = newProductFormDataByUnit[unitIndex] || { deliveryMethod: newProductData.formData.deliveryMethod || '' };
                      const unitDynamicFormValues = newProductDynamicFormValuesByUnit[unitIndex] || {};

                      return (
                        <>
                {/* Modalità di Ritiro - Mostra solo se entrambe le modalità sono disponibili */}
                {(() => {
                  // Verifica le modalità disponibili combinando shop_settings e prodotto
                  // Usa i campi nuovi se disponibili, altrimenti fallback ai campi legacy
                  const productCanPickup = newProductData.product.can_be_picked_up ?? newProductData.product.pickup_on_site ?? true;
                  const productCanDelivery = newProductData.product.can_be_delivered ?? newProductData.product.delivery ?? false;
                  // Usa valori di default se shopSettings non è ancora caricato
                  const ritiroInNegozio = shopSettings?.ritiroInNegozio ?? true;
                  const consegna = shopSettings?.consegna ?? true;
                  const canPickup = ritiroInNegozio && productCanPickup;
                  const canDelivery = consegna && productCanDelivery;
                  const showSelection = canPickup && canDelivery; // Mostra selezione solo se entrambe disponibili
                  
                  // Se solo una modalità è disponibile, nascondi completamente la sezione
                  if (!showSelection) {
                    return null;
                  }
                  
                  // Se entrambe disponibili, mostra la selezione
                  return (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Modalità di Ritiro
                      </h4>
                      <div className="flex gap-4">
                        {canPickup && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="newProductDeliveryMethod"
                              value="pickup"
                              checked={unitFormData.deliveryMethod === 'pickup'}
                              onChange={(e) => {
                                setNewProductFormDataByUnit(prev => ({
                                  ...prev,
                                  [currentStep]: { ...prev[currentStep] || {}, deliveryMethod: e.target.value as 'pickup' | 'delivery' }
                                }));
                              }}
                              className="w-4 h-4"
                            />
                            <MapPin className="h-4 w-4" />
                            <span>Ritiro in sede</span>
                          </label>
                        )}
                        {canDelivery && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="newProductDeliveryMethod"
                              value="delivery"
                              checked={unitFormData.deliveryMethod === 'delivery'}
                              onChange={(e) => {
                                setNewProductFormDataByUnit(prev => ({
                                  ...prev,
                                  [currentStep]: { ...prev[currentStep] || {}, deliveryMethod: e.target.value as 'pickup' | 'delivery' }
                                }));
                              }}
                              className="w-4 h-4"
                            />
                            <Home className="h-4 w-4" />
                            <span>Consegna a domicilio</span>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })()}


                {/* Form Dinamico */}
                {(() => {
                  if (isLoadingInformations) {
                    return (
                      <div className="border-t pt-4">
                        <p className="text-sm text-gray-500">Caricamento informazioni...</p>
                      </div>
                    );
                  }
                  
                  if (!allInformations || allInformations.length === 0) {
                    return null; // Non mostrare nulla se non ci sono informazioni
                  }

                  // Usa la funzione helper per ottenere tutte le informazioni unificate (prodotto principale + correlati)
                  const informations = getMergedInformations();
                  
                  console.log('[Checkout] Filtering informations for new product:', {
                    productId: newProductData.product?.id,
                    productName: newProductData.product?.name,
                    relatedProductsCount: relatedProducts.length,
                    totalInformations: informations.length
                  });

                  if (informations.length === 0) {
                    return null; // Non mostrare nulla se non ci sono informazioni per questa sottocategoria
                  }

                  // Estrai informazioni uniche dal carrello
                  const getCartInformationsOptions = () => {
                    if (!cartData?.booking_details) return [];

                    const optionsMap = new Map<string, { label: string; values: { [informationId: string]: any } }>();

                    cartData.booking_details.forEach((detail) => {
                      if (!detail.informations || detail.informations.length === 0) return;

                      // Cerca nome e cognome - prima cerca match esatto, poi cerca campi che iniziano con il nome
                      const findValue = (fieldName: string): string | null => {
                        const fieldNameLower = fieldName.toLowerCase();
                        // Prima cerca match esatto
                        let info = detail.informations?.find(i => {
                          const name = i.information?.name?.toLowerCase() || '';
                          return name === fieldNameLower;
                        });
                        // Se non trova match esatto, cerca campi che iniziano con il nome seguito da underscore o trattino
                        if (!info) {
                          info = detail.informations?.find(i => {
                            const name = i.information?.name?.toLowerCase() || '';
                            return name.startsWith(fieldNameLower + '_') || name.startsWith(fieldNameLower + '-');
                          });
                        }
                        if (!info || !info.value) return null;
                        
                        try {
                          const parsed = JSON.parse(info.value);
                          if (Array.isArray(parsed)) return parsed.join(', ');
                          if (typeof parsed === 'object') return JSON.stringify(parsed);
                          const value = String(parsed).trim();
                          // Rimuovi duplicati se il valore contiene lo stesso testo ripetuto
                          if (value.length > 0 && value.length % 2 === 0) {
                            const half = value.length / 2;
                            if (value.substring(0, half) === value.substring(half)) {
                              return value.substring(0, half);
                            }
                          }
                          return value;
                        } catch {
                          const value = info.value.trim();
                          // Rimuovi duplicati se il valore contiene lo stesso testo ripetuto
                          if (value.length > 0 && value.length % 2 === 0) {
                            const half = value.length / 2;
                            if (value.substring(0, half) === value.substring(half)) {
                              return value.substring(0, half);
                            }
                          }
                          return value;
                        }
                      };

                      const nome = findValue('nome')?.trim() || null;
                      const cognome = findValue('cognome')?.trim() || null;
                      const label = nome && cognome ? `${nome} ${cognome}` : nome || cognome || `Prenotazione ${detail.id.substring(0, 8)}`;

                      // Crea una chiave unica basata su nome+cognome o su tutti i valori
                      const key = nome && cognome ? `${nome}|${cognome}` : JSON.stringify(
                        detail.informations.map(i => ({ id: i.information_id, value: i.value })).sort((a, b) => a.id.localeCompare(b.id))
                      );

                      if (!optionsMap.has(key)) {
                        // Converti le informazioni in un oggetto chiave-valore
                        const values: { [informationId: string]: any } = {};
                        detail.informations.forEach((info) => {
                          let parsedValue: any = info.value;
                          try {
                            parsedValue = JSON.parse(info.value || '');
                          } catch {
                            // Se non è JSON, usa il valore direttamente
                          }
                          values[info.information_id] = parsedValue;
                        });
                        
                        optionsMap.set(key, { label, values });
                      }
                    });

                    return Array.from(optionsMap.values());
                  };

                  const cartInformationsOptions = getCartInformationsOptions();
                  
                  // Debug: verifica condizioni per mostrare la select
                  // Mostra la tendina SOLO se precompilazioneCampi è esplicitamente true
                  const shouldShowSelect = cartInformationsOptions.length > 0 && 
                                          !isLoadingShopSettings && 
                                          shopSettings && 
                                          shopSettings.precompilazioneCampi === true;
                  
                  return (
                    <div className="border-t pt-4">
                      <h4 className="text-base font-semibold text-gray-800 mb-4">Informazioni Aggiuntive</h4>
                      
                      {/* Tendina per selezionare informazioni dal carrello e bottone copia */}
                      <div className="mb-4 space-y-2">
                        {shouldShowSelect && (
                          <>
                            <label className="text-sm font-medium text-gray-700 block">
                              Carica informazioni da una prenotazione esistente nel carrello
                            </label>
                            <div className="flex gap-2">
                              <Select
                                value={selectedCartInformation[currentStep] || ''}
                                onValueChange={(value) => {
                                  const selectedOption = cartInformationsOptions.find(opt => opt.label === value);
                                  if (selectedOption) {
                                    // Precompila i form con i valori selezionati
                                    setNewProductDynamicFormValuesByUnit(prev => ({
                                      ...prev,
                                      [currentStep]: { ...selectedOption.values }
                                    }));
                                    setSelectedCartInformation(prev => ({
                                      ...prev,
                                      [currentStep]: value
                                    }));
                                    
                                    toast({
                                      title: "Informazioni caricate",
                                      description: `Le informazioni di "${selectedOption.label}" sono state caricate.`,
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Seleziona una prenotazione dal carrello..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {cartInformationsOptions.map((option, index) => (
                                    <SelectItem key={index} value={option.label}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {/* Bottone per copiare i dati dalla prima form - solo dalla seconda form in poi */}
                              {currentStep > 0 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    const firstFormData = newProductFormDataByUnit[0] || newProductData.formData;
                                    const firstDynamicValues = newProductDynamicFormValuesByUnit[0] || dynamicFormValues;
                                    const firstSelectedCartInfo = selectedCartInformation[0];
                                    
                                    setNewProductFormDataByUnit(prev => ({
                                      ...prev,
                                      [currentStep]: { ...firstFormData }
                                    }));
                                    
                                    setNewProductDynamicFormValuesByUnit(prev => ({
                                      ...prev,
                                      [currentStep]: { ...firstDynamicValues }
                                    }));
                                    
                                    // Copia anche la selezione della tendina se presente nella prima form, altrimenti deseleziona
                                    setSelectedCartInformation(prev => {
                                      const updated = { ...prev };
                                      if (firstSelectedCartInfo) {
                                        updated[currentStep] = firstSelectedCartInfo;
                                      } else {
                                        delete updated[currentStep];
                                      }
                                      return updated;
                                    });
                                    
                                    toast({
                                      title: "Dati copiati",
                                      description: `I dati dalla prima form sono stati copiati nell'articolo ${currentStep + 1}.`,
                                    });
                                  }}
                                  className="flex-shrink-0"
                                >
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copia dalla prima
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Renderizza i campi con larghezza dinamica basata su sistema a 12 colonne */}
                      {(() => {
                        // Raggruppa i campi in righe basandosi sulla loro larghezza (sistema a 12 colonne)
                        const rows: typeof informations[] = [];
                        let currentRow: typeof informations = [];
                        let currentRowColumns = 0;
                        
                        informations.forEach((info) => {
                          // width rappresenta il numero di colonne su 12 (1-12)
                          // Default: 6 colonne (50% della larghezza)
                          const columns = info.width ?? 6;
                          
                          // Se aggiungendo questo campo superiamo le 12 colonne, inizia una nuova riga
                          if (currentRowColumns + columns > 12 && currentRow.length > 0) {
                            rows.push([...currentRow]);
                            currentRow = [info];
                            currentRowColumns = columns;
                          } else {
                            currentRow.push(info);
                            currentRowColumns += columns;
                          }
                        });
                        
                        // Aggiungi l'ultima riga se non è vuota
                        if (currentRow.length > 0) {
                          rows.push(currentRow);
                        }
                        
                        return (
                          <div className="space-y-4">
                            {rows.map((row, rowIndex) => (
                              <div key={rowIndex} className="grid grid-cols-12 gap-4">
                                {row.map((info) => {
                                  // width rappresenta il numero di colonne su 12 (1-12)
                                  const columns = Math.min(Math.max(1, info.width ?? 6), 12);
                                  return (
                                    <div 
                                      key={info.id} 
                                      className={`checkout-field-responsive col-${columns}`}
                                    >
                                      <DynamicFormField
                                        information={info}
                                        value={unitDynamicFormValues[info.id]}
                                        onChange={(value) => {
                                          setNewProductDynamicFormValuesByUnit(prev => ({
                                            ...prev,
                                            [currentStep]: {
                                              ...prev[currentStep] || {},
                                              [info.id]: value
                                            }
                                          }));
                                          // Rimuovi la selezione dalla tendina quando l'utente modifica un campo
                                          setSelectedCartInformation(prev => {
                                            const updated = { ...prev };
                                            delete updated[currentStep];
                                            return updated;
                                          });
                                          // Rimuovi l'errore di validazione quando l'utente modifica il campo
                                          setValidationErrors(prev => ({
                                            ...prev,
                                            [currentStep]: {
                                              ...prev[currentStep] || {},
                                              [info.id]: ''
                                            }
                                          }));
                                        }}
                                        onValidationChange={(isValid, errorMessage) => {
                                          // Aggiorna gli errori di validazione del formato
                                          setFormatValidationErrors(prev => ({
                                            ...prev,
                                            [currentStep]: {
                                              ...prev[currentStep] || {},
                                              [info.id]: errorMessage || ''
                                            }
                                          }));
                                        }}
                                        error={formatValidationErrors[currentStep]?.[info.id] || validationErrors[currentStep]?.[info.id]}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}


                      {/* Bottoni Precedente/Successivo o Aggiungi al carrello - in fondo alla form */}
                      <div className="flex justify-between gap-2 pt-4 border-t">
                        {/* Bottone Precedente - solo se non siamo al primo step */}
                        {currentStep > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                            className="flex-1"
                          >
                            ← Precedente
                          </Button>
                        )}
                        {currentStep === newProductData.quantity - 1 ? (
                          /* Bottone Aggiungi al carrello sull'ultimo step */
                          (() => {
                            const isSameDayBooking = isSameDay(newProductData.startDate, newProductData.endDate);
                            // Usa i campi nuovi se disponibili, altrimenti fallback ai campi legacy
                            const productCanPickup = newProductData.product.can_be_picked_up ?? newProductData.product.pickup_on_site ?? true;
                            const productCanDelivery = newProductData.product.can_be_delivered ?? newProductData.product.delivery ?? false;
                            // Usa valori di default se shopSettings non è ancora caricato
                            const ritiroInNegozio = shopSettings?.ritiroInNegozio ?? true;
                            const consegna = shopSettings?.consegna ?? true;
                            const canPickup = ritiroInNegozio && productCanPickup;
                            const canDelivery = consegna && productCanDelivery;
                            const showSelection = canPickup && canDelivery;
                            
                            // Verifica se tutti i form sono validi
                            let allFormsValid = true;
                            
                            // Se non ci sono modalità disponibili, disabilita il pulsante
                            if (!canPickup && !canDelivery) {
                              allFormsValid = false;
                            } else {
                              for (let i = 0; i < newProductData.quantity; i++) {
                                // Usa sempre newProductFormDataByUnit, con fallback a newProductData.formData per quantity === 1
                                const formData = newProductFormDataByUnit[i] || 
                                  (newProductData.quantity === 1 ? (newProductData.formData || { deliveryMethod: '' }) : { deliveryMethod: '' });
                                let effectiveDeliveryMethod = formData.deliveryMethod || '';
                                
                                // Se la modalità non è selezionata e non serve selezione (solo una disponibile), imposta automaticamente
                                if (!effectiveDeliveryMethod && !showSelection) {
                                  if (canPickup && !canDelivery) {
                                    effectiveDeliveryMethod = 'pickup';
                                  } else if (canDelivery && !canPickup) {
                                    effectiveDeliveryMethod = 'delivery';
                                  }
                                }
                                
                                // Se ancora non c'è una modalità valida, il form non è valido
                                if (!effectiveDeliveryMethod) {
                                  allFormsValid = false;
                                  break;
                                }
                              }
                            }
                            
                            return (
                              <Button
                                onClick={handleAddToCart}
                                disabled={isAddingToCart || !allFormsValid}
                                className={`text-white ${currentStep === 0 ? "w-full" : "flex-1"}`}
                                size="sm"
                                style={{ backgroundColor: '#E31E24', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}
                                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#C01A1F')}
                                onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#E31E24')}
                              >
                                {isAddingToCart ? "Aggiunta in corso..." : "Aggiungi al carrello"}
                              </Button>
                            );
                          })()
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentStep(prev => Math.min(newProductData.quantity - 1, prev + 1))}
                            className={currentStep === 0 ? "w-full" : "flex-1"}
                          >
                            Successivo →
                          </Button>
                        )}
                      </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              ) : (
                /* Form singola quando quantity = 1 */
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5 text-purple-600" />
                      Dettagli Ritiro
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {(() => {
                      const unitFormData = newProductData.formData;
                      const unitDynamicFormValues = dynamicFormValues;
                      const unitIndex = 0;

                      return (
                        <>
                          {/* Modalità di Ritiro */}
                          {(() => {
                            // Usa i campi nuovi se disponibili, altrimenti fallback ai campi legacy
                            const productCanPickup = newProductData.product.can_be_picked_up ?? newProductData.product.pickup_on_site ?? true;
                            const productCanDelivery = newProductData.product.can_be_delivered ?? newProductData.product.delivery ?? false;
                            // Usa valori di default se shopSettings non è ancora caricato
                            const ritiroInNegozio = shopSettings?.ritiroInNegozio ?? true;
                            const consegna = shopSettings?.consegna ?? true;
                            const canPickup = ritiroInNegozio && productCanPickup;
                            const canDelivery = consegna && productCanDelivery;
                            const showSelection = canPickup && canDelivery;
                            
                            if (!showSelection) {
                              return null;
                            }
                            
                            return (
                              <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                  <Truck className="h-4 w-4" />
                                  Modalità di Ritiro
                                </h4>
                                <div className="flex gap-4">
                                  {canPickup && (
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name="newProductDeliveryMethod"
                                        value="pickup"
                                        checked={unitFormData.deliveryMethod === 'pickup'}
                                        onChange={(e) => {
                                          setNewProductData(prev => prev ? {
                                            ...prev,
                                            formData: { ...prev.formData, deliveryMethod: e.target.value as 'pickup' | 'delivery' }
                                          } : null);
                                        }}
                                        className="w-4 h-4"
                                      />
                                      <MapPin className="h-4 w-4" />
                                      <span>Ritiro in sede</span>
                                    </label>
                                  )}
                                  {canDelivery && (
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name="newProductDeliveryMethod"
                                        value="delivery"
                                        checked={unitFormData.deliveryMethod === 'delivery'}
                                        onChange={(e) => {
                                          setNewProductData(prev => prev ? {
                                            ...prev,
                                            formData: { ...prev.formData, deliveryMethod: e.target.value as 'pickup' | 'delivery' }
                                          } : null);
                                        }}
                                        className="w-4 h-4"
                                      />
                                      <Home className="h-4 w-4" />
                                      <span>Consegna a domicilio</span>
                                    </label>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Form Dinamico */}
                          {(() => {
                            if (isLoadingInformations) {
                              return (
                                <div className="border-t pt-4">
                                  <p className="text-sm text-gray-500">Caricamento informazioni...</p>
                                </div>
                              );
                            }
                            
                            if (!allInformations || allInformations.length === 0) {
                              return null;
                            }

                            // Usa la funzione helper per ottenere tutte le informazioni unificate (prodotto principale + correlati)
                            const informations = getMergedInformations();

                            if (informations.length === 0) {
                              return null;
                            }

                            const getCartInformationsOptions = () => {
                              if (!cartData?.booking_details) return [];

                              const optionsMap = new Map<string, { label: string; values: { [informationId: string]: any } }>();

                              cartData.booking_details.forEach((detail) => {
                                if (!detail.informations || detail.informations.length === 0) return;

                                // Cerca nome e cognome - prima cerca match esatto, poi cerca campi che iniziano con il nome
                                const findValue = (fieldName: string): string | null => {
                                  const fieldNameLower = fieldName.toLowerCase();
                                  // Prima cerca match esatto
                                  let info = detail.informations?.find(i => {
                                    const name = i.information?.name?.toLowerCase() || '';
                                    return name === fieldNameLower;
                                  });
                                  // Se non trova match esatto, cerca campi che iniziano con il nome seguito da underscore o trattino
                                  if (!info) {
                                    info = detail.informations?.find(i => {
                                      const name = i.information?.name?.toLowerCase() || '';
                                      return name.startsWith(fieldNameLower + '_') || name.startsWith(fieldNameLower + '-');
                                    });
                                  }
                                  if (!info || !info.value) return null;
                                  
                                  try {
                                    const parsed = JSON.parse(info.value);
                                    if (Array.isArray(parsed)) return parsed.join(', ');
                                    if (typeof parsed === 'object') return JSON.stringify(parsed);
                                    const value = String(parsed).trim();
                                    // Rimuovi duplicati se il valore contiene lo stesso testo ripetuto
                                    if (value.length > 0 && value.length % 2 === 0) {
                                      const half = value.length / 2;
                                      if (value.substring(0, half) === value.substring(half)) {
                                        return value.substring(0, half);
                                      }
                                    }
                                    return value;
                                  } catch {
                                    const value = info.value.trim();
                                    // Rimuovi duplicati se il valore contiene lo stesso testo ripetuto
                                    if (value.length > 0 && value.length % 2 === 0) {
                                      const half = value.length / 2;
                                      if (value.substring(0, half) === value.substring(half)) {
                                        return value.substring(0, half);
                                      }
                                    }
                                    return value;
                                  }
                                };

                                const nome = findValue('nome')?.trim() || null;
                                const cognome = findValue('cognome')?.trim() || null;
                                const label = nome && cognome ? `${nome} ${cognome}` : nome || cognome || `Prenotazione ${detail.id.substring(0, 8)}`;

                                const key = nome && cognome ? `${nome}|${cognome}` : JSON.stringify(
                                  detail.informations.map(i => ({ id: i.information_id, value: i.value })).sort((a, b) => a.id.localeCompare(b.id))
                                );

                                if (!optionsMap.has(key)) {
                                  const values: { [informationId: string]: any } = {};
                                  detail.informations.forEach((info) => {
                                    let parsedValue: any = info.value;
                                    try {
                                      parsedValue = JSON.parse(info.value || '');
                                    } catch {
                                      // Se non è JSON, usa il valore direttamente
                                    }
                                    values[info.information_id] = parsedValue;
                                  });
                                  
                                  optionsMap.set(key, { label, values });
                                }
                              });

                              return Array.from(optionsMap.values());
                            };

                            const cartInformationsOptions = getCartInformationsOptions();
                            
                            // Debug: verifica condizioni per mostrare la select
                            // Mostra la tendina SOLO se precompilazioneCampi è esplicitamente true
                            const shouldShowSelect = cartInformationsOptions.length > 0 && 
                                                    !isLoadingShopSettings && 
                                                    shopSettings && 
                                                    shopSettings.precompilazioneCampi === true;
                            
                            return (
                              <div className="border-t pt-4">
                                <h4 className="text-base font-semibold text-gray-800 mb-4">Informazioni Aggiuntive</h4>
                                
                                {shouldShowSelect && (
                                  <div className="mb-4">
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                                      Carica informazioni da una prenotazione esistente nel carrello
                                    </label>
                                    <Select
                                      value={selectedCartInformation[0] || ''}
                                      onValueChange={(value) => {
                                        const selectedOption = cartInformationsOptions.find(opt => opt.label === value);
                                        if (selectedOption) {
                                          setDynamicFormValues(selectedOption.values);
                                          setSelectedCartInformation({ 0: value });
                                          
                                          toast({
                                            title: "Informazioni caricate",
                                            description: `Le informazioni di "${selectedOption.label}" sono state caricate.`,
                                          });
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Seleziona una prenotazione dal carrello..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {cartInformationsOptions.map((option, index) => (
                                          <SelectItem key={index} value={option.label}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {/* Renderizza i campi con larghezza dinamica basata su sistema a 12 colonne */}
                                {(() => {
                                  // Raggruppa i campi in righe basandosi sulla loro larghezza (sistema a 12 colonne)
                                  const rows: typeof informations[] = [];
                                  let currentRow: typeof informations = [];
                                  let currentRowColumns = 0;
                                  
                                  informations.forEach((info) => {
                                    // width rappresenta il numero di colonne su 12 (1-12)
                                    // Default: 6 colonne (50% della larghezza)
                                    const columns = info.width ?? 6;
                                    
                                    // Se aggiungendo questo campo superiamo le 12 colonne, inizia una nuova riga
                                    if (currentRowColumns + columns > 12 && currentRow.length > 0) {
                                      rows.push([...currentRow]);
                                      currentRow = [info];
                                      currentRowColumns = columns;
                                    } else {
                                      currentRow.push(info);
                                      currentRowColumns += columns;
                                    }
                                  });
                                  
                                  // Aggiungi l'ultima riga se non è vuota
                                  if (currentRow.length > 0) {
                                    rows.push(currentRow);
                                  }
                                  
                                  return (
                                    <div className="space-y-4">
                                      {rows.map((row, rowIndex) => (
                                        <div key={rowIndex} className="grid grid-cols-12 gap-4">
                                          {row.map((info) => {
                                            // width rappresenta il numero di colonne su 12 (1-12)
                                            const columns = Math.min(Math.max(1, info.width ?? 6), 12);
                                            return (
                                              <div 
                                                key={info.id} 
                                                className={`checkout-field-responsive col-${columns}`}
                                              >
                                                <DynamicFormField
                                                  information={info}
                                                  value={unitDynamicFormValues[info.id]}
                                                  onChange={(value) => {
                                                    setDynamicFormValues(prev => ({
                                                      ...prev,
                                                      [info.id]: value
                                                    }));
                                                    setSelectedCartInformation({});
                                                    // Rimuovi l'errore di validazione quando l'utente modifica il campo
                                                    setValidationErrors(prev => ({
                                                      ...prev,
                                                      0: {
                                                        ...prev[0] || {},
                                                        [info.id]: ''
                                                      }
                                                    }));
                                                  }}
                                                  onValidationChange={(isValid, errorMessage) => {
                                                    // Aggiorna gli errori di validazione del formato
                                                    setFormatValidationErrors(prev => ({
                                                      ...prev,
                                                      0: {
                                                        ...prev[0] || {},
                                                        [info.id]: errorMessage || ''
                                                      }
                                                    }));
                                                  }}
                                                  error={formatValidationErrors[0]?.[info.id] || validationErrors[0]?.[info.id]}
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })()}

                          {/* Bottone Aggiungi al Carrello */}
                          <div className="border-t pt-4">
                            {(() => {
                              const isSameDayBooking = isSameDay(newProductData.startDate, newProductData.endDate);
                              // Usa i campi nuovi se disponibili, altrimenti fallback ai campi legacy
                              const productCanPickup = newProductData.product.can_be_picked_up ?? newProductData.product.pickup_on_site ?? true;
                              const productCanDelivery = newProductData.product.can_be_delivered ?? newProductData.product.delivery ?? false;
                              // Usa valori di default se shopSettings non è ancora caricato
                              const ritiroInNegozio = shopSettings?.ritiroInNegozio ?? true;
                              const consegna = shopSettings?.consegna ?? true;
                              const canPickup = ritiroInNegozio && productCanPickup;
                              const canDelivery = consegna && productCanDelivery;
                              const showSelection = canPickup && canDelivery;
                              
                              // Se non ci sono modalità disponibili, disabilita il pulsante
                              if (!canPickup && !canDelivery) {
                                return (
                                  <Button
                                    disabled={true}
                                    className="w-full"
                                  >
                                    Nessuna modalità disponibile
                                  </Button>
                                );
                              }
                              
                              // Usa newProductFormDataByUnit[0] se disponibile, altrimenti newProductData.formData
                              const formData = newProductFormDataByUnit[0] || newProductData.formData || { deliveryMethod: '' };
                              let effectiveDeliveryMethod = formData.deliveryMethod || '';
                              
                              if (!effectiveDeliveryMethod && !showSelection) {
                                if (canPickup && !canDelivery) {
                                  effectiveDeliveryMethod = 'pickup';
                                } else if (canDelivery && !canPickup) {
                                  effectiveDeliveryMethod = 'delivery';
                                }
                              }
                              const allFormsValid = effectiveDeliveryMethod !== '';
                              
                              return (
                                <Button
                                  onClick={handleAddToCart}
                                  disabled={isAddingToCart || !allFormsValid}
                                  className="w-full text-white"
                                  style={{ backgroundColor: '#E31E24', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}
                                  onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#C01A1F')}
                                  onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#E31E24')}
                                >
                                  {isAddingToCart ? "Aggiunta in corso..." : "Aggiungi al carrello"}
                                </Button>
                              );
                            })()}
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Colonna destra: Riepilogo Prodotto */}
            <div className="lg:col-span-1">
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Riepilogo Prodotto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible defaultValue="product-summary" className="w-full">
                    <AccordionItem value="product-summary" className="border-none">
                      <AccordionTrigger className="py-2 hover:no-underline">
                        <h3 className="text-sm font-semibold text-gray-700">Riepilogo dettagli</h3>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          {/* Immagine e titolo prodotto */}
                          <div className="flex gap-4">
                            <div className="w-24 h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                              <img 
                                src={newProductData.product.images?.[0] || DEFAULT_IMAGES.PRODUCT} 
                                alt={newProductData.product.name || 'Prodotto'}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = DEFAULT_IMAGES.PRODUCT;
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h2 className="text-lg font-bold mb-1">{newProductData.product.name || 'Prodotto'}</h2>
                              {newProductData.product.product_brand?.name && (
                                <div className="text-sm text-gray-600 mb-1">
                                  <span className="font-medium">Marca: </span>
                                  {newProductData.product.product_brand.name}
                                </div>
                              )}
                              {newProductData.product.product_model?.name && (
                                <div className="text-sm text-gray-600 mb-2">
                                  <span className="font-medium">Modello: </span>
                                  {newProductData.product.product_model.name}
                                </div>
                              )}
                              <div className="text-sm text-gray-600 mb-2">
                                <span className="font-medium">Quantità:</span> {newProductData.quantity}
                              </div>
                            </div>
                          </div>

                          {/* Attributi variante */}
                          {variantAttributes.length > 0 && (
                            <div className="border-t pt-3">
                              <h3 className="text-sm font-semibold text-gray-700 mb-2">Caratteristiche</h3>
                              <div className="space-y-2">
                                {variantAttributes.map((attr, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-gray-600 font-medium">{attr.name}:</span>
                                    <span className="text-gray-900">{attr.value}{attr.unit ? ` ${attr.unit}` : ''}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Date e orari */}
                          <div className="border-t pt-3">
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">Periodo noleggio</h3>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Data inizio:</span>
                                <span className="font-medium">{format(newProductData.startDate, "dd MMM yyyy", { locale: it })}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Data fine:</span>
                                <span className="font-medium">{format(newProductData.endDate, "dd MMM yyyy", { locale: it })}</span>
                              </div>
                              {isSameDay(newProductData.startDate, newProductData.endDate) && newProductData.startTime && newProductData.endTime && (
                                <>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Orario inizio:</span>
                                    <span className="font-medium">{newProductData.startTime}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Orario fine:</span>
                                    <span className="font-medium">{newProductData.endTime}</span>
                                  </div>
                                </>
                              )}
                              {!isSameDay(newProductData.startDate, newProductData.endDate) && (
                                <div className="flex justify-between text-sm pt-1">
                                  <span className="text-gray-600">Durata:</span>
                                  <span className="font-medium">
                                    {differenceInDays(newProductData.endDate, newProductData.startDate) + 1} {differenceInDays(newProductData.endDate, newProductData.startDate) + 1 === 1 ? 'giorno' : 'giorni'}
                                  </span>
                                </div>
                              )}
                              
                              {/* Avviso negozio chiuso */}
                              {newProductData.endDate && isDateWithEnabledBooking(newProductData.endDate, shopDaysOff) && (
                                <div className="mt-3 p-2 bg-amber-50 rounded border border-amber-200">
                                  <p className="text-xs text-amber-900 flex items-start gap-1">
                                    <span>⚠️</span>
                                    <span>
                                      Il <strong>{format(newProductData.endDate, "dd/MM/yyyy", { locale: it })}</strong> il negozio sarà chiuso, 
                                      pertanto la riconsegna del prodotto avverrà il giorno successivo (<strong>{format(addDays(newProductData.endDate, 1), "dd/MM/yyyy", { locale: it })}</strong>). 
                                      Il prezzo verrà comunque calcolato sui giorni di prenotazione selezionati.
                                    </span>
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Preventivo */}
                          {newProductData.variant && (() => {
                      const totalPrice = newProductPrice?.totalPrice || 0;
                      const priceBreakdown = newProductPrice?.priceBreakdown || 'Calcolo in corso...';
                      const totalWithQuantity = totalPrice * newProductData.quantity;
                      const deposit = newProductData.variant.deposit ? Number(newProductData.variant.deposit) * newProductData.quantity : 0;

                      return (
                        <div className="border-t pt-3">
                          <h3 className="text-sm font-semibold text-gray-700 mb-2">Preventivo</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">{priceBreakdown}</span>
                              <span className="font-medium">€{totalPrice.toFixed(2)}</span>
                            </div>
                            {newProductData.quantity > 1 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">× {newProductData.quantity} {newProductData.quantity === 1 ? 'unità' : 'unità'}</span>
                                <span className="font-medium">€{totalWithQuantity.toFixed(2)}</span>
                              </div>
                            )}
                            {deposit > 0 && (
                              <div className="flex justify-between pt-2 border-t">
                                <span className="text-gray-600 font-medium">Deposito {newProductData.quantity > 1 ? `(${newProductData.quantity} unità)` : ''}:</span>
                                <span className="font-bold text-blue-600">€{deposit.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Prodotti correlati selezionati */}
                    {relatedProducts.length > 0 && (() => {
                      // Calcola il totale dei prodotti correlati usando i prezzi già calcolati dalla nuova tabella
                      const relatedProductsTotal = relatedProducts.reduce((sum, relatedProduct) => {
                        const price = relatedProductsPrices[relatedProduct.variantId] || 0;
                        return sum + price;
                      }, 0);

                      // Calcola il totale del prodotto principale
                      const mainProductTotal = (() => {
                        if (!newProductData?.variant) return 0;
                        const startDate = newProductData.startDate;
                        const endDate = newProductData.endDate;
                        const isSameDayBooking = isSameDay(startDate, endDate);
                        const rentalDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
                        const rentalHours = newProductData.startTime && newProductData.endTime && isSameDayBooking
                          ? Math.max(1, parseInt(newProductData.endTime.split(":")[0]) - parseInt(newProductData.startTime.split(":")[0]))
                          : 0;

                        // Usa il prezzo già calcolato dalla nuova tabella product_variant_price_list
                        return (newProductPrice?.totalPrice || 0) * newProductData.quantity;
                      })();

                      // Totale complessivo
                      const grandTotal = mainProductTotal + relatedProductsTotal;

                      return (
                        <div className="border-t pt-4 mt-4">
                          <h3 className="text-sm font-semibold text-gray-700 mb-3">Prodotti correlati aggiunti ({relatedProducts.length})</h3>
                          <div className="space-y-2">
                            {relatedProducts.map((relatedProduct) => {
                              const product = relatedProduct.product;
                              const variant = relatedProduct.variant;
                              const productPrice = relatedProductsPrices[relatedProduct.variantId];
                              const isLoadingPrice = productPrice === undefined;

                              return (
                                <div key={relatedProduct.variantId} className="flex items-start justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                      {product?.name || 'Prodotto correlato'}
                                    </div>
                                  </div>
                                  <div className="text-sm font-semibold text-gray-900 ml-2">
                                    {isLoadingPrice ? (
                                      <span className="text-gray-400 text-xs">Calcolo...</span>
                                    ) : (
                                      <>€{(productPrice || 0).toFixed(2)}</>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  
                  {/* Totale complessivo - sempre visibile */}
                  {(() => {
                    // Calcola il totale del prodotto principale usando il prezzo già calcolato dalla nuova tabella
                    const mainProductTotal = newProductPrice?.totalPrice ? newProductPrice.totalPrice * newProductData.quantity : 0;

                    // Calcola il totale dei prodotti correlati usando i prezzi già calcolati dalla nuova tabella
                    const relatedProductsTotal = relatedProducts.reduce((sum, relatedProduct) => {
                      // Usa il prezzo già calcolato dalla nuova tabella product_variant_price_list
                      const price = relatedProductsPrices[relatedProduct.variantId] || 0;
                      return sum + price;
                    }, 0);

                    const grandTotal = mainProductTotal + relatedProductsTotal;

                    return (
                      <div className="border-t pt-4 mt-4">
                        <div className="flex justify-between items-center font-bold text-lg">
                          <span>Totale:</span>
                          <span className="text-green-600">€{grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Layout a 2 colonne per prodotto singolo */}

        {/* Form prodotto singolo (solo se c'è id, non ci sono parametri URL e non c'è un nuovo prodotto da aggiungere) */}
        {id && !urlProductId && !newProductData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Colonna sinistra: Form */}
            <div className="lg:col-span-2 space-y-6">

            {/* Dettagli Prenotazione */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Dettagli Prenotazione
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Data inizio</label>
                    <p className="text-lg font-semibold">
                      {startDate ? format(startDate, "dd MMMM yyyy", { locale: it }) : "Non specificata"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Data fine</label>
                    <p className="text-lg font-semibold">
                      {endDate ? format(endDate, "dd MMMM yyyy", { locale: it }) : "Non specificata"}
                    </p>
                  </div>
                </div>
                
                {isSameDayBooking && startTime && endTime && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Orario inizio</label>
                      <p className="text-lg font-semibold">{startTime}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Orario fine</label>
                      <p className="text-lg font-semibold">{endTime}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-600">Durata</label>
                  <p className="text-lg font-semibold">
                    {rentalHours > 0 && isSameDayBooking 
                      ? `${rentalHours} ${rentalHours === 1 ? 'ora' : 'ore'}`
                      : `${rentalDays} ${rentalDays === 1 ? 'giorno' : 'giorni'}`
                    }
                  </p>
                  
                  {/* Avviso negozio chiuso */}
                  {(() => {
                    console.log('[Checkout] Controllo avviso negozio:', {
                      endDate,
                      endDateType: typeof endDate,
                      shopDaysOff,
                      shopDaysOffLength: shopDaysOff?.length
                    });
                    
                    if (!endDate) {
                      console.log('[Checkout] endDate non definito');
                      return null;
                    }
                    
                    const endDateObj = endDate instanceof Date ? endDate : new Date(endDate);
                    console.log('[Checkout] endDateObj:', endDateObj, 'isValid:', !isNaN(endDateObj.getTime()));
                    
                    const isShopClosed = isDateWithEnabledBooking(endDateObj, shopDaysOff);
                    console.log('[Checkout] isShopClosed:', isShopClosed);
                    
                    if (!isShopClosed) {
                      console.log('[Checkout] Negozio non chiuso per questa data');
                      return null;
                    }
                    
                    console.log('[Checkout] MOSTRANDO AVVISO NEGOZIO CHIUSO');
                    return (
                      <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-sm text-amber-900 flex items-start gap-2">
                          <span className="text-lg">⚠️</span>
                          <span>
                            Il <strong>{format(endDateObj, "dd/MM/yyyy", { locale: it })}</strong> il negozio sarà chiuso, 
                            pertanto la riconsegna del prodotto avverrà il giorno successivo (<strong>{format(addDays(endDateObj, 1), "dd/MM/yyyy", { locale: it })}</strong>). 
                            Il prezzo verrà comunque calcolato sui giorni di prenotazione selezionati.
                          </span>
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Selezione Modalità di Ritiro */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-purple-600" />
                  Modalità di Ritiro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Scegli come preferisci ritirare l'attrezzatura:
                  </p>
                  
                  <div className="space-y-3">
                    {product.pickup_on_site && (
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          id="pickup"
                          name="deliveryMethod"
                          value="pickup"
                          checked={selectedDeliveryMethod === 'pickup'}
                          onChange={(e) => setSelectedDeliveryMethod(e.target.value as 'pickup' | 'delivery')}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                        />
                        <label htmlFor="pickup" className="text-sm font-medium text-gray-700 cursor-pointer">
                          Ritiro in sede
                        </label>
                      </div>
                    )}
                    
                    {product.delivery && (
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          id="delivery"
                          name="deliveryMethod"
                          value="delivery"
                          checked={selectedDeliveryMethod === 'delivery'}
                          onChange={(e) => setSelectedDeliveryMethod(e.target.value as 'pickup' | 'delivery')}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                        />
                        <label htmlFor="delivery" className="text-sm font-medium text-gray-700 cursor-pointer">
                          Consegna a domicilio
                        </label>
                      </div>
                    )}
                  </div>
                  
                  {selectedDeliveryMethod && (
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-sm text-purple-800">
                        <strong>Modalità selezionata:</strong> {getDeliveryText()}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>


            {/* Messaggio per consegna a domicilio */}
            {selectedDeliveryMethod === 'delivery' && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-green-600" />
                    Consegna a Domicilio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-800 mb-2">
                      <strong>Perfetto!</strong> Hai scelto la consegna a domicilio.
                    </p>
                    <p className="text-sm text-green-700">
                      Il negozio ti contatterà per definire i dettagli della consegna, 
                      inclusi orari e indirizzo di consegna e ritiro.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Informazione per prenotazioni orarie */}
            {isSameDayBooking && startTime && endTime && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-green-600" />
                    Orari Prenotazione Oraria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Per prenotazioni orarie, gli orari di ritiro e riconsegna corrispondono agli orari selezionati:
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-green-800">Orario Ritiro</p>
                        <p className="text-lg font-semibold text-green-900">{startTime}</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-green-800">Orario Riconsegna</p>
                        <p className="text-lg font-semibold text-green-900">{endTime}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Colonna destra: Riepilogo Prodotto e Costi */}
          <div className="lg:col-span-1 space-y-6">
            {/* Riepilogo Prodotto */}
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Riepilogo Prodotto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                      <img 
                        src={product.images?.[0] || DEFAULT_IMAGES.PRODUCT} 
                        alt={product.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_IMAGES.PRODUCT;
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold mb-2">{product.title}</h2>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Data inizio:</span>
                        <span className="font-medium">{startDate ? format(startDate, "dd MMM yyyy", { locale: it }) : "Non specificata"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Data fine:</span>
                        <span className="font-medium">{endDate ? format(endDate, "dd MMM yyyy", { locale: it }) : "Non specificata"}</span>
                      </div>
                      {isSameDayBooking && startTime && endTime && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Orario inizio:</span>
                            <span className="font-medium">{startTime}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Orario fine:</span>
                            <span className="font-medium">{endTime}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Riepilogo Costi */}
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Riepilogo Costi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Breakdown prezzi */}
                <div className="space-y-2">
                  {rentalHours > 0 && isSameDayBooking ? (
                    <div className="flex justify-between text-sm">
                      <span>€{pricingBreakdown.hourlyPrice} x {rentalHours} {rentalHours === 1 ? 'ora' : 'ore'}</span>
                      <span>€{pricingBreakdown.originalPrice.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span>€{pricingBreakdown.dailyPrice} x {rentalDays} {rentalDays === 1 ? 'giorno' : 'giorni'}</span>
                      <span>€{pricingBreakdown.originalPrice.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {pricingBreakdown.discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 font-medium">
                      <span>Sconto {pricingBreakdown.appliedDiscount === 'weekly' ? 'settimanale' : 'mensile'}</span>
                      <span>-€{pricingBreakdown.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Totale</span>
                    <span>€{pricingBreakdown.totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                

                {/* Pulsante conferma */}
                <Button 
                  onClick={handleConfirmBooking}
                  disabled={
                    authLoading || 
                    adminLoading ||
                    isCreatingBooking || 
                    !selectedDeliveryMethod || 
                    (isAdmin && !selectedCustomer)
                  }
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white py-3 text-lg font-semibold"
                >
                  {authLoading || adminLoading ? 'Caricamento...' : isCreatingBooking ? 'Aggiunta al carrello...' : user ? 'Prenota' : 'Accedi per prenotare'}
                </Button>

                {/* Informazioni cauzione sotto il pulsante */}
                {product.deposit && Number(product.deposit) > 0 ? (
                  <div className="bg-blue-50 p-3 rounded-lg mt-4">
                    <p className="text-sm text-blue-800">
                      <span>ℹ️ Cauzione richiesta: €{product.deposit}</span>
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Verrà richiesta una cauzione di €{product.deposit}. La cauzione verrà restituita al termine del periodo di noleggio.
                    </p>
                  </div>
                ) : (
                  <div className="bg-green-50 p-3 rounded-lg mt-4">
                    <p className="text-sm text-green-800">
                      <span>ℹ️ Nessuna cauzione richiesta</span>
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Per questo prodotto non è prevista alcuna cauzione.
                    </p>
                  </div>
                )}

                {!user && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Attenzione:</strong> Per completare la prenotazione devi accedere al tuo account.
                    </p>
                  </div>
                )}

                {isAdmin && !selectedCustomer && (
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <p className="text-sm text-purple-800">
                      <strong>Attenzione:</strong> Come amministratore, devi selezionare un cliente per la prenotazione.
                    </p>
                  </div>
                )}
                
                <p className="text-xs text-gray-500 text-center">
                  Cliccando su "Prenota" aggiungi la prenotazione al carrello
                </p>
              </CardContent>
            </Card>
            </div>
          </div>
        )}
      </div>

      {/* Auth Dialog */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-blue-600" />
              Accedi per continuare
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Per completare la prenotazione devi accedere al tuo account o registrarti.
            </p>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => {
                  setAuthDialogOpen(false);
                  navigate('/auth?mode=login');
                }}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Accedi
              </Button>
              <Button 
                onClick={() => {
                  setAuthDialogOpen(false);
                  navigate('/auth?mode=register');
                }}
                variant="outline"
                className="w-full"
              >
                Registrati
              </Button>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Cliccando su uno dei pulsanti verrai reindirizzato alla pagina di autenticazione
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <CreateCustomerDialog
        open={isCreateCustomerDialogOpen}
        onOpenChange={setIsCreateCustomerDialogOpen}
        onCustomerCreated={handleCustomerCreated}
      />

      <Footer />
    </div>
  );
};

export default Checkout; 