import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCatalogs } from "../contexts/CatalogContext"; 
import { db } from "../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { 
  BarChart2, Calendar, CheckCircle2, ShieldCheck, Settings, 
  ArrowRight, Loader2, TrendingUp, MapPin, Building2, User, Check,
  Users, Dumbbell, Headphones, Link as LinkIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// 🟢 CACHE GLOBAL DA HOME (Fica fora do componente para não ser destruído ao trocar de aba)
let homeDashboardCache = {
    timestamp: 0,
    todayStr: "", 
    validacoesRealizadasOntem: 0,
    validacoesRealizadasHoje: 0
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos em milissegundos

// --- RELÓGIO COM SEGUNDOS ---
const CorporateClock = () => {
    const [date, setDate] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setDate(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex flex-col items-end border-l-4 border-red-600 pl-4">
            <div className="flex items-baseline gap-1 text-slate-900 dark:text-white leading-none">
                <span className="text-4xl font-black tracking-tighter">
                    {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xl font-bold opacity-50 w-[24px] text-left">
                    {date.getSeconds().toString().padStart(2, '0')}
                </span>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mt-1">
                {date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
        </div>
    );
};

// --- AVATAR PROFESSOR ---
const ProfessorAvatar = ({ name }) => {
    const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : "PF";
    return (
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-600 dark:text-slate-300 border border-white dark:border-slate-600 shadow-sm" title={name}>
            {initials}
        </div>
    );
};

// --- CARD DASHBOARD ---
const DashboardCard = ({ title, subtitle, icon: Icon, theme, onClick, footerText, children, activeEffect, className }) => {
    const themes = {
        blue: { iconBox: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400", hover: "hover:border-blue-400 group-hover:text-blue-700", accent: "text-blue-600" },
        purple: { iconBox: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400", hover: "hover:border-purple-400 group-hover:text-purple-700", accent: "text-purple-600" },
        green: { iconBox: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400", hover: "hover:border-emerald-400 group-hover:text-emerald-700", accent: "text-emerald-600" },
        red: { iconBox: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400", hover: "hover:border-red-400 group-hover:text-red-700", accent: "text-red-600" },
        orange: { iconBox: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400", hover: "hover:border-orange-400 group-hover:text-orange-700", accent: "text-orange-600" },
        pink: { iconBox: "bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400", hover: "hover:border-pink-400 group-hover:text-pink-700", accent: "text-pink-600" },
        cyan: { iconBox: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400", hover: "hover:border-cyan-400 group-hover:text-cyan-700", accent: "text-cyan-600" },
        slate: { iconBox: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", hover: "hover:border-slate-400 group-hover:text-slate-700", accent: "text-slate-500" }
    };

    const style = themes[theme] || themes.slate;

    return (
        <div 
            onClick={onClick}
            className={`
                group bg-white dark:bg-slate-800 p-6 rounded-[24px] 
                border-2 border-slate-100 dark:border-slate-700 
                shadow-sm hover:shadow-xl hover:-translate-y-1 
                transition-all duration-300 cursor-pointer 
                flex flex-col justify-between relative overflow-hidden 
                h-[260px] ${className} 
                ${style.hover}
            `}
        >
            <div className={`absolute -right-6 -top-6 opacity-[0.04] transform group-hover:scale-110 transition-transform duration-500`}>
                <Icon className="w-40 h-40 text-current" />
            </div>

            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight uppercase tracking-wide">
                        {title}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-1 uppercase">
                        {subtitle}
                    </p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${style.iconBox} ${activeEffect ? 'animate-pulse ring-2 ring-offset-2 ring-green-400' : ''}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>

            <div className="relative z-10 flex-1 flex flex-col justify-center py-2">
                {children}
            </div>

            <div className="relative z-10 pt-3 border-t border-slate-50 dark:border-slate-700/50 flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${style.accent} group-hover:underline whitespace-nowrap`}>
                    {footerText || "Acessar"} <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                </span>
            </div>
        </div>
    );
};

export default function Home() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  
  const { catalogs, loadingCatalogs } = useCatalogs();

  const [loading, setLoading] = useState(true);
  
  const [resumoRelatorio, setResumoRelatorio] = useState({ valor: 0, label: "RECEITA DE ONTEM" });
  const [resumoCronograma, setResumoCronograma] = useState({ proximaAula: null });
  const [resumoValidacao, setResumoValidacao] = useState({ pendentes: 0 });
  const [resumoColetiva, setResumoColetiva] = useState({ percentual: 0, validadas: 0, total: 0 });

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Bom dia";
    if (hour >= 12 && hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const role = String(userData?.role || "").toLowerCase();
  const userId = userData?.id || userData?.uid;

  const permissions = useMemo(() => ({
      relatorio: ['admin', 'mentor', 'unidade', 'professor'].includes(role),
      cronograma: true, 
      validacaoDiaria: true, 
      validacaoColetiva: ['admin', 'mentor'].includes(role), 
      configuracoes: ['admin', 'mentor', 'unidade'].includes(role),
      pratiquePlay: ['admin', 'mentor', 'unidade', 'professor'].includes(role),
      linkAluno: ['admin', 'mentor', 'unidade', 'professor'].includes(role),
  }), [role]);

  useEffect(() => {
    if (loadingCatalogs) return;

    async function fetchDashboardData() {
      if (!userData) return;
      setLoading(true);
      
      try {
        const weekDayMap = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        const todayStr = `${y}-${m}-${day}`;
        const todayWeekDay = weekDayMap[d.getDay()];
        const nowTime = d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

        const ontemData = new Date(d);
        if (d.getDay() === 1) { 
            ontemData.setDate(d.getDate() - 2); 
        } else {
            ontemData.setDate(d.getDate() - 1);
        }
        
        const yO = ontemData.getFullYear();
        const mO = String(ontemData.getMonth() + 1).padStart(2, '0');
        const dayO = String(ontemData.getDate()).padStart(2, '0');
        
        const ontemStr = `${yO}-${mO}-${dayO}`;
        const ontemWeekDay = weekDayMap[ontemData.getDay()];

        const unidadesMap = {};
        const unidadesMentorIds = []; 
        (catalogs.unidades || []).forEach(u => {
            unidadesMap[u.id] = u.nome;
            if (role === 'mentor' && u.mentorId === userId) unidadesMentorIds.push(u.id);
        });

        const modalidadesMap = {};
        (catalogs.modalidades || []).forEach(m => modalidadesMap[m.id] = m);

        const professoresMap = {};
        let meuProfId = null;
        (catalogs.professores || []).forEach(p => {
            professoresMap[p.id] = p.nome;
            if (role === 'professor' && (p.uidLogin === userId || p.uid === userId)) meuProfId = p.id;
        });

        let aulasSnapDocs = catalogs.aulas || [];
        
        let totalValorOntem = 0;
        let totalValorMesProf = 0;
        let totalAulasOntem = 0; 
        let idsAulasOntem = []; 
        let totalAulasHoje = 0;
        let idsAulasHoje = [];
        let nextClass = null; 
        
        aulasSnapDocs.forEach(aula => {
            let hasAccess = false;
            if (role === 'admin') {
                hasAccess = true;
            } else if (role === 'mentor') {
                if (unidadesMentorIds.includes(String(aula.unidadeId))) hasAccess = true;
            } else if (role === 'unidade') {
                if (String(aula.unidadeId) === String(userData.unidadeId)) hasAccess = true;
            } else if (role === 'professor') {
                if (String(aula.professorId) === String(meuProfId)) hasAccess = true;
            }

            if (!hasAccess) return;

            if (role === 'professor') {
                const diasCount = aula.dias ? aula.dias.length : 0;
                totalValorMesProf += (parseFloat(aula.valor) || 0) * diasCount * 4; 
            }

            if (aula.dias && aula.dias.includes(ontemWeekDay)) {
                totalAulasOntem++;
                idsAulasOntem.push(aula.id);
                if (role !== 'professor') {
                    totalValorOntem += (parseFloat(aula.valor) || 0); 
                }
            }

            if (aula.dias && aula.dias.includes(todayWeekDay)) {
                totalAulasHoje++;
                idsAulasHoje.push(aula.id);
                
                if (aula.hora >= nowTime) {
                    if (!nextClass || aula.hora < nextClass.hora) {
                        const modData = modalidadesMap[aula.modalidadeId];
                        nextClass = { 
                            ...aula, 
                            modalidadeNome: modData?.nome || "Coletiva",
                            modalidadeCor: modData?.cor || "#94a3b8",
                            professorNome: professoresMap[aula.professorId] || "Instrutor",
                            unidadeNome: unidadesMap[aula.unidadeId] || "Unidade"
                        };
                    }
                }
            }
        });

        if (role === 'professor') {
            setResumoRelatorio({ valor: totalValorMesProf, label: "PREVISÃO MENSAL" });
        } else {
            setResumoRelatorio({ valor: totalValorOntem, label: "RECEITA DE ONTEM" });
        }
        
        setResumoCronograma({ proximaAula: nextClass });

        let validacoesRealizadasOntem = 0;
        let validacoesRealizadasHoje = 0;
        
        const cacheDoMesmoDia = homeDashboardCache.todayStr === todayStr;

        if (Date.now() - homeDashboardCache.timestamp < CACHE_TTL && cacheDoMesmoDia) {
             validacoesRealizadasOntem = homeDashboardCache.validacoesRealizadasOntem;
             validacoesRealizadasHoje = homeDashboardCache.validacoesRealizadasHoje;
        } else {
             if (idsAulasOntem.length > 0 || idsAulasHoje.length > 0) {
                 const qVal = query(collection(db, "validacoes"), where("data", "in", [todayStr, ontemStr]));
                 const valSnap = await getDocs(qVal);
                 
                 valSnap.forEach(doc => {
                     const val = doc.data();
                     if (val.data === ontemStr && idsAulasOntem.includes(val.aulaId)) validacoesRealizadasOntem++;
                     if (val.data === todayStr && idsAulasHoje.includes(val.aulaId)) validacoesRealizadasHoje++;
                 });

                 homeDashboardCache = {
                     timestamp: Date.now(),
                     todayStr: todayStr,
                     validacoesRealizadasOntem,
                     validacoesRealizadasHoje
                 };
             }
        }

        const pendentesHoje = Math.max(0, totalAulasHoje - validacoesRealizadasHoje);
        setResumoValidacao({ pendentes: pendentesHoje });

        const pctColetiva = totalAulasOntem > 0 ? Math.round((validacoesRealizadasOntem / totalAulasOntem) * 100) : 100;
        setResumoColetiva({ percentual: pctColetiva, total: totalAulasOntem, validadas: validacoesRealizadasOntem });

      } catch (error) {
        console.error("Erro dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [userData, role, userId, catalogs, loadingCatalogs]);

  if (!userData) return null;

  const getColetivaStatus = (pct) => {
      if (pct === 100) return { color: "text-emerald-500", theme: "green", label: "EXCELENTE", bar: "bg-emerald-500" };
      if (pct >= 80) return { color: "text-blue-500", theme: "blue", label: "EM ANDAMENTO", bar: "bg-blue-500" };
      if (pct >= 50) return { color: "text-amber-500", theme: "orange", label: "EM ANDAMENTO", bar: "bg-amber-500" };
      return { color: "text-red-500", theme: "red", label: "ATENÇÃO", bar: "bg-red-500" };
  };
  const coletivaStatus = getColetivaStatus(resumoColetiva.percentual);

  const userContextLabel = role === 'admin' ? "Administrador" : (role === 'unidade' ? userData.unidadeNome : (role === 'professor' ? "Professor" : "Mentor"));

  return (
    <div className="p-6 md:p-8 max-w-[1920px] mx-auto animate-fade-in min-h-screen bg-slate-50 dark:bg-[#0b1120]">
      
      <div className="mb-8 flex flex-col md:flex-row justify-between items-end pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
            <h1 className="text-4xl font-light text-slate-700 dark:text-slate-300 tracking-tight">
                {greeting}, <strong className="font-black text-slate-900 dark:text-white uppercase">{userData.nome}</strong>.
            </h1>
            <div className="mt-3 flex items-center gap-3">
                <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-red-600"/>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                        {userContextLabel}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Sistema Online</span>
                </div>
            </div>
        </div>
        <CorporateClock />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        
        {permissions.relatorio && (
            <DashboardCard 
                title="Relatório Gerencial"
                subtitle={resumoRelatorio.label}
                icon={BarChart2}
                theme="blue"
                footerText="Ver Detalhes"
                onClick={() => navigate('/app/relatorio-gerencial')}
            >
                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50 mt-2">
                    <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">{resumoRelatorio.label}</p>
                    {loading || loadingCatalogs ? <Loader2 className="w-6 h-6 animate-spin text-blue-500"/> : (
                        <h4 className="text-3xl font-black text-blue-700 dark:text-blue-300 tracking-tight">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(resumoRelatorio.valor)}
                        </h4>
                    )}
                </div>
            </DashboardCard>
        )}

        {permissions.cronograma && (
            <DashboardCard 
                title="Cronograma"
                subtitle="Grade de aulas"
                icon={Calendar}
                theme="purple"
                footerText="Ver Grade Completa"
                onClick={() => navigate('/app/cronograma')}
                activeEffect={!!resumoCronograma.proximaAula} 
            >
                <div className="flex flex-col justify-center h-full">
                    {loading || loadingCatalogs ? <Loader2 className="w-6 h-6 animate-spin text-purple-500 mx-auto"/> : (
                        resumoCronograma.proximaAula ? (
                            <>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[9px] font-bold text-green-600 uppercase mb-0.5 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Próxima
                                        </p>
                                        <h4 className="text-4xl font-black text-slate-800 dark:text-white leading-none">
                                            {resumoCronograma.proximaAula.hora}
                                        </h4>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-black uppercase text-white px-2 py-0.5 rounded shadow-sm" style={{ backgroundColor: resumoCronograma.proximaAula.modalidadeCor }}>
                                            {resumoCronograma.proximaAula.modalidadeNome}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-3 border-t border-slate-50 pt-2 flex justify-between items-center">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Unidade</p>
                                        <p className="text-xs font-bold text-slate-700 truncate">{resumoCronograma.proximaAula.unidadeNome}</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-right">
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Professor</p>
                                            <p className="text-xs font-bold text-slate-700">{resumoCronograma.proximaAula.professorNome.split(' ')[0]}</p>
                                        </div>
                                        <ProfessorAvatar name={resumoCronograma.proximaAula.professorNome} />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center opacity-60">
                                <CheckCircle2 className="w-8 h-8 mx-auto mb-1 text-slate-300"/>
                                <p className="text-xs font-bold text-slate-500 uppercase">Sem mais aulas hoje</p>
                            </div>
                        )
                    )}
                </div>
            </DashboardCard>
        )}

        {permissions.validacaoDiaria && (
            <DashboardCard 
                title="Validação Diária"
                subtitle="CONTROLE DE PRESENÇA"
                icon={CheckCircle2}
                theme={resumoValidacao.pendentes > 0 ? "red" : "green"}
                footerText={resumoValidacao.pendentes > 0 ? "Resolver Agora" : "Histórico"}
                onClick={() => navigate('/app/validacao-diaria')}
            >
                <div className="flex flex-col justify-center h-full">
                    {loading || loadingCatalogs ? <Loader2 className="w-6 h-6 animate-spin"/> : (
                        resumoValidacao.pendentes > 0 ? (
                            <div className="flex items-center gap-3">
                                <span className="text-6xl font-black text-red-600 tracking-tighter">{resumoValidacao.pendentes}</span>
                                <div className="flex flex-col border-l-2 border-red-200 pl-3">
                                    <span className="text-xs font-bold text-red-500 uppercase">Aulas</span>
                                    <span className="text-xs font-bold text-red-400 uppercase">Pendentes</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center w-full bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                <Check className="w-8 h-8 text-emerald-600 mb-1" />
                                <p className="text-sm font-black text-emerald-600 uppercase">Tudo Validado!</p>
                            </div>
                        )
                    )}
                </div>
            </DashboardCard>
        )}

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {permissions.validacaoColetiva && (
            <DashboardCard 
                title="Monitoramento de Validação"
                subtitle="Status de Ontem"
                icon={ShieldCheck}
                theme={coletivaStatus.theme}
                footerText="Ver Ranking"
                onClick={() => navigate('/app/validacao-coletiva')}
            >
                <div className="flex flex-col justify-center h-full">
                    {loading || loadingCatalogs ? <Loader2 className="w-6 h-6 animate-spin"/> : (
                        <>
                            <div className="flex items-baseline justify-between mb-2">
                                <span className={`text-5xl font-black tracking-tighter ${coletivaStatus.color}`}>
                                    {resumoColetiva.percentual}%
                                </span>
                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded bg-white border shadow-sm ${coletivaStatus.color.replace('text-', 'border-')}`}>
                                    {coletivaStatus.label}
                                </span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                                <div 
                                    className={`h-full ${coletivaStatus.bar} transition-all duration-1000 ease-out`} 
                                    style={{ width: `${resumoColetiva.percentual}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 text-right font-bold uppercase">
                                {resumoColetiva.validadas} de {resumoColetiva.total} validadas
                            </p>
                        </>
                    )}
                </div>
            </DashboardCard>
        )}

        {permissions.pratiquePlay && (
            <DashboardCard 
                title="PRATIQUE PLAY"
                subtitle="MÚSICAS PARA AULAS"
                icon={Headphones}
                theme="pink"
                footerText="Acessar Play"
                onClick={() => navigate('/app/pratique-play')}
            >
                <div className="flex flex-col items-center justify-center h-full bg-pink-50 dark:bg-pink-900/10 rounded-xl border border-pink-100 dark:border-pink-800/50 p-4">
                    <Headphones className="w-10 h-10 text-pink-500 mb-2 animate-pulse" />
                    <p className="text-sm font-black text-pink-600 dark:text-pink-400 uppercase text-center leading-tight">
                        PLAYLISTS DAS <br /> COLETIVAS
                    </p>
                </div>
            </DashboardCard>
        )}

        {permissions.linkAluno && (
            <DashboardCard 
                title="LINK DO ALUNO"
                subtitle="ACESSO EXTERNO"
                icon={LinkIcon}
                theme="cyan"
                footerText="Abrir Portal"
                onClick={() => navigate('/app/link-aluno')}
            >
                <div className="flex flex-col items-center justify-center h-full bg-cyan-50 dark:bg-cyan-900/10 rounded-xl border border-cyan-100 dark:border-cyan-800/50 p-4">
                    <LinkIcon className="w-10 h-10 text-cyan-500 mb-2 animate-pulse" />
                    <p className="text-sm font-black text-cyan-600 dark:text-cyan-400 uppercase text-center leading-tight">
                        PORTAL DE <br /> ALUNOS
                    </p>
                </div>
            </DashboardCard>
        )}

        {permissions.configuracoes && (
            <DashboardCard 
                title="Configurações"
                subtitle="Painel Administrativo"
                icon={Settings}
                theme="slate"
                footerText="Gerenciar"
                onClick={() => navigate('/app/configuracoes')}
            >
                <div className="flex items-center justify-around h-full bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 px-2 mt-1">
                    {(role === 'admin' || role === 'mentor') && (
                        <div className="flex flex-col items-center gap-1 group/icon cursor-pointer hover:bg-white p-2 rounded-lg transition-all">
                            <Building2 className="w-6 h-6 text-slate-400 group-hover/icon:text-blue-600"/>
                            <span className="text-[8px] font-bold uppercase text-slate-400 group-hover/icon:text-slate-600">Unidades</span>
                        </div>
                    )}
                    
                    {role === 'admin' && (
                        <div className="flex flex-col items-center gap-1 group/icon cursor-pointer hover:bg-white p-2 rounded-lg transition-all">
                            <Dumbbell className="w-6 h-6 text-slate-400 group-hover/icon:text-purple-600"/>
                            <span className="text-[8px] font-bold uppercase text-slate-400 group-hover/icon:text-slate-600">Mods</span>
                        </div>
                    )}

                    {(role === 'admin' || role === 'unidade') && (
                        <div className="flex flex-col items-center gap-1 group/icon cursor-pointer hover:bg-white p-2 rounded-lg transition-all">
                            <Users className="w-6 h-6 text-slate-400 group-hover/icon:text-green-600"/>
                            <span className="text-[8px] font-bold uppercase text-slate-400 group-hover/icon:text-slate-600">Profs</span>
                        </div>
                    )}
                </div>
            </DashboardCard>
        )}

      </div>
    </div>
  );
}