import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function ProtectedRoute() {
  const { autenticado, carregando } = useAuth();
  const location = useLocation();

  if (carregando) return <p className="tela-carregando" role="status">Carregando…</p>;
  if (!autenticado) return <Navigate to="/login" replace state={{ de: location }} />;
  return <Outlet />;
}
