import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CatalogSidebarProps {
  priceRange: number[];
  setPriceRange: (range: number[]) => void;
  condition: string;
  setCondition: (condition: string) => void;
  deliveryType: string;
  setDeliveryType: (type: string) => void;
  deliveryTypes: string[];
  brand: string;
  setBrand: (brand: string) => void;
  model: string;
  setModel: (model: string) => void;
  conditions?: { id: string; name: string }[];
  loadingConditions?: boolean;
  maxPrice?: number;
  handleResetFilters: () => void;
}

const CatalogSidebar = ({
  priceRange,
  setPriceRange,
  condition,
  setCondition,
  deliveryType,
  setDeliveryType,
  deliveryTypes,
  brand,
  setBrand,
  model,
  setModel,
  conditions = [],
  loadingConditions = false,
  maxPrice = 1000,
  handleResetFilters
}: CatalogSidebarProps) => {
  return (
    <div className="max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 pr-2 scroll-smooth">
      {/* Unico Card per tutti i filtri */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Filtri</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-8">
            {/* Filtro Prezzo */}
            <div>
              <Label className="mb-2 block">Prezzo per giorno</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-gray-600">Minimo (€)</Label>
                  <input
                    type="number"
                    value={priceRange[0]}
                    onChange={e => setPriceRange([Number(e.target.value), priceRange[1]])}
                    className="w-full border rounded p-2 text-sm"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Massimo (€)</Label>
                  <input
                    type="number"
                    value={priceRange[1]}
                    onChange={e => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="w-full border rounded p-2 text-sm"
                    placeholder={`${maxPrice}`}
                    min="0"
                  />
                </div>
              </div>
            </div>
            {/* Filtro Condizioni */}
            <div>
              <Label className="mb-2 block">Condizioni</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona condizione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {loadingConditions ? (
                    <SelectItem value="loading" disabled>Caricamento...</SelectItem>
                  ) : (
                    conditions.map((cond) => (
                      <SelectItem key={cond.id} value={cond.id}>
                        {cond.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {/* Filtro Modalità di Consegna */}
            <div>
              <Label className="mb-2 block">Modalità di Consegna</Label>
              <Select value={deliveryType} onValueChange={setDeliveryType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona modalità" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Nuovo Card per Marca e Modello */}
      <Card className="mt-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Marca e Modello</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-6">
            <div>
              <Label className="mb-2 block">Marca</Label>
              <input
                type="text"
                value={brand}
                onChange={e => setBrand(e.target.value)}
                className="w-full border rounded p-3 text-sm"
                placeholder="Inserisci la marca"
              />
            </div>
            <div>
              <Label className="mb-2 block">Modello</Label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full border rounded p-3 text-sm"
                placeholder="Inserisci il modello"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Bottoni di ricerca e reset */}
      <div className="mt-6 flex justify-end gap-2">
        <Button 
          variant="outline" 
          onClick={handleResetFilters} 
          className="lg:w-auto"
        >
          Reset Filtri
        </Button>
      </div>
      {/* Spazio extra in fondo per lo scroll */}
      <div className="h-4"></div>
    </div>
  );
};

export default CatalogSidebar;
