import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { canAccessPage } from "../permissions";

export default function RoleRoute({ pageKey, children }) {
  const { userData, loading } = useAuth();

  if (loading) return <div style={{ padding: 20 }}>Carregando...</div>;

  // sem crachá => login
  if (!userData) return <Navigate to="/login" replace />;

  // sem permissão => manda pra home do app
  if (!canAccessPage(userData, pageKey)) return <Navigate to="/app" replace />;

  return children;
}
