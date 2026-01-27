import { useState, useEffect, useMemo } from "react";
// CORREÇÃO AQUI: Mudamos de ../../ para ../
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { 
  BarChart2, Calendar, CheckCircle2, ShieldCheck, Settings, 
  ArrowRight, Clock, Loader2, TrendingUp 
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// --- COMPONENTE DE CARD INTERATIVO ---
const HomeCard = ({ title, subtitle, icon: Icon, colorClass, iconBg, onClick, children, footerText }) => (
  <div 
    onClick={onClick} 
    className="group bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between h-full min-h-[220px]"
  >
    {/* Ícone de Fundo (Decorativo) */}
    <div className={`absolute -top-4 -right-4 p-4 opacity-5 transform group-hover:scale-110 transition-transform duration-500 ${colorClass}`}>
      <Icon className="w-32 h-32" />
    </div>

    {/* Cabeçalho */}
    <div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${iconBg} ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 group-hover:text-red-600 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
        {subtitle}
      </p>
    </div>

    {/* Conteúdo Dinâmico (Meio) */}
    <div className="mt-4 mb-2 relative z-10">
      {children}
    </div>

    {/* Rodapé (Link) */}
    {footerText && (
      <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700 flex items-center justify-between">
        <span className={`text-xs font-bold uppercase flex items-center gap-1 ${colorClass} group-hover:underline`}>
          {footerText} <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    )}
  </div>
);

export default function Home() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Estados para os Resumos
  const [resumoRelatorio, setResumoRelatorio] = useState({ valor: 0 });
  const [resumoCronograma, setResumoCronograma] = useState({ proximaAula: null, totalHoje: 0 });
  const [resumoValidacao, setResumoValidacao] = useState({ pendentes: 0, total: 0 });

  // --- SAUDAÇÃO INTELIGENTE ---
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Bom dia";
    if (hour >= 12 && hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const todayDate = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }, []);

  // --- CARREGAMENTO DE DADOS (DASHBOARD) ---
  useEffect(() => {
    async function fetchDashboardData() {
      if (!userData) return;
      setLoading(true);
      
      try {
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        const userId = userData.id || userData.uid;
        const role = String(userData.role || "").toLowerCase();

        // 1. CARREGAR AULAS (Para Cronograma, Relatório e Validação)
        const qAulas = collection(db, "aulas");
        const aulasSnap = await getDocs(qAulas); 
        
        let totalValorMensal = 0;
        let totalAulasHoje = 0;
        let nextClass = null;
        
        const nowTime = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        const weekDayMap = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        const todayWeekDay = weekDayMap[new Date().getDay()];

        const aulasHojeIds = [];

        aulasSnap.forEach(doc => {
            const aula = doc.data();
            const aulaId = doc.id;

            // Filtro de Permissão (Básico)
            let permitted = false;
            if (role === 'admin') permitted = true;
            if (role === 'mentor') permitted = true; // Simplificado para visualização
            if (role === 'unidade' && String(aula.unidadeId) === String(userData.unidadeId)) permitted = true;
            if (role === 'professor' && String(aula.professorId) === String(userId)) permitted = true;

            if (permitted) {
                // Lógica de Cronograma (Hoje)
                if (aula.dias && aula.dias.includes(todayWeekDay)) {
                    totalAulasHoje++;
                    aulasHojeIds.push(aulaId);

                    // Verifica próxima aula
                    if (aula.hora >= nowTime) {
                        if (!nextClass || aula.hora < nextClass.hora) {
                            // Busca nome da modalidade se possível (aqui simplificado)
                            nextClass = { ...aula, modalidadeNome: "Aula Coletiva" }; 
                        }
                    }
                }
                
                // Lógica de Relatório (Estimativa Mensal Simples: Valor * 4 semanas)
                // Para precisão, usaríamos a lógica completa do relatório
                const nDias = aula.dias ? aula.dias.length : 0;
                totalValorMensal += (parseFloat(aula.valor) || 0) * nDias * 4; 
            }
        });

        setResumoRelatorio({ valor: totalValorMensal });
        setResumoCronograma({ proximaAula: nextClass, totalHoje: totalAulasHoje });

        // 2. CARREGAR VALIDAÇÕES (Para saber pendências de hoje)
        // Só busca validações se tiver aulas hoje
        let pendentes = 0;
        if (totalAulasHoje > 0) {
            const qVal = query(collection(db, "validacoes"), where("data", "==", todayStr));
            const valSnap = await getDocs(qVal);
            
            // Conta quantas das minhas aulas de hoje já foram validadas
            let validadasCount = 0;
            valSnap.forEach(doc => {
                const val = doc.data();
                if (aulasHojeIds.includes(val.aulaId)) {
                    validadasCount++;
                }
            });
            pendentes = Math.max(0, totalAulasHoje - validadasCount);
        }
        
        setResumoValidacao({ pendentes, total: totalAulasHoje });

      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [userData]);

  if (!userData) return null;

  const role = String(userData.role || "").toLowerCase();

  return (
    <div className="p-8 max-w-[1600px] mx-auto animate-fade-in">
      
      {/* 1. CABEÇALHO DE BOAS-VINDAS */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-light text-slate-600 dark:text-slate-300">
            {greeting}, <span className="font-bold text-slate-900 dark:text-white block md:inline">{userData.nome}</span>
          </h1>
          <p className="text-slate-400 dark:text-slate-500 mt-2 text-sm font-medium flex items-center gap-2">
            Painel Operacional • <span className="capitalize">{todayDate}</span>
          </p>
        </div>
        
        {/* Status Badges */}
        <div className="flex gap-2">
            <span className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full text-[10px] font-bold uppercase border border-green-100 dark:border-green-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Online
            </span>
        </div>
      </div>

      {/* 2. GRID DE CARDS (DASHBOARD) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
        
        {/* CARD: RELATÓRIO GERENCIAL (Admin/Mentor/Unidade) */}
        {(role === 'admin' || role === 'mentor' || role === 'unidade') && (
            <HomeCard 
                title="Relatório Gerencial" 
                subtitle="Análise de performance"
                icon={BarChart2}
                colorClass="text-blue-600 dark:text-blue-400"
                iconBg="bg-blue-50 dark:bg-blue-900/20"
                footerText="Ver Detalhes"
                onClick={() => navigate('/app/relatorio-gerencial')}
            >
                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                    <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Previsão Mensal (Est.)</p>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin text-blue-500"/> : (
                        <h4 className="text-2xl font-black text-blue-700 dark:text-blue-300">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumoRelatorio.valor)}
                        </h4>
                    )}
                </div>
            </HomeCard>
        )}

        {/* CARD: CRONOGRAMA */}
        <HomeCard 
            title="Cronograma" 
            subtitle="Grade de aulas"
            icon={Calendar}
            colorClass="text-purple-600 dark:text-purple-400"
            iconBg="bg-purple-50 dark:bg-purple-900/20"
            footerText="Ver Grade Completa"
            onClick={() => navigate('/app/cronograma')}
        >
            <div className={`p-4 rounded-xl border ${resumoCronograma.proximaAula ? 'bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-800' : 'bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-purple-500"/> : (
                    <>
                        <p className="text-[10px] font-bold uppercase mb-1 flex items-center gap-1">
                            {resumoCronograma.proximaAula ? <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Próxima Aula</> : "Agenda do dia"}
                        </p>
                        {resumoCronograma.proximaAula ? (
                            <div>
                                <span className="text-lg font-black text-slate-700 dark:text-white block">{resumoCronograma.proximaAula.hora}</span>
                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">
                                    {resumoCronograma.proximaAula.modalidadeNome || "Aula Coletiva"}
                                </span>
                                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Prof. {resumoCronograma.proximaAula.professor}</div>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic">Nenhuma aula próxima hoje.</p>
                        )}
                    </>
                )}
            </div>
        </HomeCard>

        {/* CARD: VALIDAÇÃO DIÁRIA */}
        <HomeCard 
            title="Validação Diária" 
            subtitle="Controle de presença"
            icon={CheckCircle2}
            colorClass="text-green-600 dark:text-green-400"
            iconBg="bg-green-50 dark:bg-green-900/20"
            footerText={resumoValidacao.pendentes > 0 ? "Resolver Pendências" : "Acessar"}
            onClick={() => navigate('/app/validacao-diaria')}
        >
            <div className="flex items-center justify-between mt-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-green-500"/> : (
                    <>
                        {resumoValidacao.pendentes > 0 ? (
                            <div className="flex flex-col">
                                <span className="text-3xl font-black text-red-500">{resumoValidacao.pendentes}</span>
                                <span className="text-[10px] font-bold uppercase text-red-400">Pendentes Hoje</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                                <CheckCircle2 className="w-5 h-5"/> 
                                <span className="text-xs font-bold uppercase">Tudo Certo!</span>
                            </div>
                        )}
                    </>
                )}
                
                {/* Gráfico Circular Simplificado */}
                <div className="relative w-14 h-14">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                        <path className="text-slate-100 dark:text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        <path className={`${resumoValidacao.pendentes > 0 ? 'text-red-500' : 'text-green-500'}`} strokeDasharray={`${Math.max(0, ((resumoValidacao.total - resumoValidacao.pendentes)/Math.max(1, resumoValidacao.total))*100)}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    </svg>
                </div>
            </div>
        </HomeCard>

        {/* CARD: VALIDAÇÃO COLETIVA (Admin/Mentor) */}
        {(role === 'admin' || role === 'mentor') && (
            <HomeCard 
                title="Validação Coletiva" 
                subtitle="Monitoramento de Adesão"
                icon={ShieldCheck}
                colorClass="text-orange-600 dark:text-orange-400"
                iconBg="bg-orange-50 dark:bg-orange-900/20"
                footerText="Ver Ranking"
                onClick={() => navigate('/app/validacao-coletiva')}
            >
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-800">
                        <TrendingUp className="w-6 h-6 text-orange-500"/>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Status da Rede</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-white">Acompanhamento Global</p>
                    </div>
                </div>
            </HomeCard>
        )}

        {/* CARD: CONFIGURAÇÕES (Admin/Mentor) */}
        {(role === 'admin' || role === 'mentor') && (
            <HomeCard 
                title="Configurações" 
                subtitle="Ajustes do sistema"
                icon={Settings}
                colorClass="text-slate-600 dark:text-slate-400"
                iconBg="bg-slate-100 dark:bg-slate-800"
                footerText="Gerenciar"
                onClick={() => navigate('/app/configuracoes')}
            >
                <div className="flex gap-2 mt-2">
                    <div className="h-2 w-8 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                    <div className="h-2 w-12 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                    <div className="h-2 w-4 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                </div>
            </HomeCard>
        )}

      </div>
    </div>
  );
}