import React, { useState, useEffect } from 'react';
import { 
  CircleCheck, CircleX, Users, ArrowRightLeft, 
  ChevronDown, Loader2, Undo2, Search, Mail, User, Check, Star, DollarSign, Clock, Calendar, AlertTriangle
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase'; 
import { useTranslation, Trans } from 'react-i18next';
import { getCurrencySymbol, formatCancelReason, formatSubstitutionReason } from '../../utils/formatters';

// Valores gravados no banco (em português); o texto exibido vem da tradução.
const OPCOES_CANCELAMENTO = ["Feriado", "Férias Professor", "Atestado Médico", "Manutenção Unidade", "Falta sem Justificativa", "Chuva/Clima"];
const OPCOES_SUBSTITUICAO = ["Atestado do Titular", "Férias", "Folga Programada", "Emergência", "Outros"];

export function ValidationModal({ 
    isOpen, onClose, onConfirm, onRevert, 
    acaoAtual, catalogs, processando, isMaster 
}) {
    const { t } = useTranslation();
    // --- ESTADOS GERAIS ---
    const [inputValor, setInputValor] = useState(""); 
    const [inputObs, setInputObs] = useState(""); 
    
    // --- ESTADOS DE SUBSTITUIÇÃO / AULÃO ---
    const [isSubstituicao, setIsSubstituicao] = useState(false);
    const [emailBusca, setEmailBusca] = useState("");
    const [professorEncontrado, setProfessorEncontrado] = useState(null); 
    const [buscandoProf, setBuscandoProf] = useState(false);
    const [erroBusca, setErroBusca] = useState("");
    const [motivoSubstituicao, setMotivoSubstituicao] = useState("");

    // --- ESTADOS ESPECÍFICOS DO AULÃO ---
    const [etapaAulao, setEtapaAulao] = useState('aviso'); // 'aviso' ou 'form'
    const [aulaoModalidadeId, setAulaoModalidadeId] = useState("");
    const [aulaoData, setAulaoData] = useState(""); 
    const [aulaoHora, setAulaoHora] = useState("10:00");
    const [aulaoValor, setAulaoValor] = useState("");

    // --- CARREGAR DADOS AO ABRIR ---
    useEffect(() => {
        if (isOpen && acaoAtual) {
            const { item } = acaoAtual;
            
            // Resetar tudo
            setInputValor("");
            setInputObs("");
            setIsSubstituicao(false);
            setEmailBusca("");
            setProfessorEncontrado(null);
            setErroBusca("");
            setMotivoSubstituicao("");
            
            // Aulão Defaults
            setEtapaAulao('aviso'); 
            setAulaoModalidadeId("");
            setAulaoData(item.data || new Date().toISOString().split('T')[0]); 
            setAulaoHora("10:00");
            setAulaoValor("");

            // Preencher se for edição (Validar ou Cancelar existente)
            if (item && item.validacao) {
                if (item.validacao.substituicao) {
                    setIsSubstituicao(true);
                    setMotivoSubstituicao(item.validacao.motivoSubstituicao || "");
                    setInputValor(item.validacao.alunos || "");
                    
                    if (catalogs && catalogs.professores) {
                        const profJaSalvo = catalogs.professores.find(p => p.id === item.validacao.professorId);
                        if (profJaSalvo) setProfessorEncontrado(profJaSalvo);
                    }
                } else {
                    if(item.status === 'cancelada') {
                        const motivo = item.validacao.motivoCancelamento || "";
                        if (OPCOES_CANCELAMENTO.includes(motivo)) {
                            setInputValor(motivo);
                        } else {
                            setInputValor("Outros");
                            setInputObs(motivo);
                        }
                    } else {
                        setInputValor(item.validacao.alunos || "");
                    }
                }
            }
        }
    }, [isOpen, acaoAtual, catalogs]);

    // --- FUNÇÃO DE BUSCA NO BANCO DE DADOS ---
    const handleBuscarProfessor = async () => {
        if (!emailBusca.trim()) {
            setErroBusca(t('dailyValidation.search.typeEmail'));
            return;
        }

        setBuscandoProf(true);
        setErroBusca("");
        setProfessorEncontrado(null);

        try {
            const q = query(collection(db, "professores"), where("email", "==", emailBusca.trim().toLowerCase()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setErroBusca(t('dailyValidation.search.notFound'));
            } else {
                const docData = querySnapshot.docs[0].data();
                setProfessorEncontrado({
                    id: querySnapshot.docs[0].id,
                    ...docData
                });
            }
        } catch (error) {
            console.error("Erro ao buscar professor:", error);
            setErroBusca(t('dailyValidation.search.connectionError'));
        } finally {
            setBuscandoProf(false);
        }
    };

    if (!isOpen || !acaoAtual) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validação Aulão
        if (acaoAtual.tipo === 'aulao') {
            if (!professorEncontrado) return alert(t('dailyValidation.alerts.searchTeacher'));
            if (!aulaoModalidadeId) return alert(t('dailyValidation.alerts.selectModality'));
            if (!aulaoData) return alert(t('dailyValidation.alerts.selectDate'));
            if (!inputValor) return alert(t('dailyValidation.alerts.informStudentCount'));
        }

        // Validação Substituição
        if (acaoAtual.tipo === 'validar' && isSubstituicao && !professorEncontrado) {
            alert(t('dailyValidation.alerts.confirmSubstitute'));
            return;
        }

        // =========================================================================
        // PASSO 1: A MÁGICA DO SNAPSHOT (FOTOGRAFIA DO PASSADO)
        // Aqui nós capturamos os nomes efetivos para blindar o banco de dados
        // =========================================================================
        let nomeProfSnapshot = "";
        let nomeModSnapshot = "";
        let valorAulaSnapshot = 0;

        if (acaoAtual.tipo === 'aulao') {
            nomeProfSnapshot = professorEncontrado?.nome || "Professor Desconhecido";
            const modObj = catalogs?.modalidades?.find(m => m.id === aulaoModalidadeId);
            nomeModSnapshot = modObj?.nome || "Modalidade Desconhecida";
            valorAulaSnapshot = aulaoValor ? parseFloat(aulaoValor) : 0;
        } else {
            // É validação de aula da grade normal
            const profIdReal = isSubstituicao ? professorEncontrado?.id : acaoAtual.item.aulaBase.professorId;
            const profObj = catalogs?.professores?.find(p => p.id === profIdReal);
            
            nomeProfSnapshot = profObj?.nome || acaoAtual.item.professorTitular?.nome || "Professor Desconhecido";
            nomeModSnapshot = acaoAtual.item.modalidade?.nome || "Modalidade Desconhecida";
            valorAulaSnapshot = acaoAtual.item.aulaBase?.valor ? parseFloat(acaoAtual.item.aulaBase.valor) : 0;
        }
        // =========================================================================

        const dadosFormulario = {
            inputValor,
            inputObs,
            isSubstituicao,
            substitutoId: professorEncontrado?.id || "",
            motivoSubstituicao,
            aulaoModalidadeId,
            aulaoData, 
            aulaoHora,
            aulaoValor,
            
            // Novos campos injetados para o Passo 2:
            professorNomeEfetivo: nomeProfSnapshot,
            modalidadeNomeEfetiva: nomeModSnapshot,
            valorEfetivo: valorAulaSnapshot
        };
        
        onConfirm(dadosFormulario);
    };

    // Configuração de cores e ícones baseada no tipo
    const getHeaderConfig = () => {
        switch(acaoAtual.tipo) {
            case 'validar': return { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', icon: <CircleCheck className="w-8 h-8"/>, title: t('dailyValidation.modal.validateTitle') };
            case 'cancelar': return { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-400', icon: <CircleX className="w-8 h-8"/>, title: t('dailyValidation.modal.cancelTitle') };
            case 'aulao': 
                if (etapaAulao === 'aviso') return { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600', icon: <AlertTriangle className="w-8 h-8"/>, title: t('dailyValidation.modal.attentionTitle') };
                return { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-400', icon: <Star className="w-8 h-8"/>, title: t('dailyValidation.modal.specialClassTitle') };
            default: return {};
        }
    }
    const config = getHeaderConfig();

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            
            {/* Header Dinâmico */}
            <div className={`p-6 text-center relative overflow-hidden shrink-0 ${config.bg}`}>
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-current to-transparent opacity-20"></div>
                <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3 shadow-sm bg-white ${config.text}`}>
                    {config.icon}
                </div>
                <h3 className="font-black text-xl text-slate-800 dark:text-white">
                    {acaoAtual.item?.status === 'cancelada' ? t('dailyValidation.modal.cancellationDetailsTitle') : config.title}
                </h3>
                {acaoAtual.tipo !== 'aulao' && (
                    <p className="text-xs font-bold text-slate-400 uppercase mt-1 tracking-wide">{acaoAtual.item.modalidade?.nome} • {acaoAtual.item.professorTitular?.nome}</p>
                )}
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 transition-colors"><CircleX className="w-5 h-5 text-slate-400"/></button>
            </div>

            {/* --- CONTEÚDO SCROLLÁVEL --- */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                
                {/* === FLUXO AULÃO: ETAPA 1 (AVISO) === */}
                {acaoAtual.tipo === 'aulao' && etapaAulao === 'aviso' && (
                    <div className="space-y-6 text-center">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
                            <p className="text-sm text-amber-800 font-medium leading-relaxed">
                                <Trans i18nKey="dailyValidation.modal.specialWarningQuestion" components={{ strong: <strong /> }} />
                            </p>
                            <p className="text-xs text-amber-700 mt-2">
                                • <Trans i18nKey="dailyValidation.modal.specialWarningNotInSchedule" components={{ strong: <strong /> }} /><br/>
                                • {t('dailyValidation.modal.specialWarningCheckDay')}<br/>
                                • {t('dailyValidation.modal.specialWarningUseNormal')}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 py-3 border border-slate-300 rounded-xl text-slate-600 font-bold text-xs uppercase hover:bg-slate-50">{t('common.actions.cancel')}</button>
                            <button onClick={() => setEtapaAulao('form')} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold text-xs uppercase hover:bg-amber-600 shadow-lg shadow-amber-500/20">{t('dailyValidation.modal.yesSpecial')}</button>
                        </div>
                    </div>
                )}

                {/* === FLUXO AULÃO: ETAPA 2 (FORMULÁRIO) === */}
                {acaoAtual.tipo === 'aulao' && etapaAulao === 'form' && (
                    <form id="form-validacao" onSubmit={handleSubmit} className="space-y-5">
                        
                        {/* 1. Buscar Professor */}
                        <div className="p-4 border-2 border-purple-100 bg-purple-50/30 rounded-xl space-y-3">
                            <label className="block text-[10px] font-bold text-purple-600 uppercase mb-1">{t('dailyValidation.modal.whoTeaches')}</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-purple-400"/>
                                    <input 
                                        type="email" 
                                        placeholder="professor@email.com"
                                        className="w-full pl-9 p-2 bg-white border border-purple-200 rounded-lg text-sm outline-none focus:border-purple-500"
                                        value={emailBusca}
                                        onChange={(e) => setEmailBusca(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBuscarProfessor())}
                                    />
                                </div>
                                <button 
                                    type="button" 
                                    onClick={handleBuscarProfessor}
                                    disabled={buscandoProf || !emailBusca}
                                    className="bg-purple-600 text-white px-3 rounded-lg font-bold text-xs hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                    {buscandoProf ? <Loader2 className="w-3 h-3 animate-spin"/> : <Search className="w-3 h-3"/>}
                                </button>
                            </div>
                            {erroBusca && <p className="text-[10px] text-red-500 font-bold ml-1">{erroBusca}</p>}

                            {professorEncontrado && (
                                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-purple-200 shadow-sm animate-in fade-in">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                                        {professorEncontrado.fotoUrl ? <img src={professorEncontrado.fotoUrl} alt={t('dailyValidation.modal.photoAlt')} className="w-full h-full object-cover"/> : <User className="w-4 h-4 text-slate-400"/>}
                                    </div>
                                    <p className="text-sm font-black text-slate-800 truncate flex-1">{professorEncontrado.nome}</p>
                                    <Check className="w-4 h-4 text-purple-500"/>
                                </div>
                            )}
                        </div>

                        {/* 2. Data e Hora */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('dailyValidation.modal.date')}</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                                    <input type="date" className="w-full pl-9 p-2.5 border rounded-xl text-sm font-bold bg-slate-50" value={aulaoData} onChange={e => setAulaoData(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('dailyValidation.modal.time')}</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                                    <input type="time" className="w-full pl-9 p-2.5 border rounded-xl text-sm font-bold bg-slate-50" value={aulaoHora} onChange={e => setAulaoHora(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* 3. Modalidade e Detalhes */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('dailyValidation.modal.modality')}</label>
                            <select className="w-full p-2.5 border rounded-xl text-sm font-bold bg-white" value={aulaoModalidadeId} onChange={e => setAulaoModalidadeId(e.target.value)}>
                                <option value="">{t('common.actions.select')}</option>
                                {catalogs.modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('dailyValidation.modal.amountPaid', { symbol: getCurrencySymbol(acaoAtual.item?.unidade?.pais) })}</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                                    <input type="number" placeholder="0,00" className="w-full pl-9 p-2.5 border rounded-xl text-sm font-bold" value={aulaoValor} onChange={e => setAulaoValor(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('dailyValidation.modal.studentCount')}</label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                                    <input type="number" placeholder="0" className="w-full pl-9 p-2.5 border rounded-xl text-sm font-bold" value={inputValor} onChange={e => setInputValor(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </form>
                )}

                {/* === OUTROS FLUXOS (VALIDAR/CANCELAR - MANTIDOS) === */}
                {(acaoAtual.tipo === 'validar' || acaoAtual.tipo === 'cancelar') && (
                    <form id="form-validacao" onSubmit={handleSubmit} className="space-y-5">
                        {acaoAtual.tipo === 'validar' ? (
                            <>
                                <div className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${isSubstituicao ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 hover:border-blue-200'}`}>
                                    <label className="flex items-center gap-4 p-4 cursor-pointer select-none">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSubstituicao ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                                            {isSubstituicao && <Check className="w-3 h-3 text-white"/>}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={isSubstituicao} onChange={(e) => setIsSubstituicao(e.target.checked)}/>
                                        <div className="flex-1">
                                            <span className={`block font-bold text-sm ${isSubstituicao ? 'text-blue-700' : 'text-slate-600'}`}>{t('dailyValidation.modal.substitution')}</span>
                                            <span className="text-[10px] text-slate-400">{t('dailyValidation.modal.substitutionHint')}</span>
                                        </div>
                                        <ArrowRightLeft className={`w-5 h-5 ${isSubstituicao ? 'text-blue-500' : 'text-slate-300'}`}/>
                                    </label>
                                    
                                    {isSubstituicao && (
                                        <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-2">
                                            <div className="h-px w-full bg-blue-200 mb-3"></div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">{t('dailyValidation.modal.substituteEmail')}</label>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <Mail className="absolute left-3 top-2.5 w-4 h-4 text-blue-400"/>
                                                        <input 
                                                            type="email" 
                                                            placeholder="ex: professor@pratique.com"
                                                            className="w-full pl-9 p-2 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
                                                            value={emailBusca}
                                                            onChange={(e) => setEmailBusca(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBuscarProfessor())}
                                                        />
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={handleBuscarProfessor}
                                                        disabled={buscandoProf || !emailBusca}
                                                        className="bg-blue-600 text-white px-3 rounded-lg font-bold text-xs hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        {buscandoProf ? <Loader2 className="w-3 h-3 animate-spin"/> : <Search className="w-3 h-3"/>}
                                                        {t('dailyValidation.modal.search')}
                                                    </button>
                                                </div>
                                                {erroBusca && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">{erroBusca}</p>}
                                            </div>

                                            {professorEncontrado && (
                                                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-blue-200 shadow-sm animate-in fade-in">
                                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300">
                                                        {professorEncontrado.fotoUrl ? (
                                                            <img src={professorEncontrado.fotoUrl} alt={t('dailyValidation.modal.photoAlt')} className="w-full h-full object-cover"/>
                                                        ) : (
                                                            <User className="w-5 h-5 text-slate-400"/>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-blue-600 uppercase">{t('dailyValidation.modal.substituteConfirmed')}</p>
                                                        <p className="text-sm font-black text-slate-800 truncate">{professorEncontrado.nome}</p>
                                                    </div>
                                                    <Check className="w-5 h-5 text-emerald-500 ml-auto"/>
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">{t('dailyValidation.modal.substitutionReason')}</label>
                                                <div className="relative">
                                                    <select className="w-full p-2.5 bg-white border border-blue-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none" value={motivoSubstituicao} onChange={(e) => setMotivoSubstituicao(e.target.value)}>
                                                        <option value="">{t('common.actions.select')}</option>
                                                        {OPCOES_SUBSTITUICAO.map(m => <option key={m} value={m}>{formatSubstitutionReason(m)}</option>)}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-blue-400 pointer-events-none"/>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 ml-1">{t('dailyValidation.modal.numberOfStudents')}</label>
                                    <div className="relative group">
                                        <Users className="absolute left-4 top-3.5 w-5 h-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors"/>
                                        <input type="number" min="0" className="w-full pl-12 p-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 rounded-xl text-xl font-bold text-slate-800 dark:text-white outline-none transition-all placeholder:text-slate-300" value={inputValor} onChange={e => setInputValor(e.target.value)} placeholder="00" autoFocus />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                {/* Select de Cancelamento */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 ml-1">{t('dailyValidation.modal.cancelReason')}</label>
                                    <div className="relative">
                                        <select 
                                            className={`w-full p-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none appearance-none ${acaoAtual.item.status === 'cancelada' ? 'cursor-not-allowed opacity-70' : 'focus:border-rose-500'}`} 
                                            value={inputValor} 
                                            onChange={e => setInputValor(e.target.value)}
                                            disabled={acaoAtual.item.status === 'cancelada'}
                                        >
                                        <option value="">{t('dailyValidation.modal.selectReason')}</option>
                                        {OPCOES_CANCELAMENTO.map(m => <option key={m} value={m}>{formatCancelReason(m)}</option>)}
                                        <option value="Outros">{t('dailyValidation.modal.otherDescribe')}</option>
                                        </select>
                                        <ChevronDown className="absolute right-4 top-4 w-4 h-4 text-slate-400 pointer-events-none"/>
                                    </div>
                                </div>
                                {(inputValor === 'Outros' || inputObs) && (
                                    <div className="animate-fade-in">
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 ml-1">{t('dailyValidation.modal.reasonDescription')}</label>
                                        <textarea 
                                            className="w-full p-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium text-slate-700 outline-none resize-none disabled:opacity-70" 
                                            rows="3" 
                                            value={inputObs} 
                                            onChange={e => setInputObs(e.target.value)} 
                                            placeholder={t('dailyValidation.modal.descriptionPlaceholder')}
                                            disabled={acaoAtual.item.status === 'cancelada'}
                                        />
                                    </div>
                                )}
                                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-xs flex gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <p>{t('dailyValidation.modal.cancelWarning')}</p>
                                </div>
                            </div>
                        )}
                    </form>
                )}
            </div>

            {/* Footer Ações (Só exibe se não estiver na etapa de aviso do Aulão) */}
            {!(acaoAtual.tipo === 'aulao' && etapaAulao === 'aviso') && (
                <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex gap-3 shrink-0">
                    {acaoAtual.item?.status === 'cancelada' ? (
                        <>
                            <button type="button" onClick={onClose} className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">{t('common.actions.close')}</button>
                            {isMaster && (
                                <button type="button" onClick={onRevert} disabled={processando} className="flex-[2] py-3.5 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 shadow-amber-500/30 transition-all">
                                    {processando ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Undo2 className="w-5 h-5"/> {t('dailyValidation.modal.revertCancellation')}</>}
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <button type="button" onClick={onClose} className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">{t('common.actions.cancel')}</button>
                            <button type="submit" form="form-validacao" disabled={processando} className={`flex-[2] py-3.5 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all ${
                                acaoAtual.tipo === 'validar' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' : 
                                acaoAtual.tipo === 'aulao' ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30' :
                                'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'}`}>
                                {processando ? <Loader2 className="w-5 h-5 animate-spin"/> : t('common.actions.confirm')}
                            </button>
                        </>
                    )}
                </div>
            )}

          </div>
        </div>
    );
}