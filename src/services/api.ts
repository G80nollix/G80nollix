import { supabase } from '@/integrations/supabase/client';
import type { Product, ProductVariant, Booking, CreateBookingData, ProductFilters, ApiResponse, PaginatedResponse } from '@/types';
import { findPricePeriodId } from '@/lib/pricing';

/**
 * Calcola il prezzo minimo giornaliero dalle varianti di un prodotto
 * @param productId - ID del prodotto
 * @param variantIds - Array di ID delle varianti attive
 * @returns Il prezzo minimo giornaliero o null se non trovato
 */
async function calculateMinDailyPriceFromVariants(productId: string, variantIds: string[]): Promise<number | null> {
  if (!variantIds || variantIds.length === 0) {
    return null;
  }

  try {
    const dailyPeriodId = await findPricePeriodId(1); // Periodo per 1 giorno
    
    if (!dailyPeriodId) {
      return null;
    }

    // Cerca i prezzi giornalieri per tutte le varianti
    const { data: priceListData, error: priceListError } = await supabase
      .from('product_variant_price_list')
      .select('price, id_product_variant')
      .in('id_product_variant', variantIds)
      .eq('id_price_period', dailyPeriodId)
      .not('price', 'is', null);
    
    if (priceListError || !priceListData || priceListData.length === 0) {
      return null;
    }

    // Trova il prezzo minimo tra tutte le varianti
    const prices = priceListData
      .map((entry: any) => Number(entry.price))
      .filter((price: number) => !isNaN(price) && price > 0);
    
    if (prices.length === 0) {
      return null;
    }

    return Math.min(...prices);
  } catch (error) {
    console.error('Errore nel calcolo del prezzo minimo giornaliero:', error);
    return null;
  }
}

// Helper function per mappare i dati dal DB al tipo Product
function mapDbProductToProduct(dbProduct: any, variant?: any, brand?: any, model?: any): Product {
  const product: Product = {
    id: dbProduct.id,
    name: dbProduct.name || '',
    description: dbProduct.description || null,
    id_product_subcategory: dbProduct.id_product_subcategory || null,
    id_brand: dbProduct.id_brand || null,
    id_model: dbProduct.id_model || null,
    company_id: dbProduct.company_id || null,
    is_active: dbProduct.is_active ?? true,
    can_be_delivered: dbProduct.can_be_delivered ?? true,
    can_be_picked_up: dbProduct.can_be_picked_up ?? true,
    has_variants: dbProduct.has_variants ?? false,
    images: dbProduct.images || [],
    created_at: dbProduct.created_at || null,
    updated_at: dbProduct.updated_at || null,
    // NOTA: I prezzi non sono più nella tabella products,
    // vengono gestiti tramite product_price_list
    price_hour: null,
    price_daily: null,
    price_weekly: null,
    price_monthly: null,
    price_season: null,
    deposit: dbProduct.deposit ?? null,
    min_rent_days: dbProduct.min_rent_days ?? null,
    min_rent_hours: dbProduct.min_rent_hours ?? null,
  };

  // Aggiungi relazioni joinate
  if (brand) {
    product.product_brand = { id: brand.id, name: brand.name };
  }
  if (model) {
    product.product_model = { id: model.id, name: model.name };
  }
  if (variant) {
    product.variant = {
      id: variant.id,
      id_product: variant.id_product,
      is_active: variant.is_active ?? true,
      // NOTA: I prezzi non sono più nella tabella product_variants,
      // vengono gestiti tramite product_variant_price_list
      price_hour: null,
      price_daily: null,
      price_weekly: null,
      price_monthly: null,
      price_season: null,
      deposit: variant.deposit || null,
      images: variant.images || [],
      created_at: variant.created_at || null,
      updated_at: variant.updated_at || null,
    };
  }

  // Campi legacy per compatibilità UI
  product.title = product.name;
  product.brand = product.product_brand?.name || '';
  product.model = product.product_model?.name || '';
  // Usa images del prodotto se disponibile, altrimenti fallback a variant.images
  if (!product.images || product.images.length === 0) {
    product.images = product.variant?.images || [];
  }
  // Usa SOLO i prezzi dalla tabella products, NON dalle varianti
  product.price_daily = product.price_daily || null;
  product.price_weekly = product.price_weekly || null;
  product.price_hour = product.price_hour || null;
  product.price_month = product.price_monthly || null;
  // Deposit: usa SOLO quello del prodotto dalla tabella products
  product.deposit = dbProduct.deposit !== undefined && dbProduct.deposit !== null ? dbProduct.deposit : null;
  // Campi legacy per durata minima noleggio (dalla tabella products)
  (product as any).min_rent_duration_day = product.min_rent_days ?? null;
  (product as any).min_rent_duration_hours = product.min_rent_hours ?? null;
  product.status = product.is_active ? 'active' : 'paused';
  product.delivery = product.can_be_delivered;
  product.pickup_on_site = product.can_be_picked_up;

  return product;
}

// Product API Services
export class ProductService {
  static async getProducts(filters: ProductFilters, userId?: string): Promise<ApiResponse<Product[]>> {
    try {
      // Query base con join alle tabelle correlate
      // Usiamo LEFT JOIN per includere anche prodotti senza varianti
      let query: any = supabase
        .from('products')
        .select(`
          *,
          product_brand:id_brand(id, name),
          product_model:id_model(id, name),
          product_subcategory:id_product_subcategory(id, name, product_category_id),
          product_variants(
            id,
            id_product,
            is_active,
            deposit,
            images
          )
        `)
        .eq('is_active', true);

      // Filtri
      if (filters.equipmentName) {
        query = query.ilike('name', `%${filters.equipmentName}%`);
      }

      // Filtro categoria: recupera le sottocategorie della categoria e filtra i prodotti
      if (filters.selectedCategory && filters.selectedCategory !== '' && filters.selectedCategory !== 'all') {
        // Recupera tutte le sottocategorie che appartengono a questa categoria
        const { data: subcategories, error: subcategoriesError } = await supabase
          .from('product_subcategories')
          .select('id')
          .eq('product_category_id', filters.selectedCategory);
        
        if (subcategoriesError) {
          console.error('Errore nel recupero sottocategorie per categoria:', subcategoriesError);
        } else if (subcategories && subcategories.length > 0) {
          // Filtra i prodotti che hanno una sottocategoria nella lista
          const subcategoryIds = subcategories.map((sc: any) => sc.id);
          query = query.in('id_product_subcategory', subcategoryIds);
        } else {
          // Se non ci sono sottocategorie, non ci saranno prodotti da mostrare
          // Restituisci array vuoto
          return { data: [], error: null };
        }
      }

      if (filters.selectedSubcategory && filters.selectedSubcategory !== '' && filters.selectedSubcategory !== 'all') {
        query = query.eq('id_product_subcategory', filters.selectedSubcategory);
      }

      // Filtro attributi informativi
      if (filters.selectedAttributeValue && filters.selectedAttributeValue !== '' && filters.selectedAttributeValue !== 'all') {
        // Recupera i prodotti che hanno questo valore di attributo informativo
        const { data: productsWithAttribute, error: attributeError } = await supabase
          .from('product_informative_attribute_values')
          .select('id_product')
          .eq('id_product_attribute_value', filters.selectedAttributeValue);
        
        if (attributeError) {
          console.error('Errore nel recupero prodotti per attributo:', attributeError);
        } else if (productsWithAttribute && productsWithAttribute.length > 0) {
          // Filtra i prodotti che hanno questo attributo
          const productIds = productsWithAttribute.map((p: any) => p.id_product);
          query = query.in('id', productIds);
        } else {
          // Se non ci sono prodotti con questo attributo, restituisci array vuoto
          return { data: [], error: null };
        }
      }

      // Filtro prezzo - verrà applicato dopo il recupero dei dati
      // per gestire sia prodotti con varianti che senza
      const priceRange = filters.priceRange && Array.isArray(filters.priceRange) 
        ? filters.priceRange 
        : null;

      // Filtro delivery
      if (filters.deliveryType && filters.deliveryType !== '') {
        if (filters.deliveryType === 'Ritiro in sede') {
          query = query.eq('can_be_picked_up', true);
        } else if (filters.deliveryType === 'Consegna a domicilio') {
          query = query.eq('can_be_delivered', true);
        }
      }

      // Filtro brand - ora su product_brand (esclude prodotti senza marca)
      if (filters.brand && filters.brand !== '') {
        query = query
          .not('id_brand', 'is', null)
          .ilike('product_brand.name', `%${filters.brand}%`);
      }

      // Filtro model - ora su product_model (esclude prodotti senza modello)
      if (filters.model && filters.model !== '') {
        query = query
          .not('id_model', 'is', null)
          .ilike('product_model.name', `%${filters.model}%`);
      }

      // Filtro per disponibilità nelle date selezionate
      if (filters.startDate && filters.endDate) {
        const { toItalianISOString } = await import("@/lib/utils");
        const startDateStr = toItalianISOString(filters.startDate);
        const endDateStr = toItalianISOString(filters.endDate);
        
        // Otteniamo tutti i prodotti che soddisfano i filtri base
        const { data: allProducts, error: productsError } = await query.order('created_at', { ascending: false });
        if (productsError) throw productsError;
        
        if (!allProducts || allProducts.length === 0) {
          return { data: [], error: null };
        }
        
        // Otteniamo tutti i product_id
        const productIds = allProducts.map((p: any) => p.id);
        
        // Otteniamo tutte le prenotazioni sovrapposte da booking_details
        // Contiamo quante unità sono prenotate per ogni prodotto nel periodo
        // Prima recuperiamo i booking_details sovrapposti con le informazioni sulle unità
        // Two periods overlap if: start_date <= endDate AND end_date >= startDate
        const { data: overlappingBookingDetails, error: bookingDetailsError } = await supabase
          .from('booking_details')
          .select(`
            unit_id, 
            booking_id, 
            start_date, 
            end_date,
            product_units!inner(
              id_product_variant,
              product_variants!inner(
                id_product
              )
            )
          `)
          .lte('start_date', endDateStr)
          .gte('end_date', startDateStr)
          .in('product_units.product_variants.id_product', productIds);
        
        if (bookingDetailsError) throw bookingDetailsError;
        
        // Recuperiamo gli ID delle prenotazioni per filtrare per status
        const bookingIds = [...new Set((overlappingBookingDetails || []).map((d: any) => d.booking_id))];
        
        // Recuperiamo le prenotazioni con status cart o confirmed
        const { data: activeBookings, error: bookingsError } = await supabase
          .from('bookings')
          .select('id, cart, user_id')
          .in('id', bookingIds)
          .in('status', ['cart', 'confirmed']);
        
        if (bookingsError) throw bookingsError;
        
        // Include confirmed bookings AND cart bookings from current user only
        // This ensures that units in the current user's cart are considered unavailable
        const activeBookingsFiltered = (activeBookings || []).filter((b: any) => {
          if (!b.cart) {
            // Include all confirmed bookings (from any user)
            return true;
          } else {
            // Include cart bookings only if they belong to the current user
            return b.user_id === userId;
          }
        });
        const activeBookingIds = new Set(activeBookingsFiltered.map((b: any) => b.id));
        
        // Filtra solo i booking_details con booking status attivi (inclusi cart di altri utenti)
        const activeBookingDetails = (overlappingBookingDetails || []).filter((detail: any) => {
          return activeBookingIds.has(detail.booking_id);
        });
        
        // Conta quante unità sono prenotate per ogni prodotto
        const bookedUnitsCount = new Map<string, number>();
        activeBookingDetails.forEach((detail: any) => {
          const productId = detail.product_units?.product_variants?.id_product;
          if (productId) {
            bookedUnitsCount.set(productId, (bookedUnitsCount.get(productId) || 0) + 1);
          }
        });
        
        // ID dello status "Noleggiabile"
        const rentableStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b';
        
        // Conta le unità effettive con status "Noleggiabile" per ogni prodotto e variante
        const productUnitsCount = new Map<string, number>();
        const variantUnitsCount = new Map<string, number>(); // Mappa variante -> conteggio unità noleggiabili
        
        // Raccogli tutti gli ID delle varianti attive
        const allVariantIds: string[] = [];
        const productsWithoutVariants: string[] = [];
        
        allProducts.forEach((product: any) => {
          if (product.has_variants === false) {
            // Prodotto senza varianti: aggiungi alla lista per query batch
            productsWithoutVariants.push(product.id);
          } else {
            const activeVariants = (product.product_variants || []).filter((v: any) => v.is_active === true);
            activeVariants.forEach((v: any) => {
              allVariantIds.push(v.id);
            });
          }
        });
        
        // Per prodotti senza varianti, recupera tutte le varianti in una singola query
        if (productsWithoutVariants.length > 0) {
          const { data: defaultVariants } = await supabase
            .from('product_variants')
            .select('id, id_product')
            .in('id_product', productsWithoutVariants);
          
          if (defaultVariants) {
            // Prendi solo una variante per prodotto (la prima)
            const variantMap = new Map<string, string>();
            defaultVariants.forEach((v: any) => {
              if (!variantMap.has(v.id_product)) {
                variantMap.set(v.id_product, v.id);
                allVariantIds.push(v.id);
              }
            });
          }
        }
        
        // Conta le unità con status "Noleggiabile" per ogni variante
        if (allVariantIds.length > 0) {
          const { data: productUnits, error: unitsError } = await supabase
            .from('product_units')
            .select('id, id_product_variant, product_variants!inner(id_product)')
            .in('id_product_variant', allVariantIds)
            .eq('id_product_status', rentableStatusId);
          
          if (!unitsError && productUnits) {
            // Raggruppa le unità per prodotto e per variante
            productUnits.forEach((unit: any) => {
              const productId = unit.product_variants?.id_product;
              const variantId = unit.id_product_variant;
              if (productId) {
                productUnitsCount.set(productId, (productUnitsCount.get(productId) || 0) + 1);
              }
              if (variantId) {
                variantUnitsCount.set(variantId, (variantUnitsCount.get(variantId) || 0) + 1);
              }
            });
          }
        }
        
        // Filtra i prodotti che hanno almeno un'unità disponibile
        const availableProducts = allProducts.filter((product: any) => {
          // Calcola lo stock totale del prodotto (unità con status "Noleggiabile")
          const totalStock = productUnitsCount.get(product.id) || 0;
          
          // Conta quante unità sono prenotate per questo prodotto
          const bookedUnits = bookedUnitsCount.get(product.id) || 0;
          
          // Il prodotto è disponibile se ci sono unità libere
          return (totalStock - bookedUnits) > 0;
        });
        
      // Filtra solo varianti attive con unità noleggiabili e gestisce prodotti senza varianti
      let productsWithDefaults = availableProducts
        .map((dbProduct: any) => {
          // Filtra solo varianti attive che hanno almeno un'unità in stato "Noleggiabile"
          const activeVariants = (dbProduct.product_variants || [])
            .filter((v: any) => v.is_active === true && (variantUnitsCount.get(v.id) || 0) > 0);
          // Prendi la prima variante attiva con unità noleggiabili, o null se non ce ne sono
          const variant = activeVariants.length > 0 ? activeVariants[0] : null;
          const brand = dbProduct.product_brand;
          const model = dbProduct.product_model;
          const product = mapDbProductToProduct(dbProduct, variant, brand, model);
          
          // Aggiungi sottocategoria se disponibile
          if (dbProduct.product_subcategory) {
            (product as any).product_subcategory = {
              id: dbProduct.product_subcategory.id,
              name: dbProduct.product_subcategory.name,
              product_category_id: dbProduct.product_subcategory.product_category_id
            };
          }
          return product;
        })
        // Filtra prodotti che hanno almeno una variante attiva con unità noleggiabili O che non gestiscono varianti (has_variants = false)
        .filter((product: Product) => {
          if (!product.has_variants) {
            // Prodotti senza gestione varianti: mostrati solo se hanno unità noleggiabili
            return productUnitsCount.get(product.id) !== undefined && (productUnitsCount.get(product.id) || 0) > 0;
          }
          // Prodotti con gestione varianti: mostrati solo se hanno almeno una variante attiva con unità noleggiabili
          return product.variant !== undefined && (variantUnitsCount.get(product.variant.id) || 0) > 0;
        });

        // Applica filtro prezzo se presente (considera sia prezzi prodotto che variante)
        if (priceRange) {
          const [minPrice, maxPrice] = priceRange;
          productsWithDefaults = productsWithDefaults.filter((product: Product) => {
            const productPrice = product.price_daily || 0;
            if (minPrice > 0 && productPrice < minPrice) return false;
            if (maxPrice > 0 && maxPrice < 999999 && productPrice > maxPrice) return false;
            return true;
          });
        }
        
        // Ordina: prodotti COMBO per primi (nome contiene "COMBO" case-insensitive)
        productsWithDefaults.sort((a: Product, b: Product) => {
          const aIsCombo = a.name?.toUpperCase().includes('COMBO') || false;
          const bIsCombo = b.name?.toUpperCase().includes('COMBO') || false;
          
          if (aIsCombo && !bIsCombo) return -1;
          if (!aIsCombo && bIsCombo) return 1;
          return 0; // Mantieni l'ordine originale per gli altri
        });
        
        return { data: productsWithDefaults, error: null };
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      if (!data || data.length === 0) {
        return { data: [], error: null };
      }

      // ID degli stati
      const rentableStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b'; // Noleggiabile
      const maintenanceStatusId = '2cab08fa-de9b-4abb-ad5f-d48be31da5e3'; // In manutenzione
      const nonRentableStatusId = '1c971f6d-5a0c-4d48-9f12-1f7eaa3ccf43'; // Non noleggiabile

      // Conta le unità con status "Noleggiabile" per ogni prodotto e variante
      const productUnitsCount = new Map<string, number>();
      const variantUnitsCount = new Map<string, number>(); // Mappa variante -> conteggio unità noleggiabili
      
      // Raccogli tutti gli ID delle varianti attive
      const allVariantIds: string[] = [];
      const productsWithoutVariants: string[] = [];
      
      for (const product of data) {
        if (product.has_variants === false) {
          // Prodotto senza varianti: aggiungi alla lista per query batch
          productsWithoutVariants.push(product.id);
        } else {
          const activeVariants = (product.product_variants || []).filter((v: any) => v.is_active === true);
          activeVariants.forEach((v: any) => {
            allVariantIds.push(v.id);
          });
        }
      }
      
      // Per prodotti senza varianti, recupera tutte le varianti in una singola query
      if (productsWithoutVariants.length > 0) {
        const { data: defaultVariants } = await supabase
          .from('product_variants')
          .select('id, id_product')
          .in('id_product', productsWithoutVariants);
        
        if (defaultVariants) {
          // Prendi solo una variante per prodotto (la prima)
          const variantMap = new Map<string, string>();
          defaultVariants.forEach((v: any) => {
            if (!variantMap.has(v.id_product)) {
              variantMap.set(v.id_product, v.id);
              allVariantIds.push(v.id);
            }
          });
        }
      }

      // Conta le unità con status "Noleggiabile" per ogni variante
      if (allVariantIds.length > 0) {
        const { data: productUnits, error: unitsError } = await supabase
          .from('product_units')
          .select('id, id_product_variant, product_variants!inner(id_product)')
          .in('id_product_variant', allVariantIds)
          .eq('id_product_status', rentableStatusId);
        
        if (!unitsError && productUnits) {
          // Raggruppa le unità per prodotto e per variante
          productUnits.forEach((unit: any) => {
            const productId = unit.product_variants?.id_product;
            const variantId = unit.id_product_variant;
            if (productId) {
              productUnitsCount.set(productId, (productUnitsCount.get(productId) || 0) + 1);
            }
            if (variantId) {
              variantUnitsCount.set(variantId, (variantUnitsCount.get(variantId) || 0) + 1);
            }
          });
        }
      }

      // Filtra i prodotti che hanno almeno un'unità con status "Noleggiabile"
      const productsWithRentableUnits = data.filter((product: any) => {
        const rentableUnitsCount = productUnitsCount.get(product.id) || 0;
        return rentableUnitsCount > 0;
      });

      // Filtra solo varianti attive con unità noleggiabili e gestisce prodotti senza varianti
      let productsWithDefaults = productsWithRentableUnits
        .map((dbProduct: any) => {
          // Filtra solo varianti attive che hanno almeno un'unità in stato "Noleggiabile"
          const activeVariants = (dbProduct.product_variants || [])
            .filter((v: any) => v.is_active === true && (variantUnitsCount.get(v.id) || 0) > 0);
          // Prendi la prima variante attiva con unità noleggiabili, o null se non ce ne sono
          const variant = activeVariants.length > 0 ? activeVariants[0] : null;
          const brand = dbProduct.product_brand;
          const model = dbProduct.product_model;
          const product = mapDbProductToProduct(dbProduct, variant, brand, model);
          
          // Aggiungi sottocategoria se disponibile
          if (dbProduct.product_subcategory) {
            (product as any).product_subcategory = {
              id: dbProduct.product_subcategory.id,
              name: dbProduct.product_subcategory.name,
              product_category_id: dbProduct.product_subcategory.product_category_id
            };
          }
          return product;
        })
        // Filtra prodotti che hanno almeno una variante attiva con unità noleggiabili O che non gestiscono varianti (has_variants = false)
        .filter((product: Product) => {
          if (!product.has_variants) {
            // Prodotti senza gestione varianti: mostrati solo se hanno unità noleggiabili
            return productUnitsCount.get(product.id) !== undefined && (productUnitsCount.get(product.id) || 0) > 0;
          }
          // Prodotti con gestione varianti: mostrati solo se hanno almeno una variante attiva con unità noleggiabili
          return product.variant !== undefined && (variantUnitsCount.get(product.variant.id) || 0) > 0;
        });

      // Applica filtro prezzo se presente (considera sia prezzi prodotto che variante)
      if (priceRange) {
        const [minPrice, maxPrice] = priceRange;
        productsWithDefaults = productsWithDefaults.filter((product: Product) => {
          const productPrice = product.price_daily || 0;
          if (minPrice > 0 && productPrice < minPrice) return false;
          if (maxPrice > 0 && maxPrice < 999999 && productPrice > maxPrice) return false;
          return true;
        });
      }
      
      // Ordina: prodotti COMBO per primi (nome contiene "COMBO" case-insensitive)
      productsWithDefaults.sort((a: Product, b: Product) => {
        const aIsCombo = a.name?.toUpperCase().includes('COMBO') || false;
        const bIsCombo = b.name?.toUpperCase().includes('COMBO') || false;
        
        if (aIsCombo && !bIsCombo) return -1;
        if (!aIsCombo && bIsCombo) return 1;
        return 0; // Mantieni l'ordine originale per gli altri
      });
      
      return { data: productsWithDefaults, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async getProduct(id: string): Promise<ApiResponse<Product>> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_brand:id_brand(id, name),
          product_model:id_model(id, name),
          product_subcategory:id_product_subcategory(id, name, product_category_id),
          product_variants(
            id,
            id_product,
            is_active,
            deposit,
            images
          )
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        const variant = data.product_variants?.[0];
        const brand = data.product_brand;
        const model = data.product_model;
        const subcategory = data.product_subcategory;
        const product = mapDbProductToProduct(data, variant, brand, model);
        
        // Se il prodotto ha varianti ma non ha un prezzo giornaliero sul prodotto stesso,
        // calcola il prezzo minimo giornaliero dalle varianti
        if (product.has_variants && (!product.price_daily || product.price_daily === 0) && data.product_variants && data.product_variants.length > 0) {
          const activeVariants = data.product_variants.filter((v: any) => v.is_active === true);
          if (activeVariants.length > 0) {
            const variantIds = activeVariants.map((v: any) => v.id);
            const minDailyPrice = await calculateMinDailyPriceFromVariants(id, variantIds);
            if (minDailyPrice !== null) {
              product.price_daily = minDailyPrice;
            }
          }
        }
        
        // Aggiungi sottocategoria se disponibile
        if (subcategory) {
          (product as any).product_subcategory = {
            id: subcategory.id,
            name: subcategory.name,
            product_category_id: subcategory.product_category_id
          };
        }
        return { data: product, error: null };
      }
      
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async getUserProducts(userId: string): Promise<ApiResponse<Product[]>> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_brand:id_brand(id, name),
          product_model:id_model(id, name),
          product_variants(
            id,
            id_product,
            is_active,
            deposit,
            images
          )
        `)
        .eq('company_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const productsWithDefaults = (data || []).map((dbProduct: any) => {
        const variant = dbProduct.product_variants?.[0];
        const brand = dbProduct.product_brand;
        const model = dbProduct.product_model;
        return mapDbProductToProduct(dbProduct, variant, brand, model);
      });
      
      return { data: productsWithDefaults, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Crea un nuovo prodotto
   */
  static async createProduct(productData: any): Promise<ApiResponse<Product>> {
    console.log('createProduct - productData ricevuto:', JSON.stringify(productData, null, 2));
    try {
      console.log('createProduct - Dati ricevuti:', JSON.stringify(productData, null, 2));
      
      // Prepara i dati per products
      const hasVariants = productData.has_variants ?? false;
      
      // Valida che il nome non sia vuoto
      const productName = (productData.name || productData.title || '').trim();
      if (!productName) {
        throw new Error('Il nome del prodotto è obbligatorio');
      }
      
      // Converte stringhe vuote in null per i campi UUID
      const cleanId = (id: any) => {
        if (!id || id === '' || id === 'undefined') return null;
        return id;
      };
      
      const productInsertData: any = {
        name: productName,
        description: productData.description || null,
        id_product_subcategory: cleanId(productData.id_product_subcategory || productData.product_subcategory_id),
        id_brand: cleanId(productData.id_brand),
        id_model: cleanId(productData.id_model),
        company_id: cleanId(productData.company_id),
        is_active: productData.is_active ?? (productData.status === 'active' ? true : false),
        can_be_delivered: productData.can_be_delivered ?? (productData.delivery ?? true),
        can_be_picked_up: productData.can_be_picked_up ?? (productData.pickup_on_site ?? true),
        has_variants: hasVariants,
        images: Array.isArray(productData.images) ? productData.images : [],
      };
      
      console.log('createProduct - productInsertData prima della conversione numerica:', JSON.stringify(productInsertData, null, 2));

      // Gestisci i campi numerici - converti undefined/null a null esplicito
      // NOTA: I prezzi (price_daily, price_hour, etc.) non sono più nella tabella products,
      // vengono salvati in product_price_list tramite pricePeriods
      if (productData.deposit !== undefined && productData.deposit !== null) {
        productInsertData.deposit = Number(productData.deposit);
      } else {
        productInsertData.deposit = null;
      }
      if (productData.min_rent_days !== undefined && productData.min_rent_days !== null) {
        productInsertData.min_rent_days = Number(productData.min_rent_days);
      } else {
        productInsertData.min_rent_days = null;
      }
      if (productData.min_rent_hours !== undefined && productData.min_rent_hours !== null) {
        productInsertData.min_rent_hours = Number(productData.min_rent_hours);
      } else {
        productInsertData.min_rent_hours = null;
      }

      console.log('createProduct - productInsertData finale:', JSON.stringify(productInsertData, null, 2));
      
      // Inserisci il prodotto
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert([productInsertData])
        .select()
        .single();

      if (productError) {
        console.error('Errore inserimento prodotto:', productError);
        console.error('Dettagli errore:', {
          message: productError.message,
          details: productError.details,
          hint: productError.hint,
          code: productError.code
        });
        throw productError;
      }
      
      console.log('createProduct - Prodotto creato con successo:', product);

      // Salva i prezzi in product_price_list se presenti
      if (productData.pricePeriods && Object.keys(productData.pricePeriods).length > 0) {
        console.log('createProduct - pricePeriods ricevuti:', productData.pricePeriods);
        const priceListEntries = Object.entries(productData.pricePeriods)
          .filter(([periodId, price]) => {
            // Filtra solo i periodi con prezzo valido
            const isValid = periodId && 
                           periodId !== '' && 
                           price !== null && 
                           price !== undefined && 
                           price !== '' &&
                           !isNaN(Number(price)) &&
                           Number(price) > 0;
            if (!isValid) {
              console.log(`Periodo ${periodId} saltato: prezzo non valido (${price})`);
            }
            return isValid;
          })
          .map(([periodId, price]) => {
            const priceValue = Number(price);
            console.log(`Aggiungendo prezzo: periodo ${periodId}, prezzo ${priceValue}`);
            return {
              id_product: product.id,
              id_price_period: periodId,
              price: priceValue,
            };
          });

        if (priceListEntries.length > 0) {
          console.log('createProduct - Inserimento prezzi in product_price_list:', priceListEntries);
          const { error: priceListError } = await supabase
            .from('product_price_list')
            .insert(priceListEntries);

          if (priceListError) {
            console.error('Errore inserimento prezzi in product_price_list:', priceListError);
            console.error('Dettagli errore prezzi:', {
              message: priceListError.message,
              details: priceListError.details,
              hint: priceListError.hint,
              code: priceListError.code
            });
            // Non blocchiamo la creazione del prodotto se fallisce l'inserimento dei prezzi
          } else {
            console.log('Prezzi salvati in product_price_list:', priceListEntries.length);
          }
        } else {
          console.log('createProduct - Nessun prezzo valido da inserire');
        }
      } else {
        console.log('createProduct - Nessun pricePeriods presente o vuoto');
      }

      // Salva gli attributi informativi se presenti
      if (productData.informativeAttributes && Object.keys(productData.informativeAttributes).length > 0) {
        const informativeAttributeValues = Object.entries(productData.informativeAttributes)
          .filter(([_, valueId]) => valueId && valueId !== '' && valueId !== 'N/A')
          .map(([_, valueId]) => ({
            id_product: product.id,
            id_product_attribute_value: valueId,
          }));

        if (informativeAttributeValues.length > 0) {
          const { error: informativeError } = await supabase
            .from('product_informative_attribute_values')
            .insert(informativeAttributeValues);

          if (informativeError) {
            console.error('Errore inserimento attributi informativi:', informativeError);
            // Non blocchiamo la creazione del prodotto se fallisce l'inserimento degli attributi
          }
        }
      }

      // Se has_variants è false, crea automaticamente una variante con i dati del prodotto
      // (perché un prodotto senza gestione varianti ha bisogno di una variante di default)
      if (!hasVariants) {
        console.log('createProduct - Creazione variante automatica (has_variants = false)');
        const variantData: any = {
          id_product: product.id,
          is_active: productData.is_active ?? true,
          images: Array.isArray(productData.images) ? productData.images : [],
        };

        // NOTA: I prezzi non sono più nella tabella product_variants,
        // vengono salvati in product_variant_price_list tramite pricePeriods
        variantData.deposit = productInsertData.deposit;

        console.log('createProduct - variantData:', JSON.stringify(variantData, null, 2));

        const { data: variant, error: variantError } = await supabase
          .from('product_variants')
          .insert([variantData])
          .select('id, id_product, is_active, deposit, images, created_at, updated_at')
          .single();

        if (variantError) {
          console.error('Errore nella creazione variante automatica:', variantError);
          console.error('Dettagli errore variante:', {
            message: variantError.message,
            details: variantError.details,
            hint: variantError.hint,
            code: variantError.code
          });
          throw variantError; // Blocchiamo se la variante fallisce quando has_variants è false
        }
        
        console.log('createProduct - Variante creata con successo:', variant);
        
        // Se has_variants è false, salva i prezzi anche in product_variant_price_list per la variante fittizia
        if (productData.pricePeriods && Object.keys(productData.pricePeriods).length > 0 && variant) {
          const variantPriceListEntries = Object.entries(productData.pricePeriods)
            .filter(([periodId, price]) => {
              const isValid = periodId && 
                             periodId !== '' && 
                             price !== null && 
                             price !== undefined && 
                             price !== '' &&
                             !isNaN(Number(price)) &&
                             Number(price) > 0;
              return isValid;
            })
            .map(([periodId, price]) => ({
              id_product_variant: variant.id,
              id_price_period: periodId,
              price: Number(price),
            }));

          if (variantPriceListEntries.length > 0) {
            console.log('createProduct - Inserimento prezzi in product_variant_price_list per variante fittizia:', variantPriceListEntries);
            const { error: variantPriceListError } = await supabase
              .from('product_variant_price_list')
              .insert(variantPriceListEntries);

            if (variantPriceListError) {
              console.error('Errore inserimento prezzi in product_variant_price_list per variante fittizia:', variantPriceListError);
              // Non blocchiamo la creazione del prodotto se fallisce l'inserimento dei prezzi
            } else {
              console.log('Prezzi salvati in product_variant_price_list per variante fittizia:', variantPriceListEntries.length);
            }
          }
        }
      }
      // Se has_variants è true, NON creiamo varianti automaticamente
      // L'utente le creerà manualmente dalla pagina di gestione varianti

      // Recupera il prodotto completo con join
      return await this.getProduct(product.id);
    } catch (error: any) {
      console.error('Errore creazione prodotto:', error);
      console.error('Dettagli errore completo:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        error: error
      });
      
      // Costruisci un messaggio di errore più dettagliato
      let errorMessage = 'Errore sconosciuto durante la creazione del prodotto';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (error?.hint) {
        errorMessage = error.hint;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      return { data: null, error: errorMessage };
    }
  }

  static async updateProduct(id: string, productData: Partial<Product> & { pricePeriods?: { [periodId: string]: number | null }; informativeAttributes?: { [attributeId: string]: string } }): Promise<ApiResponse<Product>> {
    try {
      // Recupera il prodotto corrente per verificare has_variants
      const { data: currentProduct, error: fetchError } = await supabase
        .from('products')
        .select('has_variants')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const hasVariants = productData.has_variants !== undefined 
        ? productData.has_variants 
        : (currentProduct?.has_variants ?? false);

      // Prepara i dati per products (include has_variants e price fields)
      const productUpdateData: any = {};
      if (productData.name !== undefined) productUpdateData.name = productData.name;
      if (productData.description !== undefined) productUpdateData.description = productData.description;
      if (productData.id_product_subcategory !== undefined) productUpdateData.id_product_subcategory = productData.id_product_subcategory;
      if (productData.id_brand !== undefined) productUpdateData.id_brand = productData.id_brand;
      if (productData.id_model !== undefined) productUpdateData.id_model = productData.id_model;
      if (productData.is_active !== undefined) productUpdateData.is_active = productData.is_active;
      if (productData.can_be_delivered !== undefined) productUpdateData.can_be_delivered = productData.can_be_delivered;
      if (productData.can_be_picked_up !== undefined) productUpdateData.can_be_picked_up = productData.can_be_picked_up;
      if (productData.has_variants !== undefined) productUpdateData.has_variants = productData.has_variants;
      
      // Gestisci i campi numerici - converti undefined/null a null esplicito
      // NOTA: I prezzi (price_daily, price_hour, etc.) non sono più nella tabella products,
      // vengono salvati in product_price_list tramite pricePeriods
      if (productData.deposit !== undefined) {
        productUpdateData.deposit = productData.deposit !== null ? Number(productData.deposit) : null;
      }
      if (productData.min_rent_days !== undefined) {
        productUpdateData.min_rent_days = productData.min_rent_days !== null ? Number(productData.min_rent_days) : null;
      }
      if (productData.min_rent_hours !== undefined) {
        productUpdateData.min_rent_hours = productData.min_rent_hours !== null ? Number(productData.min_rent_hours) : null;
      }
      if (productData.images !== undefined) productUpdateData.images = productData.images;

      // Aggiorna il prodotto se ci sono dati
      if (Object.keys(productUpdateData).length > 0) {
        const { error: productError } = await supabase
          .from('products')
          .update(productUpdateData)
          .eq('id', id);

        if (productError) throw productError;
      }

      // Gestisci i prezzi in product_price_list se presenti
      if (productData.pricePeriods !== undefined) {
        // Elimina i vecchi prezzi
        const { error: deleteError } = await supabase
          .from('product_price_list')
          .delete()
          .eq('id_product', id);

        if (deleteError) {
          console.error('Errore eliminazione prezzi esistenti:', deleteError);
        } else {
          // Inserisci i nuovi prezzi
          const priceListEntries = Object.entries(productData.pricePeriods)
            .filter(([periodId, price]) => {
              const isValid = periodId && 
                             periodId !== '' && 
                             price !== null && 
                             price !== undefined && 
                             price !== '' &&
                             !isNaN(Number(price)) &&
                             Number(price) > 0;
              return isValid;
            })
            .map(([periodId, price]) => ({
              id_product: id,
              id_price_period: periodId,
              price: Number(price),
            }));

          if (priceListEntries.length > 0) {
            const { error: priceListError } = await supabase
              .from('product_price_list')
              .insert(priceListEntries);

            if (priceListError) {
              console.error('Errore inserimento prezzi in product_price_list:', priceListError);
            } else {
              console.log('Prezzi aggiornati in product_price_list:', priceListEntries.length);
            }
          }
        }
        
        // Se has_variants è false, aggiorna anche i prezzi nella variante fittizia
        if (!hasVariants) {
          // Trova la variante fittizia (dovrebbe esserci solo una per prodotto senza varianti)
          const { data: variant, error: variantError } = await supabase
            .from('product_variants')
            .select('id')
            .eq('id_product', id)
            .maybeSingle();
          
          if (variantError) {
            console.error('Errore nel recupero variante fittizia:', variantError);
          } else if (variant) {
            // Elimina i vecchi prezzi della variante
            const { error: deleteVariantError } = await supabase
              .from('product_variant_price_list')
              .delete()
              .eq('id_product_variant', variant.id);
            
            if (deleteVariantError) {
              console.error('Errore eliminazione prezzi variante fittizia:', deleteVariantError);
            } else {
              // Inserisci i nuovi prezzi nella variante
              const variantPriceListEntries = Object.entries(productData.pricePeriods)
                .filter(([periodId, price]) => {
                  const isValid = periodId && 
                                 periodId !== '' && 
                                 price !== null && 
                                 price !== undefined && 
                                 price !== '' &&
                                 !isNaN(Number(price)) &&
                                 Number(price) > 0;
                  return isValid;
                })
                .map(([periodId, price]) => ({
                  id_product_variant: variant.id,
                  id_price_period: periodId,
                  price: Number(price),
                }));

              if (variantPriceListEntries.length > 0) {
                console.log('updateProduct - Inserimento prezzi in product_variant_price_list per variante fittizia:', variantPriceListEntries);
                const { error: variantPriceListError } = await supabase
                  .from('product_variant_price_list')
                  .insert(variantPriceListEntries);

                if (variantPriceListError) {
                  console.error('Errore inserimento prezzi in product_variant_price_list per variante fittizia:', variantPriceListError);
                } else {
                  console.log('Prezzi aggiornati in product_variant_price_list per variante fittizia:', variantPriceListEntries.length);
                }
              }
            }
          }
        }
      }

      // Gestisci attributi informativi se presenti
      if (productData.informativeAttributes !== undefined) {
        // Elimina gli attributi informativi esistenti
        const { error: deleteError } = await supabase
          .from('product_informative_attribute_values')
          .delete()
          .eq('id_product', id);

        if (deleteError) {
          console.error('Errore eliminazione attributi informativi esistenti:', deleteError);
        } else {
          // Inserisci i nuovi attributi informativi
          const informativeAttributeValues = Object.entries(productData.informativeAttributes)
            .filter(([_, valueId]) => valueId && valueId !== '' && valueId !== 'N/A')
            .map(([_, valueId]) => ({
              id_product: id,
              id_product_attribute_value: valueId,
            }));

          if (informativeAttributeValues.length > 0) {
            const { error: informativeError } = await supabase
              .from('product_informative_attribute_values')
              .insert(informativeAttributeValues);

            if (informativeError) {
              console.error('Errore inserimento attributi informativi:', informativeError);
            }
          }
        }
      }

      // Aggiorna i prezzi di TUTTE le varianti associate quando vengono modificati i prezzi del prodotto
      // NOTA: I prezzi ora sono gestiti tramite pricePeriods in product_price_list
      const hasPriceChanges = productData.pricePeriods !== undefined ||
                              productData.deposit !== undefined ||
                              productData.images !== undefined;

      if (hasPriceChanges) {
        // Trova tutte le varianti associate al prodotto
        const { data: variants, error: variantsError } = await supabase
          .from('product_variants')
          .select('id')
          .eq('id_product', id);

        if (variantsError) {
          console.error('Errore nel recupero varianti:', variantsError);
        } else if (variants && variants.length > 0) {
          const variantUpdateData: any = {};

          // Aggiorna i campi deposito se è stato modificato nel prodotto
          // NOTA: I prezzi ora sono gestiti tramite pricePeriods in product_variant_price_list
          if (productData.deposit !== undefined) {
            variantUpdateData.deposit = productUpdateData.deposit;
          }

          // Aggiorna anche immagini se modificate
          if (productData.images !== undefined) {
            variantUpdateData.images = productUpdateData.images;
          }

          // Aggiorna tutte le varianti se ci sono dati da aggiornare
          if (Object.keys(variantUpdateData).length > 0) {
            const variantIds = variants.map(v => v.id);
            const { error: variantError } = await supabase
              .from('product_variants')
              .update(variantUpdateData)
              .in('id', variantIds);

            if (variantError) {
              console.error('Errore nell\'aggiornamento varianti:', variantError);
              // Non blocchiamo l'aggiornamento del prodotto se le varianti falliscono
            } else {
              console.log(`Aggiornate ${variants.length} varianti con successo`);
            }
          }
        }
      }

      // Recupera il prodotto aggiornato
      return await this.getProduct(id);
    } catch (error: any) {
      console.error('Errore aggiornamento prodotto:', error);
      const errorMessage = error?.message || error?.details || error?.hint || 'Errore sconosciuto durante l\'aggiornamento del prodotto';
      return { data: null, error: errorMessage };
    }
  }

  static async deleteProduct(id: string): Promise<ApiResponse<void>> {
    try {
      // Le varianti verranno eliminate automaticamente per CASCADE
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Booking API Services
export class BookingService {
  static async getBookings(productId?: string): Promise<ApiResponse<Booking[]>> {
    try {
      let query = supabase
        .from('bookings')
        .select('id, user_id, price_total, delivery_method, delivery_address, status, created_at, updated_at, rifPrenotazione, cart')
        .in('status', ['cart', 'confirmed']);

      // Note: product_id no longer exists in bookings table
      // If filtering by product is needed, use the chain: product → variants → units → booking_details → bookings
      // For now, if productId is provided, we return all bookings (product filtering removed)
      // TODO: Implement proper product filtering if needed

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const bookings = (data || []).map(booking => ({
        ...booking,
        delivery_method: booking.delivery_method as 'pickup' | 'delivery',
        status: booking.status as 'cart' | 'confirmed' | 'cancelled' | 'completed' | 'inPayment'
      }));

      return { data: bookings, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async getUserBookings(userId: string): Promise<ApiResponse<Booking[]>> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, user_id, price_total, delivery_method, delivery_address, status, created_at, updated_at, rifPrenotazione, cart')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const bookings = (data || []).map(booking => ({
        ...booking,
        delivery_method: booking.delivery_method as 'pickup' | 'delivery',
        status: booking.status as 'cart' | 'confirmed' | 'cancelled' | 'completed' | 'inPayment'
      }));

      return { data: bookings, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async createBooking(bookingData: CreateBookingData): Promise<ApiResponse<Booking>> {
    try {
      // Remove fields that don't exist in bookings table anymore
      // They should be inserted in booking_details instead
      const { 
        start_date, 
        end_date,
        product_id, // product_id doesn't exist in bookings anymore, it's in booking_details as unit_id
        price_daily,
        price_weekly,
        price_hour,
        price_month,
        deposito,
        ...bookingDataForBookings 
      } = bookingData;
      
      const { data, error } = await supabase
        .from('bookings')
        .insert(bookingDataForBookings)
        .select('id, user_id, price_total, delivery_method, delivery_address, status, created_at, updated_at, rifPrenotazione, cart')
        .maybeSingle();

      if (error) throw error;

      const booking = {
        ...data,
        delivery_method: data.delivery_method as 'pickup' | 'delivery',
        status: data.status as 'cart' | 'confirmed' | 'cancelled' | 'completed' | 'inPayment'
      };

      return { data: booking, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async createEmptyCartBooking(userId: string): Promise<ApiResponse<Booking>> {
    try {
      // Create a minimal booking for an empty cart
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: userId,
          price_total: 0, // Empty cart has 0 total
          delivery_method: 'pickup', // Default, can be changed later
          delivery_address: null,
          status: 'cart',
          cart: true,
        })
        .select('id, user_id, price_total, delivery_method, delivery_address, status, created_at, updated_at, rifPrenotazione, cart')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error('Failed to create empty cart booking');
      }

      const booking = {
        ...data,
        delivery_method: data.delivery_method as 'pickup' | 'delivery',
        status: data.status as 'cart' | 'confirmed' | 'cancelled' | 'completed' | 'inPayment'
      };

      return { data: booking, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async updateBooking(id: string, bookingData: Partial<Omit<Booking, 'id' | 'created_at' | 'updated_at'>>): Promise<ApiResponse<Booking>> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update({ ...bookingData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;

      const booking = {
        ...data,
        delivery_method: data.delivery_method as 'pickup' | 'delivery',
        status: data.status as 'cart' | 'confirmed' | 'cancelled' | 'completed' | 'inPayment'
      };

      return { data: booking, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async cancelBooking(id: string): Promise<ApiResponse<Booking>> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;

      const booking = {
        ...data,
        delivery_method: data.delivery_method as 'pickup' | 'delivery',
        status: data.status as 'cart' | 'confirmed' | 'cancelled' | 'completed' | 'inPayment'
      };

      return { data: booking, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// User API Services
export class UserService {
  static async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return { data: user, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async signUp(userData: any): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            user_type: userData.userType,
            first_name: userData.firstName,
            last_name: userData.lastName,
            phone: userData.phone,
            birth_date: userData.birthDate,
            address: userData.address,
            city: userData.city,
            postal_code: userData.postalCode,
            province: userData.province,
            tax_code: userData.taxCode,
            company_name: userData.companyName,
            vat_number: userData.vatNumber,
            company_address: userData.companyAddress,
            company_city: userData.companyCity,
            company_postal_code: userData.companyPostalCode,
            company_province: userData.companyProvince,
            legal_representative: userData.legalRepresentative,
            business_sector: userData.businessSector,
            company_description: userData.companyDescription,
            website: userData.website,
            registration_number: userData.registrationNumber,
          },
          emailRedirectTo: `${window.location.origin}/`,
        }
      });

      if (error) throw error;

      if (userData.firstName || userData.lastName || userData.phone || userData.birthDate) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (existingProfile) {
            const profileUpdateData: any = {};
            if (userData.firstName) profileUpdateData.first_name = userData.firstName;
            if (userData.lastName) profileUpdateData.last_name = userData.lastName;
            if (userData.phone) profileUpdateData.phone = userData.phone;
            if (userData.birthDate) profileUpdateData.birth_date = userData.birthDate;
            if (userData.userType) profileUpdateData.user_type = userData.userType;

            if (Object.keys(profileUpdateData).length > 0) {
              await supabase
                .from('profiles')
                .update(profileUpdateData)
                .eq('id', user.id);
            }
          }
        }
      }

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async signIn(email: string, password: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async signOut(): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async updateProfile(userData: any): Promise<ApiResponse<void>> {
    try {
      // Prepara i dati per l'aggiornamento
      const updateData: any = {
        data: {
          user_type: userData.userType,
          first_name: userData.firstName,
          last_name: userData.lastName,
          phone: userData.phone,
          birth_date: userData.birthDate,
        }
      };

      // Se l'email è stata modificata, aggiungila all'aggiornamento
      if (userData.email !== undefined) {
        updateData.email = userData.email;
      }

      const { error: authError } = await supabase.auth.updateUser(updateData);

      if (authError) throw authError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      const profileUpdateData: any = {
        updated_at: new Date().toISOString()
      };

      // Aggiorna l'email nel profilo se è stata modificata
      if (userData.email !== undefined) {
        profileUpdateData.email = userData.email;
      }
      if (userData.firstName !== undefined) profileUpdateData.first_name = userData.firstName;
      if (userData.lastName !== undefined) profileUpdateData.last_name = userData.lastName;
      if (userData.phone !== undefined) profileUpdateData.phone = userData.phone;
      if (userData.birthDate !== undefined) profileUpdateData.birth_date = userData.birthDate;
      if (userData.userType !== undefined) profileUpdateData.user_type = userData.userType;

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdateData)
        .eq('id', user.id);

      if (profileError) throw profileError;

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async updatePassword(newPassword: string): Promise<ApiResponse<void>> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw new Error(`Errore nell'autenticazione: ${userError.message}`);
      }
      
      if (!user) {
        throw new Error("Utente non autenticato. Effettua nuovamente l'accesso.");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Password update error:', error);
        throw error;
      }

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Ottieni tutte le categorie prodotto
export async function fetchProductCategories() {
  const { data, error } = await supabase.from('product_categories').select('*').order('name');
  if (error) throw error;
  return data;
}

// Ottieni tutte le sottocategorie per una categoria
export async function fetchProductSubcategories(productCategoryId: string) {
  const { data, error } = await supabase
    .from('product_subcategories')
    .select('*')
    .eq('product_category_id', productCategoryId)
    .order('name');
  if (error) throw error;
  return data;
}

// Ottieni il prezzo massimo giornaliero disponibile
// I prezzi sono ora gestiti tramite product_variant_price_list con id_price_period
// Cerca il prezzo massimo nella tabella product_variant_price_list
export async function getMaxDailyPrice() {
  try {
    // Prima trova il periodo "daily" (giornaliero)
    const { data: dailyPeriod, error: periodError } = await supabase
      .from('price_periods')
      .select('id')
      .eq('code', 'daily')
      .eq('is_active', true)
      .maybeSingle();
    
    if (periodError) throw periodError;
    
    if (!dailyPeriod) {
      // Se non esiste il periodo daily, restituisci un valore di default
      return 1000;
    }
    
    // Cerca il prezzo massimo in product_variant_price_list per il periodo daily
    const { data: variantPrices, error: variantError } = await supabase
      .from('product_variant_price_list')
      .select('price')
      .eq('id_price_period', dailyPeriod.id)
      .order('price', { ascending: false })
      .limit(1);
    
    if (variantError) throw variantError;
    
    if (variantPrices && variantPrices.length > 0) {
      return variantPrices[0].price;
    }
    
    // Se non ci sono prezzi nelle varianti, cerca in product_price_list
    const { data: productPrices, error: productError } = await supabase
      .from('product_price_list')
      .select('price')
      .eq('id_price_period', dailyPeriod.id)
      .order('price', { ascending: false })
      .limit(1);
    
    if (productError) throw productError;
    
    return productPrices && productPrices.length > 0 ? productPrices[0].price : 1000;
  } catch (error) {
    console.error('Errore nel recupero del prezzo massimo giornaliero:', error);
    return 1000; // Valore di default in caso di errore
  }
}

// Ottieni tutti i brand
export async function fetchProductBrands() {
  const { data, error } = await supabase
    .from('product_brand')
    .select('id, name')
    .order('name');
  if (error) throw error;
  return data || [];
}

// Ottieni tutti i modelli (opzionalmente filtrati per brand)
export async function fetchProductModels(brandId?: string) {
  let query = supabase
    .from('product_model')
    .select('id, name, id_brand')
    .order('name');
  
  if (brandId) {
    query = query.eq('id_brand', brandId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Crea un nuovo brand
export async function createProductBrand(name: string) {
  const { data, error } = await supabase
    .from('product_brand')
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Crea un nuovo modello
export async function createProductModel(name: string, brandId: string) {
  const { data, error } = await supabase
    .from('product_model')
    .insert({ name, id_brand: brandId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Ottieni tutti i valori di un attributo
export async function fetchAttributeValues(attributeId: string) {
  const { data, error } = await supabase
    .from('product_attributes_values')
    .select('id, value, id_product_attribute')
    .eq('id_product_attribute', attributeId)
    .order('value');
  if (error) throw error;
  return data || [];
}

// Crea un nuovo valore per un attributo
export async function createAttributeValue(value: string, attributeId: string) {
  const { data, error } = await supabase
    .from('product_attributes_values')
    .insert({ value, id_product_attribute: attributeId })
    .select()
    .single();
  if (error) throw error;
  return data;
}
