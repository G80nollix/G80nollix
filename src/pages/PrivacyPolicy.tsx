import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PrivacyPolicy = () => {
  // Fetch privacy policy content from shop_settings
  const { data: shopSettings, isLoading } = useQuery({
    queryKey: ['shop_settings', 'privacy_policy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('privacy_policy')
        .maybeSingle();
      
      if (error) {
        console.error('Error loading shop settings:', error);
        return { privacy_policy: null };
      }
      
      return data || { privacy_policy: null };
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
              ) : shopSettings?.privacy_policy ? (
                <div 
                  className="
                    [&_.privacy-policy-h1]:text-3xl [&_.privacy-policy-h1]:font-bold [&_.privacy-policy-h1]:text-gray-900 [&_.privacy-policy-h1]:mb-6
                    [&_.privacy-policy-h1_span]:text-base [&_.privacy-policy-h1_span]:font-normal [&_.privacy-policy-h1_span]:text-gray-600
                    [&_.privacy-policy-h2]:text-xl [&_.privacy-policy-h2]:font-semibold [&_.privacy-policy-h2]:text-gray-900 [&_.privacy-policy-h2]:mb-3 [&_.privacy-policy-h2]:mt-4
                    [&_.privacy-policy-p]:text-gray-700 [&_.privacy-policy-p]:leading-relaxed [&_.privacy-policy-p]:mb-4
                    [&_.privacy-policy-ol]:list-decimal [&_.privacy-policy-ol]:list-outside [&_.privacy-policy-ol]:ml-6 [&_.privacy-policy-ol]:space-y-2 [&_.privacy-policy-ol]:text-gray-700
                    [&_.privacy-policy-ol_li]:mb-2
                    [&_a]:text-blue-600 [&_a]:hover:text-blue-800 [&_a]:underline
                  "
                  dangerouslySetInnerHTML={{
                    __html: shopSettings.privacy_policy
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

export default PrivacyPolicy;

