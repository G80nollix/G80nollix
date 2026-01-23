
import { useNavigate, useSearchParams } from "react-router-dom";
import { ProductCard } from "./products/ProductCard";
import type { ProductListProps } from "@/types";

export default function ProductList({ products, isLoading, error }: ProductListProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleProductClick = (productId: string) => {
    console.log("Navigating to product:", productId);
    if (productId) {
      // Get current search params to preserve date filters
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      
      console.log("URL params being passed:", { startDate, endDate });
      
      // Build URL with date parameters if they exist
      let url = `/products/${productId}`;
      const params = new URLSearchParams();
      
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log("Final URL:", url);
      navigate(url);
    } else {
      console.error("Product ID is missing or invalid");
    }
  };

  if (error) {
    return (
      <div className="my-6 text-red-600">
        Errore durante il caricamento dei prodotti. Riprova più tardi.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="col-span-full text-center py-12">Caricamento in corso...</div>
    );
  }

  if (!products.length) {
    return (
      <div className="col-span-full text-center py-12">
        <div className="text-gray-400 text-lg">Nessun prodotto trovato</div>
        <div className="text-gray-500 text-sm mt-2">Prova a modificare i filtri di ricerca</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onProductClick={handleProductClick}
        />
      ))}
    </div>
  );
}
