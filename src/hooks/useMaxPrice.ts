import { useQuery } from '@tanstack/react-query';
import { getMaxDailyPrice } from '@/services/api';

export function useMaxPrice() {
  return useQuery({
    queryKey: ['maxDailyPrice'],
    queryFn: getMaxDailyPrice,
  });
} 