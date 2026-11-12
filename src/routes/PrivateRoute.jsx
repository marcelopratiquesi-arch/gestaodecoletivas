import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import i18n from "../i18n";

export default function PrivateRoute({ children }) {
  const { userData, loading, aguardandoAprovacao } = useAuth();

  // 1) enquanto carrega o "crachá" (Firestore), NÃO redireciona
  if (loading) return <div style={{ padding: 20 }}>{i18n.t('layout.loading')}</div>;

  // 2) entrou pelo Google e ainda não foi aprovado = tela de pedido de acesso
  if (!userData && aguardandoAprovacao) return <Navigate to="/solicitar-acesso" replace />;

  // 3) sem crachá = sem acesso
  if (!userData) return <Navigate to="/login" replace />;

  return children;
}
