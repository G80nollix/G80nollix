
import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import FixedNavbar from "@/components/FixedNavbar";
import Footer from "@/components/Footer";
import AuthHeader from "@/components/auth/AuthHeader";

interface AuthLayoutProps {
  children: ReactNode;
  isLogin: boolean;
  isForgotPassword: boolean;
}

const AuthLayout = ({ children, isLogin, isForgotPassword }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
      <FixedNavbar />

      <div className="flex-1 container mx-auto px-4 py-16 pt-20 md:pt-24">
        <div className="max-w-md mx-auto">
          <Card className="shadow-xl border-4" style={{ borderColor: '#5F5F5F' }}>
            <AuthHeader isLogin={isLogin} isForgotPassword={isForgotPassword} />
            <CardContent>
              {children}
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AuthLayout;
