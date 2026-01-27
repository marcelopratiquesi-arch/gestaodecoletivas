import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function PrivateRoute({ children }) {
  const { userData, loading } = useAuth();

  // 1) enquanto carrega o "crachá" (Firestore), NÃO redireciona
  if (loading) return <div style={{ padding: 20 }}>Carregando...</div>;

  // 2) sem crachá = sem acesso
  if (!userData) return <Navigate to="/login" replace />;

  return children;
}
