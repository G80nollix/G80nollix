// Pagina Catalog: mostra tutti i prodotti in tabella con ricerca, paginazione, aggiunta, modifica e cancellazione.
// Campi: Titolo, marca, modello, descrizione, categoria, immagine, prezzo giornaliero e orario.
// Pulsante per aggiungere prodotti e azioni per modifica/cancella su ogni riga.
// Mostra 10 prodotti per pagina con frecce avanti/indietro.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus, ArrowLeft, Eye, EyeOff, RotateCcw, Ban, Layers, Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProductCategories } from '@/hooks/useProductCategories';
import AdminHeader from "@/components/admin/AdminHeader";
import AdminFooter from "@/components/admin/AdminFooter";
import { findPricePeriodId } from "@/lib/pricing";

const PAGE_SIZE = 10;

export default function Catalog() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [rentableUnitsCount, setRentableUnitsCount] = useState<Map<string, number>>(new Map());
  const navigate = useNavigate();
  const { data: categories } = useProductCategories();

  useEffect(() => {
    const fetchSubcategories = async () => {
      const { data, error } = await supabase
        .from("product_subcategories")
        .select("*");
      if (!error && data) {
        setSubcategories(data);
      }
    };
    fetchSubcategories();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      
      // Prima trova il periodo "daily" (giornaliero)
      const { data: dailyPeriod, error: periodError } = await supabase
        .from('price_periods')
        .select('id')
        .eq('code', 'daily')
        .eq('is_active', true)
        .maybeSingle();
      
      if (periodError) {
        console.error('Errore nel recupero del periodo daily:', periodError);
        setLoading(false);
        return;
      }
      
      let query = supabase
        .from("products")
        .select(`
          *,
          product_brand:id_brand(id, name),
          product_model:id_model(id, name),
          product_variants(id)
        `)
        .order("created_at", { ascending: false });
      
      if (showDeleted) {
        query = query.eq("is_active", false);
      } else {
        query = query.eq("is_active", true);
      }
      
      const { data, error } = await query;
      if (!error && data) {
        // Carica i prezzi per ogni prodotto
        const mappedData = await Promise.all((data || []).map(async (p: any) => {
          let price_daily = null;
          let price_daily_display = null;
          
          if (!dailyPeriod) {
            // Se non esiste il periodo daily, non mostrare prezzi
            return {
              ...p,
              title: p.name,
              brand: p.product_brand?.name || '',
              model: p.product_model?.name || '',
              images: p.images || [],
              price_daily: null,
              price_daily_display: '-',
              price_hour: null,
            };
          }
          
          if (p.has_variants && p.product_variants && p.product_variants.length > 0) {
            // Se ha varianti, cerca il prezzo minimo tra tutte le varianti
            const variantIds = p.product_variants.map((v: any) => v.id);
            
            if (variantIds.length > 0) {
              const { data: variantPrices, error: variantPricesError } = await supabase
                .from('product_variant_price_list')
                .select('price')
                .in('id_product_variant', variantIds)
                .eq('id_price_period', dailyPeriod.id);
              
              if (!variantPricesError && variantPrices && variantPrices.length > 0) {
                const prices = variantPrices
                  .map((vp: any) => Number(vp.price))
                  .filter((price: number) => !isNaN(price) && price > 0);
                
                if (prices.length > 0) {
                  price_daily = Math.min(...prices);
                  price_daily_display = `Da €${price_daily.toFixed(2)}`;
                }
              }
            }
          } else {
            // Se non ha varianti, cerca il prezzo del prodotto
            const { data: productPrice, error: productPriceError } = await supabase
              .from('product_price_list')
              .select('price')
              .eq('id_product', p.id)
              .eq('id_price_period', dailyPeriod.id)
              .maybeSingle();
            
            if (!productPriceError && productPrice && productPrice.price !== null) {
              const price = Number(productPrice.price);
              if (!isNaN(price) && price > 0) {
                price_daily = price;
                price_daily_display = `€${price_daily.toFixed(2)}`;
              }
            }
          }
          
          return {
            ...p,
            title: p.name,
            brand: p.product_brand?.name || '',
            model: p.product_model?.name || '',
            images: p.images || [],
            price_daily,
            price_daily_display: price_daily_display || '-',
            price_hour: null, // Non più disponibile direttamente
          };
        }));
        
        setProducts(mappedData);
        
        // Calcola le unità noleggiabili per ogni prodotto
        const productIds = mappedData.map((p: any) => p.id);
        if (productIds.length > 0) {
          // Recupera tutte le varianti attive dei prodotti
          const { data: variants, error: variantsError } = await supabase
            .from('product_variants')
            .select('id, id_product')
            .in('id_product', productIds)
            .eq('is_active', true);
          
          if (!variantsError && variants && variants.length > 0) {
            const variantIds = variants.map((v: any) => v.id);
            const rentableStatusId = '2a5f05a8-6dbe-4246-ac06-ffe869efab8b'; // Noleggiabile
            
            // Conta le unità noleggiabili per ogni variante
            const { data: units, error: unitsError } = await supabase
              .from('product_units')
              .select('id, id_product_variant, product_variants!inner(id_product)')
              .in('id_product_variant', variantIds)
              .eq('id_product_status', rentableStatusId);
            
            if (!unitsError && units) {
              const unitsCountMap = new Map<string, number>();
              units.forEach((unit: any) => {
                const productId = unit.product_variants?.id_product;
                if (productId) {
                  unitsCountMap.set(productId, (unitsCountMap.get(productId) || 0) + 1);
                }
              });
              setRentableUnitsCount(unitsCountMap);
            }
          } else {
            // Se non ci sono varianti, resetta il conteggio
            setRentableUnitsCount(new Map());
          }
        } else {
          setRentableUnitsCount(new Map());
        }
      } else if (error) {
        console.error('Errore nel recupero prodotti:', error);
      }
      setLoading(false);
    };
    fetchProducts();
  }, [showDeleted]);

  useEffect(() => {
    let filtered = products;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = products.filter(
        p =>
          p.name?.toLowerCase().includes(s) ||
          p.title?.toLowerCase().includes(s) ||
          p.brand?.toLowerCase().includes(s) ||
          p.model?.toLowerCase().includes(s)
      );
    }
    setFiltered(filtered);
    setPage(0);
  }, [search, products]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleDisable = async (id: string) => {
    if (!window.confirm("Sei sicuro di voler disabilitare questo prodotto?")) return;
    
    // Disabilita il prodotto
    const { error: productError } = await supabase
      .from("products")
      .update({ is_active: false })
      .eq("id", id);
    
    if (productError) {
      alert("Errore durante la disabilitazione del prodotto");
      return;
    }
    
    // Disabilita anche tutte le varianti associate
    const { error: variantsError } = await supabase
      .from("product_variants")
      .update({ is_active: false })
      .eq("id_product", id);
    
    if (variantsError) {
      console.error("Errore durante la disabilitazione delle varianti:", variantsError);
      alert("Prodotto disabilitato, ma si è verificato un errore durante la disabilitazione delle varianti");
    }
    
    setProducts(products => products.filter(p => p.id !== id));
  };

  const handlePermanentDelete = async (id: string) => {
    // Placeholder - da implementare in futuro
    if (!window.confirm("Sei sicuro di voler eliminare definitivamente questo prodotto?")) return;
    // TODO: Implementare l'eliminazione definitiva
    alert("Funzionalità di eliminazione definitiva da implementare");
  };

  const handleRestore = async (id: string) => {
    if (!window.confirm("Sei sicuro di voler ripristinare questo prodotto?")) return;
    
    // Riabilita il prodotto
    const { error: productError } = await supabase
      .from("products")
      .update({ is_active: true })
      .eq("id", id);
    
    if (productError) {
      alert("Errore durante il ripristino del prodotto");
      return;
    }
    
    // Riabilita anche tutte le varianti associate
    const { error: variantsError } = await supabase
      .from("product_variants")
      .update({ is_active: true })
      .eq("id_product", id);
    
    if (variantsError) {
      console.error("Errore durante il ripristino delle varianti:", variantsError);
      alert("Prodotto ripristinato, ma si è verificato un errore durante il ripristino delle varianti");
    }
    
    setProducts(products => products.filter(p => p.id !== id));
  };

  const getCategoryName = (catId: string) => {
    return categories?.find(cat => cat.id === catId)?.name || "-";
  };

  const getSubcategoryName = (subcatId: string) => {
    return subcategories?.find(subcat => subcat.id === subcatId)?.name || "-";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
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
            Catalogo Prodotti
          </h1>
          <div className="flex-1" />
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex-1 flex items-center gap-2">
            <Input
              placeholder="Cerca per titolo, marca o modello..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleted(!showDeleted)}
              className="flex items-center gap-2"
            >
              {showDeleted ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Nascondi Disabilitati
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Mostra Disabilitati
                </>
              )}
            </Button>
            <Button
              className="flex items-center gap-2 bg-[#3fafa3] hover:bg-[#3fafa3] text-white"
              onClick={() => navigate("/admin/publish")}
            >
              <Plus className="h-4 w-4" />
              Aggiungi prodotto
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Immagine</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Titolo</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Marca</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Modello</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sottocategoria</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prezzo giornaliero</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Stock Noleggiabile</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8">Caricamento...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">Nessun prodotto trovato</td></tr>
              ) : (
                paginated.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {Array.isArray(product.images) && product.images.length > 0 ? (
                        <img src={product.images[0]} alt={product.title} className="w-14 h-14 object-contain bg-white rounded" />
                      ) : (
                        <div className="w-14 h-14 bg-gray-200 rounded flex items-center justify-center text-gray-400">-</div>
                      )}
                    </td>
                    <td className="px-4 py-2 font-semibold">{product.title}</td>
                    <td className="px-4 py-2">{product.brand || 'N/A'}</td>
                    <td className="px-4 py-2">{product.model || 'N/A'}</td>
                    <td className="px-4 py-2">{getSubcategoryName(product.id_product_subcategory)}</td>
                    <td className="px-4 py-2">{getCategoryName(product.id_product_subcategory ? subcategories.find(s => s.id === product.id_product_subcategory)?.product_category_id : '')}</td>
                    <td className="px-4 py-2">{product.price_daily_display || '-'}</td>
                    <td className="px-4 py-2 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        <Warehouse className="w-4 h-4" />
                        {rentableUnitsCount.get(product.id) || 0}
                      </span>
                    </td>
                    <td className="px-4 py-2 flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/admin/publish/${product.id}`)} title="Modifica">
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => navigate(`/admin/variants/${product.id}`)} 
                        title="Gestisci varianti"
                        disabled={!product.has_variants}
                        className={!product.has_variants ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        <Layers className="h-4 w-4 text-purple-600" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => navigate(`/admin/stock/${product.id}`)} 
                        title="Gestisci stock"
                      >
                        <Warehouse className="h-4 w-4 text-green-600" />
                      </Button>
                      {showDeleted ? (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => handleRestore(product.id)} title="Ripristina">
                            <RotateCcw className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handlePermanentDelete(product.id)} title="Elimina definitivamente">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      ) : (
                        <Button size="icon" variant="ghost" onClick={() => handleDisable(product.id)} title="Disabilita">
                          <Ban className="h-4 w-4 text-orange-600" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Paginazione */}
        <div className="flex justify-between items-center mt-4">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            &larr; Indietro
          </Button>
          <span className="text-sm text-gray-600">
            {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, filtered.length)} di {filtered.length}
          </span>
          <Button
            variant="outline"
            disabled={(page + 1) * PAGE_SIZE >= filtered.length}
            onClick={() => setPage(p => p + 1)}
          >
            Avanti &rarr;
          </Button>
        </div>
      </main>
      <AdminFooter />
    </div>
  );
} 