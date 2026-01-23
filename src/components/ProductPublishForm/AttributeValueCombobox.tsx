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
import { fetchAttributeValues, createAttributeValue } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface AttributeValueItem {
  id: string;
  value: string;
  id_product_attribute: string;
}

interface AttributeValueComboboxProps {
  attributeId: string; // ID dell'attributo
  value: string; // ID del valore selezionato
  displayValue?: string; // Valore da mostrare (per compatibilità)
  onSelect: (id: string, value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function AttributeValueCombobox({
  attributeId,
  value,
  displayValue,
  onSelect,
  placeholder,
  disabled = false,
}: AttributeValueComboboxProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AttributeValueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [createNew, setCreateNew] = useState(false);
  const [newItemValue, setNewItemValue] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const loadItems = async () => {
      if (!attributeId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        const data = await fetchAttributeValues(attributeId);
        setItems(data);
      } catch (error) {
        console.error('Errore nel caricamento valori attributo:', error);
        toast({
          title: 'Errore',
          description: 'Impossibile caricare i valori dell\'attributo',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadItems();
  }, [attributeId, toast]);

  const selectedItem = items.find(item => item.id === value);
  const displayText = displayValue || selectedItem?.value || placeholder || 'Seleziona valore';

  const filteredItems = items.filter(item =>
    item.value.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleCreateNew = async () => {
    if (!newItemValue.trim()) return;
    if (!attributeId) {
      toast({
        title: 'Errore',
        description: 'Seleziona prima un attributo',
        variant: 'destructive',
      });
      return;
    }

    try {
      const newItem = await createAttributeValue(newItemValue.trim(), attributeId);
      setItems(prev => [...prev, newItem].sort((a, b) => a.value.localeCompare(b.value)));
      onSelect(newItem.id, newItem.value);
      setCreateNew(false);
      setNewItemValue("");
      setOpen(false);
      toast({
        title: 'Successo',
        description: 'Valore creato con successo',
      });
    } catch (error: any) {
      console.error('Errore nella creazione valore:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile creare il valore',
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
          disabled={disabled || !attributeId}
        >
          {displayText}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Cerca valore..."
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
                        Nessun valore trovato.
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
                    "Nessun valore disponibile."
                  )}
                </CommandEmpty>
                {!createNew && (
                  <CommandGroup>
                    {filteredItems.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.value}
                        onSelect={() => {
                          onSelect(item.id, item.value);
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
                        {item.value}
                      </CommandItem>
                    ))}
                    {searchValue && !filteredItems.some(item => 
                      item.value.toLowerCase() === searchValue.toLowerCase()
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
                      Crea nuovo valore
                    </div>
                    <Input
                      value={newItemValue}
                      onChange={(e) => setNewItemValue(e.target.value)}
                      placeholder="Nome valore"
                      className="mb-2"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateNew();
                        } else if (e.key === 'Escape') {
                          setCreateNew(false);
                          setNewItemValue("");
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
                          setNewItemValue("");
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

