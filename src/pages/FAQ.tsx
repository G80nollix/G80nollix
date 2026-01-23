
import { useState } from "react";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, HelpCircle, MessageSquare, Mail } from "lucide-react";

const FAQ = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const faqs = [
    {
      category: "Generale",
      questions: [
        {
          q: "Cos'è Nollix e come funziona?",
          a: "Nollix è una piattaforma peer-to-peer che permette di noleggiare attrezzature sportive da altri utenti. Puoi cercare l'attrezzatura di cui hai bisogno, prenotarla e ritirarla direttamente dal proprietario."
        },
        {
          q: "È gratuito utilizzare Nollix?",
          a: "Registrarsi e cercare attrezzature su Nollix è completamente gratuito. Applichiamo una piccola commissione sulle transazioni completate per mantenere la piattaforma sicura e aggiornata."
        },
        {
          q: "In quali città è disponibile Nollix?",
          a: "Nollix è attualmente disponibile nelle principali città italiane. La disponibilità dipende dagli utenti registrati nella tua zona. Puoi controllare se ci sono attrezzature disponibili nella tua città utilizzando la ricerca."
        }
      ]
    },
    {
      category: "Noleggiare",
      questions: [
        {
          q: "Come prenoto un'attrezzatura?",
          a: "Trova l'attrezzatura che ti interessa, seleziona le date, controlla la disponibilità e procedi con la prenotazione. Riceverai la conferma e i dettagli per il ritiro."
        },
        {
          q: "Posso cancellare una prenotazione?",
          a: "Sì, puoi cancellare una prenotazione fino a 24 ore prima della data di ritiro senza penali. Per cancellazioni tardive potrebbero applicarsi delle commissioni."
        },
        {
          q: "Cosa succede se l'attrezzatura è danneggiata?",
          a: "Se l'attrezzatura risulta danneggiata al momento del ritiro, puoi segnalarlo immediatamente attraverso l'app. Ti aiuteremo a trovare una soluzione o un'alternativa."
        },
        {
          q: "È necessaria una cauzione?",
          a: "Alcuni proprietari potrebbero richiedere una cauzione che verrà trattenuta temporaneamente e rilasciata dopo la restituzione dell'attrezzatura in buone condizioni."
        }
      ]
    },
    {
      category: "Pubblicare",
      questions: [
        {
          q: "Come pubblico la mia attrezzatura?",
          a: "Vai alla sezione 'Pubblica', carica foto dell'attrezzatura, inserisci una descrizione dettagliata, imposta il prezzo e la disponibilità. Il tuo annuncio sarà subito visibile."
        },
        {
          q: "Quanto posso guadagnare?",
          a: "I guadagni dipendono dal tipo di attrezzatura, dalla domanda nella tua zona e dalla frequenza di noleggio. Molti utenti recuperano il costo dell'attrezzatura in pochi noleggi."
        },
        {
          q: "Devo essere sempre disponibile per le consegne?",
          a: "No, puoi impostare i tuoi orari di disponibilità e le modalità di ritiro che preferisci. Molti utenti organizzano punti di ritiro fissi o fasce orarie specifiche."
        },
        {
          q: "Come viene gestito il pagamento?",
          a: "I pagamenti vengono elaborati in modo sicuro attraverso la piattaforma. Riceverai il tuo guadagno dopo la conferma della restituzione dell'attrezzatura."
        }
      ]
    },
    {
      category: "Sicurezza",
      questions: [
        {
          q: "Le attrezzature sono assicurate?",
          a: "Offriamo copertura assicurativa base per tutte le transazioni. Per attrezzature di alto valore, consigliamo di verificare le condizioni specifiche con il proprietario."
        },
        {
          q: "Come verificate gli utenti?",
          a: "Tutti gli utenti devono verificare la propria identità e numero di telefono. Inoltre, utilizziamo un sistema di recensioni per costruire fiducia nella community."
        },
        {
          q: "Cosa fare in caso di problemi?",
          a: "Il nostro team di supporto è disponibile 7 giorni su 7 per aiutarti a risolvere qualsiasi problema. Puoi contattarci tramite chat, email o telefono."
        }
      ]
    },
    {
      category: "Pagamenti",
      questions: [
        {
          q: "Quali metodi di pagamento accettate?",
          a: "Accettiamo carte di credito/debito, PayPal e bonifici bancari. Tutti i pagamenti sono elaborati in modo sicuro attraverso gateway certificati."
        },
        {
          q: "Quando viene addebitato il pagamento?",
          a: "Il pagamento viene autorizzato al momento della prenotazione ma addebitato solo quando ritiri effettivamente l'attrezzatura."
        },
        {
          q: "Posso ottenere un rimborso?",
          a: "Sì, hai diritto al rimborso completo se cancelli entro i tempi previsti o se l'attrezzatura non è disponibile come descritto."
        }
      ]
    }
  ];

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(
      faq => 
        faq.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.a.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <FixedNavbar />
      
      <div className="flex-1 container mx-auto px-4 py-16 pt-20 md:pt-24">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-6">
            Domande frequenti
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Trova rapidamente le risposte alle domande più comuni su Nollix
          </p>
        </div>

        {/* Barra di ricerca */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Cerca nelle FAQ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-4xl mx-auto">
          {filteredFaqs.length > 0 ? (
            <div className="space-y-8">
              {filteredFaqs.map((category, categoryIndex) => (
                <Card key={categoryIndex}>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <HelpCircle className="h-6 w-6 text-green-600" />
                      <span>{category.category}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {category.questions.map((faq, faqIndex) => (
                        <AccordionItem key={faqIndex} value={`${categoryIndex}-${faqIndex}`}>
                          <AccordionTrigger className="text-left">
                            {faq.q}
                          </AccordionTrigger>
                          <AccordionContent className="text-gray-600">
                            {faq.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                Nessun risultato trovato
              </h3>
              <p className="text-gray-500">
                Prova a modificare i termini di ricerca o contattaci direttamente
              </p>
            </div>
          )}
        </div>

        {/* Supporto aggiuntivo */}
        <div className="max-w-4xl mx-auto mt-16">
          <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold mb-4">Non hai trovato quello che cercavi?</h3>
              <p className="text-gray-600 mb-6">
                Il nostro team di supporto è sempre pronto ad aiutarti
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="flex items-center space-x-2 text-white" style={{ backgroundColor: '#E31E24', fontFamily: 'Oswald, sans-serif', fontWeight: '700' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#C01A1F'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E31E24'}>
                  <MessageSquare className="h-5 w-5" />
                  <span>Chat dal vivo</span>
                </Button>
                <Button variant="outline" className="flex items-center space-x-2">
                  <Mail className="h-5 w-5" />
                  <span>Invia email</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default FAQ;
