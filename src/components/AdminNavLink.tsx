
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Link, useLocation } from 'react-router-dom';

const AdminNavLink = () => {
  const { isAdmin, loading } = useAdminCheck();
  const location = useLocation();

  if (loading || !isAdmin) {
    return null;
  }

  return (
    <Link
      to="/admin/home"
      className={`transition-colors hover:text-green-600 ${
        location.pathname.startsWith('/admin')
          ? "text-green-600 font-semibold"
          : "text-gray-700"
      }`}
    >
      Admin
    </Link>
  );
};

export default AdminNavLink;
