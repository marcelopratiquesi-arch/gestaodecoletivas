import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

// 🟢 Adicionei o ícone 'Headphones' aqui na lista!
import { 
  LayoutDashboard, BarChart3, Calendar, CircleCheck, 
  Users, Settings, LogOut, Moon, Sun, ShieldCheck, 
  ChevronRight, TrendingUp, Globe, Megaphone, Headphones 
} from "lucide-react";

export default function Sidebar({ collapsed }) { 
  const { userData, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [pendencias, setPendencias] = useState(0);

  if (!userData) return null;

  const role = String(userData.role || "").trim().toLowerCase();
  const userInitials = userData.nome 
    ? (userData.nome.split(' ')[0][0] + (userData.nome.split(' ').length > 1 ? userData.nome.split(' ').pop()[0] : '')).toUpperCase()
    : "US";

  const path = location.pathname;
  const isActive = (route) => path === route || path.startsWith(`${route}/`);

  // --- CÁLCULO DE PENDÊNCIAS ---
  useEffect(() => {
    const fetchPendencias = async () => {
        try {
            const todayStr = new Date().toLocaleDateString('en-CA');
            const diasSemanaMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
            const diaSemanaHoje = diasSemanaMap[new Date().getDay()];

            // 1. Buscar Aulas de HOJE
            const qAulas = query(collection(db, "aulas"), where("dias", "array-contains", diaSemanaHoje));
            const aulasSnap = await getDocs(qAulas);
            
            // 2. Buscar Validações de HOJE
            const qValidacoes = query(collection(db, "validacoes"), where("data", "==", todayStr));
            const validacoesSnap = await getDocs(qValidacoes);
            const validacoesMap = new Set(validacoesSnap.docs.map(doc => doc.data().aulaId));

            // 3. Buscar Unidades (se for Mentor)
            let unidadesMentorIds = [];
            if (role === 'mentor') {
                const uSnap = await getDocs(query(collection(db, "unidades"), where("mentorId", "==", userData.uid || userData.id)));
                unidadesMentorIds = uSnap.docs.map(d => d.id);
            }

            let count = 0;
            aulasSnap.docs.forEach(doc => {
                const aula = doc.data();
                const aulaId = doc.id;
                let isMyResponsibility = false;

                if (role === 'admin') isMyResponsibility = true;
                else if (role === 'unidade' && String(aula.unidadeId) === String(userData.unidadeId)) isMyResponsibility = true;
                else if (role === 'professor' && String(aula.professorId) === String(userData.uid || userData.id)) isMyResponsibility = true;
                else if (role === 'mentor' && unidadesMentorIds.includes(String(aula.unidadeId))) isMyResponsibility = true;

                if (isMyResponsibility && !validacoesMap.has(aulaId)) count++;
            });
            setPendencias(count);
        } catch (error) { console.error("Erro pendências:", error); }
    };
    fetchPendencias();
    const interval = setInterval(fetchPendencias, 60000);
    return () => clearInterval(interval);
  }, [role, userData]);

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 transition-all duration-300 relative z-30 ${collapsed ? "w-[88px]" : "w-[280px]"}`}>
      
      {/* HEADER */}
      <div className={`h-24 flex items-center ${collapsed ? "justify-center" : "px-8"} transition-all`}>
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
                <span className="text-white font-black text-xl italic">P</span>
            </div>
            {!collapsed && (
              <div className="animate-in fade-in slide-in-from-left-4">
                <h2 className="text-xl font-black text-slate-800 dark:text-white italic leading-none">PRATIQUE</h2>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Gestão Coletivas</p>
              </div>
            )}
        </div>
      </div>

      {/* NAV */}
      <nav className="flex-1 overflow-y-auto px-4 space-y-6 custom-scrollbar py-4">
        
        {/* BLOCO PRINCIPAL */}
        <div className="space-y-1.5">
            {!collapsed && <p className="px-4 text-[9px] font-black text-slate-400/60 uppercase tracking-widest mb-2">Principal</p>}
            
            <NavItem to="/app" icon={LayoutDashboard} label="Início" collapsed={collapsed} active={path === "/app"} />
            
            {["admin", "mentor", "unidade", "professor"].includes(role) && 
                <NavItem to="/app/cronograma" icon={Calendar} label="Cronograma" collapsed={collapsed} active={isActive("/app/cronograma")} />
            }

            {/* 🟢 O BOTÃO DO PRATIQUE PLAY AQUI! */}
            {["admin", "mentor", "unidade", "professor"].includes(role) && 
                <NavItem to="/app/pratique-play" icon={Headphones} label="Pratique Play" collapsed={collapsed} active={isActive("/app/pratique-play")} />
            }

            {/* Link Público (Abre em nova aba) */}
            <NavItem 
                to="/horarios" 
                icon={Globe} 
                label="Link do Aluno" 
                collapsed={collapsed} 
                active={false} 
                target="_blank" 
            />
        </div>

        {/* BLOCO OPERACIONAL */}
        <div className="space-y-1.5">
            {!collapsed && <p className="px-4 text-[9px] font-black text-slate-400/60 uppercase tracking-widest mb-2">Operacional</p>}
            <NavItem to="/app/validacao-diaria" icon={CircleCheck} label="Validação Diária" collapsed={collapsed} active={isActive("/app/validacao-diaria")} badge={pendencias}/>
            {["admin", "mentor"].includes(role) && <NavItem to="/app/validacao-coletiva" icon={ShieldCheck} label="Validação Coletiva" collapsed={collapsed} active={isActive("/app/validacao-coletiva")} />}
        </div>

        {/* BLOCO DE GESTÃO */}
        {["admin", "mentor", "unidade", "professor"].includes(role) && (
            <div className="space-y-1.5">
                {!collapsed && <p className="px-4 text-[9px] font-black text-slate-400/60 uppercase tracking-widest mb-2">Gestão</p>}
                
                {["admin", "mentor"].includes(role) && <NavItem to="/app/financeiro" icon={TrendingUp} label="Performance Financeira" collapsed={collapsed} active={isActive("/app/financeiro")} />}
                
                {/* Professor só vê Relatórios aqui dentro */}
                <NavItem to="/app/relatorio-gerencial" icon={BarChart3} label="Relatórios" collapsed={collapsed} active={isActive("/app/relatorio-gerencial")} />
                
                {/* Nova Central de Comunicação (Gestão) */}
                {["admin", "mentor"].includes(role) && <NavItem to="/app/comunicacao" icon={Megaphone} label="Comunicados" collapsed={collapsed} active={isActive("/app/comunicacao")} />}
                
                {["admin", "mentor", "unidade"].includes(role) && <NavItem to="/app/configuracoes" icon={Settings} label="Configurações" collapsed={collapsed} active={isActive("/app/configuracoes")} />}
            </div>
        )}
      </nav>

      {/* FOOTER */}
      <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className={`flex items-center gap-3 mb-4 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-white text-xs border-2 border-white dark:border-slate-600 shadow-sm relative">
            {userInitials}
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{userData.nome?.split(' ')[0]}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase">{role}</p>
            </div>
          )}
        </div>
        <div className={`flex gap-2 ${collapsed ? 'flex-col' : ''}`}>
            <button onClick={toggleTheme} className="flex-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"><IconWrapper icon={theme === 'dark' ? Sun : Moon} /></button>
            <button onClick={logout} className="flex-1 p-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition-colors"><IconWrapper icon={LogOut} /></button>
        </div>
      </div>
    </div>
  );
}

const NavItem = ({ to, icon: Icon, label, collapsed, active, badge, target }) => (
  <Link 
    to={to} 
    target={target} 
    className={`relative flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl transition-all duration-300 group ${active ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/20" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"} ${collapsed ? "justify-center" : ""}`}
  >
    {collapsed && <div className="absolute left-14 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">{label}</div>}
    <Icon className={`w-5 h-5 ${active ? "text-white" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`} />
    {!collapsed && <span className="text-sm font-medium flex-1">{label}</span>}
    {!collapsed && badge > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white shadow-sm">{badge}</span>}
    {collapsed && badge > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>}
    {!collapsed && !active && <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300"/>}
  </Link>
);

const IconWrapper = ({ icon: Icon }) => <Icon className="w-4 h-4 mx-auto" />;