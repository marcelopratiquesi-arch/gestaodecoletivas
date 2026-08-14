import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../services/firebase";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { useTranslation } from "react-i18next"; // 🟢 MOTOR ACIONADO

import { 
  LayoutDashboard, BarChart3, Calendar, CircleCheck, 
  Users, Settings, LogOut, Moon, Sun, ShieldCheck, 
  ChevronRight, TrendingUp, Globe, Megaphone, Headphones, Activity,
  Bell, Download, Trash2,
  Lock, ChevronDown, ShoppingBag, Key, FileSearch, Target,
  X, ArrowRight, Check
} from "lucide-react";

// 🌍 DADOS DAS BANDEIRAS
const LANGUAGES = [
  { code: 'pt-BR', name: 'Português', short: 'PT', flag: 'https://flagcdn.com/w40/br.png' },
  { code: 'en-US', name: 'English', short: 'EN', flag: 'https://flagcdn.com/w40/us.png' },
  { code: 'es-AR', name: 'Español', short: 'ES', flag: 'https://flagcdn.com/w40/ar.png' }
];

export default function Sidebar({ collapsed }) { 
  const { userData, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const { t, i18n } = useTranslation(); // 🟢 CÉREBRO CONECTADO

  const [pendencias, setPendencias] = useState(0);
  const [alertas, setAlertas] = useState([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // 🟢 ESTADOS DO COFRE E DA SENHA
  const [cofreAberto, setCofreAberto] = useState(false);
  const [cofreUnlocked, setCofreUnlocked] = useState(false); 
  const [showPinModal, setShowPinModal] = useState(false); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // 🟢 ESTADO DO MENU DE IDIOMAS
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const currentLang = LANGUAGES.find(lang => lang.code === (i18n.language || 'pt-BR')) || LANGUAGES[0];

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("idioma_pratique", lng);
    setIsLangMenuOpen(false);
  };
  
  // 🔒 A SENHA DO MENU (Pode trocar aqui quando quiser)
  const PIN_DO_MENU = "7788";

  if (!userData) return null;

  const role = String(userData.role || "").trim().toLowerCase();
  const isMaster = role === 'admin' || role === 'master';

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

            const qAulas = query(collection(db, "aulas"), where("dias", "array-contains", diaSemanaHoje));
            const aulasSnap = await getDocs(qAulas);
            
            const qValidacoes = query(collection(db, "validacoes"), where("data", "==", todayStr));
            const validacoesSnap = await getDocs(qValidacoes);
            const validacoesMap = new Set(validacoesSnap.docs.map(doc => doc.data().aulaId));

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

  // --- CÃO DE GUARDA EM TEMPO REAL ---
  useEffect(() => {
    if (role !== 'admin') return;

    const lastSeen = parseInt(localStorage.getItem('pratique_last_seen_alerts') || '0');

    const qConf = query(collection(db, 'auditoria_configuracoes'), where('tipoAcao', '==', 'EXPORTACAO'));
    const qCrono = query(collection(db, 'auditoria_cronograma'), where('tipoAcao', '==', 'EXCLUÍDA'));

    let confLogs = [];
    let cronoLogs = [];

    const processLogs = () => {
        const combined = [...confLogs, ...cronoLogs];
        combined.sort((a, b) => b.timestamp - a.timestamp);
        const topAlerts = combined.slice(0, 15);
        setAlertas(topAlerts);

        const unread = topAlerts.filter(a => a.timestamp > lastSeen).length;
        setUnreadAlerts(unread);
    };

    const getTimestamp = (val) => {
        if (!val) return Date.now();
        if (val.toMillis) return val.toMillis();
        if (val.seconds) return val.seconds * 1000;
        return new Date(val).getTime();
    };

    const unsubConf = onSnapshot(qConf, (snap) => {
        confLogs = snap.docs.map(d => {
            const data = d.data();
            return { id: d.id, type: 'EXPORT', title: 'Planilha LGPD Baixada', desc: `Por: ${data.usuarioAcaoNome}`, timestamp: getTimestamp(data.dataAcao) };
        });
        processLogs();
    });

    const unsubCrono = onSnapshot(qCrono, (snap) => {
        cronoLogs = snap.docs.map(d => {
            const data = d.data();
            return { id: d.id, type: 'Aula Ocultada (Lixeira)', desc: `Por: ${data.usuarioAcaoNome}`, timestamp: getTimestamp(data.dataAcao) };
        });
        processLogs();
    });

    return () => { unsubConf(); unsubCrono(); };
  }, [role]);

  const toggleNotifications = () => {
      setShowNotifications(!showNotifications);
      if (!showNotifications) {
          localStorage.setItem('pratique_last_seen_alerts', Date.now().toString());
          setUnreadAlerts(0);
      }
  };

  const handleToggleCofre = () => {
      if (!cofreUnlocked) {
          setShowPinModal(true); 
      } else {
          setCofreAberto(!cofreAberto); 
      }
  };

  const handleUnlockCofre = (e) => {
      e.preventDefault();
      if (pinInput === PIN_DO_MENU) {
          setCofreUnlocked(true);
          setCofreAberto(true);
          setShowPinModal(false);
          setPinInput('');
      } else {
          setPinError(true);
          setPinInput('');
          setTimeout(() => setPinError(false), 2000);
      }
  };

  return (
    <>
      {/* 🟢 O MODAL DE SENHA DO MENU LATERAL */}
      {showPinModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
                  <button onClick={() => setShowPinModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-rose-500 transition-colors">
                      <X className="w-6 h-6" />
                  </button>
                  
                  <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 transition-colors duration-300 ${pinError ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-500' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500'}`}>
                      <Lock className={`w-10 h-10 ${pinError ? 'animate-bounce' : ''}`} />
                  </div>
                  
                  <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800 dark:text-white mb-2">Cofre Master</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-8">Digite o PIN para liberar o menu</p>
                  
                  <form onSubmit={handleUnlockCofre}>
                      <input 
                          type="password" 
                          autoFocus
                          value={pinInput}
                          onChange={e => setPinInput(e.target.value)}
                          className={`w-full text-center text-3xl tracking-[0.5em] font-black p-4 rounded-2xl border-2 outline-none transition-all bg-slate-50 dark:bg-slate-950 dark:text-white ${pinError ? 'border-rose-500 text-rose-500 focus:border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-rose-500'}`}
                          placeholder="••••"
                          maxLength={6}
                      />
                      {pinError && <p className="text-[10px] font-black text-rose-500 uppercase mt-2 animate-pulse">PIN Incorreto</p>}
                      
                      <button type="submit" className="mt-6 w-full bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg">
                          Destravar Menu <ArrowRight className="w-4 h-4" />
                      </button>
                  </form>
              </div>
          </div>
      )}

      <div className={`flex flex-col h-full bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 transition-all duration-300 relative z-30 ${collapsed ? "w-[88px]" : "w-[280px]"}`}>
        
        {/* HEADER DA SIDEBAR */}
        <div className={`h-24 flex items-center ${collapsed ? "justify-center" : "px-6 justify-between"} transition-all relative z-50`}>
          <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30 shrink-0">
                  <span className="text-white font-black text-xl italic">P</span>
              </div>
              {!collapsed && (
                <div className="animate-in fade-in slide-in-from-left-4 shrink-0">
                  <h2 className="text-xl font-black text-slate-800 dark:text-white italic leading-none">PRATIQUE</h2>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">{t('sidebar.brandSubtitle', 'Gestão Coletivas')}</p>
                </div>
              )}
          </div>

          {/* O SINO DE NOTIFICAÇÕES */}
          {!collapsed && role === 'admin' && (
              <div className="relative shrink-0">
                  <button 
                      onClick={toggleNotifications} 
                      className={`p-2 rounded-full transition-all relative ${showNotifications ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800 dark:text-slate-400'}`}
                  >
                      <Bell className="w-5 h-5" />
                      {unreadAlerts > 0 && (
                          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 border-2 border-white dark:border-[#0f172a]"></span>
                          </span>
                      )}
                  </button>

                  {/* DROPDOWN DO SINO */}
                  {showNotifications && (
                      <div className="absolute top-12 -right-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-4">
                          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                              <span className="font-black text-slate-800 dark:text-white text-xs uppercase tracking-widest">Alertas Críticos</span>
                              <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                                  {alertas.length} Ações
                              </span>
                          </div>
                          <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-2">
                              {alertas.length === 0 ? (
                                  <div className="p-6 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhum alerta recente.</div>
                              ) : (
                                  alertas.map(alerta => (
                                      <div key={alerta.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors mb-1 cursor-default group flex gap-3 items-start">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${alerta.type === 'EXPORT' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                                              {alerta.type === 'EXPORT' ? <Download className="w-4 h-4"/> : <Trash2 className="w-4 h-4"/>}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                              <p className="text-xs font-black text-slate-800 dark:text-white uppercase truncate">{alerta.title}</p>
                                              <p className="text-[10px] font-bold text-slate-500 uppercase truncate mt-0.5">{alerta.desc}</p>
                                              <p className="mt-1.5 text-[9px] font-bold text-slate-400 tracking-wider">
                                                  {new Date(alerta.timestamp).toLocaleString('pt-BR')}
                                              </p>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                          <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-center">
                              <Link to="/app/auditoria" onClick={() => setShowNotifications(false)} className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-widest flex items-center justify-center gap-1">
                                  <Activity className="w-3 h-3"/> Abrir Auditoria Completa
                              </Link>
                          </div>
                      </div>
                  )}
              </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-6 custom-scrollbar py-4" onClick={(e) => {setShowNotifications(false); setIsLangMenuOpen(false);}}>
          
          {/* 🟢 SELETOR DE IDIOMA MAGNÍFICO (NO TOPO) */}
          <div className="relative mb-6 mx-1">
              <button 
                  onClick={(e) => { e.stopPropagation(); setIsLangMenuOpen(!isLangMenuOpen); setShowNotifications(false); }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border shadow-sm ${isLangMenuOpen ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'} ${collapsed ? 'justify-center' : ''}`}
                  title="Mudar Idioma"
              >
                  <div className="flex items-center gap-3">
                      <img src={currentLang.flag} alt="Lang" className="w-6 h-auto rounded-[2px] shadow-sm shrink-0" />
                      {!collapsed && <span className={`text-sm font-black tracking-wide ${isLangMenuOpen ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{currentLang.name}</span>}
                  </div>
                  {!collapsed && (
                      <ChevronDown className={`w-4 h-4 transition-transform ${isLangMenuOpen ? 'rotate-180 text-red-500' : 'text-slate-400'}`} />
                  )}
              </button>

              {/* Menu Dropdown de Idiomas */}
              {isLangMenuOpen && (
                  <>
                      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsLangMenuOpen(false); }}></div>
                      <div className={`absolute z-50 ${collapsed ? 'left-full top-0 ml-4' : 'top-full left-0 mt-2'} w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                          {LANGUAGES.map(lang => (
                              <button
                                  key={lang.code}
                                  onClick={(e) => { e.stopPropagation(); changeLanguage(lang.code); }}
                                  className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors ${i18n.language === lang.code ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                              >
                                  <div className="flex items-center gap-3">
                                      <img src={lang.flag} alt={lang.name} className="w-5 h-auto rounded-sm shadow-sm" />
                                      <span>{lang.name}</span>
                                  </div>
                                  {i18n.language === lang.code && <Check className="w-4 h-4" />}
                              </button>
                          ))}
                      </div>
                  </>
              )}
          </div>

          <div className="space-y-1.5">
              {!collapsed && <p className="px-4 text-[9px] font-black text-slate-400/60 uppercase tracking-widest mb-2">{t('sidebar.sections.principal', 'Principal')}</p>}
              <NavItem to="/app" icon={LayoutDashboard} label={t('sidebar.items.inicio', 'Início')} collapsed={collapsed} active={path === "/app"} />
              {["admin", "mentor", "unidade", "professor"].includes(role) && 
                  <NavItem to="/app/cronograma" icon={Calendar} label={t('sidebar.items.cronograma', 'Cronograma')} collapsed={collapsed} active={isActive("/app/cronograma")} />
              }
              {["admin", "mentor", "unidade", "professor"].includes(role) && 
                  <NavItem to="/app/pratique-play" icon={Headphones} label="Pratique Play" collapsed={collapsed} active={isActive("/app/pratique-play")} />
              }
              <NavItem to="/horarios" icon={Globe} label={t('sidebar.items.linkAluno', 'Link do Aluno')} collapsed={collapsed} active={false} target="_blank" />
          </div>

          <div className="space-y-1.5">
              {!collapsed && <p className="px-4 text-[9px] font-black text-slate-400/60 uppercase tracking-widest mb-2">{t('sidebar.sections.operacional', 'Operacional')}</p>}
              <NavItem to="/app/validacao-diaria" icon={CircleCheck} label={t('sidebar.items.validacaoDiaria', 'Validação Diária')} collapsed={collapsed} active={isActive("/app/validacao-diaria")} badge={pendencias}/>
              {["admin", "mentor"].includes(role) && <NavItem to="/app/validacao-coletiva" icon={ShieldCheck} label={t('sidebar.items.validacaoColetiva', 'Validação Coletiva')} collapsed={collapsed} active={isActive("/app/validacao-coletiva")} />}
          </div>

          <div className="space-y-1.5">
              {!collapsed && <p className="px-4 text-[9px] font-black text-slate-400/60 uppercase tracking-widest mb-2">{t('sidebar.sections.gestao', 'Gestão')}</p>}
              {["admin", "mentor"].includes(role) && <NavItem to="/app/financeiro" icon={TrendingUp} label={t('sidebar.items.performanceFinanceira', 'Financeiro')} collapsed={collapsed} active={isActive("/app/financeiro")} />}
              <NavItem to="/app/relatorio-gerencial" icon={BarChart3} label={t('sidebar.items.relatorios', 'Relatórios')} collapsed={collapsed} active={isActive("/app/relatorio-gerencial")} />
              {["admin", "mentor"].includes(role) && <NavItem to="/app/comunicacao" icon={Megaphone} label="Comunicados" collapsed={collapsed} active={isActive("/app/comunicacao")} />}
              {["admin", "mentor", "unidade"].includes(role) && <NavItem to="/app/configuracoes" icon={Settings} label={t('sidebar.items.configuracoes', 'Configurações')} collapsed={collapsed} active={isActive("/app/configuracoes")} />}
          </div>

          {/* 🟢 O COFRE MASTER */}
          {isMaster && (
              <div className={`mt-4 rounded-2xl p-2 border shadow-inner transition-all mx-1 ${cofreUnlocked ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/30' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'}`}>
                  <button 
                      onClick={handleToggleCofre}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${cofreAberto ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'} ${collapsed ? 'justify-center' : ''}`}
                  >
                      <div className="flex items-center gap-3">
                          {cofreUnlocked ? <Lock className="w-5 h-5 text-rose-500 shrink-0" /> : <Lock className="w-5 h-5 shrink-0" />}
                          {!collapsed && <span className={`text-sm font-black uppercase tracking-wider ${cofreUnlocked ? 'text-rose-600 dark:text-rose-400' : ''}`}>Cofre Master</span>}
                      </div>
                      {!collapsed && (
                          <ChevronDown className={`w-4 h-4 transition-transform shrink-0 ${cofreAberto ? 'rotate-180 text-rose-500' : ''}`} />
                      )}
                  </button>

                  {cofreAberto && cofreUnlocked && (
                      <div className={`mt-2 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200 ${collapsed ? 'flex flex-col items-center' : 'pl-2 border-l-2 border-rose-200 dark:border-rose-900/30 ml-4'}`}>
                          <NavItem to="/app/ociosidade" icon={Target} label="Radar de Grade" collapsed={collapsed} active={isActive("/app/ociosidade")} />
                          <NavItem to="/app/workshops" icon={ShoppingBag} label="Loja & Eventos" collapsed={collapsed} active={isActive("/app/workshops")} />
                          <NavItem to="/app/auditoria" icon={FileSearch} label="Auditoria" collapsed={collapsed} active={isActive("/app/auditoria")} />
                          <NavItem to="/app/acessos" icon={Key} label="Acessos" collapsed={collapsed} active={isActive("/app/acessos")} />
                      </div>
                  )}
              </div>
          )}
        </nav>

        {/* 🟢 FOOTER DA SIDEBAR (APENAS TEMA E SAIR) */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm mt-auto relative">
          
          <div className={`flex items-center gap-3 mb-4 ${collapsed ? "justify-center" : ""}`}>
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-white text-xs border-2 border-white dark:border-slate-600 shadow-sm relative shrink-0">
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
              <button onClick={toggleTheme} title="Mudar Tema" className="flex-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
                  <IconWrapper icon={theme === 'dark' ? Sun : Moon} />
              </button>
              <button onClick={logout} title="Sair" className="flex-1 p-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition-colors">
                  <IconWrapper icon={LogOut} />
              </button>
          </div>
        </div>
      </div>
    </>
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

const IconWrapper = ({ icon: Icon }) => <Icon className="w-4 h-4 mx-auto flex-shrink-0" />;