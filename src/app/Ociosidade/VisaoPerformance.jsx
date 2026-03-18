import React, { useState } from 'react';
import { 
    Users, PieChart, Siren, HelpCircle, ChevronDown, 
    Activity, Maximize, AlertTriangle, CheckCircle2, ListFilter
} from 'lucide-react';

const VisaoPerformance = ({ resumoPerformance, executeDrillDown, openPerformanceDetails }) => {
    const [mostrarLegenda, setMostrarLegenda] = useState(false);

    if (!resumoPerformance) return <div className="p-20 text-center font-black text-slate-400 dark:text-slate-500">Mapeando dados de ocupação...</div>;

    const listOcupacao = resumoPerformance.rankingOcupacao.slice(0, 3);
    const listVacancia = resumoPerformance.rankingVacancia.slice(0, 3);

    return (
        <div className="space-y-6 animate-fade-in uppercase">
            
            {/* 🟢 LEGENDA INTELIGENTE E RETRÁTIL */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    onClick={() => setMostrarLegenda(!mostrarLegenda)}
                >
                    <div className="flex items-center gap-3">
                        <HelpCircle className="w-5 h-5 text-blue-500"/>
                        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">COMO OS DADOS DE PERFORMANCE SÃO CALCULADOS? (MÉTRICA MENSAL)</h3>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${mostrarLegenda ? 'rotate-180' : ''}`}/>
                </div>
                
                {mostrarLegenda && (
                    <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <h4 className="text-[11px] font-black text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1"><Users className="w-3 h-3"/> TAXA DE OCUPAÇÃO DA SALA</h4>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed normal-case">
                                Representa a lotação real das aulas, cruzando a presença com a planta da unidade. Dividimos a <b>média de alunos presentes</b> pela <b>capacidade máxima da sala</b>. <br/><br/>
                                <span className="font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 p-1 rounded block mt-1">Capacidade = (Metragem Real cadastrada na Unidade) ÷ (m² exigido pela Modalidade). Se a metragem não for informada, o sistema acusa erro para evitar dados falsos.</span>
                            </p>
                        </div>
                        <div>
                            <h4 className="text-[11px] font-black text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1"><PieChart className="w-3 h-3"/> TAXA DE VACÂNCIA DA GRADE</h4>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed normal-case">
                                A porcentagem exata de "Janelas Vazias" durante o horário útil de funcionamento da academia ao longo de <b>todo o mês (4 semanas)</b>. <br/><br/>
                                <span className="font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 p-1 rounded block mt-1">1 Mês Útil = 20 Dias de 16 horas = 320 Horas ou 480 Blocos de Aula possíveis. A taxa expõe quanto disso está ocioso.</span>
                            </p>
                        </div>
                        <div>
                            <h4 className="text-[11px] font-black text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1"><Siren className="w-3 h-3"/> DIAGNÓSTICO E GARGALO DE RECEITA</h4>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed normal-case">
                                O alerta vermelho dispara na hora quando a unidade possui <b>Superlotação</b> nas poucas aulas que tem (Ocupação &gt; 70%), mas a academia ainda fica muito tempo vazia <b>(Vacância Mensal &gt; 30%)</b>.<br/><br/>
                                <span className="font-bold text-rose-600 dark:text-rose-400 mt-1 block">Ação do CEO: Exigir a abertura imediata de novas turmas nos horários ociosos para aliviar as salas cheias e faturar mais.</span>
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* 🟢 3 CARDS RESUMO (TOP 3) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border-t-4 border-t-purple-600 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-[10px] font-black tracking-widest text-purple-700 dark:text-purple-400 mb-4">LÍDERES DE OCUPAÇÃO</h3>
                        {listOcupacao.map((u, i) => (
                            <div key={u.id} className="flex justify-between items-center text-xs font-bold border-b border-slate-50 dark:border-slate-700/50 pb-2 mb-2 last:border-0 last:mb-0 last:pb-0">
                                <span className="text-slate-600 dark:text-slate-300 truncate pr-2 hover:text-purple-600 cursor-pointer transition-colors" onClick={() => executeDrillDown(u.id)}>{i+1}. {u.nome}</span>
                                <span className="text-purple-700 dark:text-purple-400 font-black shrink-0">{u.taxaOcupacao.toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border-t-4 border-t-amber-500 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-[10px] font-black tracking-widest text-amber-700 dark:text-amber-400 mb-4">MAIOR VACÂNCIA (OCIOSIDADE MENSAL)</h3>
                        {listVacancia.map((u, i) => (
                            <div key={u.id} className="flex justify-between items-center text-xs font-bold border-b border-slate-50 dark:border-slate-700/50 pb-2 mb-2 last:border-0 last:mb-0 last:pb-0">
                                <span className="text-slate-600 dark:text-slate-300 truncate pr-2 hover:text-amber-600 cursor-pointer transition-colors" onClick={() => executeDrillDown(u.id)}>{i+1}. {u.nome}</span>
                                <span className="text-amber-700 dark:text-amber-400 font-black shrink-0">{u.taxaVacancia.toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-rose-600 rounded-2xl p-5 shadow-lg shadow-rose-500/20 text-white flex flex-col justify-center items-center text-center">
                    <Siren className="w-8 h-8 mb-2 opacity-80"/>
                    <span className="text-4xl font-black tracking-tighter mb-1">{resumoPerformance.alertas.length}</span>
                    <h3 className="text-xs font-black tracking-widest uppercase">GARGALOS IDENTIFICADOS</h3>
                    <p className="text-[9px] font-bold opacity-80 mt-1">Lotação Alta + Grade Vazia</p>
                </div>
            </div>

            {/* 🟢 TABELA CONSOLIDADA (A VISÃO COMPLETA E DETALHADA DO CEO) */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-500"/> VISÃO DETALHADA DE PERFORMANCE
                    </h3>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-sm border-separate border-spacing-0">
                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider">
                            <tr>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-700 w-48">UNIDADE</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-700 text-center">ESTRUTURA DA SALA</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-700 text-center w-72">OCUPAÇÃO GLOBAL (MÉDIA)</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-700 text-center w-72">VACÂNCIA DA GRADE (1 MÊS)</th>
                                <th className="p-4 border-b border-slate-200 dark:border-slate-700 text-center">DIAGNÓSTICO</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {resumoPerformance.rankingOcupacao.map(u => (
                                <tr key={u.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${u.gargalo ? 'bg-rose-50/30 dark:bg-rose-900/10' : ''}`}>
                                    
                                    <td className="p-4 align-top">
                                        <div className="font-black text-slate-800 dark:text-slate-200 text-sm cursor-pointer hover:text-blue-600 transition-colors" onClick={() => executeDrillDown(u.id)}>{u.nome}</div>
                                    </td>

                                    <td className="p-4 align-top text-center">
                                        <div className="flex flex-col items-center gap-1.5">
                                            {/* Exibição real da Metragem */}
                                            {u.metragem > 0 ? (
                                                <div className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                                                    <Maximize className="w-3 h-3 text-blue-500"/> {u.metragem} m²
                                                </div>
                                            ) : (
                                                <div className="text-[9px] font-black bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-2 py-1 rounded border border-rose-200 dark:border-rose-800/50 flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3"/> M² NÃO CADASTRADO
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    
                                    {/* 🟢 BARRA DE OCUPAÇÃO E BOTÃO DE DRILL-DOWN */}
                                    <td className="p-4 align-top">
                                        <div className="flex flex-col items-center w-full max-w-[250px] mx-auto gap-2">
                                            <div className="flex items-center gap-3 w-full">
                                                <span className={`w-12 text-right font-black ${u.taxaOcupacao > 70 ? 'text-rose-500' : 'text-purple-600 dark:text-purple-400'}`}>
                                                    {u.metragem > 0 ? `${u.taxaOcupacao.toFixed(0)}%` : '0%'}
                                                </span>
                                                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${u.taxaOcupacao > 70 ? 'bg-rose-500' : 'bg-purple-500'}`} style={{ width: `${u.metragem > 0 ? Math.min(u.taxaOcupacao, 100) : 0}%` }}></div>
                                                </div>
                                            </div>
                                            {/* 🟢 BOTÃO CIRÚRGICO PARA ABRIR O MODAL DE AULAS */}
                                            {u.metragem > 0 && (
                                                <button 
                                                    onClick={() => openPerformanceDetails(u.id)}
                                                    className="mt-1 w-full flex items-center justify-center gap-1.5 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800/50 text-purple-700 dark:text-purple-400 rounded-lg text-[9px] font-black transition-all"
                                                >
                                                    <ListFilter className="w-3 h-3"/> DETALHAR AULAS
                                                </button>
                                            )}
                                        </div>
                                    </td>

                                    {/* BARRA DE VACÂNCIA E HORAS PERDIDAS MENSAL */}
                                    <td className="p-4 align-top">
                                        <div className="flex flex-col items-center w-full max-w-[250px] mx-auto gap-2">
                                            <div className="flex items-center gap-3 w-full">
                                                <span className="w-12 text-right font-black text-amber-600 dark:text-amber-400">
                                                    {u.taxaVacancia.toFixed(0)}%
                                                </span>
                                                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${u.taxaVacancia}%` }}></div>
                                                </div>
                                            </div>
                                            {/* DADOS REAIS DE OPORTUNIDADE PROJETADO PARA O MÊS */}
                                            <div className="w-full mt-1 text-center">
                                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/50">
                                                    {u.aulasPerdidasMes} JANELAS / MÊS (<span className="font-black">{Math.round((u.aulasPerdidasMes * 40) / 60)}H LIVRES</span>)
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="p-4 align-top text-center pt-5">
                                        {u.metragem === 0 ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-black rounded-lg uppercase tracking-widest">
                                                DADOS INCOMPLETOS
                                            </span>
                                        ) : u.gargalo ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-[10px] font-black rounded-lg uppercase tracking-widest border border-rose-200 dark:border-rose-800/50">
                                                <AlertTriangle className="w-3 h-3"/> RISCO DE RECEITA
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 text-[10px] font-black rounded-lg uppercase tracking-widest">
                                                <CheckCircle2 className="w-3 h-3"/> SAUDÁVEL
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default React.memo(VisaoPerformance);