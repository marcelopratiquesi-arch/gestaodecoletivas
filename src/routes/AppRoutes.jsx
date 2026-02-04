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

// 🟢 NOVA IMPORTAÇÃO OBRIGATÓRIA
import PerformanceFinanceiraPage from "../app/PerformanceFinanceira"; // Certifique-se que a pasta está criada aqui

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota Pública (Login) */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Rotas Privadas (Dentro do AppLayout) */}
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
          
          {/* 🟢 NOVA ROTA: Performance Financeira */}
          {/* Importante: Adicionei pageKey="performance_financeira" caso seu RoleRoute precise disso */}
          <Route 
            path="performance-financeira" 
            element={
              <RoleRoute pageKey="performance_financeira">
                <PerformanceFinanceiraPage />
              </RoleRoute>
            } 
          />

          {/* Cronograma */}
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
          
          {/* Configurações (Acesso protegido por Roles) */}
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
