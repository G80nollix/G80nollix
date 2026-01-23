import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

interface Props {
  images: File[];
  imageUrls: string[];
  setImages: (files: File[]) => void;
  formData: any;
  setFormData: (f: any) => void;
  uploading?: boolean;
}

export default function MediaSection({ 
  images, 
  imageUrls, 
  setImages,
  formData, 
  setFormData,
  uploading = false
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    
    // Controllo dimensione massima (2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB in bytes
    for (const file of selectedFiles) {
      if (file.size > maxSize) {
        alert(`L'immagine "${file.name}" è troppo grande. La dimensione massima consentita è 2MB.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }
    
    const newFiles = [...images, ...selectedFiles].slice(0, 3);
    setImages(newFiles);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = (idx: number) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  return (
    <fieldset>
      <legend className="font-medium mb-2">Multimedia</legend>
      <div className="space-y-4">
        <div>
          <Label className="block mb-2">Immagini (max 3)</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {Array.from({ length: Math.min(images.length + 1, 3) }).map((_, idx) => {
              const file = images[idx];
              if (file) {
                return (
                  <div key={idx} className="relative w-20 h-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center overflow-hidden bg-white">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`preview-${idx}`}
                      className="object-cover w-full h-full"
                    />
                    <button
                      type="button"
                      className="absolute top-0 right-0 bg-white bg-opacity-80 rounded-full p-1 text-xs"
                      onClick={() => handleRemoveImage(idx)}
                      aria-label="Rimuovi immagine"
                    >
                      ✕
                    </button>
                  </div>
                );
              } else {
                return (
                  <div
                    key={idx}
                    className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="w-6 h-6 text-gray-400" />
                  </div>
                );
              }
            })}
            <Input
              type="file"
              accept="image/*"
              multiple
              ref={fileInputRef}
              onChange={handleImageChange}
              disabled={images.length >= 3}
              className="hidden"
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Formati supportati: JPG, PNG, WebP, GIF. Massimo 10MB per immagine.
          </p>
          
          {uploading && (
            <div className="flex items-center gap-2 mt-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Upload in corso...</span>
            </div>
          )}
          
          {imageUrls.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              {imageUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <img 
                    src={url} 
                    alt={`Anteprima ${index + 1}`} 
                    className="w-full h-32 object-cover rounded border shadow-sm" 
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveImage(index)}
                    disabled={uploading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div>
          <Label htmlFor="videoUrl">URL del video (opzionale)</Label>
          <Input
            type="url"
            id="videoUrl"
            value={formData.videoUrl}
            onChange={e => setFormData((prev: any) => ({ ...prev, videoUrl: e.target.value }))}
            placeholder="https://www.youtube.com/watch?v=..."
            disabled={uploading}
            className="mt-1"
          />
          <p className="text-sm text-gray-500 mt-1">
            Link a video YouTube, Vimeo o altro per mostrare il prodotto in azione.
          </p>
        </div>
      </div>
    </fieldset>
  );
}
