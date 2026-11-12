// LISTA: uma linha por aula, agrupada por horário fixo (unidade + horário + modalidade + professor),
// com a mais antiga primeiro dentro de cada grupo. No celular cada linha vira 2–3 linhas curtas.
import React from 'react';
import { ArrowRightLeft, Lock, User, CircleX, Pencil, FileText, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatWeekday, formatCancelReason } from '../../utils/formatters';
import { StatusBadge } from './AulaCard';
import { ValidacaoRapida } from './ValidacaoRapida';
import { estadoDaAula } from './estadoDaAula';

function LinhaAula({ item, verificarFuturo, onValidar, onCancelar, onValidarRapido, salvando }) {
    const { t } = useTranslation();
    const isFuture = verificarFuturo(item.data);
    const { bloqueado, textoBloqueio, exigeJustificativa, validacaoRapida } = estadoDaAula(item, isFuture, t);
    const isSub = item.professor?.isSubstituto;
    const botao = 'h-9 px-3 rounded-lg text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 transition-colors';

    return (
        <div className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 ${isFuture ? 'opacity-50' : ''}`}>
            {/* Dia + situação */}
            <div className="flex items-center gap-3 sm:w-64 shrink-0">
                <div className="w-20 shrink-0">
                    <p className="text-sm font-black text-slate-800 dark:text-white">{formatDate(item.data, { day: '2-digit', month: '2-digit' })}</p>
                    <p className="text-[10px] font-bold uppercase text-slate-400">{formatWeekday(item.diaSemana, { short: true })}</p>
                </div>
                <StatusBadge status={item.status} />
            </div>

            {/* Detalhe do meio */}
            <div className="flex-1 min-w-0 text-xs font-bold text-slate-500 dark:text-slate-400">
                {item.status === 'realizada' && (
                    <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><User className="w-3.5 h-3.5"/> {t('dailyValidation.card.students', { count: item.validacao?.alunos ?? 0 })}</span>
                )}
                {item.status === 'cancelada' && (
                    <span className="text-rose-600 truncate block">{formatCancelReason(item.validacao?.motivoCancelamento) || t('common.cancelReasons.recess')}</span>
                )}
                {isSub && (
                    <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5"><ArrowRightLeft className="w-3 h-3"/> {item.professor?.nome}</span>
                )}
                {isFuture && <span>{t('dailyValidation.card.waitForDate')}</span>}
                {bloqueado && <span className="flex items-center gap-1 text-slate-400 mt-0.5"><Lock className="w-3 h-3"/> {textoBloqueio}</span>}
                {exigeJustificativa && <span className="flex items-center gap-1 text-amber-600 mt-0.5"><FileText className="w-3 h-3"/> {t('dailyValidation.deadline.cardNeedsJustification')}</span>}
            </div>

            {/* Ações */}
            {!isFuture && !bloqueado && (
                <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                    {validacaoRapida && onValidarRapido ? (
                        <>
                            <ValidacaoRapida item={item} onValidarRapido={onValidarRapido} salvando={salvando} compacto />
                            <button type="button" onClick={() => onValidar(item)} title={t('dailyValidation.quick.substitutionLink')} aria-label={t('dailyValidation.quick.substitutionLink')} className="h-9 w-9 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/50 dark:hover:bg-blue-900/20 flex items-center justify-center">
                                <ArrowRightLeft className="w-4 h-4"/>
                            </button>
                            <button type="button" onClick={() => onCancelar(item)} title={t('dailyValidation.quick.cancelLink')} aria-label={t('dailyValidation.quick.cancelLink')} className="h-9 w-9 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-900/20 flex items-center justify-center">
                                <CircleX className="w-4 h-4"/>
                            </button>
                        </>
                    ) : (
                        <>
                            {item.status !== 'cancelada' && (
                                <button type="button" onClick={() => onValidar(item)} className={`${botao} ${item.status === 'realizada' ? 'border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>
                                    <Pencil className="w-3.5 h-3.5"/> {item.status === 'realizada' ? t('dailyValidation.card.edit') : t('dailyValidation.card.validate')}
                                </button>
                            )}
                            <button type="button" onClick={() => onCancelar(item)} className={`${botao} border ${item.status === 'cancelada' ? 'border-rose-500 text-rose-600' : 'border-rose-200 text-rose-500'} hover:bg-rose-50 dark:hover:bg-rose-900/20`}>
                                {item.status === 'cancelada' ? t('dailyValidation.card.details') : t('dailyValidation.card.cancel')}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export function ListaAulas({ grupos, mostrarProfessor, verificarFuturo, onValidar, onCancelar, onValidarRapido, salvando }) {
    const { t } = useTranslation();
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden divide-y-4 divide-slate-100 dark:divide-slate-900">
            {grupos.map(grupo => {
                const pendentes = grupo.itens.filter(i => i.status === 'pendente' && !verificarFuturo(i.data)).length;
                return (
                    <section key={grupo.chave}>
                        {/* Cabeçalho do grupo: horário · modalidade · unidade · professor */}
                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 flex items-center gap-x-3 gap-y-1 flex-wrap">
                            <span className="text-sm font-mono font-black text-slate-700 dark:text-slate-200">{grupo.hora}</span>
                            <span className="text-sm font-black uppercase text-slate-800 dark:text-white flex items-center gap-1">{grupo.modalidade}{grupo.isAulao && <Star className="w-3.5 h-3.5 text-purple-500"/>}</span>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{grupo.unidade}</span>
                            {mostrarProfessor && grupo.professor && <span className="text-xs font-bold text-slate-500 dark:text-slate-400">· {grupo.professor}</span>}
                            {pendentes > 0 && <span className="ml-auto text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{t('dailyValidation.views.pendingCount', { count: pendentes })}</span>}
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                            {grupo.itens.map(item => (
                                <LinhaAula key={item.key} item={item} verificarFuturo={verificarFuturo} onValidar={onValidar} onCancelar={onCancelar} onValidarRapido={onValidarRapido} salvando={salvando} />
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
