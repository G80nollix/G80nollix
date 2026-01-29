import { useQuery } from '@tanstack/react-query';
import { fetchProductCategories } from '@/services/api';

export function useProductCategories() {
  return useQuery({
    queryKey: ['product_categories'],
    queryFn: fetchProductCategories,
  });
} 