import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fetchProductBrands, fetchProductModels, createProductBrand, createProductModel } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface BrandModelItem {
  id: string;
  name: string;
}

interface BrandModelComboboxProps {
  type: 'brand' | 'model';
  value: string; // ID selezionato
  displayValue?: string; // Nome da mostrare (per compatibilità con formData.brand/model)
  onSelect: (id: string, name: string) => void;
  placeholder?: string;
  brandId?: string; // Per filtrare i modelli per brand
  disabled?: boolean;
  allowNone?: boolean; // Permette di selezionare "N/A"
}

export function BrandModelCombobox({
  type,
  value,
  displayValue,
  onSelect,
  placeholder,
  brandId,
  disabled = false,
  allowNone = false,
}: BrandModelComboboxProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BrandModelItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [createNew, setCreateNew] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const loadItems = async () => {
      setIsLoading(true);
      try {
        if (type === 'brand') {
          const data = await fetchProductBrands();
          setItems(data);
        } else {
          const data = await fetchProductModels(brandId);
          setItems(data);
        }
      } catch (error) {
        console.error(`Errore nel caricamento ${type === 'brand' ? 'brand' : 'modelli'}:`, error);
        toast({
          title: 'Errore',
          description: `Impossibile caricare i ${type === 'brand' ? 'brand' : 'modelli'}`,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadItems();
  }, [type, brandId, toast]);

  const selectedItem = items.find(item => item.id === value);
  const displayText = displayValue || selectedItem?.name || placeholder || `Seleziona ${type === 'brand' ? 'marca' : 'modello'}`;

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleCreateNew = async () => {
    if (!newItemName.trim()) return;

    try {
      let newItem: BrandModelItem;
      if (type === 'brand') {
        newItem = await createProductBrand(newItemName.trim());
      } else {
        if (!brandId) {
          toast({
            title: 'Errore',
            description: 'Seleziona prima una marca',
            variant: 'destructive',
          });
          return;
        }
        newItem = await createProductModel(newItemName.trim(), brandId);
      }

      setItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
      onSelect(newItem.id, newItem.name);
      setCreateNew(false);
      setNewItemName("");
      setOpen(false);
      toast({
        title: 'Successo',
        description: `${type === 'brand' ? 'Marca' : 'Modello'} creato con successo`,
      });
    } catch (error: any) {
      console.error(`Errore nella creazione ${type === 'brand' ? 'brand' : 'modello'}:`, error);
      toast({
        title: 'Errore',
        description: error.message || `Impossibile creare il ${type === 'brand' ? 'brand' : 'modello'}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {displayText}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder={`Cerca ${type === 'brand' ? 'marca' : 'modello'}...`}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm">Caricamento...</div>
            ) : (
              <>
                <CommandEmpty>
                  {searchValue ? (
                    <div className="py-2">
                      <div className="text-sm text-muted-foreground mb-2">
                        Nessun {type === 'brand' ? 'brand' : 'modello'} trovato.
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setCreateNew(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Crea "{searchValue}"
                      </Button>
                    </div>
                  ) : (
                    `Nessun ${type === 'brand' ? 'brand' : 'modello'} disponibile.`
                  )}
                </CommandEmpty>
                {!createNew && (
                  <CommandGroup>
                    {allowNone && (
                      <CommandItem
                        value="N/A"
                        onSelect={() => {
                          onSelect('N/A', 'N/A');
                          setOpen(false);
                          setSearchValue("");
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            (value === 'N/A' || value === '' || value === null) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        N/A
                      </CommandItem>
                    )}
                    {filteredItems.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.name}
                        onSelect={() => {
                          onSelect(item.id, item.name);
                          setOpen(false);
                          setSearchValue("");
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === item.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {item.name}
                      </CommandItem>
                    ))}
                    {searchValue && !filteredItems.some(item => 
                      item.name.toLowerCase() === searchValue.toLowerCase()
                    ) && (
                      <CommandItem
                        onSelect={() => setCreateNew(true)}
                        className="text-primary"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Crea "{searchValue}"
                      </CommandItem>
                    )}
                  </CommandGroup>
                )}
                {createNew && (
                  <div className="p-2 border-t">
                    <div className="text-sm font-medium mb-2">
                      Crea nuovo {type === 'brand' ? 'brand' : 'modello'}
                    </div>
                    <Input
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder={`Nome ${type === 'brand' ? 'brand' : 'modello'}`}
                      className="mb-2"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateNew();
                        } else if (e.key === 'Escape') {
                          setCreateNew(false);
                          setNewItemName("");
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleCreateNew}
                        className="flex-1"
                      >
                        Crea
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCreateNew(false);
                          setNewItemName("");
                        }}
                        className="flex-1"
                      >
                        Annulla
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

