
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";
import Index from "./pages/Index";
import Products from "./pages/Products";
import Publish from "./pages/Publish";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Dashboard from "./pages/Dashboard";
import FAQ from "./pages/FAQ";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import NotFound from "./pages/NotFound";
import ProductDetail from "./pages/ProductDetail";
import ProductSuccess from "./pages/ProductSuccess";
import Bookings from "./pages/Bookings";
import ProtectedPublishEdit from "./components/ProtectedPublishEdit";
import AdminCustomers from "./pages/AdminCustomers";
import AdminHome from "./pages/AdminHome";
import AdminLogout from "./pages/AdminLogout";
import AdminProducts from "./pages/AdminProducts";
import AdminBookings from "./pages/AdminBookings";
import AdminBookingDetail from "./pages/AdminBookingDetail";
import AdminDailyBookings from "./pages/AdminDailyBookings";
import AdminCustomerDetail from "./pages/AdminCustomerDetail";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import Catalog from "./pages/Catalog";
import Checkout from "./pages/Checkout";
import Cart from "./pages/Cart";
import BookingDetails from "./pages/BookingDetails";
import BookingConfirmation from "./pages/BookingConfirmation";
import Profile from "./pages/Profile";
import ProductVariants from "./pages/ProductVariants";
import ProductStock from "./pages/ProductStock";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentProcessing from "./pages/PaymentProcessing";
// Configure React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/products" element={<Products />} />
                      <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/:id" element={<Checkout />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/booking-details" element={<BookingDetails />} />
        <Route path="/booking-confirmation" element={<BookingConfirmation />} />
        <Route path="/product-success" element={<ProductSuccess />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/payment-processing" element={<PaymentProcessing />} />
                      <Route path="/profile" element={<Profile />} />
              <Route path="/admin/publish" element={
                <AdminProtectedRoute>
                  <Publish />
                </AdminProtectedRoute>
              } />
              <Route path="/admin/publish/:id" element={<ProtectedPublishEdit />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              <Route path="/admin/catalog" element={<Catalog />} />
              <Route path="/admin/variants/:productId" element={
                <AdminProtectedRoute>
                  <ProductVariants />
                </AdminProtectedRoute>
              } />
              <Route path="/admin/stock/:productId" element={
                <AdminProtectedRoute>
                  <ProductStock />
                </AdminProtectedRoute>
              } />
              <Route path="/admin/customers" element={<AdminCustomers />} />
              <Route path="/admin/customers/:id" element={
                <AdminProtectedRoute>
                  <AdminCustomerDetail />
                </AdminProtectedRoute>
              } />
              <Route path="/admin/bookings" element={
                <AdminProtectedRoute>
                  <AdminBookings />
                </AdminProtectedRoute>
              } />
              <Route path="/admin/bookings/:id" element={
                <AdminProtectedRoute>
                  <AdminBookingDetail />
                </AdminProtectedRoute>
              } />
              <Route path="/admin/daily-bookings" element={
                <AdminProtectedRoute>
                  <AdminDailyBookings />
                </AdminProtectedRoute>
              } />
              <Route path="/admin/home" element={
                <AdminProtectedRoute>
                  <AdminHome />
                </AdminProtectedRoute>
              } />
              <Route path="/admin/logout" element={<AdminLogout />} />
              <Route path="/admin/products" element={
                <AdminProtectedRoute>
                  <AdminProducts />
                </AdminProtectedRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
