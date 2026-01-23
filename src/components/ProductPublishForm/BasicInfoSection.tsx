import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRef } from "react";
import { Plus } from "lucide-react";
import type { ProductFormData } from '@/types';

interface Props {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  categories: { id: string; name: string }[];
  subcategories: { id: string; name: string }[];
  loadingCategories: boolean;
  loadingSubcategories: boolean;
  // Nuove props per gestione immagini
  existingImageUrls: string[];
  newImages: File[];
  onRemoveExistingImage: (idx: number) => void;
  onRemoveNewImage: (idx: number) => void;
  onNewImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function BasicInfoSection({ 
  formData, 
  setFormData, 
  categories, 
  subcategories, 
  loadingCategories, 
  loadingSubcategories, 
  existingImageUrls,
  newImages,
  onRemoveExistingImage,
  onRemoveNewImage,
  onNewImageChange
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalImages = existingImageUrls.length + newImages.length;
  const maxImages = 3;

  return (
    <div>
      <Label htmlFor="title">Nome *</Label>
      <Input
        type="text"
        id="title"
        value={formData.title}
        onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
        placeholder="Nome del prodotto"
        required
      />
      <Label htmlFor="description">Descrizione *</Label>
      <Textarea
        id="description"
        value={formData.description}
        onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
        placeholder="Descrizione dettagliata del prodotto"
        required
      />
      <Label htmlFor="category">Categoria *</Label>
      <Select value={formData.product_category_id} onValueChange={value => setFormData(prev => ({ ...prev, product_category_id: value, product_subcategory_id: '' }))}>
        <SelectTrigger id="category">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          {loadingCategories ? (
            <SelectItem value="loading" disabled>Caricamento...</SelectItem>
          ) : (
            categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Label htmlFor="subcategory">Sottocategoria *</Label>
      <Select value={formData.product_subcategory_id} onValueChange={value => setFormData(prev => ({ ...prev, product_subcategory_id: value }))} disabled={!formData.product_category_id}>
        <SelectTrigger id="subcategory">
          <SelectValue placeholder="Sottocategoria" />
        </SelectTrigger>
        <SelectContent>
          {loadingSubcategories ? (
            <SelectItem value="loading" disabled>Caricamento...</SelectItem>
          ) : (
            subcategories.map(sub => (
              <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Immagini */}
      <Label className="mt-4 block">Immagini (max {maxImages})</Label>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {/* Mostra immagini esistenti */}
        {existingImageUrls.map((url, idx) => (
          <div key={`existing-${idx}`} className="relative w-20 h-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center overflow-hidden bg-white">
            <img
              src={url}
              alt={`existing-${idx}`}
              className="object-cover w-full h-full"
            />
            <button
              type="button"
              className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs hover:bg-red-600"
              onClick={() => onRemoveExistingImage(idx)}
              aria-label="Rimuovi immagine esistente"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Mostra nuove immagini */}
        {newImages.map((file, idx) => (
          <div key={`new-${idx}`} className="relative w-20 h-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center overflow-hidden bg-white">
            <img
              src={URL.createObjectURL(file)}
              alt={`new-${idx}`}
              className="object-cover w-full h-full"
            />
            <button
              type="button"
              className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs hover:bg-red-600"
              onClick={() => onRemoveNewImage(idx)}
              aria-label="Rimuovi nuova immagine"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Pulsante per aggiungere nuove immagini */}
        {totalImages < maxImages && (
          <div
            className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="w-6 h-6 text-gray-400" />
          </div>
        )}

        <Input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          onChange={onNewImageChange}
          disabled={totalImages >= maxImages}
          className="hidden"
        />
      </div>
    </div>
  );
}
