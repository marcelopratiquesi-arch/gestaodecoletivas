// Atalhos das Centrais para as telas do sistema (a Central só mostra; quem grava é a tela original).
import { canAccessPage } from '../permissions';

// O link "Abrir a tela completa" de um quadro (só para quem pode entrar naquela tela).
export const atalhoTelaCompleta = (t, pode, onClick) => (pode ? { texto: t('centrais.abrirTelaCompleta'), onClick } : null);

// Em quais telas quem está olhando pode entrar (mesmos perfis das rotas e das abas das Configurações).
export function telasPermitidas(userData) {
  const papel = String(userData?.role || '').trim().toLowerCase();
  const gestor = ['admin', 'mentor'].includes(papel);
  return {
    relatorio: canAccessPage(userData, 'relatorio_gerencial'),
    cronograma: canAccessPage(userData, 'cronograma'),
    validacao: canAccessPage(userData, 'validacao_diaria'),
    cfgProfessores: canAccessPage(userData, 'configuracoes'),
    cfgUnidades: gestor,
    cfgLideres: gestor,
    cfgMentores: papel === 'admin',
  };
}

export const caminhos = {
  configuracoes: (irPara, aba) => () => irPara('/app/configuracoes', { state: { aba } }),
  cronograma: (irPara, unidadeId) => () => irPara(unidadeId ? `/app/cronograma?unidade=${unidadeId}` : '/app/cronograma'),
  relatorio: (irPara, unidadeId, mes) => () => irPara(`/app/relatorio-gerencial?unidade=${unidadeId}${mes ? `&mes=${mes}` : ''}`),
  // Validação Diária já no período e nas unidades, com o filtro "Pendentes" (mesmo atalho da Página de Início).
  validacao: (irPara, { inicio, fim, unidadeIds }) => () => irPara('/app/validacao-diaria', { state: { pendencias: { inicio, fim, unidadeIds } } }),
};
