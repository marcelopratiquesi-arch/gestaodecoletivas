// Onde as Centrais moram: montado UMA vez no AppLayout, escuta os pedidos de abrirCentral.js.
//
// - Confere a permissão antes de abrir (quem não pode recebe um aviso no canto da tela).
// - Ficha por cima de ficha: cada nova fica numa camada mais alta (200, 210, 220...).
//   Pedir uma ficha que já está aberta mais embaixo volta para ela (não empilha duas vezes).
// - Esc fecha só a de cima (escutado na fase de captura e sem propagar, para não fechar as duas
//   nem a janela que estiver por baixo).
// - Ir para uma tela do sistema a partir da ficha fecha todas as fichas.
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useCatalogs } from '../contexts/CatalogContext';
import { EVENTO_CENTRAL } from './abrirCentral';
import { acessoCentral, resolverAlvo, nomeDoRegistro, VAGA_DO_TIPO } from './acessos';
import { liderDaVaga } from './contasUnidade';
import CentralUnidade from './CentralUnidade';
import CentralMentor from './CentralMentor';
import CentralLider from './CentralLider';
import CentralProfessor from './CentralProfessor';

const CAMADA_BASE = 200;
const PASSO_CAMADA = 10;

// 'lider2' = a mesma ficha do líder, mostrando o 2º líder da unidade.
const CentralSegundoLider = (props) => <CentralLider {...props} vaga={2} />;
const FICHAS = { unidade: CentralUnidade, mentor: CentralMentor, lider: CentralLider, lider2: CentralSegundoLider, professor: CentralProfessor };

// Nome da tela de onde a ficha foi aberta (para o botão "Voltar para ..."). Chaves de sidebar.items.
const TELAS = {
  '/app': 'inicio',
  '/app/cronograma': 'cronograma',
  '/app/validacao-diaria': 'validacaoDiaria',
  '/app/validacao-coletiva': 'validacaoColetiva',
  '/app/financeiro': 'performanceFinanceira',
  '/app/relatorio-gerencial': 'relatorios',
  '/app/configuracoes': 'configuracoes',
  '/app/pratique-play': 'pratiquePlay',
  '/app/comunicacao': 'comunicados',
  '/app/ociosidade': 'radarGrade',
  '/app/workshops': 'lojaEventos',
  '/app/auditoria': 'auditoria',
  '/app/acessos': 'acessos',
};

export default function CentraisHost() {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();
  const navigate = useNavigate();
  const location = useLocation();
  const [pilha, setPilha] = useState([]); // [{ tipo, id }] — a última é a de cima

  // Pedidos de abertura vindos de qualquer tela (ou de dentro de outra ficha).
  useEffect(() => {
    const aoPedir = (evento) => {
      const { tipo, alvo } = evento.detail || {};
      if (!FICHAS[tipo]) return;
      const registro = resolverAlvo(tipo, alvo, catalogs);
      if (!registro) {
        toast.error(t('centrais.avisos.naoEncontrado'));
        return;
      }
      if (VAGA_DO_TIPO[tipo] && !liderDaVaga(registro, VAGA_DO_TIPO[tipo])) {
        toast.error(t('centrais.avisos.unidadeSemLider'));
        return;
      }
      if (!acessoCentral(tipo, registro, userData, catalogs)) {
        toast.error(t(tipo === 'unidade' || VAGA_DO_TIPO[tipo] ? 'centrais.avisos.unidadeForaDoEscopo' : 'centrais.avisos.semAcesso'));
        return;
      }
      setPilha((atual) => {
        const jaAberta = atual.findIndex((f) => f.tipo === tipo && f.id === registro.id);
        return jaAberta >= 0 ? atual.slice(0, jaAberta + 1) : [...atual, { tipo, id: registro.id }];
      });
    };
    window.addEventListener(EVENTO_CENTRAL, aoPedir);
    return () => window.removeEventListener(EVENTO_CENTRAL, aoPedir);
  }, [catalogs, userData, t]);

  const fecharDeCima = useCallback(() => setPilha((atual) => atual.slice(0, -1)), []);

  const temFichaAberta = pilha.length > 0;
  useEffect(() => {
    if (!temFichaAberta) return undefined;
    const aoTeclar = (evento) => {
      if (evento.key !== 'Escape') return;
      evento.stopPropagation();
      evento.preventDefault();
      fecharDeCima();
    };
    window.addEventListener('keydown', aoTeclar, true);
    return () => window.removeEventListener('keydown', aoTeclar, true);
  }, [temFichaAberta, fecharDeCima]);

  // Atalhos da ficha para as telas do sistema: fecha tudo e navega.
  const irPara = useCallback((caminho, opcoes) => {
    setPilha([]);
    navigate(caminho, opcoes);
  }, [navigate]);

  if (!temFichaAberta) return null;

  const nomeDaTela = TELAS[location.pathname.replace(/\/+$/, '')];
  const nomeDaFicha = (ficha) => nomeDoRegistro(ficha.tipo, resolverAlvo(ficha.tipo, ficha.id, catalogs));

  return pilha.map((ficha, i) => {
    const Ficha = FICHAS[ficha.tipo];
    const destino = i > 0 ? nomeDaFicha(pilha[i - 1]) : (nomeDaTela ? t(`sidebar.items.${nomeDaTela}`) : null);
    return (
      <Ficha
        key={`${ficha.tipo}:${ficha.id}`}
        id={ficha.id}
        z={CAMADA_BASE + i * PASSO_CAMADA}
        textoVoltar={destino ? t('centrais.voltarPara', { destino }) : t('centrais.voltar')}
        onFechar={fecharDeCima}
        irPara={irPara}
      />
    );
  });
}
