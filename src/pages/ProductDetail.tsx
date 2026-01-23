
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import { ArrowLeft, ImageIcon, MapPin, Truck, ChevronLeft, ChevronRight } from "lucide-react";
import RentalQuoteCard from "@/components/RentalQuoteCard";
import { useState, useEffect, useMemo } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious } from "@/components/ui/carousel";
import { useProduct } from "@/hooks/useProducts";
import { useProductCategories } from '@/hooks/useProductCategories';
import { DEFAULT_IMAGES } from "@/constants";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Controlla se c'è un pendingCartItem con date da ripristinare
  const [pendingDates, setPendingDates] = useState<{ startDate?: Date; endDate?: Date; variantId?: string } | null>(null);
  
  useEffect(() => {
    // Controlla se c'è un pendingCartItem per questo prodotto
    const pendingCartItem = localStorage.getItem('pendingCartItem');
    if (pendingCartItem && id) {
      try {
        const cartData = JSON.parse(pendingCartItem);
        // Se il pendingCartItem è per questo prodotto e la pagina corrisponde al returnUrl
        if (cartData.productId === id && cartData.startDate && cartData.endDate) {
          const startDate = new Date(cartData.startDate);
          const endDate = new Date(cartData.endDate);
          
          // Verifica che le date siano valide
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            setPendingDates({
              startDate,
              endDate,
              variantId: cartData.variantId
            });
            
            // Aggiorna i parametri URL con le date
            const newParams = new URLSearchParams(searchParams);
            newParams.set('startDate', cartData.startDate);
            newParams.set('endDate', cartData.endDate);
            if (cartData.variantId) {
              newParams.set('variantId', cartData.variantId);
            }
            if (cartData.startTime) {
              newParams.set('startTime', cartData.startTime);
            }
            if (cartData.endTime) {
              newParams.set('endTime', cartData.endTime);
            }
            setSearchParams(newParams, { replace: true });
            
            // Rimuovi il pendingCartItem dopo aver ripristinato le date
            // Le date sono ora nei parametri URL, quindi non serve più il pendingCartItem
            localStorage.removeItem('pendingCartItem');
            
            console.log('[ProductDetail] Date ripristinate dal pendingCartItem:', { startDate, endDate, variantId: cartData.variantId });
          }
        }
      } catch (error) {
        console.error('[ProductDetail] Errore nel parsing del pendingCartItem:', error);
        // Rimuovi il pendingCartItem se c'è un errore nel parsing
        localStorage.removeItem('pendingCartItem');
      }
    }
  }, [id, searchParams, setSearchParams]);

  const urlStartDate = searchParams.get("startDate");
  const urlEndDate = searchParams.get("endDate");
  const urlVariantId = searchParams.get("variantId");
  
  // Usa le date dai parametri URL o dal pendingCartItem
  const initialStartDate = urlStartDate ? new Date(urlStartDate) : (pendingDates?.startDate);
  const initialEndDate = urlEndDate ? new Date(urlEndDate) : (pendingDates?.endDate);
  // Usa la variantId dai parametri URL o dal pendingCartItem
  const initialVariantId = urlVariantId || pendingDates?.variantId;

  const { product, isLoading, error } = useProduct(id || "");

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [productUnitCondition, setProductUnitCondition] = useState<string | null>(null);
  
  // Carica attributi informativi del prodotto
  const { data: informativeAttributes } = useQuery({
    queryKey: ['product_informative_attributes', product?.id],
    queryFn: async () => {
      if (!product?.id) return [];
      
      const { data, error } = await supabase
        .from('product_informative_attribute_values')
        .select(`
          id_product_attribute_value,
          product_attributes_values!inner(
            id_product_attribute,
            value,
            product_attributes!inner(
              id,
              name,
              unit
            )
          )
        `)
        .eq('id_product', product.id);
      
      if (error) {
        console.error('Errore nel caricamento attributi informativi:', error);
        return [];
      }
      
      return (data || []).map((item: any) => ({
        attributeId: item.product_attributes_values.product_attributes.id,
        attributeName: item.product_attributes_values.product_attributes.name,
        attributeUnit: item.product_attributes_values.product_attributes.unit,
        value: item.product_attributes_values.value,
      }));
    },
    enabled: !!product?.id,
  });
  
  // Carica condizioni unità prodotto
  useEffect(() => {
    const loadProductUnitCondition = async () => {
      if (!id || !product) return;
      
      // Prova a ottenere la condizione dalla prima unità disponibile del prodotto
      // Se il prodotto ha varianti, cerca in tutte le varianti
      if (product.has_variants) {
        // Carica tutte le varianti attive
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id')
          .eq('id_product', product.id)
          .eq('is_active', true)
          .limit(10);
        
        if (variants && variants.length > 0) {
          for (const variant of variants) {
            const { data: variantUnits } = await supabase
              .from('product_units')
              .select(`
                id_product_condition,
                product_unit_conditions:product_unit_conditions(id, name)
              `)
              .eq('id_product_variant', variant.id)
              .limit(1);
            
            if (variantUnits && variantUnits.length > 0 && variantUnits[0].product_unit_conditions) {
              setProductUnitCondition((variantUnits[0].product_unit_conditions as any).name);
              break;
            }
          }
        }
      } else {
        // Prodotto senza varianti - cerca qualsiasi unità del prodotto
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id')
          .eq('id_product', product.id)
          .limit(1);
        
        if (variants && variants.length > 0) {
          const { data: units } = await supabase
            .from('product_units')
            .select(`
              id_product_condition,
              product_unit_conditions:product_unit_conditions(id, name)
            `)
            .eq('id_product_variant', variants[0].id)
            .limit(1);
          
          if (units && units.length > 0 && units[0].product_unit_conditions) {
            setProductUnitCondition((units[0].product_unit_conditions as any).name);
          }
        }
      }
    };
    
    if (id && product) {
      loadProductUnitCondition();
    }
  }, [id, product]);

  // Navigation functions for images
  const goToPreviousImage = () => {
    const images = product?.images || [];
    if (images.length > 0) {
      setSelectedImageIndex((prev) => 
        prev === 0 ? images.length - 1 : prev - 1
      );
    }
  };

  const goToNextImage = () => {
    const images = product?.images || [];
    if (images.length > 0) {
      setSelectedImageIndex((prev) => 
        prev === images.length - 1 ? 0 : prev + 1
      );
    }
  };

  // Keyboard navigation support
  useEffect(() => {
    const images = product?.images || [];
    const handleKeyDown = (event: KeyboardEvent) => {
      if (images.length > 1) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          goToPreviousImage();
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          goToNextImage();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [product?.images]);

  // Utility functions
  const getImageSrc = (imageUrl: string | null) => {
    if (!imageUrl) {
      return DEFAULT_IMAGES.PRODUCT;
    }
    return imageUrl;
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = DEFAULT_IMAGES.PRODUCT;
  };


  const { data: categories } = useProductCategories();

  // Carica i periodi di prezzo attivi
  const { data: pricePeriods } = useQuery({
    queryKey: ['price_periods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_periods')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) {
        console.error('Errore nel caricamento periodi:', error);
        return [];
      }
      
      return data || [];
    },
  });

  // Carica le varianti attive per calcolare i prezzi minimi
  const { data: variants } = useQuery({
    queryKey: ['product_variants_prices', product?.id],
    queryFn: async () => {
      if (!product?.id) return [];
      const { data, error } = await supabase
        .from('product_variants')
        .select('id')
        .eq('id_product', product.id)
        .eq('is_active', true);
      
      if (error) {
        console.error('Errore nel caricamento varianti:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!product?.id && product?.has_variants === true,
  });

  // Carica i prezzi per prodotti con varianti
  const { data: variantPricesData } = useQuery({
    queryKey: ['product_variant_prices', product?.id, variants],
    queryFn: async () => {
      if (!product?.id || !product?.has_variants || !variants || variants.length === 0 || !pricePeriods) {
        return null;
      }

      const variantIds = variants.map((v: any) => v.id);
      const pricesByPeriod: { [periodCode: string]: number[] } = {};

      // Per ogni periodo, cerca il prezzo minimo tra tutte le varianti
      for (const period of pricePeriods) {
        const { data: periodPrices, error } = await supabase
          .from('product_variant_price_list')
          .select('price')
          .in('id_product_variant', variantIds)
          .eq('id_price_period', period.id);
        
        if (!error && periodPrices && periodPrices.length > 0) {
          const validPrices = periodPrices
            .map((p: any) => Number(p.price))
            .filter((price: number) => !isNaN(price) && price > 0);
          
          if (validPrices.length > 0) {
            const periodCode = (period as any).code || period.id;
            pricesByPeriod[periodCode] = validPrices;
          }
        }
      }

      return pricesByPeriod;
    },
    enabled: !!product?.id && !!product?.has_variants && !!variants && variants.length > 0 && !!pricePeriods,
  });

  // Carica i prezzi per prodotti senza varianti
  const { data: productPricesData } = useQuery({
    queryKey: ['product_prices', product?.id, pricePeriods],
    queryFn: async () => {
      if (!product?.id || product?.has_variants || !pricePeriods) {
        return null;
      }

      const pricesByPeriod: { [periodCode: string]: number } = {};

      // Per ogni periodo, cerca il prezzo del prodotto
      for (const period of pricePeriods) {
        const { data: periodPrice, error } = await supabase
          .from('product_price_list')
          .select('price')
          .eq('id_product', product.id)
          .eq('id_price_period', period.id)
          .maybeSingle();
        
        if (!error && periodPrice && periodPrice.price !== null) {
          const price = Number(periodPrice.price);
          if (!isNaN(price) && price > 0) {
            const periodCode = (period as any).code || period.id;
            pricesByPeriod[periodCode] = price;
          }
        }
      }

      return pricesByPeriod;
    },
    enabled: !!product?.id && !product?.has_variants && !!pricePeriods,
  });

  // Calcola i prezzi minimi dalle varianti o dal prodotto
  const variantPrices = useMemo(() => {
    if (!pricePeriods) return null;

    if (product?.has_variants && variantPricesData) {
      // Per prodotti con varianti: trova il minimo per ogni periodo
      const result: { [key: string]: number | null } = {};
      
      for (const period of pricePeriods) {
        const periodCode = (period as any).code || period.id;
        const prices = variantPricesData[periodCode];
        
        if (prices && prices.length > 0) {
          // Mappa i codici comuni ai nomi dei campi
          if (periodCode === 'hourly' || periodCode === 'hour') {
            result.hour = Math.min(...prices);
          } else if (periodCode === 'daily' || periodCode === 'day') {
            result.daily = Math.min(...prices);
          } else if (periodCode === 'weekly' || periodCode === 'week') {
            result.weekly = Math.min(...prices);
          } else if (periodCode === 'monthly' || periodCode === 'month') {
            result.monthly = Math.min(...prices);
          } else if (periodCode === 'seasonal' || periodCode === 'season') {
            result.season = Math.min(...prices);
          } else {
            // Usa il nome del periodo come chiave
            result[periodCode] = Math.min(...prices);
          }
        } else {
          if (periodCode === 'hourly' || periodCode === 'hour') {
            result.hour = null;
          } else if (periodCode === 'daily' || periodCode === 'day') {
            result.daily = null;
          } else if (periodCode === 'weekly' || periodCode === 'week') {
            result.weekly = null;
          } else if (periodCode === 'monthly' || periodCode === 'month') {
            result.monthly = null;
          } else if (periodCode === 'seasonal' || periodCode === 'season') {
            result.season = null;
          }
        }
      }
      
      return {
        hour: result.hour ?? null,
        daily: result.daily ?? null,
        weekly: result.weekly ?? null,
        monthly: result.monthly ?? null,
        season: result.season ?? null,
      };
    } else if (!product?.has_variants && productPricesData) {
      // Per prodotti senza varianti: usa i prezzi direttamente
      const result: { [key: string]: number | null } = {};
      
      for (const period of pricePeriods) {
        const periodCode = (period as any).code || period.id;
        const price = productPricesData[periodCode];
        
        if (price !== undefined && price !== null) {
          // Mappa i codici comuni ai nomi dei campi
          if (periodCode === 'hourly' || periodCode === 'hour') {
            result.hour = price;
          } else if (periodCode === 'daily' || periodCode === 'day') {
            result.daily = price;
          } else if (periodCode === 'weekly' || periodCode === 'week') {
            result.weekly = price;
          } else if (periodCode === 'monthly' || periodCode === 'month') {
            result.monthly = price;
          } else if (periodCode === 'seasonal' || periodCode === 'season') {
            result.season = price;
          }
        } else {
          if (periodCode === 'hourly' || periodCode === 'hour') {
            result.hour = null;
          } else if (periodCode === 'daily' || periodCode === 'day') {
            result.daily = null;
          } else if (periodCode === 'weekly' || periodCode === 'week') {
            result.weekly = null;
          } else if (periodCode === 'monthly' || periodCode === 'month') {
            result.monthly = null;
          } else if (periodCode === 'seasonal' || periodCode === 'season') {
            result.season = null;
          }
        }
      }
      
      return {
        hour: result.hour ?? null,
        daily: result.daily ?? null,
        weekly: result.weekly ?? null,
        monthly: result.monthly ?? null,
        season: result.season ?? null,
      };
    }

    return null;
  }, [product?.has_variants, variantPricesData, productPricesData, pricePeriods]);

  // Ottieni categoria e sottocategoria dal prodotto
  const productSubcategory = (product as any)?.product_subcategory;
  const categoryId = productSubcategory?.product_category_id;
  const subcategoryId = product?.id_product_subcategory;
  
  const categoryName = categoryId && categories?.find(cat => cat.id === categoryId)?.name || '-';
  const subcategoryName = productSubcategory?.name || '-';


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <FixedNavbar />

      <div className="flex-1 container mx-auto px-4 py-8 pt-20 md:pt-24 max-w-7xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 flex gap-2 items-center">
          <ArrowLeft className="h-4 w-4" /> Indietro
        </Button>
        
        {isLoading ? (
          <div className="text-center py-16 text-lg text-gray-500">Caricamento prodotto...</div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="text-red-600 text-lg mb-2">Errore durante il caricamento del prodotto</div>
            <div className="text-gray-500 text-sm">ID prodotto: {id}</div>
            <div className="text-gray-500 text-sm">Errore: {error.message}</div>
            <Button onClick={() => navigate('/products')} className="mt-4">
              Torna ai prodotti
            </Button>
          </div>
        ) : !product ? (
          <div className="text-center py-16">
            <div className="text-gray-500 text-lg mb-2">Prodotto non trovato</div>
            <div className="text-gray-400 text-sm mb-4">ID prodotto: {id}</div>
            <Button onClick={() => navigate('/products')} className="mt-4">
              Torna ai prodotti
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content - Left Side */}
            <div className="lg:col-span-2 space-y-6">
              {/* Images Section */}
              <div className="bg-white shadow rounded-lg p-6">
                {product?.images && Array.isArray(product.images) && product.images.length > 0 ? (
                  <div className="space-y-4">
                    {/* Main image with enhanced view */}
                    <div className="relative">
                      <img
                        src={getImageSrc(product.images[selectedImageIndex])}
                        alt={`${product.title} - ${selectedImageIndex + 1}`}
                        className="w-full max-h-[600px] min-h-[300px] object-contain rounded-lg shadow-lg hover:shadow-xl transition-shadow cursor-zoom-in bg-white"
                        onError={handleImageError}
                      />
                      
                      {/* Navigation arrows */}
                      {product.images.length > 1 && (
                        <>
                          {/* Left arrow */}
                          <button
                            onClick={goToPreviousImage}
                            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all duration-200 hover:scale-110 shadow-lg backdrop-blur-sm"
                            aria-label="Immagine precedente"
                          >
                            <ChevronLeft className="h-6 w-6" />
                          </button>
                          
                          {/* Right arrow */}
                          <button
                            onClick={goToNextImage}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all duration-200 hover:scale-110 shadow-lg backdrop-blur-sm"
                            aria-label="Immagine successiva"
                          >
                            <ChevronRight className="h-6 w-6" />
                          </button>
                        </>
                      )}
                      
                      {/* Enhanced image indicator */}
                      {product.images.length > 1 && (
                        <div className="absolute top-4 right-4 bg-black/80 text-white text-sm px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-sm">
                          <ImageIcon className="h-4 w-4" />
                          {selectedImageIndex + 1} / {product.images.length}
                        </div>
                      )}
                    </div>
                    
                    {/* Enhanced thumbnail gallery - Hidden on mobile */}
                    {product.images.length > 1 && (
                      <div className="relative hidden md:block">
                        <Carousel className="w-full">
                          <CarouselContent className="-ml-2">
                            {product.images.map((img: string, index: number) => (
                              <CarouselItem key={index} className="pl-2 md:basis-1/4 lg:basis-1/5">
                                <img
                                  src={getImageSrc(img)}
                                  alt={`${product.title} - thumbnail ${index + 1}`}
                                  className={`w-full h-24 object-cover rounded-lg cursor-pointer transition-all duration-200 ${
                                    selectedImageIndex === index 
                                      ? 'ring-3 ring-blue-500 ring-offset-2 shadow-lg scale-105' 
                                      : 'hover:opacity-80 hover:scale-102 hover:shadow-md'
                                  }`}
                                  onError={handleImageError}
                                  onClick={() => setSelectedImageIndex(index)}
                                />
                              </CarouselItem>
                            ))}
                          </CarouselContent>
                          <CarouselPrevious className="left-2" />
                        </Carousel>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={DEFAULT_IMAGES.PRODUCT}
                      alt={product.title}
                      className="w-full max-h-[600px] min-h-[300px] object-contain rounded-lg shadow-lg bg-white"
                    />
                    <div className="absolute inset-0 bg-black/10 rounded-lg flex items-center justify-center">
                      <div className="text-white bg-black/50 px-4 py-2 rounded">
                        Nessuna immagine disponibile
                      </div>
                    </div>
                  </div>
                )}

              </div>
              
              {/* Product Information */}
              <div className="bg-white shadow rounded-lg p-6">
                {/* Categorie in evidenza */}
                <div className="mb-6 flex flex-wrap items-center gap-4 justify-start">
                  <span className="text-sm font-bold px-3 py-1.5 rounded-full bg-green-100 text-green-800 border border-green-300 shadow">
                    {categoryName}
                  </span>
                  {subcategoryId && (
                    <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 shadow">
                      {subcategoryName}
                    </span>
                  )}
                </div>
                
                <h1 className="text-3xl font-bold mb-3">{product.title}</h1>

                {/* Dettagli e specifiche */}
                <div className="p-4 bg-gray-50 rounded-lg border mb-6">
                  <h3 className="text-lg font-semibold mb-3">Dettagli tecnici</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="font-medium text-gray-600">Marca:</span>
                      <div className="text-lg">{product.brand || "Non specificata"}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Modello:</span>
                      <div className="text-lg">{product.model || "Non specificato"}</div>
                    </div>
                    {productUnitCondition && (
                      <div>
                        <span className="font-medium text-gray-600">Condizione prodotto:</span>
                        <div className="text-lg">{productUnitCondition}</div>
                      </div>
                    )}
                    {/* Attributi informativi */}
                    {informativeAttributes && informativeAttributes.length > 0 && (
                      <>
                        {informativeAttributes.map((attr) => (
                          <div key={attr.attributeId}>
                            <span className="font-medium text-gray-600">{attr.attributeName}:</span>
                            <div className="text-lg">
                              {attr.value}
                              {attr.attributeUnit && (
                                <span className="text-sm text-gray-500 ml-1">{attr.attributeUnit}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                
                <div className="mb-6 text-gray-700 text-lg leading-relaxed">
                  {product.description}
                </div>
              </div>
              {/* Card Prezzi */}
              <div className="p-4 bg-white rounded-lg border mt-6">
                <h3 className="text-lg font-semibold mb-3">Prezzi</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {variantPrices ? (
                    // Mostra prezzi (da varianti o prodotto)
                    <>
                      {variantPrices.hour !== null && variantPrices.hour !== undefined && (
                        <div>
                          <span className="font-medium text-gray-600">Prezzo orario</span>
                          <div className="text-lg font-semibold" style={{ color: '#E31E24' }}>
                            {product?.has_variants ? 'Da ' : ''}€{variantPrices.hour.toFixed(2)}
                          </div>
                        </div>
                      )}
                      {variantPrices.daily !== null && variantPrices.daily !== undefined && (
                        <div>
                          <span className="font-medium text-gray-600">Prezzo giornaliero</span>
                          <div className="text-lg font-semibold" style={{ color: '#E31E24' }}>
                            {product?.has_variants ? 'Da ' : ''}€{variantPrices.daily.toFixed(2)}
                          </div>
                        </div>
                      )}
                      {variantPrices.weekly !== null && variantPrices.weekly !== undefined && (
                        <div>
                          <span className="font-medium text-gray-600">Prezzo settimanale</span>
                          <div className="text-lg font-semibold" style={{ color: '#E31E24' }}>
                            {product?.has_variants ? 'Da ' : ''}€{variantPrices.weekly.toFixed(2)}
                          </div>
                        </div>
                      )}
                      {variantPrices.monthly !== null && variantPrices.monthly !== undefined && (
                        <div>
                          <span className="font-medium text-gray-600">Prezzo mensile</span>
                          <div className="text-lg font-semibold" style={{ color: '#E31E24' }}>
                            {product?.has_variants ? 'Da ' : ''}€{variantPrices.monthly.toFixed(2)}
                          </div>
                        </div>
                      )}
                      {variantPrices.season !== null && variantPrices.season !== undefined && (
                        <div>
                          <span className="font-medium text-gray-600">Prezzo stagionale</span>
                          <div className="text-lg font-semibold" style={{ color: '#E31E24' }}>
                            {product?.has_variants ? 'Da ' : ''}€{variantPrices.season.toFixed(2)}
                          </div>
                        </div>
                      )}
                      {(!variantPrices.hour && !variantPrices.daily && !variantPrices.weekly && !variantPrices.monthly && !variantPrices.season) && (
                        <div className="col-span-full text-gray-500 italic">
                          Nessun prezzo disponibile per questo prodotto
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="col-span-full text-gray-500 italic">
                      Caricamento prezzi...
                    </div>
                  )}
                </div>
              </div>
              {/* Card Condizioni del noleggio */}
              <div className="bg-white shadow rounded-lg p-6 mt-6">
                <h3 className="text-lg font-semibold mb-3">Condizioni del noleggio</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <span className="font-medium text-gray-600 mb-2 block">Modalità di ritiro</span>
                    <div className="flex flex-col gap-2">
                      {product.pickup_on_site && (
                        <div className="flex items-center gap-2 text-gray-900 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                          <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0" />
                          <span className="font-medium">Ritiro in sede</span>
                        </div>
                      )}
                      {product.delivery && (
                        <div className="flex items-center gap-2 text-gray-900 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                          <Truck className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <span className="font-medium">Consegna</span>
                        </div>
                      )}
                      {!product.pickup_on_site && !product.delivery && (
                        <div className="text-gray-500 italic">Non specificato</div>
                      )}
                    </div>
                  </div>
                  {(product.min_rent_days !== null && product.min_rent_days !== undefined && product.min_rent_days > 0) && (
                    <div>
                      <span className="font-medium text-gray-600">Durata minima noleggio (giorni)</span>
                      <div className="text-gray-900">
                        {product.min_rent_days} {product.min_rent_days === 1 ? 'giorno' : 'giorni'}
                      </div>
                    </div>
                  )}
                  {(product.min_rent_hours !== null && product.min_rent_hours !== undefined && product.min_rent_hours > 0) && (
                    <div>
                      <span className="font-medium text-gray-600">Durata minima noleggio (ore)</span>
                      <div className="text-gray-900">
                        {product.min_rent_hours} {product.min_rent_hours === 1 ? 'ora' : 'ore'}
                      </div>
                    </div>
                  )}
                  {product && product.deposit !== null && product.deposit !== undefined && product.deposit > 0 && (
                    <div>
                      <span className="font-medium text-gray-600">Cauzione</span>
                      <div className="text-gray-900">
                        €{product.deposit}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quote Card - Right Side */}
            <div className="lg:col-span-1">
              <RentalQuoteCard 
                product={product} 
                initialStartDate={initialStartDate}
                initialEndDate={initialEndDate}
                initialVariantId={initialVariantId || undefined}
              />
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default ProductDetail;
