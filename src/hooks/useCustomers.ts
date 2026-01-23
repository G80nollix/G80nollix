
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Customer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  birth_date: string | null;
  user_type: string | null;
  age?: number;
}

export const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      console.log('[DEBUG] Fetching customers...');
      
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[DEBUG] Current user:', user);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, birth_date, user_type')
        .eq('user_type', 'individual')
        .order('created_at', { ascending: false });

      console.log('[DEBUG] Query result:', { data, error });

      if (error) {
        console.error('[DEBUG] Error fetching customers:', error);
        throw error;
      }

      console.log('[DEBUG] Raw data from profiles:', data);
      console.log('[DEBUG] Number of profiles found:', data?.length || 0);

      // Calcola l'età per ogni cliente
      const customersWithAge = (data || []).map(customer => {
        let age: number | undefined;
        if (customer.birth_date) {
          const birthDate = new Date(customer.birth_date);
          const today = new Date();
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
        }
        return {
          ...customer,
          age
        };
      });

      console.log('[DEBUG] Customers with age:', customersWithAge);
      setCustomers(customersWithAge);
    } catch (err) {
      console.error('[DEBUG] Fetch customers error:', err);
      setError(err instanceof Error ? err.message : 'Errore nel caricamento clienti');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return { customers, isLoading, error, refetch: fetchCustomers };
};
