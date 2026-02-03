import { useState, useMemo, Suspense, lazy } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { 
  Building2, Users, Dumbbell, CalendarDays, 
  ShieldCheck, Database, LayoutDashboard, Loader2 
} from "lucide-react";

// --- LAZY LOADING (Carregamento sob demanda para economizar dados) ---
// O navegador só baixa o código dessas abas se elas forem realmente exibidas.
const UnidadesTab = lazy(() => import('./Unidades/UnidadesTab').then(module => ({ default: module.UnidadesTab })));
const MentoresTab = lazy(() => import('../../components/MentoresTab').then(module => ({ default: module.MentoresTab })));
const ModalidadesTab = lazy(() => import('./Modalidades/ModalidadesTab').then(module => ({ default: module.ModalidadesTab })));
const ProfessoresTab = lazy(() => import('./Professores/ProfessoresTab').then(module => ({ default: module.ProfessoresTab })));
const FeriadosTab = lazy(() => import('./Feriados/FeriadosTab').then(module => ({ default: module.FeriadosTab })));
const BackupTab = lazy(() => import('./Backup/BackupTab').then(module => ({ default: module.BackupTab })));

// Componente de Loading Simples para as Abas
const TabLoading = () => (
  <div className="flex h-64 items-center justify-center text-slate-400 animate-pulse">
    <Loader2 className="w-8 h-8 animate-spin mr-2" />
    <span className="text-sm font-medium">Carregando módulo...</span>
  </div>
);

export default function ConfiguracoesPage() {
  const { userData, loading } = useAuth();
  
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);

  const tabs = useMemo(() => [
    { id: "unidades", label: "Unidades", icon: Building2, roles: ["admin", "mentor"] },
    { id: "mentores", label: "Mentores", icon: ShieldCheck, roles: ["admin"] },
    { id: "professores", label: "Professores", icon: Users, roles: ["admin", "mentor", "unidade"] },
    { id: "modalidades", label: "Modalidades", icon: Dumbbell, roles: ["admin", "mentor"] },
    { id: "feriados", label: "Feriados", icon: CalendarDays, roles: ["admin", "mentor"] },
    // Backup: Apenas Admin
    { id: "backup", label: "Backup", icon: Database, roles: ["admin"] },
  ], []);

  // Filtra as abas permitidas
  const allowedTabs = useMemo(() => tabs.filter(t => t.roles.includes(role)), [role, tabs]);

  // Define a aba ativa inicial com base na role
  const [activeTab, setActiveTab] = useState(() => {
    if (role === 'unidade') return 'professores';
    // Se por acaso a role não tiver acesso a 'unidades' (futuro), pega a primeira permitida
    const firstAllowed = tabs.find(t => t.roles.includes(role));
    return firstAllowed ? firstAllowed.id : 'unidades';
  });

  // Proteção: Se for Professor, bloqueia tela inteira
  if (role === 'professor') {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4 text-slate-400 animate-fade-in">
        <div className="bg-slate-50 p-6 rounded-full">
            <ShieldCheck className="w-16 h-16 text-slate-300" />
        </div>
        <div className="text-center">
            <h2 className="text-xl font-bold text-slate-600">Acesso Restrito</h2>
            <p className="text-sm">Esta área é exclusiva para gestão.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400"><Loader2 className="w-10 h-10 animate-spin"/></div>;
  if (!userData) return null;

  return (
    <div className="p-6 md:p-10 animate-fade-in max-w-[1600px] mx-auto min-h-screen">
      
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <span className="bg-red-50 dark:bg-red-900/20 p-2 rounded-xl text-red-600">
            <LayoutDashboard className="w-6 h-6" />
          </span>
          Painel de Configurações
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium ml-1">
          {role === 'unidade' ? 'Gerencie o quadro de professores da sua unidade.' : 'Gerencie os registros globais e parâmetros do sistema.'}
        </p>
      </div>

      {/* MENU DE ABAS (Estilo Moderno e Responsivo) */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 mb-0 sticky top-0 z-20 flex overflow-x-auto no-scrollbar rounded-t-2xl shadow-sm">
        {allowedTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                group flex items-center gap-3 px-6 py-5 text-sm font-bold border-b-2 transition-all duration-300 whitespace-nowrap min-w-fit
                ${isActive 
                  ? "border-red-600 text-red-600 bg-red-50/30 dark:bg-red-900/10" 
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"}
              `}
            >
              <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? "text-red-600 scale-110" : "text-slate-400 group-hover:text-slate-600"}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ÁREA DE CONTEÚDO (Com Suspense para Lazy Loading) */}
      <div className="bg-white dark:bg-slate-800 rounded-b-2xl rounded-tr-2xl shadow-sm border-x border-b border-slate-200 dark:border-slate-700 min-h-[600px] relative">
        <Suspense fallback={<TabLoading />}>
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === "unidades" && allowedTabs.some(t => t.id === 'unidades') && <UnidadesTab />}
                {activeTab === "mentores" && allowedTabs.some(t => t.id === 'mentores') && <MentoresTab />}
                {activeTab === "modalidades" && allowedTabs.some(t => t.id === 'modalidades') && <ModalidadesTab />}
                {activeTab === "professores" && allowedTabs.some(t => t.id === 'professores') && <ProfessoresTab />}
                {activeTab === "feriados" && allowedTabs.some(t => t.id === 'feriados') && <FeriadosTab />}
                {activeTab === "backup" && allowedTabs.some(t => t.id === 'backup') && <BackupTab />}
            </div>
        </Suspense>
      </div>
    </div>
  );
}
