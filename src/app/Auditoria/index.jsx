import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { 
    Activity, Search, ShieldCheck, Calendar, User, Clock, Settings, 
    Trash2, Edit2, PlusCircle, AlertTriangle, Loader2, CircleCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const formatarDataHora = (dateObj) => {
    if (!dateObj) return "-";
    const d = dateObj.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'});
    const h = dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
    return `${d} às ${h}`;
};

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
                <h2 className="text-xl font-black uppercase tracking-widest">Acesso Restrito</h2>
                <p className="mt-2 text-sm">Apenas administradores podem ver a auditoria do sistema.</p>
            </div>
        );
    }

    useEffect(() => {
        const qLogs = query(collection(db, 'auditoria_cronograma'), orderBy('dataAcao', 'desc'), limit(500));
        const unsub = onSnapshot(qLogs, (snap) => {
            const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setLogs(dados);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const logsFiltrados = useMemo(() => {
        return logs.filter(log => {
            const modulo = log.modulo || 'CRONOGRAMA';
            if (filtroModulo !== "TODOS" && modulo !== filtroModulo) return false;

            if (busca) {
                const term = busca.toLowerCase();
                const textoCompleto = `
                    ${log.usuarioAcaoNome || ''} 
                    ${log.descricao || ''} 
                    ${log.diffExtras || ''} 
                    ${log.unidadeNome || ''} 
                    ${log.professorNome || ''}
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
        return <Activity className="w-4 h-4 text-slate-500" />;
    };

    const getBadgeAcao = (tipo) => {
        if (tipo === 'NOVA' || tipo === 'CRIADO') return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">Adição</span>;
        if (tipo === 'EXCLUÍDA' || tipo === 'DELETADO') return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">Exclusão</span>;
        if (tipo === 'ALTERADA' || tipo === 'EDITADO') return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">Alteração</span>;
        if (tipo === 'VIGÊNCIA') return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">Vigência</span>;
        return <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">{tipo}</span>;
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <span className="bg-slate-800 text-white p-2 rounded-lg shadow-lg">
                            <ShieldCheck className="w-6 h-6" />
                        </span>
                        Auditoria do Sistema
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                        Histórico completo de alterações em contratos, grades, validações e configurações.
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col xl:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                    <button onClick={() => setFiltroModulo("TODOS")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filtroModulo === "TODOS" ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-700'}`}>Tudo</button>
                    <button onClick={() => setFiltroModulo("CRONOGRAMA")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${filtroModulo === "CRONOGRAMA" ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-700'}`}><Calendar className="w-3 h-3"/> Cronograma</button>
                    {/* 🟢 O BOTÃO DE VALIDAÇÃO AQUI */}
                    <button onClick={() => setFiltroModulo("VALIDACAO")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${filtroModulo === "VALIDACAO" ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'}`}><CircleCheck className="w-3 h-3"/> Validação Diária</button>
                    <button onClick={() => setFiltroModulo("CONFIGURACOES")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${filtroModulo === "CONFIGURACOES" ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-700'}`}><Settings className="w-3 h-3"/> Configurações</button>
                </div>

                <div className="relative w-full xl:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar por usuário, professor, unidade..." 
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-slate-500 transition-colors dark:text-white"
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
                                    <th className="p-4">Data e Hora (Ação)</th>
                                    <th className="p-4">Usuário</th>
                                    <th className="p-4">Módulo</th>
                                    <th className="p-4">Ação</th>
                                    <th className="p-4 w-1/2">O que foi alterado? (Detalhes)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {logsFiltrados.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-10 text-center text-slate-400">Nenhum registro encontrado para a busca atual.</td>
                                    </tr>
                                ) : (
                                    logsFiltrados.map(log => {
                                        const dataAcao = log.dataAcao?.toDate ? log.dataAcao.toDate() : new Date();
                                        const modulo = log.modulo || 'Cronograma';

                                        return (
                                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group">
                                                <td className="p-4 align-top w-48">
                                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-mono text-xs">
                                                        <Clock className="w-3.5 h-3.5 opacity-50" />
                                                        {formatarDataHora(dataAcao)}
                                                    </div>
                                                </td>

                                                <td className="p-4 align-top w-48">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                                                            <User className="w-3 h-3 text-slate-500" />
                                                        </div>
                                                        <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                                                            {log.usuarioAcaoNome || 'Administrador'}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="p-4 align-top w-36">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 w-fit uppercase tracking-wider ${modulo === 'VALIDACAO' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'text-slate-500 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
                                                        {modulo === 'Cronograma' && <Calendar className="w-3 h-3"/>}
                                                        {modulo === 'CONFIGURACOES' && <Settings className="w-3 h-3"/>}
                                                        {modulo === 'VALIDACAO' && <CircleCheck className="w-3 h-3"/>}
                                                        {modulo === 'VALIDACAO' ? 'Validação' : modulo}
                                                    </span>
                                                </td>

                                                <td className="p-4 align-top w-24">
                                                    <div className="flex items-center gap-1.5">
                                                        {getIconeAcao(log.tipoAcao)}
                                                        {getBadgeAcao(log.tipoAcao)}
                                                    </div>
                                                </td>

                                                <td className="p-4 align-top">
                                                    <div className="space-y-1.5">
                                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                            {log.descricao}
                                                        </p>
                                                        
                                                        {(modulo === 'Cronograma' || modulo === 'VALIDACAO') && log.unidadeNome && (
                                                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 font-medium">
                                                                <span className="bg-slate-100 dark:bg-slate-900 px-1.5 rounded">{log.unidadeNome}</span>
                                                                <span>•</span>
                                                                <span className="bg-slate-100 dark:bg-slate-900 px-1.5 rounded text-blue-600 dark:text-blue-400">{log.modalidadeNome}</span>
                                                                <span>•</span>
                                                                <span className="bg-slate-100 dark:bg-slate-900 px-1.5 rounded">{log.professorNome}</span>
                                                                
                                                                {/* 🟢 Adicionado exibição da data e hora da aula auditada */}
                                                                {log.dias && log.dias.length > 0 && log.hora && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span className="bg-slate-100 dark:bg-slate-900 px-1.5 rounded text-slate-400">{log.dias[0]} às {log.hora}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}

                                                        {log.diffExtras && (
                                                            <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg">
                                                                <div className="flex gap-1.5 mb-1 text-amber-700 dark:text-amber-500">
                                                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    <span className="text-[10px] font-black uppercase tracking-wider">Detalhes do Registro:</span>
                                                                </div>
                                                                <p className="text-xs font-mono text-amber-900 dark:text-amber-200 whitespace-pre-wrap leading-relaxed">
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
                )}
            </div>
        </div>
    );
}