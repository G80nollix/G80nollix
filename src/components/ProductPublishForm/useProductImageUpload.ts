
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function useProductImageUpload() {
  const [images, setImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    console.log("IMMAGINI SELEZIONATE:", files);
    
    // Controllo numero massimo di immagini
    if (files.length > 3) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Puoi caricare al massimo 3 immagini.",
      });
      return;
    }
    
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
    
    setImages(files);
    // Crea URL temporanei per l'anteprima
    const urls = files.map(f => URL.createObjectURL(f));
    setImageUrls(urls);
  };

  const uploadImages = async (userId: string, imagesToUpload: File[] = images): Promise<string[]> => {
    if (imagesToUpload.length === 0) return [];
    
    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const image of imagesToUpload) {
        // Genera un nome univoco per l'immagine
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileExtension = image.name.split('.').pop();
        const uniqueFileName = `${userId}_${timestamp}_${randomString}.${fileExtension}`;

        console.log("Uploading image:", uniqueFileName);

        const { data, error } = await supabase.storage
          .from("product-images")
          .upload(uniqueFileName, image, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error("Error uploading image:", error);
          throw new Error(`Errore durante l'upload dell'immagine: ${error.message}`);
        }

        // Genera l'URL pubblico per l'immagine
        const { data: { publicUrl } } = supabase.storage
          .from("product-images")
          .getPublicUrl(data.path);
        console.log("URL pubblico generato:", publicUrl);

        uploadedUrls.push(publicUrl);
        console.log("Image uploaded successfully:", publicUrl);
      }

      return uploadedUrls;
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Errore upload",
        description: error.message || "Errore durante l'upload delle immagini",
      });
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const resetImages = () => {
    setImages([]);
    setImageUrls([]);
  };

  return { 
    images, 
    imageUrls, 
    handleImageChange, 
    resetImages, 
    setImageUrls, 
    setImages,
    uploadImages,
    uploading 
  };
}
