import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { useCustomers } from "@/hooks/useCustomers";
import type { Customer } from "@/hooks/useCustomers";

interface CustomerAutocompleteProps {
  selectedCustomer: Customer | null;
  onCustomerSelect: (customer: Customer | null) => void;
  placeholder?: string;
}

export function CustomerAutocomplete({
  selectedCustomer,
  onCustomerSelect,
  placeholder = "Seleziona un cliente..."
}: CustomerAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const { customers, isLoading, error } = useCustomers();

  const getCustomerDisplayName = (customer: Customer) => {
    const firstName = customer.first_name || '';
    const lastName = customer.last_name || '';
    const email = customer.email || '';
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    } else {
      return email;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-10 px-3 py-2 text-sm border rounded-md bg-muted">
        Caricamento clienti...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-10 px-3 py-2 text-sm border rounded-md bg-red-50 text-red-600">
        Errore nel caricamento clienti
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedCustomer ? (
            getCustomerDisplayName(selectedCustomer)
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Cerca cliente..." />
          <CommandList>
            <CommandEmpty>Nessun cliente trovato.</CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={`${customer.first_name || ''} ${customer.last_name || ''} ${customer.email || ''}`}
                  onSelect={() => {
                    onCustomerSelect(customer);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <User className="mr-2 h-4 w-4" />
                  {getCustomerDisplayName(customer)}
                  {customer.age && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({customer.age} anni)
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
} 