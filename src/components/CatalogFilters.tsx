
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Map, Search, MapPin, Calendar as CalendarIcon } from "lucide-react";
import { format, isBefore, isAfter } from "date-fns";
import { it } from "date-fns/locale";
import { useProductCategories } from '@/hooks/useProductCategories';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShopDaysOff, isDateDisabledForStart, isDateDisabledForEnd, isDateWithEnabledBooking } from '@/hooks/useShopDaysOff';
import { useToast } from '@/hooks/use-toast';

interface CatalogFiltersProps {
  showMap?: boolean;
  setShowMap?: (v: boolean) => void;
  compact?: boolean;
}

const conditions = ["Tutte", "Nuove", "Ottime", "Buone", "Discrete"];
const ownerTypes = ["Tutti", "Privato", "Azienda"];

export default function CatalogFilters({ showMap, setShowMap, compact }: CatalogFiltersProps) {
  // Lo stato qui è locale, in /catalog sarà gestito sopra se serve filtrare i prodotti davvero
  const [priceRange, setPriceRange] = useState([0, 100]);
  const [equipmentName, setEquipmentName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [condition, setCondition] = useState("");
  const [ownerType, setOwnerType] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const { data: categories, isLoading: loadingCategories } = useProductCategories();

  // Carica le impostazioni del negozio per l'anticipo prenotazione
  const { data: shopSettings } = useQuery({
    queryKey: ['shop_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('anticipo_prenotazioneGiorni')
        .maybeSingle();
      
      if (error) {
        console.error('Error loading shop settings:', error);
        return { anticipo_prenotazioneGiorni: 0 };
      }
      
      return data || { anticipo_prenotazioneGiorni: 0 };
    },
  });

  // Carica i giorni di chiusura del negozio
  const { data: shopDaysOff = [] } = useShopDaysOff();

  // Date validation functions
  const isStartDateDisabled = (date: Date) => {
    // Calcola la data minima consentita (oggi + giorni di anticipo)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const anticipoGiorni = shopSettings?.anticipo_prenotazioneGiorni || 0;
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + anticipoGiorni);
    minDate.setHours(0, 0, 0, 0);
    
    // Disable dates before minimum date (today + anticipo giorni)
    if (isBefore(date, minDate)) return true;
    
    // Disable dates that fall within shop days off periods (per data di inizio)
    if (isDateDisabledForStart(date, shopDaysOff)) return true;
    
    // If end date is selected, disable dates after end date
    if (endDate) {
      return isAfter(date, endDate);
    }
    
    return false;
  };

  const isEndDateDisabled = (date: Date) => {
    // Calcola la data minima consentita (oggi + giorni di anticipo)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const anticipoGiorni = shopSettings?.anticipo_prenotazioneGiorni || 0;
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + anticipoGiorni);
    minDate.setHours(0, 0, 0, 0);
    
    // Disable dates before minimum date (today + anticipo giorni)
    if (isBefore(date, minDate)) return true;
    
    // Disable dates that fall within shop days off periods (per data di fine)
    // Le date con enable_booking=true POSSONO essere selezionate come data di fine
    if (isDateDisabledForEnd(date, shopDaysOff)) return true;
    
    // If no start date is selected, disable all dates
    if (!startDate) return true;
    
    // If start date is selected, disable dates before start date
    return isBefore(date, startDate);
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    // If the new start date is after the current end date, clear the end date
    if (date && endDate && isAfter(date, endDate)) {
      setEndDate(undefined);
    }
    // If start date is cleared, also clear the end date
    if (!date && endDate) {
      setEndDate(undefined);
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    
    // Verifica se la data selezionata ha enable_booking=true
    if (date && isDateWithEnabledBooking(date, shopDaysOff)) {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Mostra l'alert dialog
      setClosedShopAlertData({ date, nextDay });
      setShowClosedShopAlert(true);
    }
    
    // If the new end date is before the current start date, clear the start date
    if (date && startDate && isBefore(date, startDate)) {
      setStartDate(undefined);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
      {/* Ricerca principale */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 ${compact ? "mb-4" : ""}`}>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <Input 
            placeholder="Nome attrezzatura..." 
            className="pl-10 h-12"
            value={equipmentName}
            onChange={(e) => setEquipmentName(e.target.value)}
          />
        </div>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <Input 
            placeholder="Località..." 
            className="pl-10 h-12"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <Button className="h-12 px-8 bg-[#3fafa3] hover:bg-[#3fafa3] text-white">
          Cerca
        </Button>
      </div>
      {/* Periodo di noleggio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <Label className="text-sm font-medium mb-2 block">Data inizio</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-12"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "dd MMMM yyyy", { locale: it }) : "Seleziona data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={handleStartDateChange}
                disabled={isStartDateDisabled}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label className="text-sm font-medium mb-2 block">Data fine</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-12"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "dd MMMM yyyy", { locale: it }) : "Seleziona data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={handleEndDateChange}
                disabled={isEndDateDisabled}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {/* Filtri avanzati */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div>
          <Label className="text-sm font-medium mb-2 block">Categoria</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {loadingCategories ? (
                <SelectItem value="loading" disabled>Caricamento...</SelectItem>
              ) : (
                categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
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
          <Label className="text-sm font-medium mb-2 block">Proprietario</Label>
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
        {setShowMap && (
          <Button 
            variant="outline" 
            onClick={() => setShowMap(!showMap)}
            className="flex items-center space-x-2 h-12"
          >
            <Map className="h-4 w-4" />
            <span>{showMap ? "Nascondi" : "Mostra"} mappa</span>
          </Button>
        )}
      </div>
      {/* Fascia di prezzo */}
      <div className="mt-6 pt-6 border-t">
        <div className="flex items-center space-x-6">
          <Label className="text-sm font-medium whitespace-nowrap">Fascia di prezzo:</Label>
          <div className="flex items-center space-x-4 flex-1 max-w-md">
            <span className="text-sm font-medium">€{priceRange[0]}</span>
            <Slider
              value={priceRange}
              onValueChange={setPriceRange}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="text-sm font-medium">€{priceRange[1]}</span>
            <span className="text-sm text-gray-500">/giorno</span>
          </div>
        </div>
      </div>
    </div>
  );
}
