import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { UserService } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import { ArrowLeft, Save, User, Calendar, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { COUNTRY_CALLING_CODES } from "@/constants";
import { countryCodeToFlagEmoji } from "@/lib/utils";
import { validateEmail } from "@/lib/authSchema";
import { Mail } from "lucide-react";

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isAdmin } = useAdminCheck();
  
  // Debug log per il profilo
  console.log('Profile component - user:', user?.email, 'profile:', profile);
  console.log('Is admin check:', isAdmin);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false
  });
  const [formData, setFormData] = useState({
    // Dati personali
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    birthDate: "",
    
    // Tipo utente
    userType: "individual" as "individual" | "admin"
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  // Phone input state
  const [phonePrefix, setPhonePrefix] = useState<string>(() => {
    const match = (formData.phone as string | undefined)?.match(/^\+\d+/);
    return match ? match[0] : "+39";
  });
  const [phoneLocal, setPhoneLocal] = useState<string>(() => {
    const original = (formData.phone as string | undefined) ?? "";
    return original.replace(/^\+\d+\s*/, "");
  });

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Carica i dati del profilo quando il componente si monta
  useEffect(() => {
    console.log('Profile data:', profile);
    console.log('User type:', profile?.user_type);
    console.log('Is admin?', profile?.user_type === 'admin');
    
    if (profile || user) {
      // Aggiorna formData
      setFormData({
        email: user?.email || "",
        firstName: profile?.first_name || "",
        lastName: profile?.last_name || "",
        phone: profile?.phone || "",
        birthDate: profile?.birth_date || "",
        userType: profile?.user_type || "individual"
      });

      // Aggiorna direttamente i campi del telefono per evitare delay
      if (profile.phone) {
        const match = profile.phone.match(/^\+\d+/);
        const newPrefix = match ? match[0] : "+39";
        const newLocal = profile.phone.replace(/^\+\d+\s*/, "");
        
        setPhonePrefix(newPrefix);
        setPhoneLocal(newLocal);
      } else {
        setPhonePrefix("+39");
        setPhoneLocal("");
      }
    }
  }, [profile, user]);

  // Combine phone prefix and local number when they change
  useEffect(() => {
    const combined = phoneLocal ? `${phonePrefix} ${phoneLocal}` : phonePrefix;
    if (combined !== formData.phone) {
      setFormData(prev => ({ ...prev, phone: combined }));
    }
  }, [phonePrefix, phoneLocal, formData.phone]);

  // Phone validation functions
  const getMaxDigitsForPrefix = (prefix: string): number => {
    const found = COUNTRY_CALLING_CODES.find((c) => c.code === prefix);
    return found?.maxDigits ?? 15;
  };

  const countDigits = (s: string): number => (s.match(/\d/g) || []).length;

  const handlePhoneLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers (0-9)
    const numbersOnly = value.replace(/[^0-9]/g, '');
    const digitsOnlyCount = numbersOnly.length;
    const maxDigits = getMaxDigitsForPrefix(phonePrefix);
    
    // Per l'Italia (+39), limita esattamente a 10 cifre
    if (phonePrefix === "+39") {
      if (digitsOnlyCount > 10) {
        // Preveni l'aggiunta di più di 10 cifre
        setPhoneLocal(numbersOnly.slice(0, 10));
        return;
      }
    } else if (digitsOnlyCount > maxDigits) {
      // Per altri paesi, usa il limite maxDigits
      setPhoneLocal(numbersOnly.slice(0, maxDigits));
      return;
    }
    
    setPhoneLocal(numbersOnly);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle name change - only letters (uppercase and lowercase)
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const value = e.target.value;
    // Allow only letters (a-z, A-Z) - no numbers, spaces, or special characters
    const lettersOnly = value.replace(/[^a-zA-Z]/g, '');
    setFormData(prev => ({
      ...prev,
      [field]: lettersOnly
    }));
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const togglePasswordVisibility = (field: 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validazione email
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      toast({
        title: "Email non valida",
        description: emailValidation.error || "L'email deve contenere @ e un punto (.)",
        variant: "destructive"
      });
      return;
    }
    
    // Validazione numero di telefono italiano (deve essere esattamente 10 cifre)
    if (formData.phone) {
      const phoneMatch = formData.phone.match(/^\+39\s*(.+)$/);
      if (phoneMatch) {
        const phoneLocal = phoneMatch[1];
        const digitsOnly = phoneLocal.replace(/\D/g, '');
        if (digitsOnly.length !== 10) {
          toast({
            title: "Numero di telefono non valido",
            description: "Il numero di cellulare italiano deve contenere esattamente 10 cifre.",
            variant: "destructive"
          });
          return;
        }
      }
    }
    
    // Validazione data di nascita - deve essere maggiorenne (18 anni o più)
    if (formData.birthDate) {
      const birthDate = new Date(formData.birthDate);
      const today = new Date();
      
      // Calcola l'età
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const dayDiff = today.getDate() - birthDate.getDate();
      
      // Se il compleanno non è ancora arrivato quest'anno, sottrai 1
      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--;
      }
      
      if (age < 18) {
        toast({
          title: "Età non valida",
          description: "Devi essere maggiorenne (almeno 18 anni) per utilizzare il servizio.",
          variant: "destructive"
        });
        return;
      }
    }
    
    setLoading(true);

    try {
      const result = await UserService.updateProfile(formData);
      
      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: "Profilo aggiornato!",
        description: "Le tue informazioni sono state salvate con successo.",
      });
    } catch (error: any) {
      toast({
        title: "Errore nell'aggiornamento",
        description: error.message || "Si è verificato un errore durante il salvataggio.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);

    try {
      console.log('Starting password change process...');
      
      // Controlla lo stato della rete
      if (networkStatus === 'offline') {
        throw new Error("Nessuna connessione internet. Verifica la tua connessione e riprova.");
      }
      
      // Validazione
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        throw new Error("Le password non coincidono");
      }

      if (passwordData.newPassword.length < 6) {
        throw new Error("La nuova password deve essere di almeno 6 caratteri");
      }

      // Verifica che l'utente sia ancora autenticato
      if (!user) {
        throw new Error("Sessione scaduta. Effettua nuovamente l'accesso.");
      }

      console.log('Using UserService to update password...');
      
      // Usa il servizio per aggiornare la password
      const result = await UserService.updatePassword(passwordData.newPassword);
      
      if (result.error) {
        throw new Error(result.error);
      }

      console.log('Password updated successfully');

      // Reset del form
      setPasswordData({
        newPassword: "",
        confirmPassword: ""
      });

      toast({
        title: "Password aggiornata!",
        description: "La tua password è stata cambiata con successo.",
      });
    } catch (error: any) {
      console.error('Password change error:', error);
      
      // Gestione errori specifici
      let errorMessage = error.message;
      if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = "Errore di connessione. Verifica la tua connessione internet e riprova.";
      } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
        errorMessage = "Sessione scaduta. Effettua nuovamente l'accesso.";
      } else if (error.message.includes('403') || error.message.includes('forbidden')) {
        errorMessage = "Non hai i permessi per eseguire questa operazione.";
      }
      
      toast({
        title: "Errore nel cambio password",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <FixedNavbar />
        <div className="flex-1 container mx-auto px-4 py-8 pt-20 md:pt-24">
          <div className="text-center">
            <p>Devi essere loggato per accedere a questa pagina.</p>
            <Button onClick={() => navigate('/auth')} className="mt-4">
              Accedi
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
      <FixedNavbar />
      
      <div className="flex-1 container mx-auto px-4 py-8 pt-20 md:pt-24 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Indietro
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Il mio profilo</h1>
            <p className="text-sm sm:text-base text-gray-600">Gestisci le tue informazioni personali</p>
          </div>
          {networkStatus === 'offline' && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm w-fit">
              <AlertCircle className="h-4 w-4" />
              Offline
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Dati Personali - Mostra solo se non è admin */}
          {!isAdmin && (
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Informazioni Personali
              </CardTitle>
              <CardDescription>
                Aggiorna le tue informazioni personali
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="tua.email@esempio.com"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nome *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleNameChange(e, "firstName")}
                      placeholder="Il tuo nome"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Cognome *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleNameChange(e, "lastName")}
                      placeholder="Il tuo cognome"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefono</Label>
                    <div className="flex gap-2">
                      <Select value={phonePrefix} onValueChange={setPhonePrefix}>
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
                        id="phoneLocal"
                        type="tel"
                        placeholder="123 456 7890"
                        value={phoneLocal}
                        onChange={handlePhoneLocalChange}
                        inputMode="numeric"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthDate">Data di nascita</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="birthDate"
                        type="date"
                        value={formData.birthDate}
                        onChange={(e) => handleInputChange("birthDate", e.target.value)}
                        className="pl-10"
                        max={(() => {
                          const today = new Date();
                          const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
                          return maxDate.toISOString().split('T')[0];
                        })()}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="text-white"
                    style={{ backgroundColor: '#E31E24', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#C01A1F'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E31E24'}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                         Salvataggio...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Save className="h-4 w-4" />
                        Salva Modifiche
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          )}

          {/* Cambio Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-red-600" />
                Cambio Password
              </CardTitle>
              <CardDescription>
                Cambia la tua password di accesso
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nuova Password *</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                      placeholder="Inserisci la nuova password"
                      className="pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => togglePasswordVisibility('new')}
                    >
                      {showPasswords.new ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">La password deve essere di almeno 6 caratteri</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Conferma Nuova Password *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
                      placeholder="Conferma la nuova password"
                      className="pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => togglePasswordVisibility('confirm')}
                    >
                      {showPasswords.confirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-gray-500">
                    {user ? `Utente: ${user.email}` : 'Utente non autenticato'}
                  </div>
                  <Button
                    type="submit"
                    disabled={passwordLoading || networkStatus === 'offline'}
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    {passwordLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                        Aggiornamento...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Cambia Password
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Profile; 