import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import RoleRoute from "./RoleRoute";
import AppLayout from "../layouts/AppLayout";

// --- Importação das Páginas Reais ---
import Login from "../pages/login";
import Home from "../pages/home";
import ConfiguracoesPage from "../app/Configuracoes"; 
import ValidacaoDiaria from "../app/ValidacaoDiaria"; 
import CronogramaPage from "../app/Cronograma/index"; 
import RelatorioPage from "../app/Relatorios"; 
import ValidacaoColetivaPage from "../app/ValidacaoColetiva"; 
import PerformanceFinanceiraPage from "../app/Financeiro"; 

// 🟢 NOVA IMPORTAÇÃO: Central de Comunicação
import CentralComunicacao from "../app/Comunicacao";

// Importação: Cronograma Público
import PublicSchedule from "../pages/Publico/PublicSchedule"; 

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* --- ROTAS PÚBLICAS (Sem Login) --- */}
        <Route path="/login" element={<Login />} />
        
        {/* Rota do Cronograma Público (Happy Zone) */}
        <Route path="/horarios" element={<PublicSchedule />} />

        {/* Redirecionamento da raiz */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* --- ROTAS PRIVADAS (Dentro do AppLayout) --- */}
        <Route
          path="/app"
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          {/* Página Inicial */}
          <Route index element={<RoleRoute pageKey="inicio"><Home /></RoleRoute>} />

          {/* Relatórios Gerenciais */}
          <Route 
            path="relatorio-gerencial" 
            element={
              <RoleRoute pageKey="relatorio_gerencial">
                <RelatorioPage />
              </RoleRoute>
            } 
          />
          
          {/* Financeiro */}
          <Route 
            path="financeiro" 
            element={
              <RoleRoute pageKey="financeiro">
                <PerformanceFinanceiraPage />
              </RoleRoute>
            } 
          />

          {/* Cronograma (Gestão) */}
          <Route 
            path="cronograma" 
            element={
              <RoleRoute pageKey="cronograma">
                <CronogramaPage />
              </RoleRoute>
            } 
          />

          {/* Validação Diária */}
          <Route path="validacao-diaria" element={<RoleRoute pageKey="validacao_diaria"><ValidacaoDiaria /></RoleRoute>} />
          
          {/* Validação Coletiva */}
          <Route 
            path="validacao-coletiva" 
            element={
              <RoleRoute pageKey="validacao_coletiva">
                <ValidacaoColetivaPage />
              </RoleRoute>
            } 
          />

          {/* 🟢 NOVA ROTA: Central de Comunicação */}
          <Route 
            path="comunicacao" 
            element={
              <CentralComunicacao /> 
            } 
          />
          
          {/* Configurações */}
          <Route 
            path="configuracoes" 
            element={
              <RoleRoute pageKey="configuracoes">
                <ConfiguracoesPage />
              </RoleRoute>
            } 
          />
        </Route>

        {/* Rota de Erro (404) -> Manda pro Login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}