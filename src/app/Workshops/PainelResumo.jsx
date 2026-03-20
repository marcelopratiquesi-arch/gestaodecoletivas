import React, { memo } from 'react';
import { TrendingUp, ArrowDownRight, Users, DollarSign, ArrowUpRight, Edit, Trash2 } from 'lucide-react';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const PainelResumo = ({ 
    kpis, 
    transacoes, 
    workshops, 
    abrirModalNovaTransacao, 
    abrirModalEditarTransacao, 
    handleExcluirTransacao 
}) => {
    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Faturamento Bruto</p>
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg"><TrendingUp className="w-4 h-4"/></div>
                    </div>
                    <h3 className="text-3xl xl:text-4xl font-black text-slate-800 dark:text-white tracking-tighter">{formatCurrency(kpis.faturacaoBruta)}</h3>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custos & Compras</p>
                        <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg"><ArrowDownRight className="w-4 h-4"/></div>
                    </div>
                    <h3 className="text-3xl xl:text-4xl font-black text-red-500 tracking-tighter">{formatCurrency(kpis.custosOperacionais)}</h3>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Repasse Professores</p>
                        <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg"><Users className="w-4 h-4"/></div>
                    </div>
                    <h3 className="text-3xl xl:text-4xl font-black text-amber-600 dark:text-amber-400 tracking-tighter">{formatCurrency(kpis.repasses)}</h3>
                </div>

                <div className="bg-gradient-to-br from-blue-700 to-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-500/20 relative overflow-hidden text-white flex flex-col justify-center">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                        <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Lucro Líquido Final</p>
                        <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg"><DollarSign className="w-4 h-4 text-white"/></div>
                    </div>
                    <h3 className="text-4xl xl:text-5xl font-black drop-shadow-md tracking-tighter relative z-10">{formatCurrency(kpis.lucroLiquido)}</h3>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Últimos Lançamentos de Caixa</h3>
                    <button onClick={abrirModalNovaTransacao} className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">+ Lançar Finanças</button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {transacoes.slice(0, 8).map(t => {
                        const isReceita = t.tipo === 'receita';
                        const isDespesa = t.tipo === 'despesa';
                        const ws = workshops.find(w => w.id === t.workshopId);
                        
                        return (
                        <div key={t.id} className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center ${isReceita ? 'bg-emerald-100 text-emerald-600' : isDespesa ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {isReceita ? <ArrowUpRight className="w-5 h-5"/> : isDespesa ? <ArrowDownRight className="w-5 h-5"/> : <Users className="w-5 h-5"/>}
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-white uppercase">{t.categoria}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${isReceita ? 'bg-emerald-50 text-emerald-600' : isDespesa ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                            {t.tipo}
                                        </span>
                                        <span className="text-[9px] font-black uppercase bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-200">
                                            {ws ? ws.nome : 'Workshop Global'}
                                        </span>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.descricao || 'S/ Descrição'}</p>
                                        
                                        {t.fornecedorServico && (
                                            <span className="text-[10px] font-bold text-slate-500 italic bg-slate-100 px-2 py-0.5 rounded">Para: {t.fornecedorServico}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`font-black text-base ${isReceita ? 'text-emerald-500' : 'text-slate-700 dark:text-white'}`}>
                                    {isReceita ? '+' : '-'}{formatCurrency(t.valor)}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => abrirModalEditarTransacao(t)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Editar Lançamento">
                                        <Edit className="w-4 h-4"/>
                                    </button>
                                    <button onClick={() => handleExcluirTransacao(t.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Apagar Lançamento">
                                        <Trash2 className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )})}
                    {transacoes.length === 0 && <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Sem movimentações financeiras.</div>}
                </div>
            </div>
        </div>
    );
};

export default memo(PainelResumo);