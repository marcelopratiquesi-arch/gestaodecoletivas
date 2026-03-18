import React, { useState } from 'react';
import { TrendingUp, AlertOctagon, CheckCircle2, ChevronDown, HelpCircle } from 'lucide-react';

const VisaoGlobal = ({ resumoCEO, openOciosidadeDetails, executeDrillDown }) => {
    const [showAll1, setShowAll1] = useState(false);
    const [showAll2, setShowAll2] = useState(false);
    const [showAll3, setShowAll3] = useState(false);
    const [mostrarLegenda, setMostrarLegenda] = useState(false);

    if (!resumoCEO) return <div className="p-20 text-center font-black text-slate-400 dark:text-slate-500">CALCULANDO DADOS...</div>;

    const list1 = showAll1 ? resumoCEO.ranking : resumoCEO.ranking.slice(0, 5);
    const list2 = showAll2 ? resumoCEO.ranking : resumoCEO.ranking.slice(0, 5);
    const list3 = showAll3 ? resumoCEO.otimizadas : resumoCEO.otimizadas.slice(0, 5);

    return (
        <div className="space-y-6 animate-fade-in uppercase">
            
            {/* 🟢 LEGENDA INTELIGENTE DO RELATÓRIO GLOBAL */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    onClick={() => setMostrarLegenda(!mostrarLegenda)}
                >
                    <div className="flex items-center gap-3">
                        <HelpCircle className="w-5 h-5 text-blue-500"/>
                        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">COMO OS DADOS GLOBAIS SÃO CALCULADOS? (MÉTRICA MENSAL)</h3>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${mostrarLegenda ? 'rotate-180' : ''}`}/>
                </div>
                
                {mostrarLegenda && (
                    <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <h4 className="text-[11px] font-black text-[#a06842] dark:text-[#c69c6d] mb-2 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> HORAS OCIOSAS NA REDE (MENSAL)</h4>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed normal-case">
                                Representa o <b>somatório de todo o tempo perdido</b> (sem aulas) projetado para 1 Mês (4 semanas). Nós mapeamos as "janelas" diárias que ficam vazias por mais de 60 minutos, convertemos em blocos de 40 minutos e multiplicamos pelo mês inteiro. <b>Matemática pura para o CEO saber exatamente quantas horas de dinheiro estão indo para o ralo.</b>
                            </p>
                        </div>
                        <div>
                            <h4 className="text-[11px] font-black text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1"><AlertOctagon className="w-3 h-3"/> MAIOR OCIOSIDADE</h4>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed normal-case">
                                O ranking das academias que estão "vazando" maior quantidade de receita. O sistema varre as <b>16 horas de funcionamento diário</b> (06h às 22h, de Seg-Sex) e totaliza as <b>Oportunidades Perdidas no Mês</b>. Mostramos a ferida aberta em "Janelas Vazias Mensais" para cada unidade.
                            </p>
                        </div>
                        <div>
                            <h4 className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> UNIDADES OTIMIZADAS</h4>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed normal-case">
                                As unidades de elite da rede. São as academias que possuem <b>ZERO BURACOS NA GRADE</b> durante todo o turno útil de 16 horas. O ranking organiza quem está 100% otimizado, liderado por quem entrega o <b>maior volume absoluto de aulas</b> no mês.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* 🟢 CARDS GLOBAIS (PROJETADOS PARA 1 MÊS / 4 SEMANAS) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* CARD 1: HORAS OCIOSAS */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-t-4 border-t-[#c69c6d] shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                        <div className="w-4 h-4 bg-[#c69c6d]/20 rounded flex items-center justify-center"><TrendingUp className="w-3 h-3 text-[#c69c6d]" /></div>
                        <h3 className="text-[10px] font-black tracking-widest text-[#9c7a52]">HORAS OCIOSAS NA REDE</h3>
                    </div>
                    <div className="mb-2">
                        <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">{resumoCEO.totalHorasMes}H</span>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">NESTE MÊS • <span className="text-slate-800 dark:text-white font-black">{resumoCEO.ranking.length} UNIDADES</span></p>
                    </div>
                    <div className="flex items-end h-8 gap-1 mb-4 mt-2">
                        {resumoCEO.sparklineMes.map((val, idx) => (
                            <div key={idx} className={`flex-1 rounded-sm transition-all hover:opacity-80 ${idx === 4 ? 'bg-[#7a5c37]' : 'bg-[#c6cbce] dark:bg-slate-600'}`} style={{ height: `${Math.max(10, (val / resumoCEO.maxSparkMes) * 100)}%` }} title={`${resumoCEO.diasSparkline[idx]}: ${val} aulas vazias no mês`}></div>
                        ))}
                    </div>
                    <div className="border-t border-slate-100 dark:border-slate-700 mb-3"></div>
                    <div className="flex-1 space-y-3 mb-2">
                        {list1.map((u) => (
                            <div key={u.id} className="flex justify-between items-center text-xs font-bold border-b border-slate-50 dark:border-slate-700/50 pb-2 group">
                                <span className="text-slate-600 dark:text-slate-300 truncate pr-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer transition-colors" onClick={() => openOciosidadeDetails(u.id)}>{u.nome}</span>
                                <span className="text-[#a06842] dark:text-[#c69c6d] font-black shrink-0 cursor-pointer group-hover:underline transition-all" onClick={() => openOciosidadeDetails(u.id)}>{u.aulasPerdidasMes} JANELAS/MÊS</span>
                            </div>
                        ))}
                    </div>
                    {resumoCEO.ranking.length > 5 && (
                        <button onClick={() => setShowAll1(!showAll1)} className="text-[9px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-1 py-2 uppercase">
                            {showAll1 ? 'VER MENOS' : 'VER MAIS...'} <ChevronDown className={`w-3 h-3 transition-transform ${showAll1 ? 'rotate-180' : ''}`}/>
                        </button>
                    )}
                </div>

                {/* CARD 2: MAIOR OCIOSIDADE */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-t-4 border-t-rose-800 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                        <div className="w-4 h-4 bg-rose-100 dark:bg-rose-900/30 rounded flex items-center justify-center"><AlertOctagon className="w-3 h-3 text-rose-700 dark:text-rose-400" /></div>
                        <h3 className="text-[10px] font-black tracking-widest text-slate-500 dark:text-slate-400">MAIOR OCIOSIDADE</h3>
                    </div>
                    <div className="mb-6 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openOciosidadeDetails(resumoCEO.maiorOciosidade?.id)}>
                        <span className="text-3xl font-black text-slate-800 dark:text-white leading-tight block truncate mb-1 hover:text-blue-600 transition-colors">{resumoCEO.maiorOciosidade?.nome || 'N/A'}</span>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400"><span className="text-slate-800 dark:text-white font-black">{resumoCEO.maiorOciosidade?.aulasPerdidasMes || 0} JANELAS</span> ABERTAS NESTE MÊS</p>
                    </div>
                    <div className="border-t border-slate-100 dark:border-slate-700 mb-3"></div>
                    <div className="flex-1 space-y-3 mb-2">
                        {list2.map((u) => (
                            <div key={u.id} className="flex justify-between items-center text-xs font-bold border-b border-slate-50 dark:border-slate-700/50 pb-2 group">
                                <span className="text-slate-600 dark:text-slate-300 truncate pr-2 group-hover:text-rose-600 cursor-pointer transition-colors" onClick={() => openOciosidadeDetails(u.id)}>{u.nome}</span>
                                <span className="text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded font-black shrink-0 cursor-pointer group-hover:scale-105 transition-transform" onClick={() => openOciosidadeDetails(u.id)}>{u.aulasPerdidasMes} JANELAS/MÊS</span>
                            </div>
                        ))}
                    </div>
                    {resumoCEO.ranking.length > 5 && (
                        <button onClick={() => setShowAll2(!showAll2)} className="text-[9px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-1 py-2 uppercase">
                            {showAll2 ? 'VER MENOS' : 'VER MAIS...'} <ChevronDown className={`w-3 h-3 transition-transform ${showAll2 ? 'rotate-180' : ''}`}/>
                        </button>
                    )}
                </div>

                {/* CARD 3: UNIDADES OTIMIZADAS */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-t-4 border-t-emerald-700 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                        <div className="w-4 h-4 bg-emerald-100 dark:bg-emerald-900/30 rounded flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" /></div>
                        <h3 className="text-[10px] font-black tracking-widest text-slate-500 dark:text-slate-400">UNIDADES OTIMIZADAS</h3>
                    </div>
                    <div className="mb-6">
                        <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">{resumoCEO.otimizadas.length}</span>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">COM ALTO VOLUME E GRADE MENSAL CHEIA</p>
                    </div>
                    <div className="border-t border-slate-100 dark:border-slate-700 mb-3"></div>
                    <div className="flex-1 space-y-3 mb-2">
                        {list3.length === 0 ? <div className="text-xs font-bold text-slate-400 text-center py-4">Nenhuma unidade 100% cheia.</div> : list3.map((u) => (
                            <div key={u.id} className="flex justify-between items-center text-xs font-bold border-b border-slate-50 dark:border-slate-700/50 pb-2 group">
                                <span className="text-slate-600 dark:text-slate-300 truncate pr-2 group-hover:text-emerald-600 cursor-pointer transition-colors" onClick={() => executeDrillDown(u.id)}>{u.nome}</span>
                                <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded font-black shrink-0 group-hover:scale-105 transition-transform" onClick={() => executeDrillDown(u.id)}>{u.totalAulasMes} AULAS/MÊS</span>
                            </div>
                        ))}
                    </div>
                    {resumoCEO.otimizadas.length > 5 && (
                        <button onClick={() => setShowAll3(!showAll3)} className="text-[9px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-1 py-2 uppercase">
                            {showAll3 ? 'VER MENOS' : 'VER MAIS...'} <ChevronDown className={`w-3 h-3 transition-transform ${showAll3 ? 'rotate-180' : ''}`}/>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(VisaoGlobal);