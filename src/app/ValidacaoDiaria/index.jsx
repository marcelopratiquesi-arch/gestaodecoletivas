import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCatalogs } from '../../contexts/CatalogContext'; 
import { db } from '../../services/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc 
} from 'firebase/firestore';
import { 
  Calendar, CircleCheck, CircleX, TriangleAlert, 
  MapPin, Filter, Search, List, ArrowDown, DownloadCloud, Loader2, LayoutDashboard, UserCog,
  Map as MapIcon, Star, CheckSquare, Square, ChevronDown 
} from 'lucide-react';

import { AulaCard } from './AulaCard';
import { ValidationModal } from './ValidationModal';

// --- HELPERS ---
const getTodayStr = () => new Date().toLocaleDateString('en-CA'); 

const getMonthDates = (year, month) => {
  const date = new Date(year, month, 1);
  const dates = [];
  while (date.getMonth() === month) {
    dates.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
};

const diasSemanaMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

const getFirstLast = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1]}`;
};

// ============================================================================
// COMPONENTE: MULTI-SELECT COMPACTO (ESPECIAL PARA A BARRA DE FILTROS)
// ============================================================================
const FilterMultiSelect = ({ options, selected, onChange, placeholder, icon: Icon, searchable = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTxt, setSearchTxt] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearchTxt(''); 
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (id) => selected.includes(id) ? onChange(selected.filter(item => item !== id)) : onChange([...selected, id]);
    const filteredOptions = searchable && searchTxt ? options.filter(opt => (opt.nome||'').toLowerCase().includes(searchTxt.toLowerCase())) : options;
    const isAllFilteredSelected = filteredOptions.length > 0 && filteredOptions.every(opt => selected.includes(opt.id));
    
    const toggleAll = () => {
        if (isAllFilteredSelected) {
            const filteredIds = filteredOptions.map(o => o.id);
            onChange(selected.filter(id => !filteredIds.includes(id)));
        } else {
            const newSelected = [...selected];
            filteredOptions.forEach(opt => { if (!newSelected.includes(opt.id)) newSelected.push(opt.id); });
            onChange(newSelected);
        }
    };

    return (
        <div className="relative h-10 shrink-0 min-w-[160px] flex-1 max-w-[250px]" ref={wrapperRef}>
            <Icon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 z-10 pointer-events-none"/>
            <div 
                className={`w-full h-full pl-9 pr-3 bg-slate-50 dark:bg-slate-900 border border-transparent rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer flex justify-between items-center transition-all ${isOpen ? 'ring-2 ring-emerald-500 bg-white dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                onClick={() => { setIsOpen(!isOpen); if (isOpen) setSearchTxt(''); }}
            >
                <span className="truncate pr-2 uppercase">
                    {selected.length === 0 ? <span className="font-bold">{placeholder}</span> : selected.length === options.length && options.length > 0 ? <span className="text-emerald-600 dark:text-emerald-400 font-black">TODOS</span> : <span className="text-emerald-600 dark:text-emerald-400 font-black">{selected.length} SELECIONADO(S)</span>}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full min-w-[220px] mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 flex flex-col overflow-hidden">
                    {searchable && (
                        <div className="p-2 border-b border-slate-100 dark:border-slate-700 shrink-0 bg-slate-50 dark:bg-slate-900/50">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                                <input type="text" placeholder="BUSCAR..." className="w-full pl-8 pr-2 py-1.5 text-[10px] font-bold uppercase bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:border-emerald-500 dark:text-white" value={searchTxt} onChange={(e) => setSearchTxt(e.target.value)} onClick={(e) => e.stopPropagation()} />
                            </div>
                        </div>
                    )}
                    <div className="p-1.5 sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 z-10 shrink-0">
                        <button type="button" onClick={toggleAll} className="w-full text-left px-2 py-1.5 text-[10px] font-black text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md flex items-center gap-1.5 transition-colors uppercase">
                            {isAllFilteredSelected ? <CheckSquare className="w-3.5 h-3.5"/> : <Square className="w-3.5 h-3.5"/>} MARCAR TODOS
                        </button>
                    </div>
                    <div className="p-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="text-center text-[10px] font-bold text-slate-400 py-3 uppercase">Nenhum resultado</div>
                        ) : (
                            filteredOptions.map(opt => {
                                const isSelected = selected.includes(opt.id);
                                return (
                                    <div key={opt.id} onClick={() => toggleOption(opt.id)} className={`flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                        {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0"/> : <Square className="w-3.5 h-3.5 text-slate-300 shrink-0"/>}
                                        <span className={`text-[10px] truncate uppercase ${isSelected ? 'font-black text-emerald-700 dark:text-emerald-400' : 'font-bold text-slate-600 dark:text-slate-300'}`}>{opt.nome}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// TELA PRINCIPAL
// ============================================================================
export default function ValidacaoDiariaPage() {
  const { userData } = useAuth();
  
  // 🟢 ACESSANDO A MEMÓRIA GLOBAL DO SISTEMA
  const { catalogs: globalCatalogs, loadingCatalogs } = useCatalogs();

  // --- PERMISSÕES ---
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);
  const userUnidadeId = useMemo(() => userData?.unidadeId, [userData]);
  const isMaster = useMemo(() => ['admin', 'mentor'].includes(role), [role]);

  // --- FILTROS MULTI-SELECT ---
  const [modoFiltro, setModoFiltro] = useState('dia'); 
  const [dataFiltro, setDataFiltro] = useState(getTodayStr());
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7));
  
  const [filtroEstado, setFiltroEstado] = useState([]);
  const [filtroMentor, setFiltroMentor] = useState([]);
  const [filtroUnidade, setFiltroUnidade] = useState([]);
  const [filtroModalidade, setFiltroModalidade] = useState([]);
  
  const [filtroProfessor, setFiltroProfessor] = useState("");
  const [filtroStatus, setFiltroStatus] = useState('todos'); 

  // --- DADOS TEMPO REAL ---
  const [validacoesRealtime, setValidacoesRealtime] = useState([]);
  const [gradeGerada, setGradeGerada] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [itensVisiveis, setItensVisiveis] = useState(12);

  // --- MODAL STATES ---
  const [modalOpen, setModalOpen] = useState(false);
  const [acaoAtual, setAcaoAtual] = useState(null); 

  // 🟢 REGRA DO COFRE ATUALIZADA (O Admin destranca se escolher Estado, Mentor ou Unidade)
  const isCofreFechado = role === 'admin' 
    ? (filtroEstado.length === 0 && filtroMentor.length === 0 && filtroUnidade.length === 0)
    : role === 'mentor' 
        ? (filtroUnidade.length === 0) 
        : false;

  // ==========================================
  // 1. APLICAÇÃO DE PERMISSÕES NA MEMÓRIA GLOBAL
  // ==========================================
  const catalogs = useMemo(() => {
    if (!globalCatalogs || loadingCatalogs) return { unidades: [], modalidades: [], professores: [], feriados: [], mentores: [], vinculos: [], aulas: [] };
    
    let unitsData = [...(globalCatalogs.unidades || [])];
    
    if (role === 'mentor') {
      unitsData = unitsData.filter(u => u.mentorId === userId);
    } else if (role === 'unidade') {
      unitsData = unitsData.filter(u => String(u.id) === String(userUnidadeId));
    } else if (role === 'professor') {
      const meuPerfil = globalCatalogs.professores.find(p => p.uidLogin === userId);
      if (meuPerfil) {
         const meusLinks = globalCatalogs.vinculos.filter(l => String(l.professorId) === String(meuPerfil.id));
         const minhasUnidadesIds = meusLinks.map(l => String(l.unidadeId));
         unitsData = unitsData.filter(u => minhasUnidadesIds.includes(String(u.id)));
      } else {
         unitsData = [];
      }
    }

    return { ...globalCatalogs, unidades: unitsData };
  }, [globalCatalogs, loadingCatalogs, role, userId, userUnidadeId]);

  // Se for unidade, auto-seleciona
  useEffect(() => {
      if (role === 'unidade' && userUnidadeId) {
          setFiltroUnidade([userUnidadeId]);
      }
  }, [role, userUnidadeId]);

  // 🟢 CASCATA DE FILTROS: Limpa as opções "filhas" quando o "pai" muda
  const handleEstadoChange = (v) => {
      setFiltroEstado(v);
      setFiltroMentor([]);
      setFiltroUnidade([]);
  };

  const handleMentorChange = (v) => {
      setFiltroMentor(v);
      setFiltroUnidade([]);
  };

  // OPÇÕES PARA OS MULTI-SELECTS (Agora eles são responsivos entre si)
  const estadosOptions = useMemo(() => {
      const ufs = catalogs.unidades.map(u => u.estado).filter(Boolean);
      return [...new Set(ufs)].sort().map(uf => ({ id: uf, nome: uf }));
  }, [catalogs.unidades]);

  const mentoresOptions = useMemo(() => {
      // O Mentor só aparece se a unidade do estado selecionado pertencer a ele
      let filtradas = catalogs.unidades;
      if (filtroEstado.length > 0) {
          filtradas = filtradas.filter(u => filtroEstado.includes(u.estado));
      }
      const mentorIdsValidos = new Set(filtradas.map(u => u.mentorId).filter(Boolean));

      return (catalogs.mentores || [])
          .filter(m => mentorIdsValidos.has(m.id))
          .map(m => ({ id: m.id, nome: getFirstLast(m.nome).toUpperCase() }))
          .sort((a,b) => a.nome.localeCompare(b.nome));
  }, [catalogs.mentores, catalogs.unidades, filtroEstado]);

  const unidadesFiltradasSelect = useMemo(() => {
      // A unidade só aparece se o estado e o mentor baterem
      let filtradas = catalogs.unidades;
      if (filtroEstado.length > 0) filtradas = filtradas.filter(u => filtroEstado.includes(u.estado));
      if (filtroMentor.length > 0) filtradas = filtradas.filter(u => filtroMentor.includes(u.mentorId));
      
      return filtradas.map(u => ({ id: u.id, nome: String(u.nome).toUpperCase() })).sort((a,b) => a.nome.localeCompare(b.nome));
  }, [catalogs.unidades, filtroEstado, filtroMentor]);

  const modalidadesOptions = useMemo(() => {
      return (catalogs.modalidades || []).map(m => ({ id: m.id, nome: m.nome.toUpperCase() })).sort((a,b) => a.nome.localeCompare(b.nome));
  }, [catalogs.modalidades]);

  // ==========================================
  // 0. MOTOR DE AUDITORIA FINANCEIRA (O X-9)
  // ==========================================
  const registrarLogAuditoria = async (tipoAcao, descricao, itemAula, detalhes = "") => {
      try {
          const nomeUsuario = userData?.nome || userData?.email || 'Administrador';
          let nomeUnidade = itemAula.unidade?.nome || '-';
          let nomeProf = itemAula.professor?.nome || itemAula.professorTitular?.nome || '-';
          let nomeMod = itemAula.modalidade?.nome || '-';

          await addDoc(collection(db, 'auditoria_cronograma'), {
              tipoAcao, descricao, diffExtras: detalhes, modulo: 'VALIDACAO', 
              unidadeNome: nomeUnidade, professorNome: nomeProf, modalidadeNome: nomeMod, 
              dias: [itemAula.diaSemana || ''], hora: itemAula.aulaBase?.hora || '',
              usuarioAcaoNome: nomeUsuario, usuarioAcaoId: userId, dataAcao: serverTimestamp()
          });
      } catch (e) { console.error("Erro ao gerar log de auditoria", e); }
  };

  // ==========================================
  // 2. MOTOR DE TEMPO REAL BLINDADO E OTIMIZADO
  // ==========================================
  useEffect(() => {
    if (loadingCatalogs || (catalogs.unidades.length === 0 && role !== 'admin')) return; 

    if (isCofreFechado) {
        setValidacoesRealtime([]);
        setLoading(false);
        return;
    }

    setLoading(true);

    let dataInicio, dataFim;
    if (modoFiltro === 'dia') {
      dataInicio = dataFiltro; dataFim = dataFiltro;
    } else {
      const [ano, mes] = mesFiltro.split('-');
      const lastDay = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      dataInicio = `${ano}-${mes}-01`; dataFim = `${ano}-${mes}-${lastDay}`;
    }

    let qValidacoes;
    if (role === 'unidade') {
        qValidacoes = query(collection(db, 'validacoes'), where('data', '>=', dataInicio), where('data', '<=', dataFim), where('unidadeId', '==', userUnidadeId));
    } else if (role === 'professor') {
        const meuPerfil = catalogs.professores.find(p => p.uidLogin === userId);
        const meuProfId = meuPerfil ? meuPerfil.id : 'xyz';
        qValidacoes = query(collection(db, 'validacoes'), where('data', '>=', dataInicio), where('data', '<=', dataFim), where('professorId', '==', meuProfId));
    } else {
        qValidacoes = query(collection(db, 'validacoes'), where('data', '>=', dataInicio), where('data', '<=', dataFim));
    }

    const unsubValidacoes = onSnapshot(qValidacoes, (snap) => {
        setValidacoesRealtime(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false); 
    });

    return () => unsubValidacoes();
  }, [modoFiltro, dataFiltro, mesFiltro, catalogs.unidades.length, catalogs.professores, role, userId, userUnidadeId, isCofreFechado, loadingCatalogs]);

  // ==========================================
  // 3. PROCESSADOR DE GRADE VISUAL
  // ==========================================
  useEffect(() => {
    if (loading || loadingCatalogs || catalogs.unidades.length === 0 || isCofreFechado) return;

    let datasParaVerificar = [];
    if (modoFiltro === 'dia') datasParaVerificar = [new Date(dataFiltro + 'T12:00:00')]; 
    else {
      const [ano, mes] = mesFiltro.split('-');
      datasParaVerificar = getMonthDates(parseInt(ano), parseInt(mes) - 1);
    }

    let meuProfessorId = null;
    if (role === 'professor') {
        const meuPerfil = catalogs.professores.find(p => p.uidLogin === userId);
        if (meuPerfil) meuProfessorId = meuPerfil.id;
    }

    const checkIsFeriado = (dateString) => {
        const targetDate = new Date(dateString + 'T00:00:00');
        return catalogs.feriados.some(f => {
            if (f.data === dateString) return true;
            if (f.dataInicio && f.dataFim) {
                const inicio = new Date(f.dataInicio + 'T00:00:00');
                const fim = new Date(f.dataFim + 'T00:00:00');
                return targetDate >= inicio && targetDate <= fim;
            }
            return false;
        });
    };

    let gradeFinal = [];

    datasParaVerificar.forEach(dataObj => {
      const dataString = dataObj.toISOString().split('T')[0];
      const diaSemanaNome = diasSemanaMap[dataObj.getDay()];
      const isFeriadoGlobal = checkIsFeriado(dataString);

      const aulasDoDia = catalogs.aulas.filter(aula => aula.dias && aula.dias.includes(diaSemanaNome));

      aulasDoDia.forEach(aula => {
        if (aula.dataInicio && dataString < aula.dataInicio) return; 
        if (aula.dataFim && dataString > aula.dataFim) return;

        const unidadeValida = catalogs.unidades.find(u => String(u.id) === String(aula.unidadeId));
        if (!unidadeValida) return; 

        // 🟢 A CASCATA PROTEGENDO O LAÇO DE REPETIÇÃO
        if (filtroUnidade.length > 0 && !filtroUnidade.includes(String(aula.unidadeId))) return;
        if (role === 'admin' || role === 'mentor') {
            if (filtroEstado.length > 0 && !filtroEstado.includes(unidadeValida.estado)) return;
            if (filtroMentor.length > 0 && !filtroMentor.includes(unidadeValida.mentorId)) return;
        }
        if (filtroModalidade.length > 0 && !filtroModalidade.includes(String(aula.modalidadeId))) return;
        if (role === 'professor' && String(aula.professorId) !== String(meuProfessorId)) return;

        const validacao = validacoesRealtime.find(v => String(v.aulaId) === String(aula.id) && v.data === dataString);
        
        const profDoCatalogo = catalogs.professores.find(p => String(p.id) === String(aula.professorId));
        const modDoCatalogo = catalogs.modalidades.find(m => String(m.id) === String(aula.modalidadeId));

        let professorExibicao = profDoCatalogo ? { ...profDoCatalogo } : { nome: "Professor Excluído" }; 
        let modalidadeExibicao = modDoCatalogo ? { ...modDoCatalogo } : { nome: "Modalidade Excluída" };

        if (validacao) {
            if (validacao.professorNomeEfetivo) professorExibicao.nome = validacao.professorNomeEfetivo;
            if (validacao.modalidadeNomeEfetiva) modalidadeExibicao.nome = validacao.modalidadeNomeEfetiva;
            if (validacao.substituicao && validacao.professorId) {
                const profSub = catalogs.professores.find(p => String(p.id) === String(validacao.professorId));
                if (profSub) {
                    professorExibicao = { ...profSub, isSubstituto: true };
                    if (validacao.professorNomeEfetivo) professorExibicao.nome = validacao.professorNomeEfetivo;
                } else professorExibicao.isSubstituto = true;
            }
        }

        if (filtroProfessor && professorExibicao?.nome) {
            const termo = filtroProfessor.toLowerCase();
            if (!professorExibicao.nome.toLowerCase().includes(termo)) return;
        }

        let status = 'pendente';
        let dadosValidacao = validacao;

        if (validacao) {
            status = validacao.status;
        } else if (isFeriadoGlobal) {
            status = 'cancelada';
            dadosValidacao = { motivoCancelamento: 'Recesso/Feriado', status: 'cancelada' };
        }

        gradeFinal.push({
          key: `${aula.id}-${dataString}`,
          data: dataString, diaSemana: diaSemanaNome, aulaBase: aula,
          professor: professorExibicao, professorTitular: profDoCatalogo,
          unidade: unidadeValida, modalidade: modalidadeExibicao,
          validacao: dadosValidacao || null, status: status
        });
      });

      const auloesDoDia = validacoesRealtime.filter(v => v.isAulao && v.data === dataString);
      auloesDoDia.forEach(v => {
         const unidadeValida = catalogs.unidades.find(u => String(u.id) === String(v.unidadeId));
         if (!unidadeValida) return;
         
         if (filtroUnidade.length > 0 && !filtroUnidade.includes(String(v.unidadeId))) return;
         if (role === 'admin' || role === 'mentor') {
            if (filtroEstado.length > 0 && !filtroEstado.includes(unidadeValida.estado)) return;
            if (filtroMentor.length > 0 && !filtroMentor.includes(unidadeValida.mentorId)) return;
         }
         if (filtroModalidade.length > 0 && !filtroModalidade.includes(String(v.modalidadeId))) return;

         let profAulao = { nome: v.professorNomeEfetivo || "Professor Desconhecido" };
         let modAulao = { nome: v.modalidadeNomeEfetiva || "Modalidade Desconhecida" };

         if (filtroProfessor && profAulao.nome) {
            const termo = filtroProfessor.toLowerCase();
            if (!profAulao.nome.toLowerCase().includes(termo)) return;
         }

         gradeFinal.push({
             key: `aulao-${v.id}`, data: dataString, diaSemana: diaSemanaNome,
             aulaBase: { id: v.id, hora: v.hora || "00:00", unidadeId: v.unidadeId, modalidadeId: v.modalidadeId, professorId: v.professorId },
             professor: profAulao, professorTitular: profAulao, unidade: unidadeValida, modalidade: modAulao,
             validacao: v, status: v.status, isAulao: true
         });
      });
    });

    gradeFinal.sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      return a.aulaBase.hora.localeCompare(b.aulaBase.hora);
    });

    setGradeGerada(gradeFinal);

  }, [validacoesRealtime, loading, loadingCatalogs, catalogs, filtroUnidade, filtroModalidade, filtroProfessor, filtroEstado, filtroMentor, dataFiltro, mesFiltro, modoFiltro, role, userId, isCofreFechado]);

  // CONTADORES E PAGINAÇÃO
  const counts = useMemo(() => {
      const hoje = getTodayStr();
      return {
          total: gradeGerada.length,
          pendentes: gradeGerada.filter(i => i.status === 'pendente' && i.data <= hoje).length,
          canceladas: gradeGerada.filter(i => i.status === 'cancelada').length
      };
  }, [gradeGerada]);

  const listaFiltradaTotal = useMemo(() => {
      const hoje = getTodayStr();
      if (filtroStatus === 'pendente') return gradeGerada.filter(item => item.status === 'pendente' && item.data <= hoje);
      if (filtroStatus === 'cancelada') return gradeGerada.filter(item => item.status === 'cancelada');
      return gradeGerada;
  }, [gradeGerada, filtroStatus]);

  const listaExibicao = useMemo(() => listaFiltradaTotal.slice(0, itensVisiveis), [listaFiltradaTotal, itensVisiveis]);

  const handleCarregarMais = (qtd) => {
      if (qtd === 'todos') setItensVisiveis(listaFiltradaTotal.length);
      else setItensVisiveis(prev => prev + qtd);
  };

  const verificarFuturo = (dataString) => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    return new Date(dataString + 'T00:00:00') > hoje;
  };

  const abrirModal = (tipo, item) => {
    if (tipo !== 'aulao' && verificarFuturo(item.data)) return alert("Aulas futuras não podem ser validadas.");
    if (item && item.status === 'cancelada' && !isMaster) {
        if (item.validacao?.motivoCancelamento === 'Recesso/Feriado') return alert("ℹ️ INFORMAÇÃO\n\nEsta aula foi cancelada automaticamente devido ao Recesso/Feriado cadastrado no sistema.");
        return alert("⛔ AÇÃO BLOQUEADA\n\nEsta aula foi cancelada. Apenas a Mentoria ou a Administração podem reverter este status.");
    }
    setAcaoAtual({ tipo, item }); setModalOpen(true);
  };

  const handleReverterCancelamento = async () => {
      if (!acaoAtual.item.validacao?.id && acaoAtual.item.validacao?.motivoCancelamento === 'Recesso/Feriado') return alert("Esta aula é Feriado Automático. Para acontecer, clique em 'Voltar' e 'Validar'.");
      if (!acaoAtual || !acaoAtual.item.validacao?.id) return;
      if (!window.confirm("Tem certeza que deseja reverter este cancelamento manual?")) return;

      setProcessando(true);
      try {
          await deleteDoc(doc(db, 'validacoes', acaoAtual.item.validacao.id));
          await registrarLogAuditoria('EXCLUÍDA', `Cancelamento revertido.`, acaoAtual.item, `Cancelamento por motivo de "${acaoAtual.item.validacao?.motivoCancelamento}" desfeito.`);
      } catch (error) { alert("Erro ao reverter cancelamento."); } 
      finally { setProcessando(false); setModalOpen(false); }
  };

  const handleNovoAulao = () => {
      if (filtroUnidade.length !== 1) return alert("Selecione exatamente UMA Unidade no filtro para adicionar um Aulão.");
      const unidadeObj = catalogs.unidades.find(u => String(u.id) === String(filtroUnidade[0]));
      abrirModal('aulao', { unidade: unidadeObj, data: dataFiltro });
  };

  const confirmarAcao = async (dadosFormulario) => {
    const { inputValor, inputObs, isSubstituicao, substitutoId, motivoSubstituicao, aulaoModalidadeId, aulaoHora, aulaoValor, aulaoData, professorNomeEfetivo, modalidadeNomeEfetiva, valorEfetivo } = dadosFormulario;
    
    if (acaoAtual.tipo === 'validar' && !inputValor) return alert("Informe o número de alunos.");
    if (acaoAtual.tipo === 'aulao' && (!aulaoModalidadeId || !inputValor || !substitutoId || !aulaoData)) return alert("Preencha todos os campos do Aulão.");

    setProcessando(true);
    try {
      const { tipo, item } = acaoAtual;
      const payload = {
        data: tipo === 'aulao' ? aulaoData : item.data, 
        validadoPor: userId,
        timestamp: serverTimestamp(), 
        professorNomeEfetivo: professorNomeEfetivo || "",
        modalidadeNomeEfetiva: modalidadeNomeEfetiva || "",
        valorEfetivo: valorEfetivo || 0
      };

      if (tipo === 'aulao') {
          payload.status = 'realizada'; payload.isAulao = true; payload.unidadeId = item.unidade.id;
          payload.professorId = substitutoId; payload.modalidadeId = aulaoModalidadeId;
          payload.hora = aulaoHora; payload.alunos = parseInt(inputValor);
          payload.valorPago = aulaoValor ? parseFloat(aulaoValor) : 0; payload.substituicao = false; 
          
          await addDoc(collection(db, 'validacoes'), payload);
          await registrarLogAuditoria('NOVA', `Aulão Especial registrado.`, { unidade: item.unidade, professor: {nome: professorNomeEfetivo}, modalidade: {nome: modalidadeNomeEfetiva}, aulaBase: {hora: aulaoHora}, diaSemana: aulaoData }, `Qtd Alunos: ${inputValor} | Valor: R$ ${aulaoValor}`);
      } else {
          payload.aulaId = item.aulaBase.id; payload.unidadeId = item.aulaBase.unidadeId;
          payload.professorId = (tipo === 'validar' && isSubstituicao) ? substitutoId : item.aulaBase.professorId;
          payload.status = tipo === 'validar' ? 'realizada' : 'cancelada';

          let diffLog = [];
          if (tipo === 'validar') {
            payload.alunos = parseInt(inputValor); diffLog.push(`Alunos: ${inputValor}`);
            if (isSubstituicao) {
                payload.substituicao = true; payload.professorOriginalId = item.aulaBase.professorId; payload.motivoSubstituicao = motivoSubstituicao;
                diffLog.push(`Substituição: ${item.professorTitular?.nome} ➔ ${professorNomeEfetivo}`);
            } else {
                payload.substituicao = false; payload.professorOriginalId = null; payload.motivoSubstituicao = null;
            }
          } else {
            payload.motivoCancelamento = inputValor === 'Outros' ? inputObs : inputValor; payload.substituicao = false;
            diffLog.push(`Cancelamento: ${payload.motivoCancelamento}`);
          }

          if (item.validacao?.id) {
            if (tipo === 'validar' && item.validacao.alunos !== payload.alunos) diffLog.push(`Edição Alunos: de ${item.validacao.alunos} para ${payload.alunos}`);
            await updateDoc(doc(db, 'validacoes', item.validacao.id), payload);
            await registrarLogAuditoria('ALTERADA', tipo === 'validar' ? `Validação editada.` : `Cancelamento editado.`, item, diffLog.join(' | '));
          } else {
            await addDoc(collection(db, 'validacoes'), payload);
            await registrarLogAuditoria('NOVA', tipo === 'validar' ? `Aula validada.` : `Aula cancelada.`, item, diffLog.join(' | '));
          }
      }
    } catch (error) { alert("Erro ao salvar no banco de dados."); } 
    finally { setProcessando(false); setModalOpen(false); setAcaoAtual(null); }
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in max-w-[1920px] mx-auto space-y-6">
      <div className="flex flex-col gap-6 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                    <span className="bg-gradient-to-tr from-emerald-500 to-green-600 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-500/20">
                    <CircleCheck className="w-6 h-6 md:w-7 md:h-7" />
                    </span>
                    Validação Diária
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-sm md:text-base">Gestão operacional e controle de frequência.</p>
            </div>

            <div className="flex gap-4">
                <div className="w-full md:w-auto grid grid-cols-3 gap-3">
                    <button onClick={() => { setFiltroStatus('todos'); setItensVisiveis(12); }} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md ${filtroStatus === 'todos' ? 'bg-slate-800 text-white border-slate-900 ring-2 ring-slate-800 ring-offset-2' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        <span className="text-2xl font-black">{counts.total}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1"><List className="w-3 h-3"/> Todos</span>
                    </button>
                    <button onClick={() => { setFiltroStatus('pendente'); setItensVisiveis(12); }} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md ${filtroStatus === 'pendente' ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-500 ring-offset-2' : 'bg-white border-amber-100 text-amber-500 hover:bg-amber-50'}`}>
                        <span className="text-2xl font-black">{counts.pendentes}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1"><TriangleAlert className="w-3 h-3"/> Pendentes</span>
                    </button>
                    <button onClick={() => { setFiltroStatus('cancelada'); setItensVisiveis(12); }} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md ${filtroStatus === 'cancelada' ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-600 ring-offset-2' : 'bg-white border-rose-100 text-rose-500 hover:bg-rose-50'}`}>
                        <span className="text-2xl font-black">{counts.canceladas}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1"><CircleX className="w-3 h-3"/> Canceladas</span>
                    </button>
                </div>

                {role !== 'professor' && (
                    <button onClick={handleNovoAulao} className="hidden md:flex flex-col items-center justify-center p-3 rounded-2xl border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-all shadow-sm hover:shadow-md min-w-[100px]">
                        <Star className="w-6 h-6 mb-1" />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-center leading-tight">Adicionar<br/>Aulão</span>
                    </button>
                )}
            </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm w-full">
            <div className="flex flex-wrap gap-2 items-center">
                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1 h-10 shrink-0">
                    <button onClick={() => setModoFiltro('dia')} className={`px-3 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${modoFiltro === 'dia' ? 'bg-white dark:bg-slate-600 shadow text-emerald-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>Dia</button>
                    <button onClick={() => setModoFiltro('mes')} className={`px-3 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${modoFiltro === 'mes' ? 'bg-white dark:bg-slate-600 shadow text-emerald-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>Mês</button>
                </div>
                <div className="relative h-10 w-[140px] shrink-0">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-emerald-500"/>
                    {modoFiltro === 'dia' ? (
                    <input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} className="w-full h-full pl-9 pr-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none uppercase" />
                    ) : (
                    <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="w-full h-full pl-9 pr-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none uppercase" />
                    )}
                </div>

                {role === 'admin' && (
                    <>
                        <FilterMultiSelect options={estadosOptions} selected={filtroEstado} onChange={handleEstadoChange} placeholder="ESTADOS" icon={MapIcon} />
                        <FilterMultiSelect options={mentoresOptions} selected={filtroMentor} onChange={handleMentorChange} placeholder="MENTORES" icon={UserCog} searchable={true} />
                    </>
                )}
                
                {role !== 'unidade' && (
                    <FilterMultiSelect options={unidadesFiltradasSelect} selected={filtroUnidade} onChange={setFiltroUnidade} placeholder="UNIDADES" icon={MapPin} searchable={true} />
                )}

                <FilterMultiSelect options={modalidadesOptions} selected={filtroModalidade} onChange={setFiltroModalidade} placeholder="MODALIDADES" icon={Filter} searchable={true} />

                {(role === 'admin' || role === 'mentor') && (
                    <div className="relative h-10 flex-1 min-w-[160px] max-w-[200px]">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                        <input type="text" placeholder="PROFESSOR..." value={filtroProfessor} onChange={e => setFiltroProfessor(e.target.value)} className="w-full h-full pl-9 pr-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none uppercase placeholder:normal-case" />
                    </div>
                )}

                {role !== 'professor' && (
                    <button onClick={handleNovoAulao} className="md:hidden w-full h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase shadow-md flex justify-center items-center gap-2 transition-all mt-2">
                        <Star className="w-4 h-4" /> Adicionar Aulão Especial
                    </button>
                )}
            </div>
        </div>
      </div>

      {isCofreFechado ? (
          <div className="py-24 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm animate-fade-in">
            <div className="bg-slate-50 dark:bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800 shadow-inner">
              <MapPin className="w-8 h-8 text-emerald-500 animate-bounce"/>
            </div>
            <h3 className="text-xl font-black text-slate-700 dark:text-white mb-2 uppercase">
                {role === 'admin' ? "Nenhum Filtro Selecionado" : "Nenhuma Unidade Selecionada"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest max-w-md mx-auto">
                {role === 'admin' ? "Selecione um Estado, Mentor ou Unidade para carregar a grade de aulas." : "No filtro acima, marque uma ou mais unidades para carregar a grade de aulas correspondente."}
            </p>
          </div>
      ) : (loading || loadingCatalogs) ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-2 text-emerald-500"/>
          <p className="text-xs font-bold uppercase tracking-widest">Carregando dados ao vivo...</p>
        </div>
      ) : listaFiltradaTotal.length === 0 ? (
        <div className="py-24 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 animate-fade-in">
          <div className="bg-slate-50 dark:bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard className="w-8 h-8 text-slate-300"/>
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-white uppercase tracking-tight">
              {filtroStatus === 'pendente' ? "Tudo Validado!" : filtroStatus === 'cancelada' ? "Nenhum cancelamento" : "Nenhuma aula encontrada"}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">
              {filtroStatus === 'pendente' ? "Parabéns, não há pendências nesta data." : "Tente ajustar os filtros ou a data selecionada."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
            {listaExibicao.map((item) => (
                <AulaCard 
                    key={item.key} item={item} 
                    onValidar={(i) => abrirModal('validar', i)}
                    onCancelar={(i) => abrirModal('cancelar', i)}
                    verificarFuturo={verificarFuturo}
                />
            ))}
            </div>

            {itensVisiveis < listaFiltradaTotal.length && (
                <div className="flex flex-wrap justify-center gap-3 pt-6 pb-4 animate-fade-in">
                    <button onClick={() => handleCarregarMais(12)} className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm flex items-center gap-2 transition-all"><ArrowDown className="w-4 h-4"/> Carregar +12</button>
                    <button onClick={() => handleCarregarMais('todos')} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-xl text-xs font-black uppercase text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 shadow-sm flex items-center gap-2 transition-all"><DownloadCloud className="w-4 h-4"/> Ver Todos</button>
                </div>
            )}
        </div>
      )}

      <ValidationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onConfirm={confirmarAcao} onRevert={handleReverterCancelamento} acaoAtual={acaoAtual} catalogs={catalogs} processando={processando} isMaster={isMaster} />
    </div>
  );
}