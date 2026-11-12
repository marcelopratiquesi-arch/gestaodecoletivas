import React from 'react';
import {
  Calendar, Clock, MapPin, User, ArrowRightLeft,
  CircleCheck, CircleX, TriangleAlert, Lock, Lightbulb
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatWeekday, formatCancelReason } from '../../utils/formatters';
import { ValidacaoRapida } from './ValidacaoRapida';
import { estadoDaAula } from './estadoDaAula';

// Componente Badge (usado no cartão e na lista)
export const StatusBadge = ({ status }) => {
    const { t } = useTranslation();
    if (status === 'realizada') {
        return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm">
                <CircleCheck className="w-3 h-3 flex-shrink-0" /> <span>{t('common.status.realizada')}</span>
            </div>
        );
    }
    if (status === 'cancelada') {
        return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-rose-100 text-rose-700 border border-rose-200 shadow-sm">
                <CircleX className="w-3 h-3 flex-shrink-0" /> <span>{t('common.status.cancelada')}</span>
            </div>
        );
    }
    return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 shadow-sm">
            <TriangleAlert className="w-3 h-3 flex-shrink-0" /> <span>{t('common.status.pendente')}</span>
        </div>
    );
};

// variante "pilha": dentro de uma pilha o cabeçalho já mostra horário, modalidade, unidade e professor,
// então o cartão mostra só o DIA em destaque (bem mais curto).
export function AulaCard({ item, onValidar, onCancelar, onValidarRapido, salvando, ocultarProfessor, verificarFuturo, variante }) {
    const { t } = useTranslation();
    const isFuture = verificarFuturo(item.data);
    const status = item.status;
    const isSub = item.professor?.isSubstituto;
    const media = item.mediaAlunos;
    const naPilha = variante === 'pilha';
    const { bloqueado, textoBloqueio, exigeJustificativa, validacaoRapida: podeRapida } = estadoDaAula(item, isFuture, t);
    const validacaoRapida = podeRapida && !!onValidarRapido;

    return (
        <div className={`group bg-white dark:bg-slate-800 rounded-2xl ${naPilha ? 'p-4' : 'p-4 md:p-5'} shadow-sm border border-slate-200 dark:border-slate-700 ${naPilha ? '' : 'md:hover:shadow-xl md:hover:-translate-y-1'} transition-all duration-300 relative overflow-hidden`}>
            {/* Barra Colorida no Topo */}
            <div className={`absolute top-0 left-0 w-full h-1.5 ${status === 'realizada' ? 'bg-emerald-500' : status === 'cancelada' ? 'bg-rose-500' : 'bg-amber-400'}`}></div>

            {/* Cabeçalho do Card */}
            {naPilha ? (
                <div className="flex justify-between items-center gap-3 mb-3 pt-1">
                    <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-400"/> {formatWeekday(item.diaSemana)}, {formatDate(item.data)}
                    </h3>
                    {isSub && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black tracking-wide uppercase flex items-center gap-1"><ArrowRightLeft className="w-3 h-3"/> {item.professor?.nome}</span>}
                </div>
            ) : (
                <>
                    <div className="flex justify-between items-start gap-3 mb-3 md:mb-4 pt-1.5 md:pt-2">
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-0.5 md:mb-1">
                                <Calendar className="w-3 h-3"/> {formatWeekday(item.diaSemana)}, {formatDate(item.data)}
                            </span>
                            <h3 className="font-black text-base md:text-lg text-slate-800 dark:text-white leading-tight truncate">{item.modalidade?.nome}</h3>
                        </div>
                        <div className="shrink-0 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg text-sm font-mono font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                            <Clock className="w-3.5 h-3.5 text-emerald-500"/> {item.aulaBase.hora}
                        </div>
                    </div>

                    {/* Detalhes (Local e Professor) — linhas compactas */}
                    <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4">
                        <div className="flex items-center gap-2 min-w-0">
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0"/>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{item.unidade?.nome}</p>
                        </div>
                        {!ocultarProfessor && (
                            <div className="flex items-center gap-2 min-w-0">
                                {isSub ? <ArrowRightLeft className="w-4 h-4 text-blue-500 shrink-0"/> : <User className="w-4 h-4 text-slate-400 shrink-0"/>}
                                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                    <p className={`text-sm font-bold truncate ${isSub ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                        {item.professor?.nome || t('common.unknown.noTeacher')}
                                    </p>
                                    {isSub && (
                                        <>
                                            <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 rounded font-black tracking-wide uppercase">{t('dailyValidation.card.substitute')}</span>
                                            <span className="text-[10px] text-slate-400 line-through decoration-red-400 decoration-2 truncate">{item.professorTitular?.nome}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Barra de Status e Info Extra */}
            <div className="mb-3 md:mb-4 px-3 py-2 md:p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 flex justify-between items-center gap-2">
                <StatusBadge status={status} />
                {status === 'realizada' && (
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <User className="w-3.5 h-3.5"/> {t('dailyValidation.card.students', { count: item.validacao?.alunos ?? 0 })}
                    </div>
                )}
                {status === 'cancelada' && (
                    <div className="text-[10px] font-bold text-rose-600 max-w-[140px] truncate text-right" title={formatCancelReason(item.validacao?.motivoCancelamento)}>
                        {formatCancelReason(item.validacao?.motivoCancelamento) || t('common.cancelReasons.recess')}
                    </div>
                )}
                {status === 'pendente' && media && !isFuture && (
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 text-right">
                        <Lightbulb className="w-3 h-3 text-amber-500 shrink-0"/> {t('dailyValidation.quick.averageShort', { media: media.media })}
                    </div>
                )}
            </div>

            {(bloqueado || exigeJustificativa) && (
                <div className={`mb-3 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5 ${bloqueado ? 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>
                    <Lock className="w-3 h-3 shrink-0"/> {bloqueado ? textoBloqueio : t('dailyValidation.deadline.cardNeedsJustification')}
                </div>
            )}

            {/* === VALIDAR DIRETO NO CARTÃO === */}
            {validacaoRapida && (
                <div className="space-y-2">
                    <ValidacaoRapida item={item} onValidarRapido={onValidarRapido} salvando={salvando} />
                    <div className="flex justify-between pt-1">
                        <button type="button" onClick={() => onValidar(item)} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 py-1">
                            <ArrowRightLeft className="w-3.5 h-3.5"/> {t('dailyValidation.quick.substitutionLink')}
                        </button>
                        <button type="button" onClick={() => onCancelar(item)} className="text-[11px] font-bold text-rose-500 hover:underline py-1">
                            {t('dailyValidation.quick.cancelLink')}
                        </button>
                    </div>
                </div>
            )}

            {/* Botões de Ação (editar / detalhes / validar pela janela) */}
            {!bloqueado && !validacaoRapida && <div className="grid grid-cols-2 gap-2 md:gap-3">
                <button
                    onClick={() => onValidar(item)}
                    disabled={isFuture || status === 'cancelada'}
                    className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2
                    ${status === 'realizada'
                        ? 'bg-white border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50'
                        : (isFuture || status === 'cancelada')
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 hover:shadow-emerald-500/40 hover:-translate-y-0.5'}`}
                >
                    {status === 'realizada' ? t('dailyValidation.card.edit') : t('dailyValidation.card.validate')}
                </button>

                <button
                    onClick={() => onCancelar(item)}
                    disabled={isFuture}
                    className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2
                    ${status === 'cancelada'
                        ? 'bg-white text-rose-600 border-2 border-rose-500 hover:bg-rose-50'
                        : isFuture
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            : 'bg-white text-rose-500 border border-rose-200 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600'}`}
                >
                    {status === 'cancelada' ? t('dailyValidation.card.details') : t('dailyValidation.card.cancel')}
                </button>
            </div>}

            {/* Overlay de Bloqueio (Futuro) */}
            {isFuture && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-2xl">
                    <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-xl border border-slate-200 dark:border-slate-600 flex items-center gap-2">
                        <Lock className="w-3 h-3 text-slate-400"/>
                        <span className="text-xs font-bold text-slate-500">{t('dailyValidation.card.waitForDate')}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
