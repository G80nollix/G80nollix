
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import Footer from "@/components/Footer";
import FixedNavbar from "@/components/FixedNavbar";
import CatalogTopFilters from "@/components/CatalogTopFilters";
import ProductList from "@/components/ProductList";
import { useProducts } from "@/hooks/useProducts";
import { useProductCategories } from '@/hooks/useProductCategories';
import { useProductSubcategories } from '@/hooks/useProductSubcategories';
import { useMaxPrice } from '@/hooks/useMaxPrice';
import type { ProductFilters } from "@/types";
import { DELIVERY_TYPES } from "@/constants";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from "@/hooks/useAuth";

// Hook per caricare le condizioni prodotto dal DB
function useProductConditions() {
  return useQuery({
    queryKey: ['product_conditions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_unit_conditions').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    }
  });
}

// Categories and conditions
const deliveryTypes = DELIVERY_TYPES;

// Utility to normalize filters
const normalizeFilter = (val: string, skip: string[] = ["Tutte", "Tutti", ""]) =>
  skip.includes(val) ? "" : val;

const Products = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: categories, isLoading: loadingCategories } = useProductCategories();
  const { data: conditions, isLoading: loadingConditions } = useProductConditions();
  const { data: maxPrice, isLoading: loadingMaxPrice } = useMaxPrice();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const PRODUCTS_PER_PAGE = 9;

  // Get URL parameters (from home page)
  const urlEquipmentName = searchParams.get("equipmentName") || "";
  const urlCategory = searchParams.get("category") || "";
  const urlSubcategory = searchParams.get("subcategory") || "";
  const urlStartDate = searchParams.get("startDate");
  const urlEndDate = searchParams.get("endDate");



  // State for temporary filter values (top controls)
  const [pendingFilters, setPendingFilters] = useState<ProductFilters>({
    equipmentName: urlEquipmentName,
    selectedCategory: urlCategory,
    selectedSubcategory: urlSubcategory || "",
    startDate: urlStartDate ? new Date(urlStartDate) : undefined,
    endDate: urlEndDate ? new Date(urlEndDate) : undefined,
    priceRange: [0, 1000], // Valore di default, verrà aggiornato quando maxPrice è disponibile
    condition: "all",
    deliveryType: "",
    brand: "",
    model: "",
  });

  // Active filters state (used in query) - initialize with URL parameters if present
  const [activeFilters, setActiveFilters] = useState<ProductFilters>({
    equipmentName: urlEquipmentName,
    selectedCategory: urlCategory,
    selectedSubcategory: urlSubcategory || "",
    startDate: urlStartDate ? new Date(urlStartDate) : undefined,
    endDate: urlEndDate ? new Date(urlEndDate) : undefined,
    priceRange: [0, 1000], // Valore di default, verrà aggiornato quando maxPrice è disponibile
    condition: "all",
    deliveryType: "",
    brand: "",
    model: "",
  });

  const [isApplyingFilters, setIsApplyingFilters] = useState(false);



  // Hook per le sottocategorie - si aggiorna quando cambia la categoria
  const { data: subcategories, isLoading: loadingSubcategories } = useProductSubcategories(pendingFilters.selectedCategory);

  // Update filters when maxPrice is loaded
  useEffect(() => {
    if (maxPrice && maxPrice > 0) {
      setPendingFilters(prev => ({
        ...prev,
        priceRange: [prev.priceRange[0], maxPrice]
      }));
      setActiveFilters(prev => ({
        ...prev,
        priceRange: [prev.priceRange[0], maxPrice]
      }));
    }
  }, [maxPrice]);

  // Applica i filtri automaticamente quando cambiano (con debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setActiveFilters({ ...pendingFilters });
      
      // Update URL parameters with current search filters
      const newSearchParams = new URLSearchParams();
      if (pendingFilters.equipmentName) newSearchParams.set("equipmentName", pendingFilters.equipmentName);
      if (pendingFilters.selectedCategory) newSearchParams.set("category", pendingFilters.selectedCategory);
      if (pendingFilters.selectedSubcategory && pendingFilters.selectedSubcategory !== "all") newSearchParams.set("subcategory", pendingFilters.selectedSubcategory);
      if (pendingFilters.startDate) newSearchParams.set("startDate", pendingFilters.startDate.toISOString());
      if (pendingFilters.endDate) newSearchParams.set("endDate", pendingFilters.endDate.toISOString());
      
      setSearchParams(newSearchParams);
    }, 300); // Debounce di 300ms

    return () => clearTimeout(timeoutId);
  }, [pendingFilters, setSearchParams]);

  // Update filters without applying them automatically
  const setPendingValue = useCallback((key: keyof ProductFilters, value: any) => {
    const newFilters = { ...pendingFilters, [key]: value };
    setPendingFilters(newFilters);
  }, [pendingFilters]);

  // Funzione per aggiornare categoria e resettare sottocategoria in una singola operazione
  const setCategoryAndResetSubcategory = useCallback((categoryValue: string) => {
    // Converti "all" in stringa vuota per la logica interna
    const internalCategoryValue = categoryValue === "all" ? "" : categoryValue;
    const newFilters = { 
      ...pendingFilters, 
      selectedCategory: internalCategoryValue,
      selectedSubcategory: ""
    };
    setPendingFilters(newFilters);
    // I filtri verranno applicati automaticamente dal useEffect
  }, [pendingFilters]);



  // Use the new products hook
  const { products, isLoading, error, refetch } = useProducts(activeFilters, user?.id);
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [activeFilters]);
  
  // Calculate pagination
  const totalPages = Math.ceil(products.length / PRODUCTS_PER_PAGE);
  const startIndex = currentPage * PRODUCTS_PER_PAGE;
  const endIndex = startIndex + PRODUCTS_PER_PAGE;
  const paginatedProducts = products.slice(startIndex, endIndex);

  // Start new search (apply filters when search button is clicked)
  const handleSearch = useCallback(() => {
    console.log("Starting search with filters:", pendingFilters);
    
    setIsApplyingFilters(true);
    setActiveFilters({ ...pendingFilters });
    
    // Update URL parameters with current search filters
    const newSearchParams = new URLSearchParams();
    if (pendingFilters.equipmentName) newSearchParams.set("equipmentName", pendingFilters.equipmentName);
    if (pendingFilters.selectedCategory) newSearchParams.set("category", pendingFilters.selectedCategory);
    if (pendingFilters.selectedSubcategory && pendingFilters.selectedSubcategory !== "all") newSearchParams.set("subcategory", pendingFilters.selectedSubcategory);
    if (pendingFilters.startDate) newSearchParams.set("startDate", pendingFilters.startDate.toISOString());
    if (pendingFilters.endDate) newSearchParams.set("endDate", pendingFilters.endDate.toISOString());
    
    setSearchParams(newSearchParams);
    
    // Hide the indicator after a short delay
    setTimeout(() => setIsApplyingFilters(false), 1000);
  }, [pendingFilters, setSearchParams]);

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    const resetFilters: ProductFilters = {
      equipmentName: "",
      selectedCategory: "",
      selectedSubcategory: "",
      startDate: undefined,
      endDate: undefined,
      priceRange: [0, maxPrice || 1000],
      condition: "all",
      deliveryType: "",
      brand: "",
      model: "",
    };
    
    setPendingFilters(resetFilters);
    setActiveFilters(resetFilters);
    setSearchParams(new URLSearchParams());
  }, [setSearchParams, maxPrice]);

  // Pagination handlers
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
    window.scrollTo(0, 0);
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
    window.scrollTo(0, 0);
  };


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ fontFamily: 'Oswald, sans-serif', scrollbarGutter: 'stable' }}>
      {/* Navbar fissa sempre visibile */}
      <FixedNavbar />
      <div className="flex-1 container mx-auto px-4 py-8 pt-24 md:pt-28">
        {/* TOP SEARCH/FILTER BAR */}
        <CatalogTopFilters
          pendingFilters={pendingFilters}
          setPendingValue={setPendingValue}
          setCategoryAndResetSubcategory={setCategoryAndResetSubcategory}
          handleSearch={handleSearch}
          handleResetFilters={handleResetFilters}
          isApplyingFilters={isApplyingFilters}
        />
        {/* PRODUCT LIST */}
        <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Oswald, sans-serif', fontWeight: '700', color: '#5F5F5F' }}>Attrezzature disponibili</h1>
              <span className="text-gray-600" style={{ fontFamily: 'Oswald, sans-serif' }}>{isLoading ? '...' : products.length} risultati</span>
            </div>
            
            {/* Pagination controls - Top */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Pagina {currentPage + 1} di {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 0}
                    className="flex items-center gap-1"
                    style={{ fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Precedente
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages - 1}
                    className="flex items-center gap-1"
                    style={{ fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}
                  >
                    Successiva
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            <ProductList products={paginatedProducts} isLoading={isLoading} error={error} />
            
            {/* Pagination controls - Bottom */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-600" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Pagina {currentPage + 1} di {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 0}
                    className="flex items-center gap-1"
                    style={{ fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Precedente
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages - 1}
                    className="flex items-center gap-1"
                    style={{ fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}
                  >
                    Successiva
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
      </div>
      <Footer />
    </div>
  );
};

export default Products;
