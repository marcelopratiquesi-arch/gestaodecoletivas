import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { 
  LayoutDashboard, BarChart3, Calendar, CheckCircle2, 
  Users, Settings, LogOut, Moon, Sun, ShieldCheck, 
  ChevronRight, TrendingUp // <--- NOVO ÍCONE ADICIONADO AQUI
} from "lucide-react";

export default function Sidebar({ collapsed }) { 
  const { userData, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [pendencias, setPendencias] = useState(0);

  if (!userData) return null;

  const role = String(userData.role || "").trim().toLowerCase();
  const userId = userData.id || userData.uid;
  const path = location.pathname;
  
  const isActive = (route) => path === route || path.startsWith(`${route}/`);

  // --- LÓGICA DE NOME E INICIAIS ---
  const nomeCompleto = userData.nome || "Usuário Sistema";
  const partesNome = nomeCompleto.trim().split(/\s+/);
  const primeiroNome = partesNome[0];
  const ultimoNome = partesNome.length > 1 ? partesNome[partesNome.length - 1] : "";
  
  const userInitials = (primeiroNome[0] + (ultimoNome ? ultimoNome[0] : "")).toUpperCase();

  // --- CÁLCULO REAL DE PENDÊNCIAS ---
  useEffect(() => {
    const fetchPendencias = async () => {
        try {
            const today = new Date();
            const todayStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD
            const diasSemanaMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
            const diaSemanaHoje = diasSemanaMap[today.getDay()];

            // 1. Buscar Aulas de HOJE
            const aulasRef = collection(db, "aulas");
            const qAulas = query(aulasRef, where("dias", "array-contains", diaSemanaHoje));
            const aulasSnap = await getDocs(qAulas);
            
            // 2. Buscar Validações de HOJE
            const validacoesRef = collection(db, "validacoes");
            const qValidacoes = query(validacoesRef, where("data", "==", todayStr));
            const validacoesSnap = await getDocs(qValidacoes);
            
            const validacoesMap = new Set();
            validacoesSnap.forEach(doc => validacoesMap.add(doc.data().aulaId));

            // 3. Buscar Unidades (se for Mentor, para filtrar)
            let unidadesMentorIds = [];
            if (role === 'mentor') {
                const uRef = collection(db, "unidades");
                const uSnap = await getDocs(query(uRef, where("mentorId", "==", userId)));
                unidadesMentorIds = uSnap.docs.map(d => d.id);
            }

            let count = 0;

            aulasSnap.forEach(doc => {
                const aula = doc.data();
                const aulaId = doc.id;

                // Filtros de Permissão
                let shouldCount = false;

                if (role === 'admin') {
                    shouldCount = true;
                } else if (role === 'unidade') {
                    if (String(aula.unidadeId) === String(userData.unidadeId)) shouldCount = true;
                } else if (role === 'professor') {
                    if (String(aula.professorId) === String(userId)) shouldCount = true;
                } else if (role === 'mentor') {
                    if (unidadesMentorIds.includes(String(aula.unidadeId))) shouldCount = true;
                }

                // Se a aula é de hoje, é minha responsabilidade e NÃO foi validada
                if (shouldCount && !validacoesMap.has(aulaId)) {
                    count++;
                }
            });

            setPendencias(count);

        } catch (error) {
            console.error("Erro ao calcular pendências da sidebar:", error);
        }
    };

    fetchPendencias();
    
    // Configura um intervalo para atualizar a cada 60s
    const interval = setInterval(fetchPendencias, 60000);
    return () => clearInterval(interval);

  }, [role, userId, userData]);

  return (
    <div className={`
      flex flex-col h-full transition-all duration-500 ease-cubic-bezier relative z-30
      bg-white dark:bg-[#0f172a] 
      border-r border-slate-200 dark:border-slate-800
      ${collapsed ? "w-[88px]" : "w-[280px]"}
    `}>
      
      {/* === 1. HEADER (MARCA LIMPA) === */}
      <div className={`h-24 flex items-center ${collapsed ? "justify-center" : "px-8"} transition-all duration-300`}>
        <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer">
                {/* Logo Icon com efeito Glass */}
                <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <span className="text-white font-black text-xl italic tracking-tighter">P</span>
                </div>
                {/* Brilho pulsante */}
                <div className="absolute inset-0 bg-red-400 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-500 animate-pulse"></div>
            </div>

            {!collapsed && (
              <div className="flex flex-col justify-center animate-in fade-in slide-in-from-left-4 duration-500">
                <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tighter leading-none italic">
                  PRATIQUE
                </h2>
                <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] leading-tight">
                      Gestão Coletivas
                    </p>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* === 2. NAVEGAÇÃO (CLEAN & GROUPED) === */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8 overflow-x-hidden custom-scrollbar">
        
        {/* GRUPO: PRINCIPAL */}
        <div className="space-y-1.5">
            {!collapsed && <SectionTitle label="Principal" />}
            <NavItem to="/app" icon={LayoutDashboard} label="Início" collapsed={collapsed} active={path === "/app"} />
            
            {(["admin", "mentor", "unidade", "professor"].includes(role)) && (
              <NavItem to="/app/cronograma" icon={Calendar} label="Cronograma" collapsed={collapsed} active={isActive("/app/cronograma")} />
            )}
        </div>

        {/* GRUPO: OPERACIONAL (COM ALERTAS REAIS) */}
        <div className="space-y-1.5">
            {!collapsed && <SectionTitle label="Operacional" />}
            
            {(["admin", "mentor", "unidade", "professor"].includes(role)) && (
              <NavItem 
                to="/app/validacao-diaria" 
                icon={CheckCircle2} 
                label="Validação Diária" 
                collapsed={collapsed} 
                active={isActive("/app/validacao-diaria")}
                badge={pendencias > 0 ? pendencias : null}
                badgeColor="bg-rose-500 text-white shadow-rose-500/40"
              />
            )}

            {(["admin", "mentor"].includes(role)) && (
              <NavItem to="/app/validacao-coletiva" icon={ShieldCheck} label="Validação Coletiva" collapsed={collapsed} active={isActive("/app/validacao-coletiva")} />
            )}
        </div>

        {/* GRUPO: GESTÃO */}
        {(["admin", "mentor", "unidade"].includes(role)) && (
            <div className="space-y-1.5">
                {!collapsed && <SectionTitle label="Gestão" />}
                
                {/* --- NOVO ITEM: PERFORMANCE FINANCEIRA --- */}
                {/* Apenas Admin e Mentor podem ver */}
                {(["admin", "mentor"].includes(role)) && (
                    <NavItem 
                        to="/app/performance-financeira" 
                        icon={TrendingUp} 
                        label="Performance Financeira" 
                        collapsed={collapsed} 
                        active={isActive("/app/performance-financeira")} 
                    />
                )}
                {/* ----------------------------------------- */}

                <NavItem to="/app/relatorio-gerencial" icon={BarChart3} label="Relatórios" collapsed={collapsed} active={isActive("/app/relatorio-gerencial")} />
                
                <NavItem to="/app/configuracoes" icon={Settings} label="Configurações" collapsed={collapsed} active={isActive("/app/configuracoes")} />
            </div>
        )}

      </nav>

      {/* === 3. FOOTER (LIMPO & FUNCIONAL) === */}
      <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 backdrop-blur-md">
        
        {/* Card do Usuário (Maior e Mais Bonito) */}
        <div className={`
            flex items-center gap-4 transition-all duration-300 mb-4
            ${collapsed ? "justify-center" : "justify-start"}
        `}>
          <div className="relative group">
              {/* Avatar Maior (w-12 h-12) com Iniciais */}
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-200 to-white dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-700 dark:text-white font-black text-sm border-2 border-white dark:border-slate-700 shadow-md group-hover:scale-105 transition-transform duration-300">
                {userInitials}
              </div>
              {/* Status Indicator */}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-[3px] border-white dark:border-slate-900 rounded-full"></div>
          </div>
          
          {!collapsed && (
            <div className="overflow-hidden min-w-0 flex-1 animate-in fade-in zoom-in duration-300">
              <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{primeiroNome} {ultimoNome}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                {role} 
              </p>
            </div>
          )}
        </div>

        {/* Ações (Apenas Tema e Sair) */}
        <div className={`flex gap-2 ${collapsed ? 'flex-col' : ''}`}>
            <ToolbarButton 
                icon={theme === 'dark' ? Sun : Moon} 
                onClick={toggleTheme} 
                label={!collapsed ? (theme === 'dark' ? "Claro" : "Escuro") : ""}
                collapsed={collapsed} 
                tooltip="Mudar Tema" 
            />
            <ToolbarButton 
                icon={LogOut} 
                onClick={logout} 
                label={!collapsed ? "Sair" : ""}
                collapsed={collapsed} 
                isDanger 
                tooltip="Sair" 
            />
        </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTES VISUAIS ---

const SectionTitle = ({ label }) => (
    <div className="px-4 pb-2 pt-2">
        <p className="text-[9px] font-black text-slate-400/60 uppercase tracking-widest">
            {label}
        </p>
    </div>
);

// Botão da Toolbar (Clean)
const ToolbarButton = ({ icon: Icon, onClick, label, collapsed, isDanger, tooltip }) => (
    <button 
        onClick={onClick}
        className={`
            relative group flex items-center justify-center gap-2 p-2.5 rounded-xl transition-all duration-200 flex-1 font-bold text-xs
            ${isDanger 
                ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30' 
                : 'bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}
        `}
        title={collapsed ? tooltip : ""}
    >
        <Icon className="w-4 h-4" />
        {label}
    </button>
);

function NavItem({ to, icon: Icon, label, collapsed, active, badge, badgeColor }) {
  return (
    <Link 
      to={to} 
      className={`
        relative flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl transition-all duration-300 group
        ${active 
          ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/25" 
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"}
        ${collapsed ? "justify-center" : ""}
      `}
    >
      {/* Tooltip Lateral (Só aparece colapsado) */}
      {collapsed && (
          <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-200 pointer-events-none z-50 whitespace-nowrap">
              {label}
              <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-900 dark:bg-white transform rotate-45"></div>
          </div>
      )}

      {/* Ícone */}
      <div className={`relative z-10 transition-transform duration-300 ${active ? "scale-110" : "group-hover:scale-110 group-hover:rotate-3"}`}>
        <Icon className={`w-5 h-5 ${active ? "text-white" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200"}`} />
      </div>
      
      {/* Texto */}
      {!collapsed && (
        <span className={`whitespace-nowrap overflow-hidden flex-1 relative z-10 text-sm ${active ? "font-bold" : "font-medium"}`}>
            {label}
        </span>
      )}
      
      {/* Badge de Notificação (Contador Real) */}
      {!collapsed && badge > 0 && (
          <span className={`
            px-2 py-0.5 rounded-md text-[10px] font-black min-w-[20px] text-center shadow-lg relative z-10 animate-in zoom-in
            ${badgeColor || "bg-blue-100 text-blue-700"}
          `}>
              {badge}
          </span>
      )}
      {/* Badge Bolinha (Modo Colapsado) */}
      {collapsed && badge > 0 && (
          <span className="absolute top-2 right-2 w-3 h-3 bg-rose-500 border-2 border-white dark:border-slate-900 rounded-full z-20 animate-pulse"></span>
      )}

      {/* Seta sutil no hover */}
      {!collapsed && !active && !badge && (
        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 -translate-x-2 group-hover:translate-x-0 transition-all duration-300 ease-out" />
      )}

      {/* Brilho Sutil no Ativo */}
      {active && (
          <div className="absolute top-0 right-0 w-20 h-full bg-white/10 skew-x-12 -translate-x-10 pointer-events-none"></div>
      )}
    </Link>
  )
}
