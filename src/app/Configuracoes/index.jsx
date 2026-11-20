import { useState, useMemo, Suspense, lazy } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { 
  Building2, Users, Dumbbell, CalendarDays, 
  ShieldCheck, Database, LayoutDashboard, Loader2, Headphones, UserCheck, ShoppingBag
} from "lucide-react";
import { useCatalogs } from "../../contexts/CatalogContext";
import { useTranslation } from "react-i18next"; // 🟢 MOTOR ACIONADO
import { ehLider, ehDoMeuEscopo } from '../../permissions';
import { useLocation } from "react-router-dom";
import { temaDaAba } from "./ui/temas";
import { useTelaGrande } from "./ui/useTelaGrande";

// --- LAZY LOADING ---
const UnidadesTab = lazy(() => import('./Unidades/UnidadesTab').then(module => ({ default: module.UnidadesTab })));
const MentoresTab = lazy(() => import('./Mentores/MentoresTab').then(module => ({ default: module.MentoresTab })));
const ModalidadesTab = lazy(() => import('./Modalidades/ModalidadesTab').then(module => ({ default: module.ModalidadesTab })));
const ProfessoresTab = lazy(() => import('./Professores/ProfessoresTab').then(module => ({ default: module.ProfessoresTab })));
const FeriadosTab = lazy(() => import('./Feriados/FeriadosTab').then(module => ({ default: module.FeriadosTab })));
const BackupTab = lazy(() => import('./Backup/BackupTab'));
// Workshops: SÓ o cadastro (nome, data, modalidade, participantes). Resumo, Estoque e Eventos têm dinheiro e ficam no Cofre,
// por isso esta aba NÃO carrega a tela da Loja (src/app/Workshops/index.jsx), só o cadastro.
const WorkshopsTab = lazy(() => import('../Workshops/WorkshopsCadastro'));
const LideresTab = lazy(() => import('./Lideres/LideresTab').then(module => ({ default: module.LideresTab })));

// 🟢 NOVA ABA: PRATIQUE PLAY
const PratiquePlayTab = lazy(() => import('./PratiquePlay/PratiquePlayTab').then(module => ({ default: module.PratiquePlayTab })));

// Componente de Loading com Tradução
const TabLoading = () => {
  const { t } = useTranslation();
  return (
    <div className="flex h-64 items-center justify-center text-slate-400 animate-pulse">
      <Loader2 className="w-8 h-8 animate-spin mr-2" />
      <span className="text-sm font-medium">{t('settingsPage.loadingModule', 'Carregando módulo...')}</span>
    </div>
  );
};

export default function ConfiguracoesPage() {
  const { userData, loading } = useAuth();
  const { t } = useTranslation(); // 🟢 CÉREBRO CONECTADO NO COMPONENTE PRINCIPAL
  const computador = useTelaGrande(); // >= 1024 px: barra de menus fixa no topo; no celular fica como era
  
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  // Número vermelho da aba Líderes: unidades SEM LÍDER (o que a pessoa enxerga). Os pedidos de acesso e os
  // líderes a conferir aparecem dentro da aba, na central de pendências.
  const { catalogs } = useCatalogs();
  const unidadesSemLider = useMemo(() => (catalogs?.unidades || []).filter((u) =>
    !u.liderUid && (role === "admin" || (role === "mentor" && ehDoMeuEscopo(userData, u.mentorId)))).length,
  [catalogs?.unidades, role, userData]);

  // 🟢 Abas agora reagem ao idioma em tempo real
  const tabs = useMemo(() => [
    // Ordem: Mentores, Líderes, Professores, Unidades, Modalidades, Feriados, Workshops, Pratique Play, Backup.
    // Os pedidos de acesso pelo Google ficam dentro da aba Líderes (o número vermelho da aba = unidades sem líder).
    { id: "mentores", label: t('settingsPage.tabs.mentores', 'Mentores'), icon: ShieldCheck, roles: ["admin"] },
    { id: "lideres", label: t('settingsPage.tabs.lideres'), icon: UserCheck, roles: ["admin", "mentor"], contador: unidadesSemLider },
    { id: "professores", label: t('settingsPage.tabs.professores', 'Professores'), icon: Users, roles: ["admin", "mentor", "lider", "unidade"] },
    { id: "unidades", label: t('settingsPage.tabs.unidades', 'Unidades'), icon: Building2, roles: ["admin", "mentor"] },
    { id: "modalidades", label: t('settingsPage.tabs.modalidades', 'Modalidades'), icon: Dumbbell, roles: ["admin", "mentor"] },
    { id: "feriados", label: t('settingsPage.tabs.feriados', 'Feriados'), icon: CalendarDays, roles: ["admin", "mentor"] },
    { id: "workshops", label: t('settingsPage.tabs.workshops', 'Workshops'), icon: ShoppingBag, roles: ["admin", "mentor", "lider", "unidade"] },
    { id: "pratique-play", label: t('settingsPage.tabs.pratiquePlay', 'Pratique Play'), icon: Headphones, roles: ["admin"] },
    { id: "backup", label: t('settingsPage.tabs.backup', 'Backup'), icon: Database, roles: ["admin"] },
  ], [t, unidadesSemLider]);

  const allowedTabs = useMemo(() => tabs.filter(t => t.roles.includes(role)), [role, tabs]);

  // Atalhos da Página de Início abrem direto na aba certa (navigate com state: { aba }), se o perfil puder vê-la.
  const location = useLocation();
  const abaPedida = location.state?.aba;

  const [activeTab, setActiveTab] = useState(() => {
    if (abaPedida && tabs.some(t => t.id === abaPedida && t.roles.includes(role))) return abaPedida;
    if (ehLider(role)) return 'professores';
    const firstAllowed = tabs.find(t => t.roles.includes(role));
    return firstAllowed ? firstAllowed.id : 'unidades';
  });

  // Se a pessoa já está nas Configurações e chega um novo atalho (ex.: botão "Resolver" de uma Central),
  // troca para a aba pedida. Cada chegada tem uma chave própria (location.key); aplicado uma vez por chegada.
  const [chegadaVista, setChegadaVista] = useState(location.key);
  if (location.key !== chegadaVista) {
    setChegadaVista(location.key);
    if (abaPedida && tabs.some(t => t.id === abaPedida && t.roles.includes(role))) setActiveTab(abaPedida);
  }

  // Cor da aba aberta (pinta o ícone do título e a faixa do conteúdo)
  const temaAtivo = temaDaAba(activeTab);

  if (role === 'professor') {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4 text-slate-400 animate-fade-in">
        <div className="bg-slate-50 p-6 rounded-full">
            <ShieldCheck className="w-16 h-16 text-slate-300" />
        </div>
        <div className="text-center">
            <h2 className="text-xl font-bold text-slate-600">{t('settingsPage.restrictedAccess.title', 'Acesso Restrito')}</h2>
            <p className="text-sm">{t('settingsPage.restrictedAccess.desc', 'Esta área é exclusiva para gestão.')}</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400"><Loader2 className="w-10 h-10 animate-spin"/></div>;
  if (!userData) return null;

  const pode = (id) => activeTab === id && allowedTabs.some(t => t.id === id);
  const conteudo = (
    <Suspense fallback={<TabLoading />}>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {pode("unidades") && <UnidadesTab />}
            {pode("lideres") && <LideresTab />}
            {pode("mentores") && <MentoresTab />}
            {pode("modalidades") && <ModalidadesTab />}
            {pode("professores") && <ProfessoresTab />}
            {pode("feriados") && <FeriadosTab />}
            {pode("workshops") && <WorkshopsTab />}
            {pode("pratique-play") && <PratiquePlayTab />}
            {pode("backup") && <BackupTab />}
        </div>
    </Suspense>
  );

  // COMPUTADOR: barra horizontal fixa no topo (não some ao rolar) com a marca e as abas; o conteúdo de cada aba
  // não muda. Líderes tem o próprio desenho de página (sem a moldura branca); as outras abas seguem na moldura.
  if (computador) {
    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 animate-fade-in">
        <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800">
          <div className="max-w-[1440px] mx-auto px-6 py-2.5 flex items-center gap-4">
            <div className="flex items-center gap-2.5 shrink-0">
              <span aria-hidden="true" className="w-9 h-9 rounded-[10px] bg-red-600 text-white inline-flex items-center justify-center font-black text-lg">P</span>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-neutral-500">{t('settingsPage.bar.panel', 'Painel')}</div>
                <div className="text-sm font-black text-neutral-900 dark:text-white">{t('settingsPage.bar.settings', 'Configurações')}</div>
              </div>
            </div>
            <span aria-hidden="true" className="w-px h-8 bg-neutral-200 dark:bg-neutral-800 shrink-0" />
            <nav aria-label={t('settingsPage.bar.settings', 'Configurações')} className="flex gap-0.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
              {allowedTabs.map((tab) => {
                const Icon = tab.icon;
                const ativo = activeTab === tab.id;
                return (
                  <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={ativo ? "page" : undefined}
                    className={`inline-flex items-center gap-2 h-10 px-3 rounded-[10px] text-sm whitespace-nowrap shrink-0 transition-colors ${ativo
                      ? "bg-red-600 text-white font-extrabold"
                      : "font-semibold text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"}`}>
                    <Icon className="w-[17px] h-[17px] shrink-0" aria-hidden="true" />
                    {tab.label}
                    {tab.contador > 0 && (
                      <span className={`px-[7px] py-px rounded-full text-[11px] font-black ${ativo ? "bg-white text-red-700" : "bg-red-600 text-white"}`}>{tab.contador}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        <main className="max-w-[1440px] mx-auto p-6">
          {activeTab === "lideres" ? conteudo : (
            <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 min-h-[600px] relative ${temaAtivo.faixa}`}>
              {conteudo}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 animate-fade-in max-w-[1600px] mx-auto min-h-screen">
      
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <span className={`p-2 rounded-xl transition-colors duration-300 ${temaAtivo.iconeTitulo}`}>
            <LayoutDashboard className="w-6 h-6" />
          </span>
          {t('settingsPage.title', 'Painel de Configurações')}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium ml-1">
          {ehLider(role) 
            ? t('settingsPage.subtitle.unidade', 'Gerencie o quadro de professores da sua unidade.') 
            : t('settingsPage.subtitle.default', 'Gerencie os registros globais e parâmetros do sistema.')}
        </p>
      </div>

      {/* MENU DE ABAS */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 mb-0 sticky top-0 z-20 flex overflow-x-auto no-scrollbar rounded-t-2xl shadow-sm">
        {allowedTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const tema = temaDaAba(tab.id); // cada aba tem a sua cor (ui/temas.js)
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`
                group flex items-center gap-3 px-6 py-5 text-sm font-bold border-b-4 transition-all duration-300 whitespace-nowrap min-w-fit
                ${isActive
                  ? tema.menuAtivo
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"}
              `}
            >
              <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? `${tema.menuIconeAtivo} scale-110` : "text-slate-400 group-hover:text-slate-600"}`} />
              {tab.label}
              {tab.contador > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">{tab.contador}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ÁREA DE CONTEÚDO */}
      <div className={`bg-white dark:bg-slate-800 rounded-b-2xl shadow-sm border-x border-b border-slate-200 dark:border-slate-700 min-h-[600px] relative transition-colors duration-300 ${temaAtivo.faixa}`}>
        {conteudo}
      </div>
    </div>
  );
}