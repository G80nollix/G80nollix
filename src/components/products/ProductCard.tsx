import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageIcon, Package, Truck } from "lucide-react";
import type { ProductCardProps, Product } from "@/types";
import { DEFAULT_IMAGES, PRODUCT_STATUS } from "@/constants";
import { useProductCategories } from '@/hooks/useProductCategories';
import { useProductSubcategories } from '@/hooks/useProductSubcategories';
import { useProductConditions } from '@/hooks/useProductConditions';
import { useMemo } from 'react';
import { findPricePeriodId } from '@/lib/pricing';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const ProductCard = ({ product, onProductClick }: ProductCardProps) => {
  // Utility functions
  const getProductImage = (product: Product) => {
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      return product.images[0];
    }
    return DEFAULT_IMAGES.productThumbnail;
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = DEFAULT_IMAGES.productThumbnail;
  };

  const handleCardClick = () => {
    onProductClick(product.id);
  };



  const handleBookNowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onProductClick(product.id);
  };

  const { data: categories } = useProductCategories();
  const { data: conditions } = useProductConditions();

  // Ottieni categoria e sottocategoria dal prodotto
  const productSubcategory = (product as any)?.product_subcategory;
  const categoryId = productSubcategory?.product_category_id;
  const subcategoryId = product?.id_product_subcategory;
  
  const categoryName = categoryId && categories?.find(cat => cat.id === categoryId)?.name || '-';
  const subcategoryName = productSubcategory?.name || '-';
  const conditionName = conditions?.find(cond => cond.id === (product as any).product_condition_id)?.name || '-';

  // Cerca il prezzo giornaliero: 
  // - Se il prodotto ha varianti: cerca in product_variant_price_list (prezzo minimo tra tutte le varianti)
  // - Se il prodotto non ha varianti: cerca in product_price_list
  const { data: dailyPrice, isLoading: loadingPrice } = useQuery({
    queryKey: ['product-daily-price', product.id, product.has_variants],
    queryFn: async () => {
      try {
        const dailyPeriodId = await findPricePeriodId(1); // Periodo per 1 giorno
        
        if (!dailyPeriodId) {
          return null;
        }
        
        if (product.has_variants) {
          // Se ha varianti, cerca il prezzo minimo tra tutte le varianti attive
          const { data: variants, error: variantsError } = await supabase
            .from('product_variants')
            .select('id')
            .eq('id_product', product.id)
            .eq('is_active', true);
          
          if (variantsError || !variants || variants.length === 0) {
            return null;
          }
          
          const variantIds = variants.map(v => v.id);
          
          // Cerca tutti i prezzi delle varianti per il periodo daily
          const { data: variantPrices, error: priceError } = await supabase
            .from('product_variant_price_list')
            .select('price')
            .in('id_product_variant', variantIds)
            .eq('id_price_period', dailyPeriodId);
          
          if (priceError || !variantPrices || variantPrices.length === 0) {
            return null;
          }
          
          // Trova il prezzo minimo
          const prices = variantPrices
            .map(vp => Number(vp.price))
            .filter(price => !isNaN(price) && price > 0);
          
          if (prices.length === 0) {
            return null;
          }
          
          return Math.min(...prices);
        } else {
          // Se non ha varianti, cerca il prezzo direttamente dal prodotto
          const { data: priceData, error: priceError } = await supabase
            .from('product_price_list')
            .select('price')
            .eq('id_product', product.id)
            .eq('id_price_period', dailyPeriodId)
            .maybeSingle();
          
          if (priceError || !priceData || !priceData.price) {
            return null;
          }
          
          const price = Number(priceData.price);
          return isNaN(price) || price <= 0 ? null : price;
        }
      } catch (error) {
        console.error('Errore nel recupero del prezzo:', error);
        return null;
      }
    },
    enabled: !!product.id,
  });

  const priceRange = useMemo(() => {
    const price = dailyPrice;
    if (price && price > 0) {
      return { min: price, display: `da €${price.toFixed(2)}` };
    }
    
    return null;
  }, [dailyPrice]);
  
  const loadingVariants = loadingPrice;

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-all transform hover:scale-105 cursor-pointer h-full flex flex-col"
      onClick={handleCardClick}
    >
      {/* Image Section */}
      <div className="relative">
        <img
          src={getProductImage(product)}
          alt={product.title}
          className="w-full h-48 object-contain bg-white"
          onError={handleImageError}
        />
        
        {/* Image count indicator */}
        {product.images && Array.isArray(product.images) && product.images.length > 1 && (
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            {product.images.length}
          </div>
        )}
        

        
        {/* Status overlay */}
        {product.status !== PRODUCT_STATUS.ACTIVE && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="secondary" className="bg-red-600 text-white">
              Non disponibile
            </Badge>
          </div>
        )}
      </div>
      
      {/* Content Section */}
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg line-clamp-2">{product.title}</CardTitle>
          <div className="text-right">
            {loadingVariants ? (
              <>
                <div className="text-lg font-bold text-gray-400">
                  Caricamento...
                </div>
                <div className="text-sm text-gray-500">/giorno</div>
              </>
            ) : priceRange ? (
              <>
                <div className="text-lg font-bold" style={{ color: '#E31E24' }}>
                  {priceRange.display}
                </div>
                <div className="text-sm text-gray-500">/giorno</div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-gray-400">
                  Prezzo non disponibile
                </div>
                <div className="text-sm text-gray-500">/giorno</div>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex flex-col flex-1">
        <div className="flex flex-col flex-1">
          {/* Top content - grows to fill available space */}
          <div className="flex-1 space-y-3">
            {/* Category and Subcategory */}
            <div className="flex items-center gap-2">
              <Badge variant="outline">{categoryName}</Badge>
              {subcategoryId && (
                <Badge variant="secondary">{subcategoryName}</Badge>
              )}
            </div>
            
            {/* Brand and Model */}
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-gray-600">Marca: </span>
                <span className="font-medium">{product.brand || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600">Modello: </span>
                <span className="font-medium">{product.model || '-'}</span>
              </div>
            </div>
            
            {/* Condition */}
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-gray-600">Condizione: </span>
                <span className="font-medium">{conditionName}</span>
              </div>
            </div>
          </div>
          
          {/* Bottom content - stays at bottom */}
          <div className="mt-auto pt-4 space-y-3">
            {/* Pickup and Delivery Options */}
            <div className="flex items-center gap-2 flex-wrap">
              {product.pickup_on_site && (
                <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 border-blue-200 text-blue-700">
                  <Package className="h-3 w-3" />
                  Ritiro in loco
                </Badge>
              )}
              {product.delivery && (
                <Badge variant="outline" className="flex items-center gap-1" style={{ backgroundColor: '#E31E2420', borderColor: '#E31E2460', color: '#E31E24' }}>
                  <Truck className="h-3 w-3" />
                  Consegna a domicilio
                </Badge>
              )}
            </div>
            
            {/* Book Now Button */}
            <Button
              className="w-full text-white"
              style={{ backgroundColor: '#E31E24', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#C01A1F'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E31E24'}
              disabled={product.status !== PRODUCT_STATUS.ACTIVE}
              onClick={handleBookNowClick}
            >
              Prenota ora
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 