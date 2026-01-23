import { useAdminCheck } from '@/hooks/useAdminCheck';
import NotFound from '@/pages/NotFound';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

const AdminProtectedRoute = ({ children }: AdminProtectedRouteProps) => {
  const { isAdmin, loading } = useAdminCheck();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <NotFound />;
  }

  return <>{children}</>;
};

export default AdminProtectedRoute;
