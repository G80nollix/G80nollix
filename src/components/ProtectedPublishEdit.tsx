
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminFooter from "@/components/admin/AdminFooter";
import ProductPublishForm from "@/components/ProductPublishForm/";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedPublishEdit() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Mostra loading mentre controlla l'autenticazione
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center py-10 text-gray-500">
          Caricamento...
        </div>
      </div>
    );
  }

  // Se l'utente non è loggato, non mostrare nulla (verrà reindirizzato)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader />
      <main className="flex-1">
        <div className="container max-w-2xl mx-auto py-10">
          <ProductPublishForm productId={id} />
        </div>
      </main>
      <AdminFooter />
    </div>
  );
}
