
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthForm from "@/components/auth/AuthForm";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { validateEmail } from "@/lib/authSchema";

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'register');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [userType] = useState<"individual" | "admin">("individual");
  const [loading, setLoading] = useState(false);
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [taxCodeFile, setTaxCodeFile] = useState<File | null>(null);

  const initialForm = {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    birthDate: "",
    address: "",
    city: "",
    postalCode: "",
    province: "",
    taxCode: "",
    companyName: "",
    vatNumber: "",
    companyAddress: "",
    companyCity: "",
    companyPostalCode: "",
    companyProvince: "",
    legalRepresentative: "",
    businessSector: "",
    companyDescription: "",
    website: "",
    registrationNumber: "",
    acceptTerms: false,
  };
  const [formData, setFormData] = useState(initialForm);

  const { signUp, signIn, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      // Piccolo delay per assicurarsi che il localStorage sia aggiornato
      const timeoutId = setTimeout(() => {
        // Controlla se c'è un carrello pendente da recuperare
        const pendingCartItem = localStorage.getItem('pendingCartItem');
        const redirectParam = searchParams.get('redirect');
        
        console.log('[AuthPage] Utente loggato, controllando pendingCartItem:', { 
          hasPendingCartItem: !!pendingCartItem, 
          redirectParam,
          userId: user.id
        });
        
        if (pendingCartItem) {
          try {
            const cartData = JSON.parse(pendingCartItem);
            console.log('[AuthPage] pendingCartItem parsato:', {
              returnUrl: cartData.returnUrl,
              productId: cartData.productId,
              variantId: cartData.variantId,
              startDate: cartData.startDate,
              endDate: cartData.endDate
            });
            
            // Se c'è un returnUrl, naviga a quella pagina (con le date già nei parametri)
            if (cartData.returnUrl) {
              console.log('[AuthPage] Navigando al returnUrl:', cartData.returnUrl);
              // Non rimuovere il pendingCartItem qui, lo farà la pagina di destinazione
              navigate(cartData.returnUrl, { replace: true });
              return;
            }
            
            // Se non c'è returnUrl ma c'è redirect=checkout, naviga al checkout
            if (redirectParam === 'checkout') {
              console.log('[AuthPage] Navigando al checkout (redirect=checkout)');
              // Non rimuovere il pendingCartItem qui, lo farà il Checkout
              navigate('/checkout', { replace: true });
              return;
            }
            
            console.log('[AuthPage] Nessun returnUrl e nessun redirect=checkout, navigando alla home');
          } catch (error) {
            console.error('[AuthPage] Errore nel parsing del pendingCartItem:', error);
            localStorage.removeItem('pendingCartItem');
          }
        }
        
        // Naviga alla home solo se non c'è un carrello pendente o se c'è stato un errore
        if (!pendingCartItem) {
          console.log('[AuthPage] Nessun pendingCartItem, navigando alla home');
          navigate("/", { replace: true });
        }
      }, 100); // Piccolo delay per assicurarsi che tutto sia pronto
      
      return () => clearTimeout(timeoutId);
    }
  }, [user, navigate, searchParams]);

  useEffect(() => {
    setIsLogin(searchParams.get('mode') !== 'register');
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

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

    if (!isLogin && !formData.acceptTerms) {
      toast({
        title: "Devi accettare i termini per registrarti.",
        variant: "destructive"
      });
      return;
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      toast({
        title: "Le password non combaciano",
        description: "Assicurati che le due password inserite siano identiche.",
        variant: "destructive"
      });
      return;
    }

    if (!isLogin && formData.password.length < 6) {
      toast({
        title: "Password troppo corta",
        description: "La password deve essere di almeno 6 caratteri.",
        variant: "destructive"
      });
      return;
    }

    // Validazione numero di telefono - obbligatorio
    if (!isLogin && userType === "individual") {
      if (!formData.phone || formData.phone.trim() === "") {
        toast({
          title: "Telefono obbligatorio",
          description: "Il numero di telefono è obbligatorio.",
          variant: "destructive"
        });
        return;
      }
      
      // Verifica che il telefono non sia solo il prefisso
      const phoneMatch = formData.phone.match(/^(\+\d+)\s*(.+)$/);
      if (!phoneMatch || !phoneMatch[2] || phoneMatch[2].trim() === "") {
        toast({
          title: "Telefono non valido",
          description: "Inserisci un numero di telefono valido.",
          variant: "destructive"
        });
        return;
      }
      
      // Validazione numero di telefono italiano (deve essere esattamente 10 cifre)
      if (phoneMatch[1] === "+39") {
        const phoneLocal = phoneMatch[2];
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

    // Validazione data di nascita - obbligatoria e deve essere maggiorenne (18 anni o più)
    if (!isLogin && userType === "individual") {
      if (!formData.birthDate || formData.birthDate.trim() === "") {
        toast({
          title: "Data di nascita obbligatoria",
          description: "La data di nascita è obbligatoria.",
          variant: "destructive"
        });
        return;
      }
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
          description: "Devi essere maggiorenne (almeno 18 anni) per registrarti.",
          variant: "destructive"
        });
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        await signIn(formData.email, formData.password);
      } else {
        let signUpData: Record<string, any> = {
          userType,
          email: formData.email,
          password: formData.password,
        };

        if (userType === "individual") {
          signUpData = {
            ...signUpData,
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone,
            birthDate: formData.birthDate,
            address: formData.address,
            city: formData.city,
            postalCode: formData.postalCode,
            province: formData.province,
            taxCode: formData.taxCode,
            identityFile,
            taxCodeFile,
          }
        } else {
          signUpData = {
            ...signUpData,
            companyName: formData.companyName,
            vatNumber: formData.vatNumber,
            companyAddress: formData.companyAddress,
            companyCity: formData.companyCity,
            companyPostalCode: formData.companyPostalCode,
            companyProvince: formData.companyProvince,
            legalRepresentative: formData.legalRepresentative,
            businessSector: formData.businessSector,
            companyDescription: formData.companyDescription,
            website: formData.website,
            registrationNumber: formData.registrationNumber,
            phone: formData.phone,
          }
        }
        await signUp(signUpData);
      }
      // Non navigare qui, lascia che il useEffect gestisca la navigazione dopo il login
      // Il useEffect controllerà se c'è un pendingCartItem e navigherà di conseguenza
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setIsForgotPassword(false);
    const newUrl = isLogin ? '/auth?mode=register' : '/auth';
    window.history.pushState({}, '', newUrl);
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
  };

  const handleForgotPassword = () => {
    setIsForgotPassword(true);
  };

  return (
    <AuthLayout isLogin={isLogin} isForgotPassword={isForgotPassword}>
      {isForgotPassword ? (
        <ForgotPasswordForm onBackToLogin={handleBackToLogin} />
      ) : (
        <AuthForm
          isLogin={isLogin}
          formData={formData}
          setFormData={setFormData}
          identityFile={identityFile}
          setIdentityFile={setIdentityFile}
          taxCodeFile={taxCodeFile}
          setTaxCodeFile={setTaxCodeFile}
          loading={loading}
          onSubmit={handleSubmit}
          onToggleMode={toggleMode}
          onForgotPassword={handleForgotPassword}
        />
      )}
    </AuthLayout>
  );
};

export default AuthPage;
