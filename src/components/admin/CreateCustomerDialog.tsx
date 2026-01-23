import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { COUNTRY_CALLING_CODES } from "@/constants";
import { countryCodeToFlagEmoji } from "@/lib/utils";

interface CreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated: () => void;
}

const CreateCustomerDialog = ({ open, onOpenChange, onCustomerCreated }: CreateCustomerDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Form state - only essential fields
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    birthDate: '',
  });

  // Phone field state
  const [phonePrefix, setPhonePrefix] = useState<string>("+39");
  const [phoneLocal, setPhoneLocal] = useState<string>("");

  // Update formData.phone when prefix or local part changes
  useEffect(() => {
    const combined = phoneLocal ? `${phonePrefix} ${phoneLocal}` : phonePrefix;
    setFormData(prev => ({ ...prev, phone: combined }));
  }, [phonePrefix, phoneLocal]);

  // Initialize phone fields from formData.phone if it exists
  useEffect(() => {
    if (formData.phone) {
      const match = formData.phone.match(/^(\+\d+)\s*(.*)/);
      if (match) {
        setPhonePrefix(match[1]);
        setPhoneLocal(match[2]);
      }
    }
  }, []);

  const handleInputChange = (field: string, value: string) => {
    // Validation for firstName and lastName - only letters allowed
    if (field === 'firstName' || field === 'lastName') {
      // Rimuovi tutto tranne lettere
      const lettersOnly = value.replace(/[^a-zA-Z]/g, '');
      
      // Se il valore originale contiene caratteri non consentiti, mostra errore
      if (value !== lettersOnly) {
        toast({
          title: "Errore",
          description: "Nome e cognome possono contenere solo lettere dell'alfabeto",
          variant: "destructive",
        });
      }
      
      // Imposta solo lettere
      setFormData(prev => ({ ...prev, [field]: lettersOnly }));
      return;
    }

    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getMaxDigitsForPrefix = (prefix: string): number => {
    const found = COUNTRY_CALLING_CODES.find((c) => c.code === prefix);
    return found?.maxDigits ?? 15;
  };

  const countDigits = (s: string): number => (s.match(/\d/g) || []).length;

  const handlePhoneLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Rimuovi tutto tranne i numeri
    const digitsOnly = value.replace(/[^0-9]/g, '');
    
    // Se il valore originale contiene caratteri non numerici, mostra errore
    if (value !== digitsOnly) {
      toast({
        title: "Errore",
        description: "Il campo telefono accetta solo numeri",
        variant: "destructive",
      });
    }
    
    const digitsOnlyCount = digitsOnly.length;
    const maxDigits = getMaxDigitsForPrefix(phonePrefix);
    
    if (digitsOnlyCount > maxDigits) {
      // Limita al numero massimo di cifre consentite
      setPhoneLocal(digitsOnly.slice(0, maxDigits));
      return;
    }
    
    // Imposta solo i numeri, senza formattazione
    setPhoneLocal(digitsOnly);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      birthDate: '',
    });
    setPhonePrefix("+39");
    setPhoneLocal("");
  };

  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('Error checking email:', error);
        return false;
      }

      return data !== null;
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.firstName || !formData.lastName || !phoneLocal || !formData.birthDate) {
      toast({
        title: "Errore",
        description: "Tutti i campi sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check if email already exists in profiles table
      const emailExists = await checkEmailExists(formData.email);
      
      if (emailExists) {
        toast({
          title: "Errore",
          description: "Un cliente con questa email esiste già nel sistema",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-customer-account', {
        body: {
          ...formData,
          userType: 'individual', // Default to individual since we're not asking
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Cliente creato con successo!",
          description: "Account creato e email di benvenuto inviata al cliente",
        });
        
        onCustomerCreated();
        handleClose();
      } else {
        throw new Error(data?.error || 'Errore sconosciuto');
      }
    } catch (error: any) {
      console.error('Error creating customer:', error);
      toast({
        title: "Errore nella creazione",
        description: error.message || "Si è verificato un errore imprevisto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Cliente</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="mario.rossi@email.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">Nome *</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="Mario"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Cognome *</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Rossi"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="phone">Telefono *</Label>
            <div className="flex gap-2">
              <Select value={phonePrefix} onValueChange={setPhonePrefix} required>
                <SelectTrigger className="w-28" aria-label="Prefisso telefonico">
                  <SelectValue placeholder="Prefisso" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CALLING_CODES.map((country) => (
                    <SelectItem key={country.iso2} value={country.code}>
                      {countryCodeToFlagEmoji(country.iso2)} {country.code} ({country.iso2})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="phone"
                type="tel"
                placeholder="123 456 7890"
                value={phoneLocal}
                onChange={handlePhoneLocalChange}
                inputMode="numeric"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="birthDate">Data di Nascita *</Label>
            <Input
              id="birthDate"
              type="date"
              value={formData.birthDate}
              onChange={(e) => handleInputChange('birthDate', e.target.value)}
              required
            />
          </div>

              <div className="bg-[#3fafa3]/10 border border-[#3fafa3]/30 rounded-lg p-3">
                <p className="text-sm text-[#3fafa3]">
                  <strong>Nota:</strong> Al cliente verrà inviata automaticamente un'email con le credenziali di accesso.
                </p>
              </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={loading}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creazione...
                </>
              ) : (
                'Crea Cliente'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCustomerDialog;
