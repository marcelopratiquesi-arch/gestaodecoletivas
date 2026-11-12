import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { canAccessPage, getHomePath } from "../permissions";
import i18n from "../i18n";

export default function RoleRoute({ pageKey, children }) {
  const { userData, loading } = useAuth();

  if (loading) return <div style={{ padding: 20 }}>{i18n.t('layout.loading')}</div>;

  // 1. Sem crachá => Volta para o login
  if (!userData) return <Navigate to="/login" replace />;

  // 🟢 2. CHAVE MESTRA DO GENERAL: O Dono nunca é barrado!
  const userRole = String(userData?.role || "").toLowerCase();
  const isMaster = userRole === 'admin' || userRole === 'administrador' || userRole === 'master';
  
  if (isMaster) {
      return children; // Se for o chefe, entra direto sem perguntar nada.
  }

  // 3. Se não for Master, verifica as regras normais. Se falhar, manda pra página "de casa" do perfil
  //    (professor não tem Início: cai na Validação Diária). Se nem a casa é permitida, volta pro login.
  if (!canAccessPage(userData, pageKey)) {
    const home = getHomePath(userData);
    const homeKey = home === "/app" ? "inicio" : "validacao_diaria";
    if (homeKey === pageKey || !canAccessPage(userData, homeKey)) return <Navigate to="/login" replace />;
    return <Navigate to={home} replace />;
  }

  return children;
}