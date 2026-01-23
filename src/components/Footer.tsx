import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Facebook } from "lucide-react";

const Footer = () => {
  return (
    <footer className="pt-12 pb-4 text-white" style={{ backgroundColor: '#302438', fontFamily: 'Oswald, sans-serif' }}>
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Sezione principale */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 mb-8">
          {/* Logo e descrizione */}
          <div>
            <Link to="/" className="inline-block mb-4">
              <img 
                src="/Asti/logo_g80.png" 
                alt="G80 Sport" 
                className="h-14 md:h-18 w-auto object-contain"
              />
            </Link>
            <p className="text-white/90 mb-6 text-lg md:text-xl leading-relaxed">
              Il tuo punto di riferimento per lo sport ad Asti.
            </p>
            {/* Social Media */}
            <div className="flex gap-4">
              <a 
                href="https://www.facebook.com/g80sport/?locale=it_IT" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-gray-300 transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="h-6 w-6 md:h-8 md:w-8" />
              </a>
            </div>
          </div>

          {/* Indirizzo e Contatti affiancati */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Indirizzo */}
            <div>
              <h3 className="text-xl md:text-2xl font-bold mb-4 uppercase" style={{ fontWeight: '700' }}>
                Indirizzo
              </h3>
              <ul className="space-y-4 text-white/90">
                <li className="flex items-start gap-3">
                  <MapPin className="h-6 w-6 mt-1 flex-shrink-0" />
                  <div className="text-base md:text-lg leading-relaxed">
                    <p className="font-semibold">Corso Torino, 149</p>
                    <p>Asti, 14100</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Contatti */}
            <div>
              <h3 className="text-xl md:text-2xl font-bold mb-4 uppercase" style={{ fontWeight: '700' }}>
                Contatti
              </h3>
              <ul className="space-y-4 text-white/90">
                <li className="flex items-center gap-3">
                  <Mail className="h-6 w-6 flex-shrink-0" />
                  <a href="mailto:giottto@gmail.com" className="text-base md:text-lg hover:text-white transition-colors">
                    giottto@gmail.com
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="h-6 w-6 flex-shrink-0" />
                  <a href="tel:+390141530116" className="text-base md:text-lg hover:text-white transition-colors font-semibold">
                    +39 0141 530116
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Separatore */}
        <div className="border-t-2 border-white/20 my-8"></div>

        {/* Copyright e P.IVA */}
        <div className="text-center mb-6">
          <p className="text-white/80 text-base md:text-lg mb-2">
            © 2025 Nollix. Tutti i diritti riservati.
          </p>
          <p className="text-white/70 text-sm md:text-base">
            P.IVA: 01589790052
          </p>
        </div>

        {/* Powered by Nollix */}
        <div className="border-t-2 border-white/20 pt-2">
          <div className="flex flex-col md:flex-row items-center justify-center gap-3">
            <span className="text-white/70 text-sm md:text-base">Powered by</span>
            <a href="https://www.nollix.it" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img 
                src="/Logo_Nollix_Bianco.png" 
                alt="Nollix Logo" 
                className="h-16 md:h-20 w-auto object-contain"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
