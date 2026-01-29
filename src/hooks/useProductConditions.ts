import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook per caricare le condizioni prodotto dal database
 * @returns Query result con le condizioni prodotto ordinate per nome
 */
export function useProductConditions() {
  return useQuery({
    queryKey: ['product_conditions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_unit_conditions')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });
}

