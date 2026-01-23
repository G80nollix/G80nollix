
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { useState } from "react";
import { useProductBookings } from "@/hooks/useProductBookings";

interface ProductOption {
  id: string;
  title: string;
}

interface ProductBookingsSectionProps {
  products: ProductOption[];
}

const ProductBookingsSection = ({ products }: ProductBookingsSectionProps) => {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );

  const {
    data: bookings,
    isLoading: bookingsLoading,
    error: bookingsError,
  } = useProductBookings(selectedProductId || undefined);

  return (
    <div className="mt-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Prenotazioni noleggi</span>
          </CardTitle>
          <CardDescription>
            Seleziona un tuo annuncio per vedere tutte le prenotazioni ricevute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <Select
              value={selectedProductId ?? ""}
              onValueChange={(v) => setSelectedProductId(v)}
            >
              <SelectTrigger className="w-72 max-w-full">
                <SelectValue placeholder="Seleziona un annuncio" />
              </SelectTrigger>
              <SelectContent>
                {products.length === 0 ? (
                  <SelectItem value="" disabled>
                    Nessun annuncio disponibile
                  </SelectItem>
                ) : (
                  products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {/* Tabella Prenotazioni */}
          {selectedProductId == null || selectedProductId === "" ? (
            <p className="text-gray-500 italic mb-6">
              Seleziona un annuncio per vedere le prenotazioni
            </p>
          ) : bookingsLoading ? (
            <p>Caricamento prenotazioni...</p>
          ) : bookingsError ? (
            <p className="text-red-500">
              Errore nel caricamento delle prenotazioni.
            </p>
          ) : bookings && bookings.length === 0 ? (
            <p className="text-gray-500">
              Nessuna prenotazione ricevuta per questo annuncio.
            </p>
          ) : (
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data Inizio</TableHead>
                  <TableHead>Data Fine</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Prezzo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings?.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      {b.user_id ? (
                        <span className="text-gray-700">
                          {b.user_id.slice(0, 8)}...
                        </span>
                      ) : (
                        <span className="italic text-gray-400">Sconosciuto</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {b.start_date
                        ? new Date(b.start_date).toLocaleDateString("it-IT")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {b.end_date
                        ? new Date(b.end_date).toLocaleDateString("it-IT")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          b.status === "confirmed"
                            ? "default"
                            : b.status === "cart"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {b.status === "confirmed"
                          ? "Confermata"
                          : b.status === "cart"
                          ? "Nel carrello"
                          : b.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {b.price_total ? <>€{parseFloat(b.price_total).toFixed(2)}</> : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductBookingsSection;

