import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface CatalogSidebarFiltersProps {
  priceRange: number[];
  setPriceRange: (v: number[]) => void;
  condition: string;
  setCondition: (v: string) => void;
  ownerType: string;
  setOwnerType: (v: string) => void;
}

// Opzioni uniformate
const conditions = [
  "Tutte",
  "Come nuovo",
  "Ottime condizioni",
  "Buone condizioni",
  "Condizioni discrete"
];
// Solo questi valori ora!
const ownerTypes = ["Tutti", "Privato", "Azienda"];

export default function CatalogSidebarFilters({
  priceRange,
  setPriceRange,
  condition,
  setCondition,
  ownerType,
  setOwnerType
}: CatalogSidebarFiltersProps) {
  return (
    <aside className="w-full md:w-64 bg-white rounded-xl shadow-sm p-4 mb-8 flex flex-col gap-6 sticky top-24 max-h-[80vh]">
      <div>
        <Label className="text-sm font-medium mb-2 block">Fascia di prezzo</Label>
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium">€{priceRange[0]}</span>
          <Slider
            value={priceRange}
            onValueChange={setPriceRange}
            max={100}
            step={5}
            className="flex-1"
          />
          <span className="text-sm font-medium">€{priceRange[1]}</span>
        </div>
        <div className="text-xs text-gray-500 text-end">/giorno</div>
      </div>
      <div>
        <Label className="text-sm font-medium mb-2 block">Condizioni</Label>
        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Condizioni" />
          </SelectTrigger>
          <SelectContent>
            {conditions.map((cond) => (
              <SelectItem key={cond} value={cond}>
                {cond}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium mb-2 block">Tipologia proprietario</Label>
        <Select value={ownerType} onValueChange={setOwnerType}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Tipo proprietario" />
          </SelectTrigger>
          <SelectContent>
            {ownerTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </aside>
  );
}
