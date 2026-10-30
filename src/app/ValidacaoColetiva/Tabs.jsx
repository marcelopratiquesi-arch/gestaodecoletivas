import React from 'react';
import { ChevronDown, ChevronRight, User, Calendar, Clock as ClockIcon, Copy, Smartphone, ArrowDown, Eye, EyeOff, FileText, MessageSquare, CheckCircle2, Users, ShieldCheck } from 'lucide-react';
import { StatusBadge, getColorClassByPercent, getFirstLast, getRowColor, copyToClipboard, sendWhatsApp, filterPendingDates, formatDateShort, SortableHeader } from './components';
import { useTranslation } from 'react-i18next';
import { formatRole } from '../../utils/formatters';

// =========================================================
// 1. ABA RANKING (CARDS DE PLACAR AO VIVO)
// =========================================================
export function RankingTab({ isMentor, rankingMentores, rankingUnidades }) {
    const { t } = useTranslation();
    // 🟢 CORREÇÃO: Trava de segurança (|| []) para evitar o erro "undefined" no map
    const list = (isMentor ? rankingUnidades : rankingMentores) || [];
    
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 uppercase">
            {list.map((item, index) => {
                const score = item.mediaGeral !== undefined ? item.mediaGeral : item.percentual;
                const faltas = item.totalPendencias !== undefined ? item.totalPendencias : (item.pendencias?.length || 0);
                
                let podiumClass = "bg-slate-100 text-slate-500 border border-slate-200";
                if (index === 0) podiumClass = "bg-yellow-400 text-yellow-950 border border-yellow-500 shadow-md shadow-yellow-400/30";
                else if (index === 1) podiumClass = "bg-slate-300 text-slate-800 border border-slate-400 shadow-md shadow-slate-300/30";
                else if (index === 2) podiumClass = "bg-orange-300 text-orange-950 border border-orange-400 shadow-md shadow-orange-300/30";

                let scoreColor = "text-rose-600";
                if (score === 100) scoreColor = "text-emerald-600";
                else if (score >= 80) scoreColor = "text-blue-600";
                else if (score >= 50) scoreColor = "text-amber-600";

                return (
                    <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-start gap-4 mb-4">
                            <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center font-black text-xl ${podiumClass}`}>
                                {index + 1}º
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                                <h4 className="font-black text-slate-800 text-sm truncate tracking-tight" title={item.nome}>
                                    {item.nome}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                    {isMentor ? t('groupValidation.ranking.classesCount', { done: item.totalValidado, expected: item.totalEsperado }) : t('groupValidation.ranking.unitsCount', { count: item.totalUnidades })}
                                </p>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center border border-slate-100">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">{t('groupValidation.ranking.score')}</span>
                                <span className={`text-2xl font-black tracking-tighter leading-none mt-1 ${scoreColor}`}>
                                    {score}%
                                </span>
                            </div>
                            
                            <div className="text-right">
                                {faltas > 0 ? (
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] font-black text-rose-400 tracking-widest uppercase">{t('groupValidation.ranking.pendencies')}</span>
                                        <span className="text-xs font-black text-white bg-rose-500 px-2 py-0.5 rounded-md mt-1 shadow-sm">
                                            {t('groupValidation.ranking.absences', { count: faltas })}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] font-black text-emerald-400 tracking-widest uppercase">{t('groupValidation.ranking.status')}</span>
                                        <span className="text-xs font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md mt-1 flex items-center gap-1 shadow-sm">
                                            <CheckCircle2 className="w-3 h-3"/> {t('groupValidation.ranking.allOk')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
            {list.length === 0 && (
                <div className="col-span-full py-8 text-center text-slate-400 font-bold uppercase tracking-widest">
                    {t('groupValidation.ranking.waiting')}
                </div>
            )}
        </div>
    );
}

// =========================================================
// 2. ABA STATUS DETALHADO
// =========================================================
export function StatusTab({ showOnlyIssues, setShowOnlyIssues, sortConfig, requestSort, statusExibicao, toggleUnit, expandedUnitId, itensVisiveisStatus, sortedUnidades, setItensVisiveisStatus, msgMentorToUnit }) {
    const { t } = useTranslation();
    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm uppercase">
            <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
                <div>
                    <h3 className="text-sm font-black text-slate-800 tracking-widest">{t('groupValidation.status.title')}</h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">{t('groupValidation.status.hint')}</p>
                </div>
                <button onClick={() => setShowOnlyIssues(!showOnlyIssues)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm border ${showOnlyIssues ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {showOnlyIssues ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>} 
                    {showOnlyIssues ? t('groupValidation.status.showAll') : t('groupValidation.status.filterIssues')}
                </button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-4 w-10"></th>
                            <SortableHeader label={t('groupValidation.status.colUnitMentor')} sortKey="nome" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label={t('groupValidation.status.colProgress')} sortKey="percentual" currentSort={sortConfig} onSort={requestSort} align="center" />
                            <SortableHeader label={t('groupValidation.status.colStatus')} sortKey="status" currentSort={sortConfig} onSort={requestSort} align="center" />
                            <SortableHeader label={t('groupValidation.status.colLastUpdate')} sortKey="lastValidation" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label={t('groupValidation.status.colResponsible')} sortKey="responsavel" currentSort={sortConfig} onSort={requestSort} align="right" />
                            <th className="p-4 text-center text-[10px] font-black text-slate-400 tracking-widest">{t('groupValidation.status.colActions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(statusExibicao || []).map(u => (
                            <React.Fragment key={u.id}>
                                <tr className={`hover:bg-slate-50 transition-colors cursor-pointer group ${expandedUnitId === u.id ? 'bg-blue-50/40' : ''}`} onClick={() => toggleUnit(u.id)}>
                                    <td className="p-4 text-slate-400 group-hover:text-blue-500 transition-colors">
                                        {expandedUnitId === u.id ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-black text-slate-800 text-sm uppercase">{u.nome}</div>
                                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-1 font-bold uppercase"><User className="w-3 h-3"/> {u.mentorNome}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        {!u.temCronograma ? (
                                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-md uppercase border border-slate-200">{t('groupValidation.status.noSchedule')}</span>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1.5 justify-center">
                                                <div className="flex items-center gap-2 w-full max-w-[120px]">
                                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                                                        <div className={`h-full rounded-full transition-all duration-500 ${getColorClassByPercent(u.percentual)}`} style={{width: `${u.percentual}%`}}></div>
                                                    </div>
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${(u.pendencias || []).length === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {(u.pendencias || []).length === 0 ? t('groupValidation.status.ok100') : t('groupValidation.status.pendencies', { count: u.pendencias.length })}
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-center"><StatusBadge type={u.statusTexto} text={u.statusTexto} /></td>
                                    <td className="p-4">
                                        {u.lastValidation && u.lastValidation.responsavelNome !== '-' ? (
                                            <div className="flex flex-col text-xs">
                                                <span className="text-slate-700 font-bold flex items-center gap-1.5 uppercase"><Calendar className="w-3.5 h-3.5 text-slate-400"/> {u.lastValidation.data}</span>
                                                <span className="text-slate-500 flex items-center gap-1.5 mt-1 uppercase"><ClockIcon className="w-3.5 h-3.5 text-slate-400"/> {u.lastValidation.horaValidacao || '-'}</span>
                                            </div>
                                        ) : <span className="text-[10px] font-bold text-slate-400 italic">{t('groupValidation.status.waiting')}</span>}
                                    </td>
                                    <td className="p-4 text-right">
                                        {u.lastValidation && u.lastValidation.responsavelNome !== '-' ? (
                                            <div className="flex flex-col items-end">
                                                <span className="block text-xs font-black text-slate-800 truncate max-w-[160px] uppercase">{u.lastValidation.responsavelNome}</span>
                                                <span className="inline-flex items-center text-[9px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-1 border border-slate-200 uppercase">{formatRole(u.lastValidation.responsavelRole)}</span>
                                            </div>
                                        ) : <span className="text-xs text-slate-300">-</span>}
                                    </td>
                                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                        {u.percentual < 100 && u.temCronograma && (
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => copyToClipboard(msgMentorToUnit(u))} className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-600 transition-all border border-slate-200" title={t('groupValidation.status.copyMessage')}><Copy className="w-4 h-4"/></button>
                                                <button onClick={() => sendWhatsApp(u.telefone, msgMentorToUnit(u))} className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-200" title={t('groupValidation.status.sendWhatsApp')}><Smartphone className="w-4 h-4"/></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>

                                {expandedUnitId === u.id && (
                                    <tr className="bg-slate-50/50 shadow-inner">
                                        <td colSpan="7" className="p-4 sm:px-8">
                                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-md">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-slate-100 text-slate-500 font-black uppercase text-[9px] tracking-widest border-b border-slate-200">
                                                        <tr>
                                                            <th className="p-4">{t('groupValidation.status.colDateTime')}</th>
                                                            <th className="p-4">{t('groupValidation.status.colModality')}</th>
                                                            <th className="p-4">{t('groupValidation.status.colTeacher')}</th>
                                                            <th className="p-4 text-center">{t('groupValidation.status.colStatusFlow')}</th>
                                                            <th className="p-4 text-right">{t('groupValidation.status.colValidationData')}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {(u.historicoDetalhado || []).map((h) => {
                                                            const statusAjustado = String(h.status || '').trim().toUpperCase();
                                                            const isRealizada = ['REALIZADA', 'CANCELADA', 'VALIDADA'].includes(statusAjustado);
                                                            const isFeriado = statusAjustado === 'FERIADO';

                                                            return (
                                                                <tr key={h.key} className={`transition-colors hover:bg-slate-50 ${getRowColor(h.status, h.diffDays)}`}>
                                                                    <td className="p-4">
                                                                        <div className="font-black text-slate-800 uppercase">{h.data}</div>
                                                                        <div className="text-[10px] text-slate-500 font-mono font-bold mt-0.5 uppercase">{h.horaAula}</div>
                                                                    </td>
                                                                    <td className="p-4 font-bold text-slate-600 uppercase tracking-wide">{h.modalidade}</td>
                                                                    <td className="p-4 font-bold text-slate-600 uppercase">{getFirstLast(h.professor)}</td>
                                                                    <td className="p-4 text-center">
                                                                        <div className="flex flex-col items-center justify-center gap-1.5">
                                                                            <StatusBadge type={h.status} />
                                                                            {(statusAjustado === 'REALIZADA' || statusAjustado === 'VALIDADA') && (
                                                                                <span className="text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                                                                    <Users className="w-3 h-3"/> {t('groupValidation.status.students', { count: h.alunos || 0 })}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-4 text-right">
                                                                        {isRealizada ? (
                                                                            <div className="flex flex-col items-end">
                                                                                <div className="font-black text-slate-800 text-[10px] uppercase bg-slate-100 px-2 py-0.5 rounded border border-slate-200 mb-1">
                                                                                    {h.responsavelNome}
                                                                                </div>
                                                                                <div className="text-[9px] text-blue-600 font-black flex items-center gap-1.5 uppercase">
                                                                                    <ClockIcon className="w-3 h-3"/> {h.dataValidacao} {h.horaValidacao !== '-' ? t('groupValidation.status.atTime', { time: h.horaValidacao }) : ''}
                                                                                </div>
                                                                            </div>
                                                                        ) : (isFeriado ? <span className="text-purple-600 font-black text-[9px] uppercase border border-purple-200 px-2 py-0.5 rounded bg-purple-50">{t('groupValidation.status.recessHoliday')}</span> : <span className="text-slate-300 font-black">-</span>)}
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                        {(statusExibicao || []).length === 0 && (
                            <tr><td colSpan="7" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest">{t('groupValidation.status.noUnits')}</td></tr>
                        )}
                    </tbody>
                </table>
                
                {itensVisiveisStatus < (sortedUnidades || []).length && (
                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-center">
                        <button onClick={() => setItensVisiveisStatus(prev => prev + 12)} className="flex items-center gap-2 bg-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-slate-600 border border-slate-200 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm">
                            <ArrowDown className="w-4 h-4"/> {t('groupValidation.status.loadMore')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// =========================================================
// 3. ABA DE COBRANÇA EM MASSA
// =========================================================
export function CobrancaTab({ isMentor, mentoresRelatorioGeral, unidadesRelatorioGeral, msgAdminToMentor, msgMentorToUnit, msgAdminGeneralReport, msgMentorGeneralReport }) {
    const { t } = useTranslation();
    const listaParaCobrar = !isMentor 
        ? (mentoresRelatorioGeral || []).filter(m => m.totalPendencias > 0)
        : (unidadesRelatorioGeral || []).filter(u => u.pendencias && u.pendencias.length > 0);

    const listaOrdenada = [...listaParaCobrar].sort((a, b) => {
        const scoreA = a.mediaGeral !== undefined ? a.mediaGeral : a.percentual;
        const scoreB = b.mediaGeral !== undefined ? b.mediaGeral : b.percentual;
        return scoreA - scoreB; 
    });

    return (
        <div className="animate-fade-in space-y-6 uppercase">
            <div className="bg-slate-900 rounded-2xl p-8 shadow-xl relative overflow-hidden text-white border border-slate-800">
                <div className="absolute top-0 right-0 p-8 opacity-10"><MessageSquare className="w-32 h-32"/></div>
                <div className="relative z-10">
                    <h3 className="text-xl font-black flex items-center gap-3 uppercase tracking-tighter">
                        <FileText className="w-6 h-6 text-blue-400"/>
                        {t('groupValidation.collection.title', { scope: isMentor ? t('groupValidation.collection.scopeMyUnits') : t('groupValidation.collection.scopeMentors') })}
                    </h3>
                    <p className="text-slate-400 text-xs mt-2 font-bold uppercase tracking-widest">{t('groupValidation.collection.subtitle')}</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => copyToClipboard(isMentor ? msgMentorGeneralReport() : msgAdminGeneralReport())} className="bg-white text-slate-900 px-5 py-2.5 rounded-lg text-[10px] font-black hover:bg-blue-500 hover:text-white transition-all shadow-lg flex items-center gap-2 uppercase">
                            <Copy className="w-4 h-4"/> {t('groupValidation.collection.copyReport')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-200">
                        <tr>
                            <th className="p-4 border-r border-slate-200 uppercase">{isMentor ? t('groupValidation.collection.colUnit') : t('groupValidation.collection.colMentor')}</th>
                            <th className="p-4 border-r border-slate-200 text-center w-32 uppercase">{t('groupValidation.collection.colScore')}</th>
                            <th className="p-4 border-r border-slate-200 uppercase">{t('groupValidation.collection.colPendencies')}</th>
                            <th className="p-4 text-center w-64 uppercase">{t('groupValidation.collection.colActions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {listaOrdenada.map((item) => {
                            const score = item.mediaGeral !== undefined ? item.mediaGeral : item.percentual;
                            
                            return (
                                <tr key={item.id} className="hover:bg-slate-50 transition-all">
                                    <td className="p-4 font-black text-slate-800 uppercase text-xs border-r border-slate-100">
                                        {item.nome}
                                    </td>
                                    
                                    <td className="p-4 text-center border-r border-slate-100">
                                        <span className={`px-3 py-1 rounded-md text-[10px] font-black shadow-sm ${getColorClassByPercent(score)}`}>
                                            {score}%
                                        </span>
                                    </td>
                                    
                                    <td className="p-4 text-[10px] font-bold text-slate-500 uppercase leading-relaxed border-r border-slate-100">
                                        {isMentor 
                                            ? filterPendingDates(item.pendencias || []).map(d => formatDateShort(d)).join(', ') 
                                            : (item.unidadesList || [])
                                                .filter(u => u.percentual < 100)
                                                .map(u => `${u.nome} (${filterPendingDates(u.pendencias || []).map(d => formatDateShort(d)).join(', ')})`)
                                                .join(' | ')
                                        }
                                    </td>
                                    
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => copyToClipboard(!isMentor ? msgAdminToMentor(item) : msgMentorToUnit(item))} className="px-3 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-500 hover:text-white transition-all flex items-center gap-1.5">
                                                <Copy className="w-3 h-3"/> {t('groupValidation.collection.copy')}
                                            </button>
                                            <button onClick={() => sendWhatsApp(item.telefone, !isMentor ? msgAdminToMentor(item) : msgMentorToUnit(item))} className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase hover:bg-emerald-600 transition-all shadow-sm flex items-center gap-1.5">
                                                <Smartphone className="w-3 h-3"/> {t('groupValidation.collection.whatsapp')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}

                        {/* 🟢 CORREÇÃO: Uso de ShieldCheck importado corretamente na linha 299 */}
                        {listaOrdenada.length === 0 && (
                            <tr>
                                <td colSpan="4" className="p-10 text-center text-slate-400 font-bold tracking-widest uppercase">
                                    <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30 text-emerald-500"/>
                                    {t('groupValidation.collection.noPendencies')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}