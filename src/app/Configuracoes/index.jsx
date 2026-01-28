import { useState, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { 
  Building2, Users, Dumbbell, CalendarDays, 
  ShieldCheck, Database, LayoutDashboard 
} from "lucide-react";

import { UnidadesTab } from './Unidades/UnidadesTab';
import { MentoresTab } from '../../components/MentoresTab';
import { ModalidadesTab } from './Modalidades/ModalidadesTab';
import { ProfessoresTab } from './Professores/ProfessoresTab';
import { FeriadosTab } from './Feriados/FeriadosTab';
import { BackupTab } from './Backup/BackupTab'; 

export default function ConfiguracoesPage() {
  const { userData, loading } = useAuth();
  
  const role = String(userData?.role || "").trim().toLowerCase();

  const tabs = useMemo(() => [
    { id: "unidades", label: "Unidades", icon: Building2, roles: ["admin", "mentor"] },
    { id: "mentores", label: "Mentores", icon: ShieldCheck, roles: ["admin"] },
    { id: "professores", label: "Professores", icon: Users, roles: ["admin", "mentor", "unidade"] },
    { id: "modalidades", label: "Modalidades", icon: Dumbbell, roles: ["admin", "mentor"] },
    { id: "feriados", label: "Feriados", icon: CalendarDays, roles: ["admin", "mentor"] },
    
    // 🔴 CORREÇÃO: Removido 'mentor'. Agora APENAS 'admin' vê o Backup.
    { id: "backup", label: "Backup", icon: Database, roles: ["admin"] },
  ], []);

  const allowedTabs = tabs.filter(t => t.roles.includes(role));

  const [activeTab, setActiveTab] = useState(() => {
    if (role === 'unidade') return 'professores';
    return 'unidades';
  });

  if (role === 'professor') {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4 text-slate-400">
        <ShieldCheck className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-bold text-slate-600">Acesso Restrito</h2>
        <p>Professores não têm acesso às configurações do sistema.</p>
      </div>
    );
  }

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">Carregando...</div>;
  if (!userData) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Acesso negado.</div>;

  return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2 transition-colors">
          <LayoutDashboard className="w-6 h-6 text-red-600" />
          Painel de Configurações
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 transition-colors">
          {role === 'unidade' ? 'Gerencie o quadro de professores da sua unidade.' : 'Gerencie os registros e parâmetros do sistema.'}
        </p>
      </div>

      {/* MENU */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 mb-6 sticky top-0 z-10 flex overflow-x-auto no-scrollbar rounded-t-xl transition-colors shadow-sm">
        {allowedTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap
                ${isActive 
                  ? "border-red-600 text-red-600 bg-red-50/50 dark:bg-red-900/10" 
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"}
              `}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-red-600" : "text-slate-400 dark:text-slate-500"}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* CONTEÚDO */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 min-h-[500px] transition-colors">
        {activeTab === "unidades" && allowedTabs.some(t => t.id === 'unidades') && <UnidadesTab />}
        {activeTab === "mentores" && allowedTabs.some(t => t.id === 'mentores') && <MentoresTab />}
        {activeTab === "modalidades" && allowedTabs.some(t => t.id === 'modalidades') && <ModalidadesTab />}
        {activeTab === "professores" && allowedTabs.some(t => t.id === 'professores') && <ProfessoresTab />}
        {activeTab === "feriados" && allowedTabs.some(t => t.id === 'feriados') && <FeriadosTab />}
        
        {/* Renderiza o Backup se permitido */}
        {activeTab === "backup" && allowedTabs.some(t => t.id === 'backup') && <BackupTab />}
      </div>
    </div>
  );
}
