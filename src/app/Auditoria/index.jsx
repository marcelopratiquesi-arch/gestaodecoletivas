import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { 
    Activity, Search, ShieldCheck, Calendar, User, Clock, Settings, 
    Trash2, Edit2, PlusCircle, AlertTriangle, Loader2, CircleCheck,
    DollarSign, TrendingUp, Building2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// --- HELPERS ---
const formatarDataHora = (dateObj) => {
    if (!dateObj) return "-";
    const d = dateObj.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'});
    const h = dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
    return `${d} ÀS ${h}`;
};

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export default function AuditoriaPage() {
    const { userData } = useAuth();
    const role = String(userData?.role || "").trim().toLowerCase();
    
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState("");
    const [filtroModulo, setFiltroModulo] = useState("TODOS"); 

    if (role === 'professor' || role === 'unidade') {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] text-slate-500">
                <ShieldCheck className="w-16 h-16 mb-4 text-red-500 opacity-50" />
                <h2 className="text-xl font-black uppercase tracking-widest">ACESSO RESTRITO</h2>
                <p className="mt-2 text-sm font-bold uppercase">APENAS ADMINISTRADORES PODEM VER A AUDITORIA DO SISTEMA.</p>
            </div>
        );
    }

    // 🟢 MOTOR DE MESCLAGEM EM TEMPO REAL (CRONOGRAMA + FINANCEIRO)
    useEffect(() => {
        const qCronograma = query(collection(db, 'auditoria_cronograma'), orderBy('dataAcao', 'desc'), limit(500));
        const qFinanceiro = query(collection(db, 'auditoria_financeiro'), orderBy('timestamp', 'desc'), limit(500));

        let logsCronograma = [];
        let logsFinanceiro = [];

        const updateLogs = () => {
            const combined = [...logsCronograma, ...logsFinanceiro];
            
            // Ordenação global baseada no timestamp
            combined.sort((a, b) => {
                const timeA = a.dataAcao?.toMillis?.() || 0;
                const timeB = b.dataAcao?.toMillis?.() || 0;
                return timeB - timeA;
            });
            
            setLogs(combined.slice(0, 500)); // Mantém o limite de 500 na tela
            setLoading(false);
        };

        const unsubCronograma = onSnapshot(qCronograma, (snap) => {
            logsCronograma = snap.docs.map(d => ({ 
                id: d.id, 
                _source: 'cronograma', 
                ...d.data() 
            }));
            updateLogs();
        });

        const unsubFinanceiro = onSnapshot(qFinanceiro, (snap) => {
            logsFinanceiro = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id, 
                    _source: 'financeiro', 
                    modulo: 'FINANCEIRO', // Força o módulo
                    dataAcao: data.timestamp, // Normaliza a variável de tempo para o renderizador
                    ...data 
                };
            });
            updateLogs();
        });

        return () => {
            unsubCronograma();
            unsubFinanceiro();
        };
    }, []);

    const logsFiltrados = useMemo(() => {
        return logs.filter(log => {
            const modulo = log.modulo || 'CRONOGRAMA';
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
    }, [logs, busca, filtroModulo]);

    const getIconeAcao = (tipo) => {
        if (tipo === 'NOVA' || tipo === 'CRIADO') return <PlusCircle className="w-4 h-4 text-emerald-500" />;
        if (tipo === 'EXCLUÍDA' || tipo === 'DELETADO') return <Trash2 className="w-4 h-4 text-rose-500" />;
        if (tipo === 'ALTERADA' || tipo === 'EDITADO') return <Edit2 className="w-4 h-4 text-amber-500" />;
        if (tipo === 'VIGÊNCIA') return <Calendar className="w-4 h-4 text-blue-500" />;
        if (tipo === 'EDICAO_FOLHA') return <DollarSign className="w-4 h-4 text-purple-600" />;
        return <Activity className="w-4 h-4 text-slate-500" />;
    };

    const getBadgeAcao = (tipo) => {
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
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col xl:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                    <button onClick={() => setFiltroModulo("TODOS")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filtroModulo === "TODOS" ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-700'}`}>TUDO</button>
                    <button onClick={() => setFiltroModulo("CRONOGRAMA")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${filtroModulo === "CRONOGRAMA" ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-700'}`}><Calendar className="w-3 h-3"/> CRONOGRAMA</button>
                    <button onClick={() => setFiltroModulo("VALIDACAO")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${filtroModulo === "VALIDACAO" ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'}`}><CircleCheck className="w-3 h-3"/> VALIDAÇÃO</button>
                    
                    {/* 🟢 NOVO FILTRO: FINANCEIRO */}
                    <button onClick={() => setFiltroModulo("FINANCEIRO")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${filtroModulo === "FINANCEIRO" ? 'bg-purple-600 text-white dark:bg-purple-500 dark:text-white' : 'bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800'}`}><TrendingUp className="w-3 h-3"/> FINANCEIRO</button>
                    
                    <button onClick={() => setFiltroModulo("CONFIGURACOES")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${filtroModulo === "CONFIGURACOES" ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-700'}`}><Settings className="w-3 h-3"/> CONFIGURAÇÕES</button>
                </div>

                <div className="relative w-full xl:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="BUSCAR REGISTRO..." 
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-slate-500 transition-colors dark:text-white placeholder:normal-case"
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400"/></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <tr>
                                    <th className="p-4">DATA E HORA (AÇÃO)</th>
                                    <th className="p-4">USUÁRIO</th>
                                    <th className="p-4">MÓDULO</th>
                                    <th className="p-4">AÇÃO</th>
                                    <th className="p-4 w-1/2">O QUE FOI ALTERADO? (DETALHES)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {logsFiltrados.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-10 text-center font-bold text-slate-400">NENHUM REGISTRO ENCONTRADO PARA A BUSCA ATUAL.</td>
                                    </tr>
                                ) : (
                                    logsFiltrados.map(log => {
                                        const dataAcao = log.dataAcao?.toDate ? log.dataAcao.toDate() : new Date();
                                        const modulo = log.modulo || 'CRONOGRAMA';

                                        return (
                                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group">
                                                <td className="p-4 align-top w-48">
                                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">
                                                        <Clock className="w-3.5 h-3.5 opacity-50" />
                                                        {formatarDataHora(dataAcao)}
                                                    </div>
                                                </td>

                                                <td className="p-4 align-top w-48">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                                                            <User className="w-3 h-3 text-slate-500" />
                                                        </div>
                                                        <span className="font-black text-slate-700 dark:text-slate-300 text-xs">
                                                            {log.usuarioAcaoNome || log.usuarioNome || 'ADMINISTRADOR'}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="p-4 align-top w-36">
                                                    <span className={`text-[10px] font-black px-2 py-1 rounded flex items-center gap-1 w-fit uppercase tracking-wider 
                                                        ${modulo === 'VALIDACAO' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 
                                                        modulo === 'FINANCEIRO' ? 'bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-900/20 dark:border-purple-800' :
                                                        'text-slate-500 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
                                                        {modulo === 'Cronograma' && <Calendar className="w-3 h-3"/>}
                                                        {modulo === 'CONFIGURACOES' && <Settings className="w-3 h-3"/>}
                                                        {modulo === 'VALIDACAO' && <CircleCheck className="w-3 h-3"/>}
                                                        {modulo === 'FINANCEIRO' && <TrendingUp className="w-3 h-3"/>}
                                                        {modulo === 'VALIDACAO' ? 'VALIDAÇÃO' : modulo.toUpperCase()}
                                                    </span>
                                                </td>

                                                <td className="p-4 align-top w-36">
                                                    <div className="flex items-center gap-1.5">
                                                        {getIconeAcao(log.tipoAcao)}
                                                        {getBadgeAcao(log.tipoAcao)}
                                                    </div>
                                                </td>

                                                <td className="p-4 align-top">
                                                    <div className="space-y-2">
                                                        
                                                        {/* LÓGICA DE DETALHES PARA CRONOGRAMA / VALIDAÇÃO / CONFIG */}
                                                        {log._source === 'cronograma' && (
                                                            <>
                                                                <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                                                                    {log.descricao}
                                                                </p>
                                                                
                                                                {(modulo === 'Cronograma' || modulo === 'VALIDACAO') && log.unidadeNome && (
                                                                    <div className="text-[10px] font-black text-slate-500 flex flex-wrap items-center gap-2">
                                                                        <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm">{log.unidadeNome}</span>
                                                                        <span className="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800 shadow-sm">{log.modalidadeNome}</span>
                                                                        <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm">{log.professorNome}</span>
                                                                        
                                                                        {log.dias && log.dias.length > 0 && log.hora && (
                                                                            <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm">{log.dias[0]} ÀS {log.hora}</span>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {log.diffExtras && (
                                                                    <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg shadow-sm">
                                                                        <div className="flex gap-1.5 mb-1 text-amber-700 dark:text-amber-500">
                                                                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                                            <span className="text-[9px] font-black uppercase tracking-widest">DETALHES DO REGISTRO:</span>
                                                                        </div>
                                                                        <p className="text-[11px] font-mono font-bold text-amber-900 dark:text-amber-200 whitespace-pre-wrap leading-relaxed">
                                                                            {log.diffExtras}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}

                                                        {/* 🟢 LÓGICA DE DETALHES EXCLUSIVA PARA O FINANCEIRO */}
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
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}