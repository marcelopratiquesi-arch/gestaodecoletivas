import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { 
    Activity, Search, ShieldCheck, Calendar, User, Clock, Settings, 
    Trash2, Edit2, PlusCircle, AlertTriangle, Loader2, CircleCheck,
    DollarSign, TrendingUp, Building2, ArrowDown, RefreshCw, Database,
    Key, LogIn, LogOut // 🟢 Ícones Novos para Acessos
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// --- HELPERS E CONSTANTES ---
const getTodayStr = () => new Date().toLocaleDateString('en-CA');
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas de Cache

// 🟢 BLINDAGEM DE DATAS: Garante que o Cache do PC não corrompa os timestamps do Firebase
const getIsoDate = (val) => {
    if (!val) return new Date().toISOString();
    if (val.toDate) return val.toDate().toISOString(); 
    if (val.seconds) return new Date(val.seconds * 1000).toISOString();
    if (typeof val === 'string') return val;
    return new Date(val).toISOString(); 
};

const formatarDataHora = (isoString) => {
    if (!isoString) return "-";
    try {
        const dateObj = new Date(isoString);
        const d = dateObj.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'});
        const h = dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
        return `${d} ÀS ${h}`;
    } catch { return isoString; }
};

const formatarDataSimples = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export default function AuditoriaPage() {
    const { userData } = useAuth();
    const role = String(userData?.role || "").trim().toLowerCase();
    
    const [logsTotais, setLogsTotais] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState("");
    const [filtroModulo, setFiltroModulo] = useState("TODOS"); 
    
    const [modoFiltro, setModoFiltro] = useState('dia'); 
    const [dataInicio, setDataInicio] = useState(getTodayStr());
    const [dataFim, setDataFim] = useState(getTodayStr());

    const [limiteExibicao, setLimiteExibicao] = useState(30); 
    const [verTudo, setVerTudo] = useState(false); 
    const [isCachedData, setIsCachedData] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0); 

    if (role === 'professor' || role === 'unidade') {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] text-slate-500">
                <ShieldCheck className="w-16 h-16 mb-4 text-red-500 opacity-50" />
                <h2 className="text-xl font-black uppercase tracking-widest">ACESSO RESTRITO</h2>
                <p className="mt-2 text-sm font-bold uppercase">APENAS ADMINISTRADORES PODEM VER A AUDITORIA DO SISTEMA.</p>
            </div>
        );
    }

    // Reseta paginação de tela ao mudar a data
    useEffect(() => {
        setLimiteExibicao(30);
        setVerTudo(false);
    }, [dataInicio, dataFim]);

    // 🟢 MOTOR INDESTRUTÍVEL: Busca por Período, Isola Erros e Salva em Cache
    const carregarDados = async (forcarRefresh = false) => {
        setLoading(true);
        try {
            // Alterado para v4 para limpar o cache antigo e rodar a nova classificação de Acessos
            const cacheKey = `pratique_auditoria_v4_${dataInicio}_${dataFim}`;

            // 1. Tenta Cache do PC
            if (!forcarRefresh) {
                const cachedStr = localStorage.getItem(cacheKey);
                if (cachedStr) {
                    const cachedData = JSON.parse(cachedStr);
                    if (Date.now() - cachedData.timestamp < CACHE_TTL) {
                        setLogsTotais(cachedData.logs);
                        setIsCachedData(true);
                        setLoading(false);
                        return;
                    }
                }
            }

            setIsCachedData(false);

            const start = new Date(`${dataInicio}T00:00:00`);
            const end = new Date(`${dataFim}T23:59:59.999`);

            let snapCrono = { docs: [] };
            let snapFin = { docs: [] };
            let snapConf = { docs: [] };

            // 2. Buscas Independentes (Se uma cair, as outras sobrevivem!)
            // Sem orderBy no Firebase para evitar erros de composite index. Ordenação será em RAM.
            try {
                snapCrono = await getDocs(query(collection(db, 'auditoria_cronograma'), where('dataAcao', '>=', start), where('dataAcao', '<=', end)));
            } catch (e) { console.warn("Aviso Crono:", e); }

            try {
                snapFin = await getDocs(query(collection(db, 'auditoria_financeiro'), where('dataAcao', '>=', start), where('dataAcao', '<=', end)));
            } catch (e1) {
                try {
                    // Fallback se o Financeiro usar a palavra 'timestamp' em vez de 'dataAcao'
                    snapFin = await getDocs(query(collection(db, 'auditoria_financeiro'), where('timestamp', '>=', start), where('timestamp', '<=', end)));
                } catch (e2) { console.warn("Aviso Financeiro:", e2); }
            }

            try {
                snapConf = await getDocs(query(collection(db, 'auditoria_configuracoes'), where('dataAcao', '>=', start), where('dataAcao', '<=', end)));
            } catch (e) { console.warn("Aviso Configurações:", e); }

            // 3. Formatação Unificada
            const logsCrono = snapCrono.docs.map(d => {
                const data = d.data();
                return { id: d.id, _source: 'cronograma', ...data, dataAcao: getIsoDate(data.dataAcao) };
            });

            const logsFin = snapFin.docs.map(d => {
                const data = d.data();
                return { id: d.id, _source: 'financeiro', modulo: 'FINANCEIRO', ...data, dataAcao: getIsoDate(data.dataAcao || data.timestamp) };
            });

            const logsConf = snapConf.docs.map(d => {
                const data = d.data();
                return { id: d.id, _source: 'configuracoes', modulo: 'CONFIGURACOES', ...data, dataAcao: getIsoDate(data.dataAcao) };
            });

            const combined = [...logsCrono, ...logsFin, ...logsConf];
            
            // 4. Ordenação Perfeita em Memória (Mais Rápido e Sem Erros)
            combined.sort((a, b) => new Date(b.dataAcao).getTime() - new Date(a.dataAcao).getTime());
            
            // 5. Salva no Cache Local
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), logs: combined }));
            } catch (e) { console.warn("Memória cache cheia, ignorando."); }
            
            setLogsTotais(combined); 
        } catch (error) {
            console.error("Erro Crítico na Auditoria:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDados(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshTrigger, dataInicio, dataFim]);

    const handleDateChange = (type) => {
        setModoFiltro(type);
        const hoje = getTodayStr();
        if (type === 'dia' || type === 'periodo') { 
            setDataInicio(hoje); 
            setDataFim(hoje); 
        } else if (type === 'mes') {
            const d = new Date();
            setDataInicio(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-01`);
            setDataFim(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]);
        }
    };
    
    const handleMonthChange = (e) => {
        const [y, m] = e.target.value.split('-');
        setDataInicio(`${y}-${m}-01`);
        setDataFim(new Date(y, m, 0).toISOString().split('T')[0]);
    };

    // 🟢 FILTRAGEM INTELIGENTE NA MEMÓRIA COM INTERCEPTAÇÃO DE ACESSOS
    const dadosFiltradosCompletos = useMemo(() => {
        return logsTotais.filter(log => {
            let modulo = String(log.modulo || 'CRONOGRAMA').toUpperCase(); 
            
            // 🟢 INTERCEPTA LOGINS E LOGOUTS
            if (log.tipoAcao === 'LOGIN' || log.tipoAcao === 'LOGOUT') {
                modulo = 'ACESSOS';
            }

            if (filtroModulo !== "TODOS" && modulo !== filtroModulo) return false;

            if (busca) {
                const term = busca.toLowerCase();
                const textoCompleto = `
                    ${log.usuarioAcaoNome || log.usuarioNome || ''} 
                    ${log.descricao || ''} 
                    ${log.diffExtras || ''} 
                    ${log.unidadeNome || ''} 
                    ${log.professorNome || ''}
                    ${log.mesReferencia || ''}
                `.toLowerCase();
                if (!textoCompleto.includes(term)) return false;
            }
            return true;
        });
    }, [logsTotais, busca, filtroModulo]);

    // Aplica o limite apenas na hora de renderizar na tela
    const logsExibicao = verTudo ? dadosFiltradosCompletos : dadosFiltradosCompletos.slice(0, limiteExibicao);

    // 🟢 ÍCONES ATUALIZADOS
    const getIconeAcao = (tipo) => {
        if (tipo === 'LOGIN') return <LogIn className="w-4 h-4 text-indigo-500" />;
        if (tipo === 'LOGOUT') return <LogOut className="w-4 h-4 text-orange-500" />;
        if (tipo === 'NOVA' || tipo === 'CRIADO') return <PlusCircle className="w-4 h-4 text-emerald-500" />;
        if (tipo === 'EXCLUÍDA' || tipo === 'DELETADO') return <Trash2 className="w-4 h-4 text-rose-500" />;
        if (tipo === 'ALTERADA' || tipo === 'EDITADO') return <Edit2 className="w-4 h-4 text-amber-500" />;
        if (tipo === 'VIGÊNCIA') return <Calendar className="w-4 h-4 text-blue-500" />;
        if (tipo === 'EDICAO_FOLHA') return <DollarSign className="w-4 h-4 text-purple-600" />;
        return <Activity className="w-4 h-4 text-slate-500" />;
    };

    // 🟢 BADGES ATUALIZADAS
    const getBadgeAcao = (tipo) => {
        if (tipo === 'LOGIN') return <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">LOGIN</span>;
        if (tipo === 'LOGOUT') return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">LOGOUT</span>;
        if (tipo === 'NOVA' || tipo === 'CRIADO') return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">ADIÇÃO</span>;
        if (tipo === 'EXCLUÍDA' || tipo === 'DELETADO') return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">EXCLUSÃO</span>;
        if (tipo === 'ALTERADA' || tipo === 'EDITADO') return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">ALTERAÇÃO</span>;
        if (tipo === 'VIGÊNCIA') return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">VIGÊNCIA</span>;
        if (tipo === 'EDICAO_FOLHA') return <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">EDIÇÃO DE VALOR</span>;
        return <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">{tipo}</span>;
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6 uppercase">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <span className="bg-slate-800 text-white p-2 rounded-lg shadow-lg">
                            <ShieldCheck className="w-6 h-6" />
                        </span>
                        AUDITORIA DO SISTEMA (X-9)
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-bold text-sm">
                        HISTÓRICO COMPLETO DE ALTERAÇÕES EM CONTRATOS, GRADES, VALIDAÇÕES, FINANÇAS E CONFIGURAÇÕES.
                    </p>
                </div>
                
                <button 
                    onClick={() => carregarDados(true)}
                    disabled={loading}
                    className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-5 py-3 rounded-xl text-xs font-black shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50 uppercase"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : 'text-blue-500'}`} />
                    SINCRONIZAR NOVAS (FORÇAR)
                </button>
            </div>

            <div className="flex flex-col gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 flex flex-col xl:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1 h-11 shrink-0">
                            <button onClick={() => handleDateChange('dia')} className={`px-4 text-xs font-bold rounded-lg uppercase transition-all ${modoFiltro === 'dia' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>DIA</button>
                            <button onClick={() => setModoFiltro('periodo')} className={`px-4 text-xs font-bold rounded-lg uppercase transition-all ${modoFiltro === 'periodo' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>PERÍODO</button>
                            <button onClick={() => handleDateChange('mes')} className={`px-4 text-xs font-bold rounded-lg uppercase transition-all ${modoFiltro === 'mes' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>MÊS</button>
                        </div>

                        <div className="h-11 px-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-2 shrink-0">
                            <Calendar className="w-4 h-4 text-blue-500"/>
                            {modoFiltro === 'mes' ? (
                                <input type="month" value={dataInicio.substring(0, 7)} onChange={handleMonthChange} className="bg-transparent text-xs font-bold text-slate-700 dark:text-white outline-none cursor-pointer uppercase"/>
                            ) : (
                                <input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); if(modoFiltro==='dia') setDataFim(e.target.value); }} className="bg-transparent text-xs font-bold text-slate-700 dark:text-white outline-none cursor-pointer uppercase"/>
                            )}
                            {modoFiltro === 'periodo' && <><span className="text-slate-400 font-bold">-</span><input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 dark:text-white outline-none cursor-pointer uppercase"/></>}
                        </div>
                    </div>

                    <div className="relative w-full xl:w-[400px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="PESQUISAR LOGS (NOME, UNIDADE, AÇÃO)..." 
                            className="w-full pl-9 pr-4 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-slate-500 transition-colors dark:text-white placeholder:normal-case uppercase"
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setFiltroModulo("TODOS")} className={`px-5 py-2.5 rounded-xl text-[11px] font-black tracking-widest transition-all ${filtroModulo === "TODOS" ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-700'}`}>TUDO</button>
                        <button onClick={() => setFiltroModulo("CRONOGRAMA")} className={`px-5 py-2.5 rounded-xl text-[11px] font-black tracking-widest transition-all flex items-center gap-2 ${filtroModulo === "CRONOGRAMA" ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-700'}`}><Calendar className="w-3.5 h-3.5"/> CRONOGRAMA</button>
                        <button onClick={() => setFiltroModulo("VALIDACAO")} className={`px-5 py-2.5 rounded-xl text-[11px] font-black tracking-widest transition-all flex items-center gap-2 ${filtroModulo === "VALIDACAO" ? 'bg-emerald-600 text-white shadow-md' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400'}`}><CircleCheck className="w-3.5 h-3.5"/> VALIDAÇÃO</button>
                        <button onClick={() => setFiltroModulo("FINANCEIRO")} className={`px-5 py-2.5 rounded-xl text-[11px] font-black tracking-widest transition-all flex items-center gap-2 ${filtroModulo === "FINANCEIRO" ? 'bg-purple-600 text-white shadow-md' : 'bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400'}`}><TrendingUp className="w-3.5 h-3.5"/> FINANCEIRO</button>
                        
                        {/* 🟢 NOVA ABA DE ACESSOS */}
                        <button onClick={() => setFiltroModulo("ACESSOS")} className={`px-5 py-2.5 rounded-xl text-[11px] font-black tracking-widest transition-all flex items-center gap-2 ${filtroModulo === "ACESSOS" ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400'}`}><Key className="w-3.5 h-3.5"/> ACESSOS</button>

                        <button onClick={() => setFiltroModulo("CONFIGURACOES")} className={`px-5 py-2.5 rounded-xl text-[11px] font-black tracking-widest transition-all flex items-center gap-2 ${filtroModulo === "CONFIGURACOES" ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-700'}`}><Settings className="w-3.5 h-3.5"/> CONFIGURAÇÕES</button>
                    </div>
                    {isCachedData && !loading && (
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg shadow-sm">
                            <Database className="w-3 h-3"/> DADOS CARREGADOS DA MEMÓRIA LOCAL (CUSTO ZERO)
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400"/></div>
                ) : (
                    <div className="flex flex-col h-full">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    <tr>
                                        <th className="p-4 w-40">DATA E HORA (AÇÃO)</th>
                                        <th className="p-4 w-40">USUÁRIO</th>
                                        <th className="p-4 w-32">MÓDULO</th>
                                        <th className="p-4 w-32">AÇÃO</th>
                                        <th className="p-4">O QUE FOI ALTERADO? (DETALHES)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {logsExibicao.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="p-10 text-center font-bold text-slate-400">NENHUM REGISTRO ENCONTRADO NO PERÍODO SELECIONADO.</td>
                                        </tr>
                                    ) : (
                                        logsExibicao.map(log => {
                                            const dataAcaoISO = log.dataAcao;
                                            
                                            // 🟢 INTERCEPTADOR VISUAL DE ACESSOS
                                            let moduloExibicao = String(log.modulo || 'CRONOGRAMA').toUpperCase();
                                            if (log.tipoAcao === 'LOGIN' || log.tipoAcao === 'LOGOUT') moduloExibicao = 'ACESSOS';

                                            return (
                                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group">
                                                    <td className="p-4 align-top">
                                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                                                            <Clock className="w-3.5 h-3.5 opacity-50" />
                                                            {formatarDataHora(dataAcaoISO)}
                                                        </div>
                                                    </td>

                                                    <td className="p-4 align-top">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                                                                <User className="w-3 h-3 text-slate-500" />
                                                            </div>
                                                            <span className="font-black text-slate-700 dark:text-slate-300 text-xs">
                                                                {log.usuarioAcaoNome || log.usuarioNome || 'ADMINISTRADOR'}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="p-4 align-top">
                                                        <span className={`text-[10px] font-black px-2 py-1 rounded flex items-center gap-1 w-fit uppercase tracking-wider 
                                                            ${moduloExibicao === 'VALIDACAO' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 
                                                            moduloExibicao === 'FINANCEIRO' ? 'bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-900/20 dark:border-purple-800' :
                                                            moduloExibicao === 'ACESSOS' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' :
                                                            'text-slate-500 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
                                                            {moduloExibicao === 'CRONOGRAMA' && <Calendar className="w-3 h-3"/>}
                                                            {moduloExibicao === 'CONFIGURACOES' && <Settings className="w-3 h-3"/>}
                                                            {moduloExibicao === 'VALIDACAO' && <CircleCheck className="w-3 h-3"/>}
                                                            {moduloExibicao === 'FINANCEIRO' && <TrendingUp className="w-3 h-3"/>}
                                                            {moduloExibicao === 'ACESSOS' && <Key className="w-3 h-3"/>}
                                                            {moduloExibicao === 'VALIDACAO' ? 'VALIDAÇÃO' : moduloExibicao}
                                                        </span>
                                                    </td>

                                                    <td className="p-4 align-top">
                                                        <div className="flex items-center gap-1.5">
                                                            {getIconeAcao(log.tipoAcao)}
                                                            {getBadgeAcao(log.tipoAcao)}
                                                        </div>
                                                    </td>

                                                    <td className="p-4 align-top">
                                                        <div className="space-y-3">
                                                            
                                                            <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                                                                {log.descricao}
                                                            </p>
                                                            
                                                            {log._source === 'cronograma' && (
                                                                <>
                                                                    {(log.estadoAnterior || log.estadoNovo) ? (
                                                                        <div className="flex flex-col lg:flex-row gap-4 mt-3">
                                                                            {log.estadoAnterior && (
                                                                                <div className="flex-1 border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-900/10 rounded-xl p-4 shadow-sm">
                                                                                    <h5 className="text-[10px] font-black text-rose-600 dark:text-rose-400 mb-3 border-b border-rose-100 dark:border-rose-900/30 pb-2 flex items-center gap-1">
                                                                                        <Trash2 className="w-3 h-3"/> COMO ERA:
                                                                                    </h5>
                                                                                    <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                                                                                        <li><span className="font-black text-slate-800 dark:text-slate-200">UNIDADE:</span> {log.estadoAnterior.unidade}</li>
                                                                                        <li><span className="font-black text-slate-800 dark:text-slate-200">MODALIDADE:</span> {log.estadoAnterior.modalidade}</li>
                                                                                        <li className={log.estadoNovo && log.estadoAnterior.professor !== log.estadoNovo.professor ? "text-rose-600 font-black bg-rose-100/50 px-1 rounded -mx-1" : ""}><span className="font-black text-slate-800 dark:text-slate-200">PROFESSOR:</span> {log.estadoAnterior.professor}</li>
                                                                                        <li className={log.estadoNovo && log.estadoAnterior.dias !== log.estadoNovo.dias ? "text-rose-600 font-black bg-rose-100/50 px-1 rounded -mx-1" : ""}><span className="font-black text-slate-800 dark:text-slate-200">DIAS:</span> {log.estadoAnterior.dias}</li>
                                                                                        <li className={log.estadoNovo && log.estadoAnterior.hora !== log.estadoNovo.hora ? "text-rose-600 font-black bg-rose-100/50 px-1 rounded -mx-1" : ""}><span className="font-black text-slate-800 dark:text-slate-200">HORÁRIO:</span> {log.estadoAnterior.hora}</li>
                                                                                        <li className={log.estadoNovo && log.estadoAnterior.valor !== log.estadoNovo.valor ? "text-rose-600 font-black bg-rose-100/50 px-1 rounded -mx-1" : ""}><span className="font-black text-slate-800 dark:text-slate-200">VALOR:</span> {formatCurrency(log.estadoAnterior.valor)}</li>
                                                                                        <li className={log.estadoNovo && log.estadoAnterior.dataInicio !== log.estadoNovo.dataInicio ? "text-rose-600 font-black bg-rose-100/50 px-1 rounded -mx-1" : ""}><span className="font-black text-slate-800 dark:text-slate-200">INÍCIO:</span> {formatarDataSimples(log.estadoAnterior.dataInicio)}</li>
                                                                                        <li className={log.estadoNovo && log.estadoAnterior.dataFim !== log.estadoNovo.dataFim ? "text-rose-600 font-black bg-rose-100/50 px-1 rounded -mx-1" : ""}><span className="font-black text-slate-800 dark:text-slate-200">FIM:</span> {formatarDataSimples(log.estadoAnterior.dataFim)}</li>
                                                                                    </ul>
                                                                                </div>
                                                                            )}
                                                                            
                                                                            {log.estadoNovo && (
                                                                                <div className="flex-1 border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl p-4 shadow-sm">
                                                                                    <h5 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 mb-3 border-b border-emerald-100 dark:border-emerald-900/30 pb-2 flex items-center gap-1">
                                                                                        <PlusCircle className="w-3 h-3"/> COMO FICOU:
                                                                                    </h5>
                                                                                    <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                                                                                        <li><span className="font-black text-slate-800 dark:text-slate-200">UNIDADE:</span> {log.estadoNovo.unidade}</li>
                                                                                        <li><span className="font-black text-slate-800 dark:text-slate-200">MODALIDADE:</span> {log.estadoNovo.modalidade}</li>
                                                                                        <li className={log.estadoAnterior && log.estadoAnterior.professor !== log.estadoNovo.professor ? "text-emerald-600 font-black bg-emerald-100/50 px-1 rounded -mx-1" : ""}><span className="font-black text-slate-800 dark:text-slate-200">PROFESSOR:</span> {log.estadoNovo.professor}</li>
                                                                                        <li className={log.estadoAnterior && log.estadoAnterior.dias !== log.estadoNovo.dias ? "text-emerald-600 font-black bg-emerald-100/50 px-1 rounded -mx-1" : ""}><span className="font-black text-slate-800 dark:text-slate-200">DIAS:</span> {log.estadoNovo.dias}</li>
                                                                                        <li className={log.estadoAnterior && log.estadoAnterior.hora !== log.estadoNovo.hora ? "text-emerald-600 font-black bg-emerald-100/50 px-1 rounded -mx-1" : ""}><span className="font-black text-slate-800 dark:text-slate-200">HORÁRIO:</span> {log.estadoNovo.hora}</li>
                                                                                        <li className={log.estadoAnterior && log.estadoAnterior.valor !== log.estadoNovo.valor ? "text-emerald-600 font-black bg-emerald-100/50 px-1 rounded -mx-1" : ""}><span className="font-black text-slate-800 dark:text-slate-200">VALOR:</span> {formatCurrency(log.estadoNovo.valor)}</li>
                                                                                        <li className={log.estadoAnterior && log.estadoAnterior.dataInicio !== log.estadoNovo.dataInicio ? "text-emerald-600 font-black bg-emerald-100/50 px-1 rounded -mx-1" : ""}><span className="font-black text-slate-800 dark:text-slate-200">INÍCIO:</span> {formatarDataSimples(log.estadoNovo.dataInicio)}</li>
                                                                                        <li className={log.estadoAnterior && log.estadoAnterior.dataFim !== log.estadoNovo.dataFim ? "text-emerald-600 font-black bg-emerald-100/50 px-1 rounded -mx-1" : ""}><span className="font-black text-slate-800 dark:text-slate-200">FIM:</span> {formatarDataSimples(log.estadoNovo.dataFim)}</li>
                                                                                    </ul>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        (moduloExibicao === 'CRONOGRAMA' || moduloExibicao === 'VALIDACAO') && log.unidadeNome && (
                                                                            <div className="text-[10px] font-black text-slate-500 flex flex-wrap items-center gap-2 mt-2">
                                                                                <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm">{log.unidadeNome}</span>
                                                                                <span className="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800 shadow-sm">{log.modalidadeNome}</span>
                                                                                <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm">{log.professorNome}</span>
                                                                                {log.dias && log.dias.length > 0 && log.hora && (
                                                                                    <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm">{log.dias[0]} ÀS {log.hora}</span>
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </>
                                                            )}

                                                            {log._source === 'financeiro' && (
                                                                <div className="flex flex-col gap-2">
                                                                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                                                                        ALTERAÇÃO NO VALOR DA FOLHA DE PAGAMENTO
                                                                    </p>
                                                                    <div className="text-[10px] font-black text-slate-500 flex flex-wrap items-center gap-2">
                                                                        <span className="bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1">
                                                                            <Building2 className="w-3 h-3"/> {log.unidadeNome}
                                                                        </span>
                                                                        <span className="bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1">
                                                                            <Calendar className="w-3 h-3"/> MÊS: {log.mesReferencia}
                                                                        </span>
                                                                    </div>

                                                                    <div className="mt-2 flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl shadow-sm w-fit">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">VALOR ANTIGO</span>
                                                                            <span className="text-sm font-bold text-slate-500 line-through decoration-rose-500">{formatCurrency(log.valorAntigo)}</span>
                                                                        </div>
                                                                        <div className="w-6 border-t-2 border-dashed border-blue-200 dark:border-blue-800"></div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">NOVO VALOR</span>
                                                                            <span className="text-base font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">{formatCurrency(log.valorNovo)}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Observações Extras (Usado por Configurações e ACESSOS) */}
                                                            {log.diffExtras && (
                                                                <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg shadow-sm w-fit">
                                                                    <div className="flex gap-1.5 mb-1 text-amber-700 dark:text-amber-500">
                                                                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                                        <span className="text-[9px] font-black uppercase tracking-widest">OBSERVAÇÕES DO SISTEMA:</span>
                                                                    </div>
                                                                    <p className="text-[11px] font-mono font-bold text-amber-900 dark:text-amber-200 whitespace-pre-wrap leading-relaxed">
                                                                        {log.diffExtras}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* 🟢 BOTÕES DE PAGINAÇÃO AVANÇADA */}
                        {dadosFiltradosCompletos.length > logsExibicao.length && !loading && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex flex-wrap justify-center gap-3 shrink-0">
                                <button 
                                    onClick={() => setLimiteExibicao(prev => prev + 30)} 
                                    className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm flex items-center gap-2 transition-all uppercase"
                                >
                                    <ArrowDown className="w-4 h-4"/> CARREGAR MAIS 30
                                </button>
                                
                                <button 
                                    onClick={() => setVerTudo(true)} 
                                    className="px-6 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-black hover:bg-rose-600 hover:text-white shadow-sm flex items-center gap-2 transition-all uppercase"
                                >
                                    <Database className="w-4 h-4"/> OPÇÃO NUCLEAR: VER TODOS DESTE PERÍODO ({dadosFiltradosCompletos.length})
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}