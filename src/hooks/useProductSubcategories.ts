import { useQuery } from '@tanstack/react-query';
import { fetchProductSubcategories } from '@/services/api';

export function useProductSubcategories(productCategoryId?: string) {
  return useQuery({
    queryKey: ['product_subcategories', productCategoryId],
    queryFn: () => productCategoryId ? fetchProductSubcategories(productCategoryId) : [],
    enabled: !!productCategoryId,
  });
} 