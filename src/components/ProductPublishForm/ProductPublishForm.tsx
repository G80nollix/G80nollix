import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ArrowRight, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCreateProduct, useUpdateProduct, useProduct } from "@/hooks/useProducts";
import { PRODUCT_STATUS, CONDITIONS } from "@/constants";
import BasicInfoSection from "./BasicInfoSection";
import ConditionLocationSection from "./ConditionLocationSection";
import useProductImageUpload from "./useProductImageUpload";
import StepPricingAndOptionsSection from "./StepPricingAndOptionsSection";
import ProductPricingSection from "./ProductPricingSection";
import { supabase } from "@/integrations/supabase/client";
import { useProductCategories } from '@/hooks/useProductCategories';
import { useProductSubcategories } from '@/hooks/useProductSubcategories';
import { useProductConditions } from '@/hooks/useProductConditions';
import type { ProductFormData } from '@/types';
import { ProductService } from '@/services/api';
import { useEffect as useReactEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const steps = [
  { label: "Informazioni generali", component: BasicInfoSection },
  { label: "Scheda tecnica", component: ConditionLocationSection },
  { label: "Prezzi", component: ProductPricingSection },
  { label: "Opzioni di noleggio", component: StepPricingAndOptionsSection },
];

export default function ProductPublishForm({ productId }: { productId?: string }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { mutate: createProduct, isPending: loading } = useCreateProduct();
  const { mutate: updateProduct, isPending: updating } = useUpdateProduct();
  const { product, isLoading: loadingProduct, error: errorProduct } = useProduct(productId || "");
  const { 
    images,
    imageUrls, 
    handleImageChange, 
    resetImages, 
    setImageUrls, 
    setImages,
    uploadImages,
    uploading 
  } = useProductImageUpload();
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileDb, setProfileDb] = useState<{ user_type: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    description: '',
    images: [],
    status: 'active',
    brand: '',
    model: '',
    delivery: false,
    pickup_on_site: false,
    has_variants: false,
    min_rent_duration_day: undefined,
    min_rent_duration_hours: undefined,
    dimensions: '',
    weight: '',
    company_id: null,
    deposit: undefined,
    product_category_id: '',
    product_subcategory_id: '',
    product_condition_id: '',
  });

  const { data: categories, isLoading: loadingCategories } = useProductCategories();
  // Carica le sottocategorie in base alla categoria selezionata
  const { data: subcategories, isLoading: loadingSubcategories } = useProductSubcategories(formData.product_category_id || undefined);
  const { data: productConditions, isLoading: loadingConditions, error: errorConditions } = useProductConditions();


  const [currentStep, setCurrentStep] = useState(0);

  // Sostituisco images/imageUrls con due stati separati:
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]); // immagini già presenti
  const [newImages, setNewImages] = useState<File[]>([]); // nuove immagini selezionate


  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      setProfileLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_type')
        .eq('id', user.id)
        .maybeSingle();
      setProfileDb(data || null);
      setProfileLoading(false);
    };
    fetchProfile();
  }, [user]);

  // Effetto: quando il prodotto è caricato, recupera la categoria dalla sottocategoria
  useReactEffect(() => {
    if (productId && product && !loadingProduct && product.id_product_subcategory) {
      // Recupera la categoria dalla sottocategoria
      supabase
        .from('product_subcategories')
        .select('product_category_id')
        .eq('id', product.id_product_subcategory)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data?.product_category_id) {
            setFormData(prev => {
              // Solo se non è già impostata
              if (prev.product_category_id) return prev;
              return {
                ...prev,
                product_category_id: data.product_category_id,
              };
            });
          }
        });
    }
  }, [productId, product?.id, product?.id_product_subcategory, loadingProduct]);

  // Effetto: quando il prodotto è caricato, imposto tutti i dati
  useReactEffect(() => {
    if (productId && product && !loadingProduct) {
      setExistingImageUrls(product.images || product.variant?.images || []);
      setNewImages([]); // reset nuove immagini
      
      setFormData(prev => ({
        ...prev,
        title: product.title || product.name || '',
        description: product.description || '',
        status: product.status || (product.is_active ? 'active' : 'paused'),
        id_brand: product.id_brand || null,
        brand: product.brand || product.product_brand?.name || '',
        id_model: product.id_model || null,
        model: product.model || product.product_model?.name || '',
        delivery: product.delivery ?? product.can_be_delivered ?? false,
        pickup_on_site: product.pickup_on_site ?? product.can_be_picked_up ?? false,
        has_variants: product.has_variants ?? false,
        price_hour: product.price_hour ?? product.variant?.price_hour ?? undefined,
        price_daily: product.price_daily ?? product.variant?.price_daily ?? undefined,
        price_weekly: product.price_weekly ?? product.variant?.price_weekly ?? undefined,
        price_monthly: product.price_monthly ?? product.variant?.price_monthly ?? undefined,
        price_season: product.price_season ?? product.variant?.price_season ?? undefined,
        min_rent_duration_day: product.min_rent_days ?? undefined,
        min_rent_duration_hours: product.min_rent_hours ?? undefined,
        dimensions: '', // Rimosso dalla nuova struttura
        weight: '', // Rimosso dalla nuova struttura
        company_id: product.company_id || null,
        deposit: product.deposit ?? product.variant?.deposit ?? undefined,
        product_subcategory_id: product.id_product_subcategory || '',
        product_condition_id: '', // Rimosso dalla nuova struttura
      }));
    }
  }, [productId, product, loadingProduct]);

  // Effetto: quando le subcategorie sono caricate, imposto la sottocategoria SOLO se valida
  useReactEffect(() => {
      if (
        productId &&
        product &&
        subcategories &&
        subcategories.length > 0
      ) {
        const found = subcategories.find(
          (sub) => sub.id === product.id_product_subcategory
        );
        setFormData(prev => ({
          ...prev,
          product_subcategory_id: found ? found.id : '',
        }));
      }
  }, [productId, product, subcategories]);


  // Handler per aggiunta nuove immagini
  const handleNewImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Controllo dimensione massima (2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB in bytes
    for (const file of files) {
      if (file.size > maxSize) {
        toast({
          variant: "destructive",
          title: "Errore",
          description: `L'immagine "${file.name}" è troppo grande. La dimensione massima consentita è 2MB.`,
        });
        return;
      }
    }
    
    setNewImages(prev => [...prev, ...files].slice(0, 3 - existingImageUrls.length));
  };

  // Handler per rimozione immagini esistenti - ora elimina anche dal bucket
  const handleRemoveExistingImage = async (idx: number) => {
    const imageUrl = existingImageUrls[idx];
    
    try {
      // Estrai il path del file dall'URL di Supabase
      // L'URL è del tipo: https://xxx.supabase.co/storage/v1/object/public/product-images/filename.jpg
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      if (fileName) {
        // Elimina il file dal bucket
        const { error } = await supabase.storage
          .from('product-images')
          .remove([fileName]);
        
        if (error) {
          console.error('Errore eliminazione file:', error);
          toast({
            title: 'Errore',
            description: 'Impossibile eliminare il file. L\'immagine è stata rimossa solo dalla lista.',
            variant: 'destructive',
          });
        } else {
          console.log('File eliminato dal bucket:', fileName);
        }
      }
    } catch (error) {
      console.error('Errore durante eliminazione file:', error);
      // Continua comunque a rimuovere dall'interfaccia
    }
    
    // Rimuovi dallo stato (sempre, anche se l'eliminazione dal bucket fallisce)
    setExistingImageUrls(urls => urls.filter((_, i) => i !== idx));
  };

  // Handler per rimozione nuove immagini (solo dallo stato, non dal bucket)
  const handleRemoveNewImage = (idx: number) => {
    setNewImages(imgs => imgs.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileLoading || isSubmitting) return;
    
    setIsSubmitting(true);
    
    // Validazione obbligatoria per delivery
    if (!formData.pickup_on_site && !formData.delivery) {
      toast({
        title: 'Modalità di consegna richiesta',
        description: 'Seleziona almeno una modalità di ritiro/spedizione.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    
    const userType = profileDb?.user_type;
    if (userType !== 'admin') {
      toast({
        title: 'Solo aziende',
        description: 'Solo aziende possono pubblicare prodotti.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }
    try {
      let uploadedUrls: string[] = [];
      if (newImages.length > 0) {
        if (!user?.id) throw new Error('Utente non valido');
        // Carica nuove immagini
        uploadedUrls = await uploadImages(user.id, newImages);
      }
      // Combina immagini esistenti (non rimosse) + nuove caricate
      const finalImages = [...existingImageUrls, ...uploadedUrls];
      // Mappa i dati alla nuova struttura
      const payload: any = {
        name: formData.title || formData.name, // title → name
        description: formData.description,
        id_product_subcategory: formData.id_product_subcategory || formData.product_subcategory_id || null,
        id_brand: formData.id_brand === '' || formData.id_brand === undefined ? null : formData.id_brand,
        id_model: formData.id_model === '' || formData.id_model === undefined ? null : formData.id_model,
        is_active: formData.is_active ?? (formData.status === 'active'),
        can_be_delivered: formData.can_be_delivered ?? formData.delivery ?? true,
        can_be_picked_up: formData.can_be_picked_up ?? formData.pickup_on_site ?? true,
        has_variants: formData.has_variants ?? false,
        company_id: formData.company_id || user?.id || null,
        // Prezzi per periodo (salvati in product_price_list)
        pricePeriods: formData.pricePeriods || {},
        min_rent_days: formData.min_rent_duration_day ?? null,
        min_rent_hours: formData.min_rent_duration_hours ?? null,
        images: finalImages,
        deposit: formData.deposit ?? null,
        // Attributi informativi
        informativeAttributes: formData.informativeAttributes || {},
        // Campi legacy per compatibilità
        title: formData.title,
        brand: formData.brand,
        model: formData.model,
      };
      if (productId) {
        // UPDATE
        if (!productId || typeof productId !== 'string' || productId.trim() === '') {
          toast({
            title: 'Errore ID prodotto',
            description: 'ID prodotto non valido. Impossibile aggiornare.',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }
        console.log('Aggiornamento prodotto:', { productId, payload });
        updateProduct({ id: productId, productData: payload }, {
          onSuccess: () => {
            toast({
              title: 'Prodotto aggiornato',
              description: 'Le modifiche sono state salvate!',
              variant: 'default',
            });
            navigate('/admin/catalog');
          },
          onError: (error: any) => {
            if (error?.code === 'PGRST116') {
              toast({
                title: 'Prodotto non trovato',
                description: 'Il prodotto non esiste o è già stato eliminato.',
                variant: 'destructive',
              });
            } else {
              toast({
                title: 'Errore aggiornamento',
                description: error?.message || 'Errore durante il salvataggio',
                variant: 'destructive',
              });
            }
            setIsSubmitting(false);
          }
        });
      } else {
        // CREATE
        console.log('Payload prodotto:', payload);
        const { data, error } = await ProductService.createProduct(payload);
        if (error) {
          console.error('Errore creazione prodotto:', error);
          toast({
            title: 'Errore pubblicazione',
            description: error || 'Errore sconosciuto durante la pubblicazione del prodotto',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }
        
        if (!data) {
          toast({
            title: 'Errore pubblicazione',
            description: 'Il prodotto non è stato creato correttamente',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }
        
        // Reindirizza alla pagina di successo con i parametri del prodotto
        const successUrl = `/product-success?id=${data?.id}&title=${encodeURIComponent(formData.title)}`;
        navigate(successUrl);
      }
    } catch (err: any) {
      console.error('Errore durante pubblicazione:', err);
      toast({
        title: 'Errore',
        description: err?.message || err?.error || 'Errore durante la pubblicazione',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  // Validazione per uno step specifico
  const isStepValid = (stepIndex?: number) => {
    const step = stepIndex !== undefined ? stepIndex : currentStep;
    
    if (step === 0) {
      const titleValid = formData.title && formData.title.trim() !== '';
      const descriptionValid = formData.description && formData.description.trim() !== '';
      const categoryValid = formData.product_category_id && formData.product_category_id.trim() !== '';
      const subcategoryValid = formData.product_subcategory_id && formData.product_subcategory_id.trim() !== '';
      return titleValid && descriptionValid && categoryValid && subcategoryValid;
    }
    if (step === 1) {
      // Marca e modello sono opzionali (possono essere N/A/null)
      // Lo step è sempre valido perché non ci sono campi obbligatori
      return true;
    }
    if (step === 2) {
      // Step Prezzi - nessun campo obbligatorio, l'utente può selezionare i periodi che vuole
      // Lo step è sempre valido perché non ci sono campi obbligatori
      return true;
    }
    if (step === 3) {
      // Almeno una modalità di ritiro/spedizione deve essere selezionata
      return formData.pickup_on_site === true || formData.delivery === true;
    }
    return true;
  };

  // Ottiene il messaggio di errore per uno step specifico
  const getStepErrorMessage = (stepIndex: number): string => {
    switch (stepIndex) {
      case 0:
        return 'Compila tutti i campi obbligatori: titolo, descrizione, categoria e sottocategoria';
      case 1:
        return 'Marca e modello sono opzionali';
      case 2:
        return 'I prezzi sono opzionali. Seleziona i periodi per cui vuoi impostare un prezzo.';
      case 3:
        return 'Seleziona almeno una modalità di ritiro/spedizione';
      default:
        return 'Compila tutti i campi obbligatori di questa sezione';
    }
  };

  // Calcola il progresso di completamento per ogni step
  const calculateStepProgress = (step: number) => {
    if (step === 0) {
      const totalFields = 4; // titolo, descrizione, categoria, sottocategoria (immagini non obbligatorie)
      let completedFields = 0;
      
      if (formData.title && formData.title.trim() !== '') completedFields++;
      if (formData.description && formData.description.trim() !== '') completedFields++;
      if (formData.product_category_id && formData.product_category_id.trim() !== '') completedFields++;
      if (formData.product_subcategory_id && formData.product_subcategory_id.trim() !== '') completedFields++;
      
      return (completedFields / totalFields) * 100;
    }
    
    if (step === 1) {
      // Marca e modello sono opzionali
      // Lo step è considerato completo quando entrambi hanno un valore (anche N/A/null)
      const totalFields = 2; // marca, modello
      let completedFields = 0;
      
      // Considera completato se ha un valore (anche null/N/A significa che l'utente ha fatto una scelta)
      // null significa che l'utente ha selezionato N/A, undefined significa che non ha ancora scelto
      if (formData.id_brand !== undefined || formData.brand !== undefined) completedFields++;
      if (formData.id_model !== undefined || formData.model !== undefined) completedFields++;
      
      return (completedFields / totalFields) * 100;
    }
    
    if (step === 2) {
      // Step Prezzi - nessun campo obbligatorio
      // Calcola il progresso basato sui periodi selezionati con prezzo
      const pricePeriods = formData.pricePeriods || {};
      const selectedPeriods = Object.keys(pricePeriods).filter(
        periodId => pricePeriods[periodId] !== null && 
                   pricePeriods[periodId] !== undefined && 
                   Number(pricePeriods[periodId]) > 0
      );
      
      // Se almeno un periodo ha un prezzo, considera lo step al 100%
      // Altrimenti 0% (ma lo step è comunque valido per andare avanti)
      return selectedPeriods.length > 0 ? 100 : 0;
    }
    
    if (step === 3) {
      const totalFields = 1; // modalità di ritiro
      let completedFields = 0;
      
      if (formData.pickup_on_site || formData.delivery) completedFields++;
      
      return (completedFields / totalFields) * 100;
    }
    
    return 0;
  };

  const currentProgress = calculateStepProgress(currentStep);

  if (profileLoading) {
    return <div className="text-center py-8">Caricamento profilo azienda...</div>;
  }
  if (errorConditions) {
    return <div className="text-center py-8 text-red-600">Errore nel caricamento delle condizioni prodotto. Riprova più tardi.</div>;
  }
  if (loadingConditions) {
    return <div className="text-center py-8">Caricamento condizioni prodotto...</div>;
  }
  if (productId && loadingProduct) {
    return <div className="text-center py-8">Caricamento dati prodotto...</div>;
  }
  if (productId && errorProduct) {
    return <div className="text-center py-8 text-red-600">Errore nel caricamento del prodotto. Riprova più tardi.</div>;
  }

  return (
    <Card className="w-full max-w-[95%] mx-auto">
      <CardHeader>
        {/* Stepper */}
        <div className="mt-6 px-4">
          <div className="flex items-start justify-between">
            {steps.map((step, index) => {
              // Navigazione sequenziale: solo step precedenti/completi e validi
              const stepIsValid = isStepValid(index);
              const canNavigate = index <= currentStep && stepIsValid;
              
              return (
                <div 
                  key={index} 
                  className="flex flex-col items-center flex-1 relative"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Se si sta già su questo step, non fare nulla
                    if (index === currentStep) {
                      return;
                    }
                    
                    // Verifica nuovamente la validità dello step
                    const isValid = isStepValid(index);
                    
                    // Navigazione permessa solo se lo step è precedente/completo e valido
                    if (index <= currentStep && isValid) {
                      setCurrentStep(index);
                    } else {
                      // Mostra messaggio di errore
                      if (!isValid) {
                        toast({
                          title: 'Sezione non disponibile',
                          description: getStepErrorMessage(index),
                          variant: 'destructive',
                        });
                      } else {
                        toast({
                          title: 'Sezione non disponibile',
                          description: 'Completa prima gli step precedenti',
                          variant: 'destructive',
                        });
                      }
                    }
                  }}
                  style={{ cursor: canNavigate ? 'pointer' : 'not-allowed' }}
                >
                  {/* Connector Line - sopra */}
                  {index < steps.length - 1 && (
                    <div className={`
                      absolute top-4 left-[60%] right-0 h-0.5
                      ${index < currentStep ? 'bg-green-500' : 'bg-gray-300'}
                    `} style={{ width: 'calc(100% - 2rem)' }} />
                  )}
                  
                  {/* Step Circle */}
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium relative z-10
                    transition-all duration-200
                    ${index < currentStep 
                      ? 'bg-green-500 border-green-500 text-white' // Completato
                      : index === currentStep 
                      ? 'bg-blue-500 border-blue-500 text-white' // Corrente
                      : canNavigate
                      ? 'bg-gray-200 border-gray-300 text-gray-500' // Futuro ma navigabile
                      : 'bg-gray-100 border-gray-200 text-gray-400 opacity-60' // Futuro non navigabile
                    }
                    ${canNavigate ? 'hover:scale-110 hover:shadow-md' : ''}
                  `}>
                    {index < currentStep ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  
                  {/* Step Title */}
                  <div className={`
                    mt-2 text-xs text-center font-medium max-w-[80px] leading-tight transition-colors
                    ${index < currentStep 
                      ? 'text-green-600' // Completato
                      : index === currentStep 
                      ? 'text-blue-600' // Corrente
                      : canNavigate
                      ? 'text-gray-500' // Futuro ma navigabile
                      : 'text-gray-400 opacity-60' // Futuro non navigabile
                    }
                    ${canNavigate ? 'hover:text-blue-600' : ''}
                  `}>
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Titolo della sezione corrente */}
        <div className="text-center mb-6">
          {currentStep === 2 && (formData.has_variants ?? false) ? (
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-2xl font-bold">Prezzi</h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full w-5 h-5 bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors cursor-help"
                      aria-label="Informazioni sui prezzi"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Se vuoi puoi inserire i prezzi di riferimento per le varianti prodotto. In questo modo le varianti erediteranno automaticamente questi prezzi, ma potrai cambiarli in futuro.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <h2 className="text-2xl font-bold">
              {currentStep === 0
                ? 'Informazioni generali'
                : currentStep === 1
                ? 'Scheda tecnica'
                : currentStep === 2
                ? 'Prezzi'
                : currentStep === 3
                ? 'Opzioni di noleggio'
                : 'Informazioni generali'}
            </h2>
          )}
        </div>
        
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Step content */}
          {(() => {
            const StepComponent = steps[currentStep].component;
            if (StepComponent === BasicInfoSection) {
              return (
                <BasicInfoSection
                  formData={formData}
                  setFormData={setFormData}
                  categories={categories || []}
                  subcategories={subcategories || []}
                  loadingCategories={loadingCategories}
                  loadingSubcategories={loadingSubcategories}
                  existingImageUrls={existingImageUrls}
                  newImages={newImages}
                  onRemoveExistingImage={handleRemoveExistingImage}
                  onRemoveNewImage={handleRemoveNewImage}
                  onNewImageChange={handleNewImageChange}
                />
              );
            }
            if (StepComponent === ConditionLocationSection) {
              return (
                <ConditionLocationSection
                  formData={formData}
                  setFormData={setFormData}
                  conditions={productConditions || []}
                  loadingConditions={loadingConditions}
                  productId={productId}
                />
              );
            }
            if (StepComponent === ProductPricingSection) {
              return (
                <ProductPricingSection
                  formData={formData}
                  setFormData={setFormData}
                  productId={productId}
                />
              );
            }
            if (StepComponent === StepPricingAndOptionsSection) {
              return (
                <StepPricingAndOptionsSection
                  formData={formData}
                  setFormData={setFormData}
                />
              );
            }
            return null;
          })()}

          {/* Navigation buttons */}
          <div className="flex justify-between items-center mt-8">
            {/* Pulsante Annulla modifiche */}
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/admin/catalog")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Annulla modifiche
            </Button>

            {/* Pulsanti di navigazione a destra */}
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                  className="flex items-center justify-center rounded-full w-12 h-12 shadow border-2 border-green-600 bg-white hover:bg-green-50 transition-colors"
                >
                  <ArrowLeft className="w-6 h-6 text-green-600" />
                </Button>
              )}
              {currentStep === steps.length - 1 && (
                <Button
                  type="submit"
                  disabled={isSubmitting || uploading || !(formData.pickup_on_site || formData.delivery)}
                  className="flex items-center justify-center rounded-full w-12 h-12 shadow bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting || uploading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    "Salva"
                  )}
                </Button>
              )}
              {currentStep < steps.length - 1 && (
                <Button
                  type="button"
                  onClick={() => {
                    // Se si sta modificando un prodotto, permettere navigazione libera solo se lo step corrente è valido
                    // Altrimenti validare prima di procedere
                    const nextStep = currentStep + 1;
                    const nextStepIsValid = isStepValid(nextStep);
                    
                    if (productId) {
                      // In modifica: verifica che lo step successivo sia valido
                      if (nextStepIsValid) {
                        setCurrentStep(nextStep);
                      } else {
                        toast({
                          title: 'Sezione non disponibile',
                          description: getStepErrorMessage(nextStep),
                          variant: 'destructive',
                        });
                      }
                    } else {
                      // In creazione: valida lo step corrente prima di procedere
                      if (isStepValid()) {
                        setCurrentStep(nextStep);
                      } else {
                        toast({
                          title: 'Campi obbligatori mancanti',
                          description: getStepErrorMessage(currentStep),
                          variant: 'destructive',
                        });
                      }
                    }
                  }}
                  className="flex items-center justify-center rounded-full w-12 h-12 shadow bg-green-600 text-white hover:bg-green-700 transition-colors"
                  disabled={!productId && !isStepValid()}
                >
                  <ArrowRight className="w-6 h-6 text-white" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
