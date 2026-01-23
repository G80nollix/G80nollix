
import { Card, CardContent } from "@/components/ui/card";
import { Users, Package, Calendar, BarChart3, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminFooter from "@/components/admin/AdminFooter";

const AdminHome = () => {
  console.log()
  const adminSections = [
    {
      title: "Clienti",
      icon: Users,
      href: "/admin/customers",
      color: "bg-[#3fafa3] hover:bg-[#3fafa3]",
      iconColor: "text-white",
      description: "Gestisci utenti e clienti registrati",
      featured: false
    },
    {
      title: "Catalogo",
      icon: Package,
      href: "/admin/catalog",
      color: "bg-[#3fafa3] hover:bg-[#3fafa3]",
      iconColor: "text-white",
      description: "Visualizza e gestisci il catalogo prodotti",
      featured: false
    },
    {
      title: "Prenotazioni",
      icon: Calendar,
      href: "/admin/bookings",
      color: "bg-blue-600 hover:bg-blue-700",
      iconColor: "text-white",
      description: "Monitora prenotazioni e noleggi",
      featured: true
    },
    {
      title: "Statistiche",
      icon: BarChart3,
      href: "/dashboard",
      color: "bg-[#3fafa3] hover:bg-[#3fafa3]",
      iconColor: "text-white",
      description: "Visualizza report e analytics",
      featured: false
    },
    {
      title: "Noleggi Giornalieri",
      icon: CalendarDays,
      href: "/admin/daily-bookings",
      color: "bg-purple-600 hover:bg-purple-700",
      iconColor: "text-white",
      description: "Visualizza inizi e fine noleggi per data",
      featured: true
    }
  ];

  return (
    <AdminProtectedRoute>
      <div className="min-h-screen flex flex-col">
        <AdminHeader />
        
        <main className="flex-1 bg-gray-50 p-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Dashboard Amministratore
              </h1>
            </div>
            
            {/* Featured Cards - Top Row */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">Sezioni Principali</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {adminSections
                  .filter(section => section.featured)
                  .map((section, index) => (
                    <Link key={`featured-${index}`} to={section.href}>
                      <Card className={`hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer h-64 border-l-4 border-2 shadow-lg ${
                        section.title === "Prenotazioni" 
                          ? "border-l-blue-600 border-blue-200 bg-blue-50/30" 
                          : "border-l-purple-600 border-purple-200 bg-purple-50/30"
                      }`}>
                        <CardContent className="flex flex-col items-center justify-center h-full p-6 text-center">
                          <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${section.color} transition-colors shadow-xl`}>
                            <section.icon className={`h-12 w-12 ${section.iconColor}`} />
                          </div>
                          <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            {section.title}
                          </h2>
                          <p className="text-base text-gray-600">
                            {section.description}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
              </div>
            </div>

            {/* Other Cards - Bottom Grid */}
            <div>
              <h2 className="text-xl font-semibold text-gray-700 mb-4">Altre Sezioni</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {adminSections
                  .filter(section => !section.featured)
                  .map((section, index) => (
                    <Link key={`normal-${index}`} to={section.href}>
                      <Card className="hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer h-56 border-l-4 border-l-blue-500">
                        <CardContent className="flex flex-col items-center justify-center h-full p-6 text-center">
                          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${section.color} transition-colors shadow-lg`}>
                            <section.icon className={`h-10 w-10 ${section.iconColor}`} />
                          </div>
                          <h2 className="text-xl font-semibold text-gray-800 mb-2">
                            {section.title}
                          </h2>
                          <p className="text-sm text-gray-600">
                            {section.description}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        </main>
        
        <AdminFooter />
      </div>
    </AdminProtectedRoute>
  );
};

export default AdminHome;
