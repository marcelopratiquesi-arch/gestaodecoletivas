// PILHA ("baralho"): junta as aulas do mesmo horário fixo (unidade + horário + modalidade + professor).
// Fechada: mostra só a aula pendente MAIS ANTIGA por cima; validou, ela sai e a próxima sobe sozinha.
// Aberta: mostra todas as aulas daquele horário.
import React from 'react';
import { ChevronDown, Clock, MapPin, User, CircleCheck, TriangleAlert, CircleX, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PilhaAulas({ grupo, aberta, onAlternar, renderCartao, mostrarProfessor, verificarFuturo }) {
    const { t } = useTranslation();
    const itens = grupo.itens;

    // Uma aula só naquele horário: vira um cartão normal (igual a antes).
    if (itens.length === 1) return renderCartao(itens[0]);

    const pendentes = itens.filter(i => i.status === 'pendente' && !verificarFuturo(i.data));
    const realizadas = itens.filter(i => i.status === 'realizada').length;
    const canceladas = itens.filter(i => i.status === 'cancelada').length;
    // Já vem em ordem de data: a pendente mais antiga primeiro. Sem pendente vencida, mostra a próxima (futura).
    const topo = pendentes[0] || itens.find(i => i.status === 'pendente') || null;
    const cartasAtras = Math.min(2, Math.max(0, pendentes.length - 1));

    return (
        <div className={`rounded-3xl border p-3 md:p-4 transition-all ${aberta ? 'col-span-full' : ''} ${pendentes.length === 0 ? 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/40' : 'bg-slate-100/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700'}`}>
            {/* Cabeçalho da pilha (clica para abrir/recolher) */}
            <button type="button" onClick={onAlternar} className="w-full flex items-start justify-between gap-3 text-left mb-3" aria-expanded={aberta}>
                <div className="min-w-0">
                    <p className="font-black text-slate-800 dark:text-white flex items-center gap-2 flex-wrap">
                        <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg text-sm font-mono border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-emerald-500"/> {grupo.hora}
                        </span>
                        <span className="truncate uppercase">{grupo.modalidade}</span>
                        {grupo.isAulao && <Star className="w-4 h-4 text-purple-500"/>}
                    </p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3"/> {grupo.unidade}</span>
                        {mostrarProfessor && grupo.professor && <span className="flex items-center gap-1 truncate"><User className="w-3 h-3"/> {grupo.professor}</span>}
                    </p>
                    <div className="flex gap-1.5 flex-wrap mt-2">
                        {pendentes.length > 0 && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><TriangleAlert className="w-3 h-3"/> {t('dailyValidation.views.pendingCount', { count: pendentes.length })}</span>}
                        {realizadas > 0 && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1"><CircleCheck className="w-3 h-3"/> {t('dailyValidation.views.doneCount', { count: realizadas })}</span>}
                        {canceladas > 0 && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-1"><CircleX className="w-3 h-3"/> {t('dailyValidation.views.canceledCount', { count: canceladas })}</span>}
                    </div>
                </div>
                <span className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5">
                    {aberta ? t('dailyValidation.views.collapse') : t('dailyValidation.views.showAll', { count: itens.length })}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aberta ? 'rotate-180' : ''}`}/>
                </span>
            </button>

            {aberta ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                    {itens.map(item => renderCartao(item, 'pilha'))}
                </div>
            ) : topo ? (
                // Baralho: a carta de cima + "sombras" das que estão por baixo
                <div className="relative" style={{ paddingBottom: cartasAtras * 8 }}>
                    {cartasAtras >= 2 && <div className="absolute inset-x-6 bottom-0 top-4 rounded-2xl bg-white/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700" />}
                    {cartasAtras >= 1 && <div className="absolute inset-x-3 top-2 rounded-2xl bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700" style={{ bottom: cartasAtras >= 2 ? 8 : 0 }} />}
                    <div className="relative z-10">{renderCartao(topo, 'pilha')}</div>
                </div>
            ) : (
                <button type="button" onClick={onAlternar} className="w-full py-4 rounded-2xl border border-dashed border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                    <CircleCheck className="w-4 h-4"/> {t('dailyValidation.views.allDone')}
                </button>
            )}
        </div>
    );
}
