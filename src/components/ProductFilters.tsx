
interface ProductFiltersProps {
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
}

const ProductFilters = ({
  filterStatus,
  setFilterStatus,
  sortBy,
  setSortBy,
}: ProductFiltersProps) => (
  <div className="flex flex-wrap gap-4 mb-6">
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium">Stato:</span>
      <select
        value={filterStatus}
        onChange={e => setFilterStatus(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
      >
        <option value="all">Tutti</option>
        <option value="active">Attivi</option>
        <option value="paused">In pausa</option>
        <option value="draft">Bozze</option>
      </select>
    </div>
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium">Ordina per:</span>
      <select
        value={sortBy}
        onChange={e => setSortBy(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
      >
        <option value="created_at">Data creazione</option>
        <option value="views">Visualizzazioni</option>
        <option value="title">Titolo</option>
        <option value="price_daily">Prezzo</option>
      </select>
    </div>
  </div>
);

export default ProductFilters;

