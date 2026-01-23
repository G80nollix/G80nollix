import { Link } from "react-router-dom";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminFooter from "@/components/admin/AdminFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const AdminProducts = () => {
  // Qui andrà la logica di fetch dei prodotti (da implementare)
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-end mb-6">
          <Link to="/admin/publish">
            <Button className="bg-[#3fafa3] hover:bg-[#3fafa3] text-white">
              + Aggiungi nuova attrezzatura
            </Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Catalogo Attrezzature</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Placeholder: qui verrà la tabella/lista prodotti */}
            <div className="text-center text-gray-500 py-12">
              <p>Qui potrai gestire tutte le attrezzature pubblicate dagli utenti.</p>
              <p className="mt-2">(Funzionalità in sviluppo)</p>
            </div>
          </CardContent>
        </Card>
      </main>
      <AdminFooter />
    </div>
  );
};

export default AdminProducts; 