import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProductService } from '@/services/api';
import type { Product, ProductFilters, UseProductsReturn, UseProductReturn } from '@/types';

export const useProducts = (filters: ProductFilters, userId?: string): UseProductsReturn => {
  const queryClient = useQueryClient();

  const {
    data: productsResponse,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['products', filters, userId],
    queryFn: () => ProductService.getProducts(filters, userId),
  });

  return {
    products: productsResponse?.data || [],
    isLoading,
    error: error as Error | null,
    refetch
  };
};

export const useProduct = (id: string): UseProductReturn => {
  const {
    data: productResponse,
    isLoading,
    error
  } = useQuery({
    queryKey: ['product', id],
    queryFn: () => ProductService.getProduct(id),
    enabled: !!id,
  });

  return {
    product: productResponse?.data || null,
    isLoading,
    error: error as Error | null
  };
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productData: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'views' | 'owner_type'>) => 
      ProductService.createProduct(productData),
    onSuccess: () => {
      // Invalidate and refetch products queries
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, productData }: { id: string; productData: Partial<Omit<Product, 'owner_type'>> }) =>
      ProductService.updateProduct(id, productData),
    onSuccess: (_, { id }) => {
      // Invalidate and refetch specific queries
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      // Invalidate product prices query to refresh prices after update
      queryClient.invalidateQueries({ queryKey: ['product_prices', id] });
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProductService.deleteProduct(id),
    onSuccess: () => {
      // Invalidate and refetch products queries
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};
