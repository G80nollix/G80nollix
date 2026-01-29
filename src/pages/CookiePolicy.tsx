import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CookiePolicy = () => {
  // Fetch cookie policy content from shop_settings
  const { data: shopSettings, isLoading } = useQuery({
    queryKey: ['shop_settings', 'cookie_policy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('cookie_policy')
        .maybeSingle();
      
      if (error) {
        console.error('Error loading shop settings:', error);
        return { cookie_policy: null };
      }
      
      return data || { cookie_policy: null };
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <FixedNavbar />
      
      <div className="flex-1 container mx-auto px-4 py-16 pt-20 md:pt-24">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-8 space-y-6">
              {isLoading ? (
                <div className="text-center text-gray-500 py-8">
                  Caricamento contenuto...
                </div>
              ) : shopSettings?.cookie_policy ? (
                <div 
                  className="
                    [&_.cookie-policy-h1]:text-3xl [&_.cookie-policy-h1]:font-bold [&_.cookie-policy-h1]:text-gray-900 [&_.cookie-policy-h1]:mb-6
                    [&_.cookie-policy-h1_span]:text-base [&_.cookie-policy-h1_span]:font-normal [&_.cookie-policy-h1_span]:text-gray-600
                    [&_.cookie-policy-h2]:text-xl [&_.cookie-policy-h2]:font-semibold [&_.cookie-policy-h2]:text-gray-900 [&_.cookie-policy-h2]:mb-3 [&_.cookie-policy-h2]:mt-4
                    [&_.cookie-policy-p]:text-gray-700 [&_.cookie-policy-p]:leading-relaxed [&_.cookie-policy-p]:mb-4
                    [&_.cookie-policy-ol]:list-decimal [&_.cookie-policy-ol]:list-outside [&_.cookie-policy-ol]:ml-6 [&_.cookie-policy-ol]:space-y-2 [&_.cookie-policy-ol]:text-gray-700
                    [&_.cookie-policy-ul]:list-disc [&_.cookie-policy-ul]:list-outside [&_.cookie-policy-ul]:ml-6 [&_.cookie-policy-ul]:space-y-2 [&_.cookie-policy-ul]:text-gray-700
                    [&_.cookie-policy-ol_li]:mb-2 [&_.cookie-policy-ul_li]:mb-2
                    [&_a]:text-blue-600 [&_a]:hover:text-blue-800 [&_a]:underline
                  "
                  dangerouslySetInnerHTML={{
                    __html: shopSettings.cookie_policy
                  }}
                />
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Contenuto non disponibile.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default CookiePolicy;

