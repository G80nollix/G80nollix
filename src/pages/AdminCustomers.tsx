import { useState } from "react";
import { Search, Plus, User, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useCustomers, type Customer } from "@/hooks/useCustomers";
import CreateCustomerDialog from "@/components/admin/CreateCustomerDialog";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminFooter from "@/components/admin/AdminFooter";
import { useNavigate } from "react-router-dom";

const AdminCustomers = () => {
  const navigate = useNavigate();
  const { customers, isLoading, error, refetch } = useCustomers();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const itemsPerPage = 20;

  // Filtra i clienti in base al termine di ricerca
  const filteredCustomers = customers.filter(customer => {
    const firstName = customer.first_name?.toLowerCase() || '';
    const lastName = customer.last_name?.toLowerCase() || '';
    const email = customer.email?.toLowerCase() || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const searchLower = searchTerm.toLowerCase();
    
    return firstName.includes(searchLower) || 
           lastName.includes(searchLower) || 
           fullName.includes(searchLower) ||
           email.includes(searchLower);
  });

  // Calcola i clienti per la pagina corrente
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Reset della pagina quando cambia il termine di ricerca
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCustomerClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailOpen(true);
  };

  const handleCustomerCreated = () => {
    refetch();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Non disponibile';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getDisplayName = (customer: Customer) => {
    const firstName = customer.first_name || '';
    const lastName = customer.last_name || '';
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    return customer.email || 'Nome non disponibile';
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AdminHeader />
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-96">
            <CardContent className="pt-6">
              <div className="text-center text-red-600">
                <p className="font-medium">Errore nel caricamento</p>
                <p className="text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <AdminFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminHeader />
      <div className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Header con pulsante indietro */}
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              onClick={() => navigate("/admin/home")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Indietro
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">
              Gestione Clienti
            </h1>
            <div className="flex-1" />
          </div>

          <div className="mb-8">
          </div>

          {/* Barra di ricerca e pulsante aggiungi */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Cerca per nome, cognome o email..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button 
              className="bg-[#3fafa3] hover:bg-[#3fafa3] text-white"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi Cliente
            </Button>
          </div>

          {/* Lista clienti */}
          <Card>
            <CardHeader>
              <CardTitle>
                Clienti ({filteredCustomers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">Caricamento clienti...</p>
                </div>
              ) : currentCustomers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun cliente trovato</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => handleCustomerClick(customer)}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {getDisplayName(customer)}
                          </h3>
                          <p className="text-sm text-gray-500">{customer.email || 'Email non disponibile'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Paginazione */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNumber = i + 1;
                    return (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNumber)}
                          isActive={currentPage === pageNumber}
                          className="cursor-pointer"
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

          {/* Dialog dettaglio cliente */}
          <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Dettagli Cliente</DialogTitle>
              </DialogHeader>
              {selectedCustomer && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                      <User className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">
                        {getDisplayName(selectedCustomer)}
                      </h3>
                      <p className="text-gray-600">{selectedCustomer.email || 'Email non disponibile'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Nome</label>
                      <p className="text-gray-900">{selectedCustomer.first_name || 'Non disponibile'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Cognome</label>
                      <p className="text-gray-900">{selectedCustomer.last_name || 'Non disponibile'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Età</label>
                      <p className="text-gray-900">
                        {selectedCustomer.age ? `${selectedCustomer.age} anni` : 'Non disponibile'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Data di nascita</label>
                      <p className="text-gray-900">{formatDate(selectedCustomer.birth_date)}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700">Email</label>
                      <p className="text-gray-900">{selectedCustomer.email || 'Non disponibile'}</p>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Dialog creazione cliente */}
          <CreateCustomerDialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            onCustomerCreated={handleCustomerCreated}
          />
        </div>
      </div>
      <AdminFooter />
    </div>
  );
};

export default AdminCustomers;
