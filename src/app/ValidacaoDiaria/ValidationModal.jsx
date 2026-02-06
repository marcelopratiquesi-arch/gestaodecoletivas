import React, { useState, useEffect } from 'react';
import { 
  CircleCheck, CircleX, Users, ArrowRightLeft, 
  ChevronDown, Loader2, Undo2, Search, Mail, User, Check
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase'; // Verifique se o caminho está correto para o seu projeto

export function ValidationModal({ 
    isOpen, onClose, onConfirm, onRevert, 
    acaoAtual, catalogs, processando, isMaster 
}) {
    // --- ESTADOS GERAIS ---
    const [inputValor, setInputValor] = useState(""); 
    const [inputObs, setInputObs] = useState(""); 
    
    // --- ESTADOS DE SUBSTITUIÇÃO (NOVO MÓDULO) ---
    const [isSubstituicao, setIsSubstituicao] = useState(false);
    const [emailBusca, setEmailBusca] = useState("");
    const [professorEncontrado, setProfessorEncontrado] = useState(null); // Guarda o prof buscado
    const [buscandoProf, setBuscandoProf] = useState(false);
    const [erroBusca, setErroBusca] = useState("");
    const [motivoSubstituicao, setMotivoSubstituicao] = useState("");

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

            // Preencher se for edição
            if (item.validacao) {
                if (item.validacao.substituicao) {
                    setIsSubstituicao(true);
                    setMotivoSubstituicao(item.validacao.motivoSubstituicao || "");
                    setInputValor(item.validacao.alunos || "");
                    
                    // Se estiver editando, tentamos mostrar quem é o substituto atual
                    // (Se a lista catalogs.professores tiver ele, mostramos o nome, senão mostramos que tem um ID)
                    if (catalogs && catalogs.professores) {
                        const profJaSalvo = catalogs.professores.find(p => p.id === item.validacao.professorId);
                        if (profJaSalvo) {
                            setProfessorEncontrado(profJaSalvo);
                        }
                    }
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
    }, [isOpen, acaoAtual, catalogs]);

    // --- FUNÇÃO DE BUSCA NO BANCO DE DADOS ---
    const handleBuscarProfessor = async () => {
        if (!emailBusca.trim()) {
            setErroBusca("Digite o e-mail do professor.");
            return;
        }

        setBuscandoProf(true);
        setErroBusca("");
        setProfessorEncontrado(null);

        try {
            // Busca exata pelo email na coleção de professores
            const q = query(collection(db, "professores"), where("email", "==", emailBusca.trim()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setErroBusca("Professor não encontrado com este e-mail.");
            } else {
                // Pega o primeiro (e deve ser único) resultado
                const docData = querySnapshot.docs[0].data();
                setProfessorEncontrado({
                    id: querySnapshot.docs[0].id,
                    ...docData
                });
            }
        } catch (error) {
            console.error("Erro ao buscar professor:", error);
            setErroBusca("Erro ao conectar com o banco de dados.");
        } finally {
            setBuscandoProf(false);
        }
    };

    if (!isOpen || !acaoAtual) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validação extra para substituição
        if (acaoAtual.tipo === 'validar' && isSubstituicao && !professorEncontrado) {
            alert("Por favor, busque e confirme o professor substituto pelo e-mail.");
            return;
        }

        const dadosFormulario = {
            inputValor,
            inputObs,
            isSubstituicao,
            substitutoId: professorEncontrado?.id || "", // Envia o ID do professor encontrado
            motivoSubstituicao
        };
        onConfirm(dadosFormulario);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            
            {/* Header do Modal */}
            <div className={`p-6 text-center relative overflow-hidden shrink-0 ${acaoAtual.tipo === 'validar' ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
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

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              {acaoAtual.tipo === 'validar' ? (
                <>
                    {/* Switch de Substituição */}
                    <div className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${isSubstituicao ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 hover:border-blue-200'}`}>
                        <label className="flex items-center gap-4 p-4 cursor-pointer select-none">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSubstituicao ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                                {isSubstituicao && <Check className="w-3 h-3 text-white"/>}
                            </div>
                            <input type="checkbox" className="hidden" checked={isSubstituicao} onChange={(e) => setIsSubstituicao(e.target.checked)}/>
                            <div className="flex-1">
                                <span className={`block font-bold text-sm ${isSubstituicao ? 'text-blue-700' : 'text-slate-600'}`}>Substituição de Professor</span>
                                <span className="text-[10px] text-slate-400">Marque se outro professor deu esta aula</span>
                            </div>
                            <ArrowRightLeft className={`w-5 h-5 ${isSubstituicao ? 'text-blue-500' : 'text-slate-300'}`}/>
                        </label>
                        
                        {/* --- NOVA LÓGICA DE BUSCA POR E-MAIL --- */}
                        {isSubstituicao && (
                            <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-2">
                                <div className="h-px w-full bg-blue-200 mb-3"></div>
                                
                                {/* Campo de Busca */}
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">E-mail do Substituto</label>
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
                                            Buscar
                                        </button>
                                    </div>
                                    {erroBusca && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">{erroBusca}</p>}
                                </div>

                                {/* Resultado da Busca */}
                                {professorEncontrado && (
                                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-blue-200 shadow-sm animate-in fade-in">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300">
                                            {professorEncontrado.fotoUrl ? (
                                                <img src={professorEncontrado.fotoUrl} alt="Foto" className="w-full h-full object-cover"/>
                                            ) : (
                                                <User className="w-5 h-5 text-slate-400"/>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-blue-600 uppercase">Substituto Confirmado</p>
                                            <p className="text-sm font-black text-slate-800 truncate">{professorEncontrado.nome}</p>
                                        </div>
                                        <Check className="w-5 h-5 text-emerald-500 ml-auto"/>
                                    </div>
                                )}

                                {/* Motivo da Troca */}
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
                  {/* Aviso Financeiro */}
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-xs flex gap-2">
                     <AlertTriangle className="w-4 h-4 shrink-0" />
                     <p>Atenção: Aulas canceladas não geram pagamento para o professor titular.</p>
                  </div>
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