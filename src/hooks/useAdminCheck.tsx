
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useAdminCheck = () => {
  // Gestisci il caso in cui AuthProvider non è disponibile (durante hot reload)
  let user, authLoading;
  try {
    const auth = useAuth();
    user = auth.user;
    authLoading = auth.loading;
  } catch (error) {
    // Se AuthProvider non è disponibile, considera come non admin e in loading
    console.warn('AuthProvider not available in useAdminCheck:', error);
    user = null;
    authLoading = true;
  }

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        console.log('[DEBUG] Checking admin role for user:', user.id);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('user_type, email')
          .eq('id', user.id)
          .maybeSingle();

        console.log('[DEBUG] Profile query result:', { profile, error });
        
        if (error) {
          console.error('[DEBUG] Error fetching profile:', error);
          setIsAdmin(false);
        } else {
          const adminRole = profile?.user_type === 'admin';
          console.log('[DEBUG] Is admin:', adminRole, 'for email:', profile?.email);
          setIsAdmin(adminRole || false);
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      }
      
      setLoading(false);
    };

    if (!authLoading) {
      checkAdminRole();
    }
  }, [user, authLoading]);

  return { isAdmin, loading: loading || authLoading };
};
