import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { 
  LayoutDashboard, BarChart3, Calendar, CheckCircle2, 
  Users, Settings, LogOut, Moon, Sun, ShieldCheck 
} from "lucide-react";

export default function Sidebar({ collapsed }) { 
  const { userData, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  if (!userData) return null;

  const role = String(userData.role || "").trim().toLowerCase();
  const path = location.pathname;
  
  const isActive = (route) => path === route || path.startsWith(`${route}/`);

  const userInitial = userData.nome ? userData.nome.charAt(0).toUpperCase() : "U";
  const primeiroNome = userData.nome ? userData.nome.split(" ")[0] : "Usuário";

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 transition-all duration-300 shadow-2xl relative z-20">
      
      {/* === LOGO === */}
      <div className={`p-6 border-b border-slate-800 flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
        <div className="w-8 h-8 bg-red-600 rounded-lg flex-shrink-0 shadow-lg shadow-red-900/50 flex items-center justify-center transform transition-transform hover:scale-110">
           <span className="text-white font-black text-lg italic">P</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden whitespace-nowrap transition-all duration-300">
            <h2 className="text-lg font-black text-white tracking-tight italic">PRATIQUE</h2>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Gestão Coletivas</p>
          </div>
        )}
      </div>

      {/* === NAVEGAÇÃO === */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 overflow-x-hidden custom-scrollbar">
        
        <NavItem to="/app" icon={LayoutDashboard} label="Início" collapsed={collapsed} active={path === "/app"} />

        {(["admin", "mentor", "unidade", "professor"].includes(role)) && (
          <NavItem to="/app/relatorio-gerencial" icon={BarChart3} label="Relatórios" collapsed={collapsed} active={isActive("/app/relatorio-gerencial")} />
        )}

        {(["admin", "mentor", "unidade", "professor"].includes(role)) && (
          <NavItem to="/app/cronograma" icon={Calendar} label="Cronograma" collapsed={collapsed} active={isActive("/app/cronograma")} />
        )}

        {(["admin", "mentor", "unidade", "professor"].includes(role)) && (
          <NavItem to="/app/validacao-diaria" icon={CheckCircle2} label="Validação Diária" collapsed={collapsed} active={isActive("/app/validacao-diaria")} />
        )}

        {/* 🔴 CORREÇÃO: Apenas Admin e Mentor veem isso no menu */}
        {(["admin", "mentor"].includes(role)) && (
          <NavItem to="/app/validacao-coletiva" icon={ShieldCheck} label="Validação Coletiva" collapsed={collapsed} active={isActive("/app/validacao-coletiva")} />
        )}

        {/* Configurações */}
        {(["admin", "mentor", "unidade"].includes(role)) && (
          <NavItem to="/app/configuracoes" icon={Settings} label="Configurações" collapsed={collapsed} active={isActive("/app/configuracoes")} />
        )}
      </nav>

      {/* === FOOTER === */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50 space-y-2">
        <div className={`flex items-center gap-3 p-2 rounded-lg bg-slate-900 border border-slate-800 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold border border-slate-600 flex-shrink-0">
            {userInitial}
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate max-w-[120px]">{primeiroNome}</p>
              <p className="text-[9px] text-red-500 uppercase font-bold tracking-wide">{role}</p>
            </div>
          )}
        </div>

        <button 
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-all ${collapsed ? "justify-center" : ""}`}
          title="Alternar Tema"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {!collapsed && (theme === 'dark' ? "Modo Claro" : "Modo Escuro")}
        </button>

        <button 
          onClick={logout} 
          className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors ${collapsed ? "justify-center" : ""}`}
          title="Sair do Sistema"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && "SAIR"}
        </button>
      </div>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, collapsed, active }) {
  return (
    <Link 
      to={to} 
      className={`
        flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group font-medium text-sm mb-1
        ${active 
          ? "bg-red-600 text-white shadow-lg shadow-red-900/30 translate-x-1" 
          : "text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1"}
        ${collapsed ? "justify-center" : ""}
      `}
      title={collapsed ? label : ""}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${active ? "text-white" : "text-slate-500 group-hover:text-white"}`} />
      {!collapsed && <span className="whitespace-nowrap overflow-hidden">{label}</span>}
    </Link>
  )
}
