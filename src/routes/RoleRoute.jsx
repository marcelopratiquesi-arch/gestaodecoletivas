import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { canAccessPage } from "../permissions";

export default function RoleRoute({ pageKey, children }) {
  const { userData, loading } = useAuth();

  if (loading) return <div style={{ padding: 20 }}>Carregando...</div>;

  // 1. Sem crachá => Volta para o login
  if (!userData) return <Navigate to="/login" replace />;

  // 🟢 2. CHAVE MESTRA DO GENERAL: O Dono nunca é barrado!
  const userRole = String(userData?.role || "").toLowerCase();
  const isMaster = userRole === 'admin' || userRole === 'administrador' || userRole === 'master';
  
  if (isMaster) {
      return children; // Se for o chefe, entra direto sem perguntar nada.
  }

  // 3. Se não for Master, verifica as regras normais. Se falhar, manda pra Home.
  if (!canAccessPage(userData, pageKey)) return <Navigate to="/app" replace />;

  return children;
}