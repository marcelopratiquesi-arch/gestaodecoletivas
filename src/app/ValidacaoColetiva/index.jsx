import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { 
  BarChart2, Filter, Calendar, CheckCircle2, AlertCircle, 
  Search, Trophy, ChevronRight, User, Clock, ShieldCheck, 
  LayoutDashboard, Download, AlertTriangle, Building2, UserCog, List 
} from 'lucide-react';

// --- HELPERS ---
const diasSemanaMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

const getTodayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

const getDatesInRange = (startDate, endDate) => {
  const dates = [];
  const curr = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  
  while (curr <= end) {
    dates.push(new Date(curr).toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
};

// --- COMPONENTES VISUAIS ---

const KPICard = ({ title, value, icon: Icon, colorClass, iconBg, subTitle }) => (
  <div className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border shadow-sm flex items-center justify-between transition-all hover:shadow-md ${colorClass}`}>
    <div>
      <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-black text-slate-800 dark:text-white">{value}</h3>
      {subTitle && <p className="text-xs text-slate-400 mt-1">{subTitle}</p>}
    </div>
    <div className={`p-3 rounded-xl ${iconBg}`}>
      <Icon className="w-6 h-6" />
    </div>
  </div>
);

// Avatar Simples para o Mentor
const MentorAvatar = ({ name }) => (
  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shadow-sm border border-slate-600 flex-shrink-0">
    {name ? name.charAt(0).toUpperCase() : 'M'}
  </div>
);

export default function ValidacaoColetiva() {
  const { userData } = useAuth();
  const role = String(userData?.role || "").toLowerCase();
  const userId = userData?.id || userData?.uid;
  
  // --- ESTADO ---
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ 
    unidades: [], mentores: [], aulas: [], validacoes: [], usuarios: [] 
  });

  // Filtros
  const [modoFiltro, setModoFiltro] = useState('dia'); // 'dia', 'mes', 'periodo'
  const [dataInicio, setDataInicio] = useState(getTodayStr());
  const [dataFim, setDataFim] = useState(getTodayStr());
  
  // Controle de Abas
  const [activeTab, setActiveTab] = useState('ranking'); 
  const [searchTerm, setSearchTerm] = useState("");

  // --- 1. CARREGAMENTO DE DADOS ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Query de Validações
        const qValidacoes = query(
            collection(db, 'validacoes'), 
            where('data', '>=', dataInicio),
            where('data', '<=', dataFim)
        );

        // Query de Unidades
        let qUnidades = collection(db, 'unidades');
        if (role === 'mentor') {
            qUnidades = query(collection(db, 'unidades'), where('mentorId', '==', userId));
        }

        const [uniSnap, userSnap, aulaSnap, valSnap] = await Promise.all([
          getDocs(qUnidades),
          getDocs(collection(db, 'usuarios')),
          getDocs(collection(db, 'aulas')),
          getDocs(qValidacoes)
        ]);

        setData({
          unidades: uniSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          usuarios: userSnap.docs.map(d => ({ id: d.id, ...d.data() })), 
          mentores: userSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === 'mentor' || u.role === 'admin'),
          aulas: aulaSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          validacoes: valSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

      } catch (e) {
        console.error("Erro ao carregar validação coletiva:", e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataInicio, dataFim, role, userId]); 

  // --- 2. MOTOR DE CÁLCULO ---
  const dadosProcessados = useMemo(() => {
    if (data.unidades.length === 0) return { mentores: [], unidades: [], kpis: { totalAulas: 0, unidadesValidadas: 0, unidadesPendentes: 0 } };

    // Mapeamentos
    const mentorMap = {};
    data.mentores.forEach(m => mentorMap[m.id] = m.nome);
    const usuariosMap = {};
    data.usuarios.forEach(u => usuariosMap[u.id] = { nome: u.nome, role: u.role });

    // Datas do período
    const datasDoPeriodo = getDatesInRange(dataInicio, dataFim);

    // Processar por UNIDADE
    const statusUnidades = data.unidades.map(unidade => {
        let totalEsperado = 0;
        let totalValidado = 0;
        let pendencias = []; 

        const gradeUnidade = data.aulas.filter(a => String(a.unidadeId) === String(unidade.id));

        datasDoPeriodo.forEach(dataStr => {
            const dateObj = new Date(dataStr + 'T00:00:00');
            const diaSemana = diasSemanaMap[dateObj.getDay()];
            const aulasDoDia = gradeUnidade.filter(a => a.dias && a.dias.includes(diaSemana));

            aulasDoDia.forEach(aula => {
                totalEsperado++;
                const validacao = data.validacoes.find(v => String(v.aulaId) === String(aula.id) && v.data === dataStr);

                if (validacao) {
                    totalValidado++;
                } else {
                    pendencias.push({
                        data: dataStr,
                        dia: diaSemana,
                        info: `Aula das ${aula.hora}`
                    });
                }
            });
        });

        const percentual = totalEsperado > 0 ? Math.round((totalValidado / totalEsperado) * 100) : 100; 

        // === CORREÇÃO DE AUDITORIA (BUSCA CAMPO CORRETO) ===
        const validacoesDaUnidade = data.validacoes
            .filter(v => String(v.unidadeId) === String(unidade.id))
            .sort((a,b) => {
                // Tenta pegar o timestamp de 'validadoEm' (seu padrão) ou 'timestamp' (padrão antigo)
                const timeA = a.validadoEm?.seconds || a.timestamp?.seconds || 0;
                const timeB = b.validadoEm?.seconds || b.timestamp?.seconds || 0;
                return timeB - timeA;
            });
        
        const lastVal = validacoesDaUnidade[0];
        
        let responsavelInfo = { nome: '-', role: '-' };
        if (lastVal) {
            const userLog = usuariosMap[lastVal.userId || lastVal.validadoPor]; 
            if (userLog) {
                responsavelInfo = { nome: userLog.nome, role: userLog.role };
            } else {
                responsavelInfo = { nome: lastVal.validadoPorNome || 'Desconhecido', role: '?' };
            }
        }

        // === LÓGICA DE HORA CORRIGIDA (validadoEm) ===
        const getHoraFormatada = (val) => {
             if (!val) return '-';
             const ts = val.validadoEm || val.timestamp; // Procura os dois campos
             
             if (!ts) return '-';

             // Se for objeto do Firestore (Timestamp)
             if (ts.seconds) {
                 return new Date(ts.seconds * 1000).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
             }
             
             // Se for string ISO ou objeto Date
             try {
                 const d = new Date(ts);
                 if (!isNaN(d.getTime())) return d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
             } catch(e) {}
             
             return '-';
        };

        return {
            id: unidade.id,
            nome: unidade.nome,
            mentorId: unidade.mentorId,
            mentorNome: mentorMap[unidade.mentorId] || 'Sem Mentor',
            totalEsperado,
            totalValidado,
            percentual,
            pendencias, 
            status: percentual === 100 ? 'Completo' : 'Pendente',
            lastValidation: lastVal ? {
                data: new Date(lastVal.data + 'T00:00:00').toLocaleDateString('pt-BR'),
                hora: getHoraFormatada(lastVal),
                responsavelNome: responsavelInfo.nome,
                responsavelRole: responsavelInfo.role
            } : null
        };
    });

    // Agrupar por MENTOR
    const ranking = Object.values(statusUnidades.reduce((acc, unit) => {
        if (!unit.mentorId) return acc;
        
        if (!acc[unit.mentorId]) {
            acc[unit.mentorId] = {
                id: unit.mentorId,
                nome: unit.mentorNome,
                totalUnidades: 0,
                somaPercentuais: 0,
                unidadesList: []
            };
        }
        acc[unit.mentorId].totalUnidades++;
        acc[unit.mentorId].somaPercentuais += unit.percentual;
        acc[unit.mentorId].unidadesList.push(unit);
        return acc;
    }, {})).map(m => ({
        ...m,
        mediaGeral: Math.round(m.somaPercentuais / m.totalUnidades)
    })).sort((a, b) => b.mediaGeral - a.mediaGeral);

    // KPIs
    const kpis = {
        totalAulas: statusUnidades.reduce((acc, u) => acc + u.totalEsperado, 0),
        unidadesValidadas: statusUnidades.filter(u => u.percentual === 100).length,
        unidadesPendentes: statusUnidades.filter(u => u.percentual < 100).length
    };

    return { mentores: ranking, unidades: statusUnidades, kpis };

  }, [data, dataInicio, dataFim]);

  // --- HANDLERS ---
  const handleDateChange = (type) => {
    setModoFiltro(type);
    const hoje = getTodayStr();
    if (type === 'dia') {
        setDataInicio(hoje);
        setDataFim(hoje);
    } else if (type === 'mes') {
        const d = new Date();
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        setDataInicio(`${y}-${String(m).padStart(2,'0')}-01`);
        setDataFim(new Date(y, m, 0).toISOString().split('T')[0]);
    }
  };

  const handleMonthChange = (e) => {
      const val = e.target.value; 
      const [y, m] = val.split('-');
      setDataInicio(`${y}-${m}-01`);
      setDataFim(new Date(y, m, 0).toISOString().split('T')[0]);
  };

  // Exportar CSV
  const exportarCSV = () => {
    const headers = "Unidade,Mentor,Realizado,Esperado,Status,Progresso,Pendencias,Data Validacao,Hora Validacao,Responsavel,Cargo\n";
    const rows = dadosProcessados.unidades.map(u => 
        `${u.nome},${u.mentorNome},${u.totalValidado},${u.totalEsperado},${u.status},${u.percentual}%,${u.pendencias.length},${u.lastValidation?.data || '-'},${u.lastValidation?.hora || '-'},${u.lastValidation?.responsavelNome || '-'},${u.lastValidation?.responsavelRole || '-'}`
    ).join("\n");
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `validacao_coletiva_${dataInicio}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400 gap-2"><LayoutDashboard className="animate-spin"/> Calculando métricas...</div>;

  return (
    <div className="p-6 md:p-8 max-w-[1920px] mx-auto animate-fade-in space-y-8">
      
      {/* HEADER E FILTROS */}
      <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <span className="bg-blue-600 text-white p-2 rounded-lg shadow-lg shadow-blue-500/20"><ShieldCheck className="w-6 h-6" /></span>
            Validação Coletiva
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">Monitoramento de adesão e auditoria de validação</p>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                <button onClick={() => handleDateChange('dia')} className={`px-3 py-1.5 text-xs font-bold rounded-md uppercase transition-all ${modoFiltro === 'dia' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>Dia</button>
                <button onClick={() => setModoFiltro('periodo')} className={`px-3 py-1.5 text-xs font-bold rounded-md uppercase transition-all ${modoFiltro === 'periodo' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>Período</button>
                <button onClick={() => handleDateChange('mes')} className={`px-3 py-1.5 text-xs font-bold rounded-md uppercase transition-all ${modoFiltro === 'mes' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>Mês</button>
            </div>
            
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-600 mx-1"></div>
            
            <div className="flex items-center gap-2">
                {modoFiltro === 'mes' ? (
                    <input type="month" value={dataInicio.substring(0, 7)} onChange={handleMonthChange} className="bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none"/>
                ) : (
                    <input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setDataFim(e.target.value); }} className="bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none"/>
                )}
                
                {modoFiltro === 'periodo' && (
                    <>
                        <span className="text-slate-400">-</span>
                        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none"/>
                    </>
                )}
            </div>

            <button onClick={exportarCSV} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"><Download className="w-4 h-4"/></button>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard 
            title="Aulas Esperadas" 
            value={dadosProcessados.kpis.totalAulas} 
            icon={Calendar} 
            colorClass="border-l-4 border-l-blue-500"
            iconBg="bg-blue-50 text-blue-600"
        />
        <KPICard 
            title="Unidades OK" 
            value={dadosProcessados.kpis.unidadesValidadas} 
            icon={CheckCircle2} 
            colorClass="border-l-4 border-l-green-500"
            iconBg="bg-green-50 text-green-600"
            subTitle={`de ${dadosProcessados.unidades.length} unidades`}
        />
        <KPICard 
            title="Unidades Pendentes" 
            value={dadosProcessados.kpis.unidadesPendentes} 
            icon={AlertCircle} 
            colorClass="border-l-4 border-l-red-500"
            iconBg="bg-red-50 text-red-500"
        />
      </div>

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex gap-6 border-b border-slate-200 dark:border-slate-700">
        <button onClick={() => setActiveTab('ranking')} className={`pb-3 text-sm font-bold uppercase flex items-center gap-2 transition-colors ${activeTab === 'ranking' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}>
            <Trophy className="w-4 h-4"/> Ranking de Mentores
        </button>
        <button onClick={() => setActiveTab('status')} className={`pb-3 text-sm font-bold uppercase flex items-center gap-2 transition-colors ${activeTab === 'status' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}>
            <List className="w-4 h-4"/> Status Individual
        </button>
        <button onClick={() => setActiveTab('detalhamento')} className={`pb-3 text-sm font-bold uppercase flex items-center gap-2 transition-colors ${activeTab === 'detalhamento' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}>
            <User className="w-4 h-4"/> Detalhamento por Mentor
        </button>
      </div>

      {/* CONTEÚDO */}
      <div className="min-h-[400px]">
        {/* ABA 1: RANKING */}
        {activeTab === 'ranking' && (
            <div className="grid gap-4">
                {dadosProcessados.mentores.map((mentor, index) => (
                    <div key={mentor.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-shadow group relative">
                        <div className="flex items-center gap-4 w-full md:w-1/4 min-w-[200px]">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-yellow-400 text-yellow-900' : index === 1 ? 'bg-slate-300 text-slate-800' : index === 2 ? 'bg-orange-300 text-orange-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                                {index + 1}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">{mentor.nome}</h3>
                                <p className="text-xs text-slate-400">{mentor.totalUnidades} unidades</p>
                            </div>
                        </div>
                        <div className="flex-1 w-full relative">
                            <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                                <span>Adesão Geral</span>
                                <span>{mentor.mediaGeral}%</span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative cursor-help">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${mentor.mediaGeral === 100 ? 'bg-green-500' : 'bg-blue-600'}`} 
                                    style={{ width: `${mentor.mediaGeral}%` }}
                                ></div>
                            </div>
                            {/* Tooltip */}
                            {mentor.mediaGeral < 100 && (
                                <div className="absolute top-8 left-0 w-full z-20 hidden group-hover:block animate-fade-in">
                                    <div className="bg-slate-800 text-white text-xs rounded-lg p-4 shadow-xl max-w-lg border border-slate-700">
                                        <p className="font-bold text-yellow-400 mb-2 border-b border-slate-600 pb-1 flex items-center gap-2">
                                            <AlertTriangle className="w-3 h-3"/> Pendências:
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                            {mentor.unidadesList.filter(u => u.percentual < 100).map(u => (
                                                <div key={u.id} className="flex justify-between border-b border-slate-700/50 pb-1">
                                                    <span className="font-medium truncate mr-2" title={u.nome}>{u.nome}</span>
                                                    <span className="text-red-300 font-bold whitespace-nowrap">{u.pendencias.length} aulas</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="w-full md:w-32 text-right">
                            {mentor.mediaGeral === 100 ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-bold uppercase">
                                    <Trophy className="w-3 h-3"/> Parabéns!
                                </span>
                            ) : (
                                <span className="text-xs font-bold text-slate-400 uppercase">Em andamento</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* ABA 2: STATUS INDIVIDUAL (TABELA) */}
        {activeTab === 'status' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                        <input 
                            type="text" 
                            placeholder="Buscar por unidade ou mentor..." 
                            className="w-full pl-9 p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="p-4">Unidade / Mentor</th>
                                <th className="p-4 text-center">Progresso</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4">Última Validação (Audit)</th>
                                <th className="p-4 text-right">Responsável</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {dadosProcessados.unidades
                                .filter(u => u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || u.mentorNome.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(u => (
                                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-700 dark:text-slate-200">{u.nome}</div>
                                        <div className="text-[10px] text-slate-400 flex items-center gap-1 uppercase mt-0.5"><User className="w-3 h-3"/> {u.mentorNome}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center gap-2 justify-center">
                                            <div className="w-20 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                                <div className={`h-1.5 rounded-full ${u.percentual === 100 ? 'bg-green-500' : 'bg-red-500'}`} style={{width: `${u.percentual}%`}}></div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{u.percentual}%</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        {u.percentual === 100 ? (
                                            <span className="px-2 py-1 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-[10px] font-bold uppercase border border-green-100 dark:border-green-800">Validado</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded text-[10px] font-bold uppercase border border-red-100 dark:border-red-800 flex items-center justify-center gap-1">
                                                {u.pendencias.length} Pendentes
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        {u.lastValidation ? (
                                            <div className="flex flex-col text-xs">
                                                <span className="text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1">
                                                    <Calendar className="w-3 h-3 text-slate-400"/> {u.lastValidation.data}
                                                </span>
                                                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <Clock className="w-3 h-3 text-slate-400"/> {u.lastValidation.hora}
                                                </span>
                                            </div>
                                        ) : <span className="text-xs text-slate-300 italic">-</span>}
                                    </td>
                                    <td className="p-4 text-right">
                                        {u.lastValidation ? (
                                            <div className="flex justify-end">
                                                <div className="text-right">
                                                    <span className="block text-xs font-bold text-slate-700 dark:text-white truncate max-w-[150px]">
                                                        {u.lastValidation.responsavelNome}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded mt-0.5">
                                                        {u.lastValidation.responsavelRole === 'mentor' && <UserCog className="w-3 h-3"/>}
                                                        {u.lastValidation.responsavelRole === 'unidade' && <Building2 className="w-3 h-3"/>}
                                                        {u.lastValidation.responsavelRole === 'admin' && <ShieldCheck className="w-3 h-3"/>}
                                                        {u.lastValidation.responsavelRole}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : <span className="text-xs text-slate-300">-</span>}
                                    </td>
                                </tr>
                            ))}
                            {dadosProcessados.unidades.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 text-xs uppercase font-bold">Sem dados</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* ABA 3: DETALHAMENTO POR MENTOR */}
        {activeTab === 'detalhamento' && (
            <div className="animate-fade-in">
                <div className="mb-6">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400"/>
                        <input 
                            type="text" 
                            placeholder="Filtrar card de mentor..." 
                            className="w-full pl-10 p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm shadow-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {dadosProcessados.mentores.filter(m => m.nome.toLowerCase().includes(searchTerm.toLowerCase())).map(mentor => (
                        <div key={mentor.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300">
                            
                            {/* Header do Card */}
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                                <div className="flex items-center gap-3">
                                    <MentorAvatar name={mentor.nome} />
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-white text-base">{mentor.nome}</h4>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                            {mentor.totalUnidades} Unidades Vinculadas
                                        </span>
                                    </div>
                                </div>
                                <div className={`text-sm font-black px-3 py-1 rounded-lg ${mentor.mediaGeral === 100 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                    {mentor.mediaGeral}%
                                </div>
                            </div>

                            {/* Lista de Unidades */}
                            <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                                {mentor.unidadesList.map(u => (
                                    <div key={u.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600">
                                        
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 truncate max-w-[140px]" title={u.nome}>
                                            {u.nome}
                                        </span>

                                        <div className="flex items-center gap-3">
                                            {/* Contagem X de Y */}
                                            <span className="text-xs font-mono font-medium text-slate-400">
                                                <strong className={u.percentual < 100 ? 'text-red-500' : 'text-green-600'}>{u.totalValidado}</strong>
                                                <span className="mx-1">/</span>
                                                {u.totalEsperado}
                                            </span>

                                            {/* Bolinha de Status */}
                                            {u.percentual === 100 ? (
                                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-200" title="Validado"></div>
                                            ) : (
                                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-sm shadow-red-200" title="Pendente"></div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

      </div>
    </div>
  );
}