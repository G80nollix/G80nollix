
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProductBasicInfoProps {
  formData: any;
  setFormData: (update: any) => void;
  productCategories: { name: string; subcategories: string[] }[];
  subcategories: string[];
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
}

const ProductBasicInfo = ({
  formData,
  setFormData,
  productCategories,
  subcategories,
  selectedCategory,
  setSelectedCategory,
}: ProductBasicInfoProps) => (
  <div>
    <div>
      <Label htmlFor="title">Titolo dell'annuncio</Label>
      <Input
        id="title"
        placeholder="es. Mountain bike Trek in ottime condizioni"
        value={formData.title}
        onChange={(e) => setFormData((prev: any) => ({ ...prev, title: e.target.value }))}
        className="mt-1"
        required
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="category">Categoria</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => {
            setSelectedCategory(value);
            setFormData((prev: any) => ({ ...prev, category: value }));
          }}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Seleziona categoria" />
          </SelectTrigger>
          <SelectContent>
            {productCategories.map((cat) => (
              <SelectItem key={cat.name} value={cat.name}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="subcategory">Sottocategoria</Label>
        <Select
          value={formData.subcategory}
          onValueChange={(value) => setFormData((prev: any) => ({ ...prev, subcategory: value }))}
          disabled={!subcategories.length}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={subcategories.length ? "Sottocategoria" : "Seleziona categoria prima"} />
          </SelectTrigger>
          <SelectContent>
            {subcategories.map((sub) => (
              <SelectItem key={sub} value={sub}>
                {sub}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="brand">Marca</Label>
        <Input
          id="brand"
          value={formData.brand}
          placeholder="Trek, Specialized, Salewa..."
          onChange={(e) => setFormData((prev: any) => ({ ...prev, brand: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="model">Modello</Label>
        <Input
          id="model"
          value={formData.model}
          placeholder="Modello"
          onChange={(e) => setFormData((prev: any) => ({ ...prev, model: e.target.value }))}
        />
      </div>
    </div>
    <div>
      <Label htmlFor="description">Descrizione dettagliata</Label>
      <Textarea
        id="description"
        placeholder="Condizioni, caratteristiche tecniche, accessori inclusi"
        rows={4}
        value={formData.description}
        onChange={(e) => setFormData((prev: any) => ({ ...prev, description: e.target.value }))}
        className="mt-1"
      />
    </div>
  </div>
);

export default ProductBasicInfo;
