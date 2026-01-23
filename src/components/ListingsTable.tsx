
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useProductCategories } from '@/hooks/useProductCategories';
import { useProductSubcategories } from '@/hooks/useProductSubcategories';

interface Product {
  id: string;
  title: string;
  category: string;
  price_daily: number;
  status: string;
  views: number;
  location: string;
  images: string[];
  created_at: string;
  description: string;
  product_category_id: string;
  product_subcategory_id: string;
}

interface ListingsTableProps {
  products: Product[];
  handleEditProduct: (productId: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  formatDate: (dateString: string) => string;
}

const ListingsTable = ({
  products,
  handleEditProduct,
  getStatusBadge,
  formatDate
}: ListingsTableProps) => {
  const { data: categories } = useProductCategories();

  // Funzione di utilità per ottenere il nome della categoria
  const getCategoryName = (categoryId: string) => categories?.find(cat => cat.id === categoryId)?.name || '-';

  // Funzione di utilità per ottenere il nome della sottocategoria
  const getSubcategoryName = (categoryId: string, subcategoryId: string) => {
    const subcategories = useProductSubcategories(categoryId).data;
    return subcategories?.find(sub => sub.id === subcategoryId)?.name || '-';
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Prodotto</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Prezzo/giorno</TableHead>
          <TableHead>Stato</TableHead>
          <TableHead className="text-center">Visualizzazioni</TableHead>
          <TableHead className="text-center">Data creazione</TableHead>
          <TableHead className="text-center">Azioni</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id} className="hover:bg-gray-50">
            <TableCell>
              <div className="flex items-center space-x-3">
                <img
                  src={product.images[0] || "/placeholder.svg"}
                  alt={product.title}
                  className="w-12 h-12 object-contain bg-white rounded-lg"
                />
                <div>
                  <p className="font-semibold">{product.title}</p>
                  <p className="text-sm text-gray-500 truncate max-w-xs">
                    {product.description}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{getCategoryName(product.product_category_id)}</Badge>
              {product.product_subcategory_id && (
                <Badge variant="secondary">{getSubcategoryName(product.product_category_id, product.product_subcategory_id)}</Badge>
              )}
            </TableCell>
            <TableCell className="font-semibold">€{product.price_daily}</TableCell>
            <TableCell>{getStatusBadge(product.status)}</TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <Eye className="h-4 w-4 text-gray-400" />
                <span>{product.views}</span>
              </div>
            </TableCell>
            <TableCell className="text-center">
              {formatDate(product.created_at)}
            </TableCell>
            <TableCell>
              <div className="flex justify-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleEditProduct(product.id)}
                  title="Modifica annuncio"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default ListingsTable;
