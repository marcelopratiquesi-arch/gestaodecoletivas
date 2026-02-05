import React, { useState, useEffect } from 'react';
import { 
  CircleCheck, CircleX, Users, ArrowRightLeft, 
  ChevronDown, Loader2, Undo2 
} from 'lucide-react';

export function ValidationModal({ 
    isOpen, onClose, onConfirm, onRevert, 
    acaoAtual, catalogs, processando, isMaster 
}) {
    // Estados locais do formulário
    const [inputValor, setInputValor] = useState(""); 
    const [inputObs, setInputObs] = useState(""); 
    const [isSubstituicao, setIsSubstituicao] = useState(false);
    const [substitutoId, setSubstitutoId] = useState("");
    const [motivoSubstituicao, setMotivoSubstituicao] = useState("");

    // Carregar dados quando o modal abrir
    useEffect(() => {
        if (isOpen && acaoAtual) {
            const { item, tipo } = acaoAtual;
            
            // Resetar
            setInputValor("");
            setInputObs("");
            setIsSubstituicao(false);
            setSubstitutoId("");
            setMotivoSubstituicao("");

            // Preencher se já houver dados
            if (item.validacao) {
                if (item.validacao.substituicao) {
                    setIsSubstituicao(true);
                    setSubstitutoId(item.validacao.professorId);
                    setMotivoSubstituicao(item.validacao.motivoSubstituicao || "");
                    setInputValor(item.validacao.alunos || "");
                } else {
                    if(item.status === 'cancelada') {
                        const motivo = item.validacao.motivoCancelamento || "";
                        const motivosPadrao = ["Feriado", "Férias Professor", "Atestado Médico", "Manutenção Unidade", "Falta sem Justificativa", "Chuva/Clima"];
                        if (motivosPadrao.includes(motivo)) {
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
    }, [isOpen, acaoAtual]);

    if (!isOpen || !acaoAtual) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        // Prepara os dados para mandar para o pai
        const dadosFormulario = {
            inputValor,
            inputObs,
            isSubstituicao,
            substitutoId,
            motivoSubstituicao
        };
        onConfirm(dadosFormulario);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            
            {/* Header do Modal */}
            <div className={`p-6 text-center relative overflow-hidden ${acaoAtual.tipo === 'validar' ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-current to-transparent opacity-20"></div>
                <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3 shadow-sm ${acaoAtual.tipo === 'validar' ? 'bg-white text-emerald-500' : 'bg-white text-rose-500'}`}>
                    {acaoAtual.tipo === 'validar' ? <CircleCheck className="w-8 h-8"/> : <CircleX className="w-8 h-8"/>}
                </div>
                <h3 className="font-black text-xl text-slate-800 dark:text-white">
                    {acaoAtual.item.status === 'cancelada' ? 'Detalhes do Cancelamento' : (acaoAtual.tipo === 'validar' ? 'Validar Aula' : 'Cancelar Aula')}
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase mt-1 tracking-wide">{acaoAtual.item.modalidade?.nome} • {acaoAtual.item.professorTitular?.nome}</p>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 transition-colors"><CircleX className="w-5 h-5 text-slate-400"/></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {acaoAtual.tipo === 'validar' ? (
                <>
                    {/* Switch de Substituição */}
                    <div className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${isSubstituicao ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 hover:border-blue-200'}`}>
                        <label className="flex items-center gap-4 p-4 cursor-pointer select-none">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSubstituicao ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                                {isSubstituicao && <CircleCheck className="w-3 h-3 text-white"/>}
                            </div>
                            <input type="checkbox" className="hidden" checked={isSubstituicao} onChange={(e) => setIsSubstituicao(e.target.checked)}/>
                            <div className="flex-1">
                                <span className={`block font-bold text-sm ${isSubstituicao ? 'text-blue-700' : 'text-slate-600'}`}>Substituição de Professor</span>
                                <span className="text-[10px] text-slate-400">Marque se outro professor deu esta aula</span>
                            </div>
                            <ArrowRightLeft className={`w-5 h-5 ${isSubstituicao ? 'text-blue-500' : 'text-slate-300'}`}/>
                        </label>
                        
                        {/* Campos de Substituição */}
                        {isSubstituicao && (
                            <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-2">
                                <div className="h-px w-full bg-blue-200 mb-3"></div>
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Quem deu a aula?</label>
                                    <div className="relative">
                                        <select className="w-full p-2.5 bg-white border border-blue-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none" value={substitutoId} onChange={(e) => setSubstitutoId(e.target.value)}>
                                            <option value="">Selecione o professor...</option>
                                            {catalogs.professores.filter(p => String(p.id) !== String(acaoAtual.item.professorTitular?.id)).map(p => (<option key={p.id} value={p.id}>{p.nome}</option>))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-blue-400 pointer-events-none"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Motivo da Troca</label>
                                    <div className="relative">
                                        <select className="w-full p-2.5 bg-white border border-blue-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none" value={motivoSubstituicao} onChange={(e) => setMotivoSubstituicao(e.target.value)}>
                                            <option value="">Selecione...</option>
                                            <option value="Atestado do Titular">Atestado do Titular</option>
                                            <option value="Férias">Férias</option>
                                            <option value="Folga Programada">Folga Programada</option>
                                            <option value="Emergência">Emergência</option>
                                            <option value="Outros">Outros</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-blue-400 pointer-events-none"/>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input de Alunos */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 ml-1">Quantidade de Alunos</label>
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
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 ml-1">Motivo do Cancelamento</label>
                    <div className="relative">
                        <select 
                            className={`w-full p-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none appearance-none ${acaoAtual.item.status === 'cancelada' ? 'cursor-not-allowed opacity-70' : 'focus:border-rose-500'}`} 
                            value={inputValor} 
                            onChange={e => setInputValor(e.target.value)}
                            disabled={acaoAtual.item.status === 'cancelada'}
                        >
                        <option value="">Selecione o motivo...</option>
                        <option value="Feriado">Feriado</option>
                        <option value="Férias Professor">Férias Professor</option>
                        <option value="Atestado Médico">Atestado Médico</option>
                        <option value="Manutenção Unidade">Manutenção Unidade</option>
                        <option value="Falta sem Justificativa">Falta sem Justificativa</option>
                        <option value="Chuva/Clima">Chuva/Clima</option>
                        <option value="Outros">Outros (Descrever)</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-4 w-4 h-4 text-slate-400 pointer-events-none"/>
                    </div>
                  </div>
                  {(inputValor === 'Outros' || inputObs) && (
                    <div className="animate-fade-in">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 ml-1">Descrição do motivo</label>
                        <textarea 
                            className="w-full p-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium text-slate-700 outline-none resize-none disabled:opacity-70" 
                            rows="3" 
                            value={inputObs} 
                            onChange={e => setInputObs(e.target.value)} 
                            placeholder="Descrição..."
                            disabled={acaoAtual.item.status === 'cancelada'}
                        />
                    </div>
                  )}
                </div>
              )}

              {/* Rodapé do Modal */}
              <div className="flex gap-3 pt-2">
                {acaoAtual.item.status === 'cancelada' ? (
                    // MODO VISUALIZAÇÃO/REVERSÃO
                    <>
                        <button type="button" onClick={onClose} className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Fechar</button>
                        
                        {isMaster && (
                            <button type="button" onClick={onRevert} disabled={processando} className="flex-[2] py-3.5 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 shadow-amber-500/30 transition-all">
                                {processando ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Undo2 className="w-5 h-5"/> Reverter Cancelamento</>}
                            </button>
                        )}
                    </>
                ) : (
                    // MODO EDIÇÃO NORMAL
                    <>
                        <button type="button" onClick={onClose} className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                        <button type="submit" disabled={processando} className={`flex-[2] py-3.5 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all ${acaoAtual.tipo === 'validar' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'}`}>
                            {processando ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Confirmar'}
                        </button>
                    </>
                )}
              </div>
            </form>
          </div>
        </div>
    );
}