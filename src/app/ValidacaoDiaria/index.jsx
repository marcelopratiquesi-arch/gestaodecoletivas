import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCatalogs } from '../../contexts/CatalogContext'; 
import { db } from '../../services/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, setDoc 
} from 'firebase/firestore';
import { 
  Calendar, CircleCheck, CircleX, TriangleAlert, 
  MapPin, Filter, Search, List, ArrowDown, DownloadCloud, Loader2, LayoutDashboard, UserCog,
  Map as MapIcon, Star, CheckSquare, Square, ChevronDown, Layers, ChevronsUpDown, ChevronsDownUp
} from 'lucide-react';

import { AulaCard } from './AulaCard';
import { PilhaAulas } from './PilhaAulas';
import { ListaAulas } from './ListaAulas';
import { ValidationModal } from './ValidationModal';
import { useLocation } from 'react-router-dom';
import { getDiaSemana, formatCurrency, formatPeriod } from '../../utils/formatters';
import {
  idValidacao, deduplicarValidacoes, regraDePrazo, hojeLocal, mesLocal, dataLocal,
  alunosValidos, LIMITE_ALUNOS, MIN_JUSTIFICATIVA, DIAS_RETROATIVOS_LIDER, pendenciasDoProfessor
} from '../../utils/validacoes';
import { feriadoNoDia } from '../../utils/feriados';
import { aulaNaGradeDoDia, datasEntre } from '../../utils/agendaAulas';
import { invalidarCacheInicio } from '../../services/cacheInicio';
import { useValidacoesDoProfessor, meuProfessorId } from '../../hooks/useValidacoesDoProfessor';
import { useMediaAlunos, numeroEstranho } from '../../hooks/useMediaAlunos';
import { useTranslation } from 'react-i18next';
import { ehLider, unidadesDoLider } from '../../permissions';

// --- HELPERS ---
const getTodayStr = hojeLocal;

const getMonthDates = (year, month) => {
  const date = new Date(year, month, 1);
  const dates = [];
  while (date.getMonth() === month) {
    dates.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
};

const getFirstLast = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1]}`;
};

// ============================================================================
// COMPONENTE: MULTI-SELECT COMPACTO (ESPECIAL PARA A BARRA DE FILTROS)
// ============================================================================
const FilterMultiSelect = ({ options, selected, onChange, placeholder, icon: Icon, searchable = false }) => {
    const { t } = useTranslation();
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
                    {selected.length === 0 ? <span className="font-bold">{placeholder}</span> : selected.length === options.length && options.length > 0 ? <span className="text-emerald-600 dark:text-emerald-400 font-black">{t('common.multiSelect.all')}</span> : <span className="text-emerald-600 dark:text-emerald-400 font-black">{t('common.multiSelect.selected', { count: selected.length })}</span>}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full min-w-[220px] mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 flex flex-col overflow-hidden">
                    {searchable && (
                        <div className="p-2 border-b border-slate-100 dark:border-slate-700 shrink-0 bg-slate-50 dark:bg-slate-900/50">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                                <input type="text" placeholder={t('common.multiSelect.search')} className="w-full pl-8 pr-2 py-1.5 text-[10px] font-bold uppercase bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:border-emerald-500 dark:text-white" value={searchTxt} onChange={(e) => setSearchTxt(e.target.value)} onClick={(e) => e.stopPropagation()} />
                            </div>
                        </div>
                    )}
                    <div className="p-1.5 sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 z-10 shrink-0">
                        <button type="button" onClick={toggleAll} className="w-full text-left px-2 py-1.5 text-[10px] font-black text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md flex items-center gap-1.5 transition-colors uppercase">
                            {isAllFilteredSelected ? <CheckSquare className="w-3.5 h-3.5"/> : <Square className="w-3.5 h-3.5"/>} {t('common.multiSelect.selectAll')}
                        </button>
                    </div>
                    <div className="p-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="text-center text-[10px] font-bold text-slate-400 py-3 uppercase">{t('common.multiSelect.noResults')}</div>
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
  const { t } = useTranslation();
  
  // 🟢 ACESSANDO A MEMÓRIA GLOBAL DO SISTEMA
  const { catalogs: globalCatalogs, loadingCatalogs } = useCatalogs();

  // --- PERMISSÕES ---
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);
  // Líder pode comandar mais de uma unidade: lista em texto ("id1,id2") para servir de dependência estável.
  const unidadesLiderKey = useMemo(() => unidadesDoLider(userData).join(","), [userData]);
  const liderDeVarias = ehLider(role) && unidadesLiderKey.includes(",");
  const isMaster = useMemo(() => ['admin', 'mentor'].includes(role), [role]);

  // Vindo do "Resolver agora" da Página de Início: abre já no período das pendências, nas unidades
  // que têm pendência, mostrando só as pendentes. { inicio, fim, unidadeIds }
  const location = useLocation();
  const pedidoDoInicio = location.state?.pendencias || null;

  // --- FILTROS MULTI-SELECT ---
  // modoFiltro: 'dia' | 'mes' | 'periodo' (o período só existe quando vem da Página de Início)
  const [modoFiltro, setModoFiltro] = useState(pedidoDoInicio ? 'periodo' : 'dia');
  const [dataFiltro, setDataFiltro] = useState(getTodayStr());
  // Mês no fuso do aparelho (o toISOString virava o mês às 21h do último dia).
  const [mesFiltro, setMesFiltro] = useState(mesLocal());
  const [periodoFiltro] = useState(() => pedidoDoInicio
    ? { inicio: pedidoDoInicio.inicio, fim: pedidoDoInicio.fim || getTodayStr() }
    : { inicio: getTodayStr(), fim: getTodayStr() });

  const [filtroEstado, setFiltroEstado] = useState([]);
  const [filtroMentor, setFiltroMentor] = useState([]);
  const [filtroUnidade, setFiltroUnidade] = useState(() => (pedidoDoInicio?.unidadeIds || []).map(String));
  const [filtroModalidade, setFiltroModalidade] = useState([]);

  const [filtroProfessor, setFiltroProfessor] = useState("");
  const [filtroStatus, setFiltroStatus] = useState(pedidoDoInicio ? 'pendente' : 'todos');

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
    } else if (ehLider(role)) {
      const minhas = new Set(unidadesLiderKey.split(","));
      unitsData = unitsData.filter(u => minhas.has(String(u.id)));
    } else if (role === 'professor') {
      const meuId = meuProfessorId(userData, globalCatalogs.professores);
      if (meuId) {
         const meusLinks = globalCatalogs.vinculos.filter(l => String(l.professorId) === String(meuId));
         const minhasUnidadesIds = meusLinks.map(l => String(l.unidadeId));
         unitsData = unitsData.filter(u => minhasUnidadesIds.includes(String(u.id)));
      } else {
         unitsData = [];
      }
    }

    return { ...globalCatalogs, unidades: unitsData };
  }, [globalCatalogs, loadingCatalogs, role, userId, unidadesLiderKey, userData]);

  // --- PERÍODO NA TELA E VALIDAÇÕES DO PROFESSOR ---
  const periodo = useMemo(() => {
    if (modoFiltro === 'dia') return { inicio: dataFiltro, fim: dataFiltro };
    if (modoFiltro === 'periodo') return { inicio: periodoFiltro.inicio, fim: periodoFiltro.fim };
    const [ano, mes] = mesFiltro.split('-');
    const lastDay = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    return { inicio: `${ano}-${mes}-01`, fim: `${ano}-${mes}-${String(lastDay).padStart(2, '0')}` };
  }, [modoFiltro, dataFiltro, mesFiltro, periodoFiltro]);

  const isProfessor = role === 'professor';
  const meuProfId = useMemo(
    () => (isProfessor ? meuProfessorId(userData, catalogs.professores) : null),
    [isProfessor, userData, catalogs.professores]
  );

  // O professor sempre carrega o mês atual inteiro (para o aviso de pendências), mais o período escolhido.
  const inicioMesAtual = `${mesLocal()}-01`;
  const hoje = hojeLocal();
  const faixaProfessor = {
    inicio: periodo.inicio < inicioMesAtual ? periodo.inicio : inicioMesAtual,
    fim: periodo.fim > hoje ? periodo.fim : hoje,
  };
  const { validacoes: validacoesProfessor, carregando: carregandoProfessor } =
    useValidacoesDoProfessor(meuProfId, faixaProfessor.inicio, faixaProfessor.fim);

  const validacoesDaTela = isProfessor ? validacoesProfessor : validacoesRealtime;
  const carregandoValidacoes = isProfessor ? carregandoProfessor : loading;

  const pendentesDoMes = useMemo(() => {
    if (!isProfessor || loadingCatalogs || carregandoProfessor) return [];
    return pendenciasDoProfessor({
      aulas: catalogs.aulas, unidades: catalogs.unidades, feriados: catalogs.feriados,
      validacoes: validacoesProfessor, professorId: meuProfId, getDiaSemana, feriadoNoDia,
    });
  }, [isProfessor, loadingCatalogs, carregandoProfessor, catalogs, validacoesProfessor, meuProfId]);

  const verPendentesDoMes = () => {
      setModoFiltro('mes'); setMesFiltro(mesLocal()); setFiltroStatus('pendente'); setItensVisiveis(12);
  };

  // Se for unidade, auto-seleciona
  useEffect(() => {
      if (ehLider(role) && unidadesLiderKey && !unidadesLiderKey.includes(",")) {
          setFiltroUnidade([unidadesLiderKey]);
      }
  }, [role, unidadesLiderKey]);

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

  // Admin vê todas as modalidades; os demais, só as que existem nas aulas que eles enxergam
  // (o professor, só as das aulas dele).
  const modalidadesOptions = useMemo(() => {
      let modalidades = catalogs.modalidades || [];
      if (role !== 'admin') {
          const unidadesVisiveis = new Set(catalogs.unidades.map(u => String(u.id)));
          const idsUsados = new Set((catalogs.aulas || [])
              .filter(a => unidadesVisiveis.has(String(a.unidadeId)))
              .filter(a => !isProfessor || String(a.professorId) === String(meuProfId))
              .map(a => String(a.modalidadeId)));
          modalidades = modalidades.filter(m => idsUsados.has(String(m.id)));
      }
      return modalidades.map(m => ({ id: m.id, nome: String(m.nome || '').toUpperCase() })).sort((a,b) => a.nome.localeCompare(b.nome));
  }, [catalogs.modalidades, catalogs.unidades, catalogs.aulas, role, isProfessor, meuProfId]);

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
    // Professor: as validações vêm do useValidacoesDoProfessor (as dele + as das aulas dele substituídas).
    if (role === 'professor') return;
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
    } else if (modoFiltro === 'periodo') {
      dataInicio = periodoFiltro.inicio; dataFim = periodoFiltro.fim;
    } else {
      const [ano, mes] = mesFiltro.split('-');
      const lastDay = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      dataInicio = `${ano}-${mes}-01`; dataFim = `${ano}-${mes}-${lastDay}`;
    }

    const ref = collection(db, 'validacoes');
    const periodo = [where('data', '>=', dataInicio), where('data', '<=', dataFim)];

    // Cada consulta escuta o banco ao vivo; a lista final junta todas (sem repetir) e tira duplicatas antigas.
    // (O professor não passa por aqui: as validações dele vêm do useValidacoesDoProfessor.)
    const consultas = [];
    if (ehLider(role)) {
        // Só as unidades dele (as escolhidas no filtro, se ele tiver mais de uma).
        const minhas = unidadesLiderKey.split(",").filter(Boolean);
        const escolhidas = filtroUnidade.filter(id => minhas.includes(String(id)));
        const alvo = (escolhidas.length > 0 ? escolhidas : minhas).slice(0, 30);
        if (alvo.length > 0) consultas.push({ q: query(ref, ...periodo, where('unidadeId', 'in', alvo)) });
    } else if (filtroUnidade.length > 0 && filtroUnidade.length <= 30) {
        // Admin/mentor com unidades escolhidas: busca só essas unidades, e não a rede inteira (poupa a cota gratuita).
        consultas.push({ q: query(ref, ...periodo, where('unidadeId', 'in', filtroUnidade)) });
    } else {
        consultas.push({ q: query(ref, ...periodo) });
    }

    const resultados = consultas.map(() => null);
    const atualizar = () => {
        if (resultados.some(r => r === null)) return; // espera todas responderem
        const porId = new Map();
        resultados.flat().forEach(v => porId.set(v.id, v));
        setValidacoesRealtime(deduplicarValidacoes([...porId.values()]));
        setLoading(false);
    };

    const cancelar = consultas.map(({ q, filtro }, i) => onSnapshot(q, (snap) => {
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        resultados[i] = filtro ? lista.filter(filtro) : lista;
        atualizar();
    }, (error) => {
        console.error('Erro ao escutar validações:', error);
        resultados[i] = [];
        atualizar();
    }));

    return () => cancelar.forEach(unsub => unsub());
    // filtroUnidade entra como texto para não reabrir a escuta quando só a referência da lista muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoFiltro, dataFiltro, mesFiltro, periodoFiltro, filtroUnidade.join(','), catalogs.unidades.length, catalogs.professores, role, userId, unidadesLiderKey, isCofreFechado, loadingCatalogs]);

  // ==========================================
  // 3. PROCESSADOR DE GRADE VISUAL
  // ==========================================
  useEffect(() => {
    if (carregandoValidacoes || loadingCatalogs || catalogs.unidades.length === 0 || isCofreFechado) {
      if (isProfessor && !loadingCatalogs && catalogs.unidades.length === 0) setGradeGerada([]);
      return;
    }

    let datasParaVerificar = [];
    if (modoFiltro === 'dia') datasParaVerificar = [new Date(dataFiltro + 'T12:00:00')];
    else if (modoFiltro === 'periodo') datasParaVerificar = datasEntre(periodoFiltro.inicio, periodoFiltro.fim).map(d => new Date(d + 'T12:00:00'));
    else {
      const [ano, mes] = mesFiltro.split('-');
      datasParaVerificar = getMonthDates(parseInt(ano), parseInt(mes) - 1);
    }

    const meuProfessorId = meuProfId;

    let gradeFinal = [];

    datasParaVerificar.forEach(dataObj => {
      const dataString = dataLocal(dataObj);
      const diaSemanaNome = getDiaSemana(dataObj);

      // Regra única (src/utils/agendaAulas.js): dia da semana + vigência da aula. A Página de Início usa a mesma.
      const aulasDoDia = catalogs.aulas.filter(aula => aulaNaGradeDoDia(aula, dataString, diaSemanaNome));

      aulasDoDia.forEach(aula => {
        const unidadeValida = catalogs.unidades.find(u => String(u.id) === String(aula.unidadeId));
        if (!unidadeValida) return; 

        // 🟢 A CASCATA PROTEGENDO O LAÇO DE REPETIÇÃO
        if (filtroUnidade.length > 0 && !filtroUnidade.includes(String(aula.unidadeId))) return;
        if (role === 'admin' || role === 'mentor') {
            if (filtroEstado.length > 0 && !filtroEstado.includes(unidadeValida.estado)) return;
            if (filtroMentor.length > 0 && !filtroMentor.includes(unidadeValida.mentorId)) return;
        }
        if (filtroModalidade.length > 0 && !filtroModalidade.includes(String(aula.modalidadeId))) return;

        const validacao = validacoesDaTela.find(v => String(v.aulaId) === String(aula.id) && v.data === dataString);

        // Professor vê as aulas em que é titular e também as que ele deu como SUBSTITUTO
        // (essas só para consulta: quem valida/edita é o titular, a unidade ou o mentor).
        let somenteLeitura = false;
        if (role === 'professor') {
            const souTitular = String(aula.professorId) === String(meuProfessorId);
            const souSubstituto = !!validacao && String(validacao.professorId) === String(meuProfessorId);
            if (!souTitular && !souSubstituto) return;
            somenteLeitura = !souTitular;
        }
        
        const profDoCatalogo = catalogs.professores.find(p => String(p.id) === String(aula.professorId));
        const modDoCatalogo = catalogs.modalidades.find(m => String(m.id) === String(aula.modalidadeId));

        let professorExibicao = profDoCatalogo ? { ...profDoCatalogo } : { nome: t('common.unknown.deletedTeacher') }; 
        let modalidadeExibicao = modDoCatalogo ? { ...modDoCatalogo } : { nome: t('common.unknown.deletedModality') };

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
        } else if (feriadoNoDia(dataString, unidadeValida, catalogs.feriados)) {
            // Regra única de feriado (src/utils/feriados.js): só a unidade dentro da abrangência do feriado.
            status = 'cancelada';
            dadosValidacao = { motivoCancelamento: 'Recesso/Feriado', status: 'cancelada' };
        }

        gradeFinal.push({
          key: `${aula.id}-${dataString}`,
          data: dataString, diaSemana: diaSemanaNome, aulaBase: aula,
          professor: professorExibicao, professorTitular: profDoCatalogo,
          unidade: unidadeValida, modalidade: modalidadeExibicao,
          validacao: dadosValidacao || null, status: status,
          somenteLeitura, prazo: regraDePrazo(role, dataString)
        });
      });

      const auloesDoDia = validacoesDaTela.filter(v => v.isAulao && v.data === dataString);
      auloesDoDia.forEach(v => {
         const unidadeValida = catalogs.unidades.find(u => String(u.id) === String(v.unidadeId));
         if (!unidadeValida) return;
         
         if (filtroUnidade.length > 0 && !filtroUnidade.includes(String(v.unidadeId))) return;
         if (role === 'admin' || role === 'mentor') {
            if (filtroEstado.length > 0 && !filtroEstado.includes(unidadeValida.estado)) return;
            if (filtroMentor.length > 0 && !filtroMentor.includes(unidadeValida.mentorId)) return;
         }
         if (filtroModalidade.length > 0 && !filtroModalidade.includes(String(v.modalidadeId))) return;

         let profAulao = { nome: v.professorNomeEfetivo || t('common.unknown.teacher') };
         let modAulao = { nome: v.modalidadeNomeEfetiva || t('common.unknown.modality') };

         if (filtroProfessor && profAulao.nome) {
            const termo = filtroProfessor.toLowerCase();
            if (!profAulao.nome.toLowerCase().includes(termo)) return;
         }

         gradeFinal.push({
             key: `aulao-${v.id}`, data: dataString, diaSemana: diaSemanaNome,
             aulaBase: { id: v.id, hora: v.hora || "00:00", unidadeId: v.unidadeId, modalidadeId: v.modalidadeId, professorId: v.professorId },
             professor: profAulao, professorTitular: profAulao, unidade: unidadeValida, modalidade: modAulao,
             validacao: v, status: v.status, isAulao: true,
             // Aulão é lançado pela unidade/mentor; o professor só consulta.
             somenteLeitura: role === 'professor', prazo: regraDePrazo(role, dataString)
         });
      });
    });

    gradeFinal.sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      return a.aulaBase.hora.localeCompare(b.aulaBase.hora);
    });

    setGradeGerada(gradeFinal);

  }, [validacoesDaTela, carregandoValidacoes, loadingCatalogs, catalogs, filtroUnidade, filtroModalidade, filtroProfessor, filtroEstado, filtroMentor, dataFiltro, mesFiltro, modoFiltro, periodoFiltro, role, isProfessor, meuProfId, isCofreFechado, t]);

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

  // GRUPOS = mesmo horário fixo (unidade + horário + modalidade + professor titular).
  // Dentro do grupo a ordem é por data (a mais antiga primeiro); os grupos vão por horário.
  // A paginação ("carregar mais") conta GRUPOS, não aulas soltas.
  const grupos = useMemo(() => {
      const mapa = new Map();
      for (const item of listaFiltradaTotal) {
          const chave = item.isAulao
              ? `aulao|${item.key}`
              : [item.unidade?.id, item.aulaBase.hora, item.aulaBase.modalidadeId, item.aulaBase.professorId].join('|');
          if (!mapa.has(chave)) {
              mapa.set(chave, {
                  chave, hora: item.aulaBase.hora || '', isAulao: !!item.isAulao,
                  modalidade: item.modalidade?.nome || '', unidade: item.unidade?.nome || '',
                  professor: item.professorTitular?.nome || item.professor?.nome || '', itens: [],
              });
          }
          mapa.get(chave).itens.push(item);
      }
      return [...mapa.values()].sort((a, b) =>
          a.hora.localeCompare(b.hora) || a.modalidade.localeCompare(b.modalidade)
          || a.unidade.localeCompare(b.unidade) || a.professor.localeCompare(b.professor));
  }, [listaFiltradaTotal]);

  const gruposVisiveis = useMemo(() => grupos.slice(0, itensVisiveis), [grupos, itensVisiveis]);

  // Média de alunos (sugestão + alerta de número estranho): só para aulas na tela que ainda podem ser
  // validadas/editadas (pendentes ou realizadas, dentro do prazo, aula da grade).
  const podeTerMedia = (item) => !item.isAulao && !item.somenteLeitura && item.prazo?.pode && item.status !== 'cancelada';
  const mediaDe = useMediaAlunos(gruposVisiveis.flatMap(g => g.itens).filter(podeTerMedia).map(i => i.aulaBase.id));
  const gruposExibicao = gruposVisiveis.map(g => ({
      ...g,
      itens: g.itens.map(item => podeTerMedia(item) ? { ...item, mediaAlunos: mediaDe(item.aulaBase.id, item.data) } : item),
  }));

  const handleCarregarMais = (qtd) => {
      if (qtd === 'todos') setItensVisiveis(grupos.length);
      else setItensVisiveis(prev => prev + qtd);
  };

  // --- VISUALIZAÇÃO: PILHAS (padrão do professor) ou LISTA (padrão de líder/unidade, mentor e admin) ---
  // A escolha fica salva neste navegador (só conveniência; se não der para salvar, usa o padrão).
  const chaveVisualizacao = `validacao.visualizacao.${role || 'x'}`;
  const [visualizacao, setVisualizacaoState] = useState(() => {
      try {
          const salva = localStorage.getItem(chaveVisualizacao);
          if (salva === 'pilhas' || salva === 'lista') return salva;
      } catch { /* sem armazenamento: usa o padrão */ }
      return role === 'professor' ? 'pilhas' : 'lista';
  });
  const setVisualizacao = (v) => {
      setVisualizacaoState(v);
      try { localStorage.setItem(chaveVisualizacao, v); } catch { /* ignora */ }
  };

  const [pilhasAbertas, setPilhasAbertas] = useState(() => new Set());
  const alternarPilha = (chave) => setPilhasAbertas(prev => {
      const novo = new Set(prev);
      if (novo.has(chave)) novo.delete(chave); else novo.add(chave);
      return novo;
  });
  const temPilhaDeVerdade = gruposExibicao.some(g => g.itens.length > 1);
  const abrirTodasPilhas = () => setPilhasAbertas(new Set(gruposExibicao.map(g => g.chave)));
  const recolherTodasPilhas = () => setPilhasAbertas(new Set());
  const mostrarProfessorNoGrupo = !isProfessor;

  const verificarFuturo = (dataString) => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    return new Date(dataString + 'T00:00:00') > hoje;
  };

  // Mensagem de bloqueio por prazo (mesma regra do banco: src/utils/validacoes.js e firestore.rules).
  const mensagemPrazo = (motivo) => {
    if (motivo === 'futuro') return t('dailyValidation.alerts.futureClass');
    if (motivo === 'mesFechado') return t('dailyValidation.deadline.closedMonthTeacher');
    if (motivo === 'limiteDias') return t('dailyValidation.deadline.leaderLimit', { dias: DIAS_RETROATIVOS_LIDER });
    return t('dailyValidation.deadline.noPermission');
  };

  const abrirModal = (tipo, item) => {
    if (item?.somenteLeitura) return alert(t('dailyValidation.deadline.substituteReadOnly'));
    if (tipo !== 'aulao') {
        const prazo = regraDePrazo(role, item.data);
        if (!prazo.pode) return alert(mensagemPrazo(prazo.motivo));
    }
    if (item && item.status === 'cancelada' && !isMaster) {
        if (item.validacao?.motivoCancelamento === 'Recesso/Feriado') return alert(t('dailyValidation.alerts.holidayInfo'));
        return alert(t('dailyValidation.alerts.blockedCanceled'));
    }
    setAcaoAtual({ tipo, item }); setModalOpen(true);
  };

  const handleReverterCancelamento = async () => {
      if (!acaoAtual.item.validacao?.id && acaoAtual.item.validacao?.motivoCancelamento === 'Recesso/Feriado') return alert(t('dailyValidation.alerts.autoHolidayRevert'));
      if (!acaoAtual || !acaoAtual.item.validacao?.id) return;
      const prazo = regraDePrazo(role, acaoAtual.item.data);
      if (!prazo.pode) return alert(mensagemPrazo(prazo.motivo));
      let justificativa = '';
      if (prazo.precisaJustificativa) {
          justificativa = (window.prompt(t('dailyValidation.deadline.justificationPrompt', { min: MIN_JUSTIFICATIVA })) || '').trim();
          if (justificativa.length < MIN_JUSTIFICATIVA) return alert(t('dailyValidation.deadline.justificationRequired', { min: MIN_JUSTIFICATIVA }));
      } else if (!window.confirm(t('dailyValidation.alerts.confirmRevert'))) return;

      setProcessando(true);
      try {
          await deleteDoc(doc(db, 'validacoes', acaoAtual.item.validacao.id));
          await registrarLogAuditoria('EXCLUÍDA', `Cancelamento revertido.`, acaoAtual.item,
              `Cancelamento por motivo de "${acaoAtual.item.validacao?.motivoCancelamento}" desfeito.` + (justificativa ? ` | Justificativa (mês fechado): ${justificativa}` : ''));
      } catch (error) { alert(error?.code === 'permission-denied' ? t('dailyValidation.deadline.permissionDenied') : t('dailyValidation.alerts.revertError')); }
      finally { invalidarCacheInicio(); setProcessando(false); setModalOpen(false); }
  };

  // VALIDAR DIRETO NO CARTÃO: só o número de alunos, professor titular, sem abrir a janela.
  // Substituição, cancelamento e mês fechado (justificativa) continuam pela janela.
  const validarRapido = (item, alunos) => {
    if (item?.somenteLeitura) return alert(t('dailyValidation.deadline.substituteReadOnly'));
    const prazo = regraDePrazo(role, item.data);
    if (!prazo.pode) return alert(mensagemPrazo(prazo.motivo));
    if (prazo.precisaJustificativa) return abrirModal('validar', item);
    return confirmarAcao({
        inputValor: String(alunos ?? ''), inputObs: '', isSubstituicao: false, substitutoId: '', motivoSubstituicao: '',
        professorNomeEfetivo: item.professorTitular?.nome || item.professor?.nome || 'Professor Desconhecido',
        modalidadeNomeEfetiva: item.modalidade?.nome || 'Modalidade Desconhecida',
        valorEfetivo: item.aulaBase?.valor ? parseFloat(item.aulaBase.valor) : 0,
        justificativa: '',
    }, { tipo: 'validar', item });
  };

  const handleNovoAulao = () => {
      if (filtroUnidade.length !== 1) return alert(t('dailyValidation.alerts.selectOneUnit'));
      const unidadeObj = catalogs.unidades.find(u => String(u.id) === String(filtroUnidade[0]));
      abrirModal('aulao', { unidade: unidadeObj, data: dataFiltro });
  };

  // A janela e o "validar direto no cartão" passam pelo MESMO caminho (mesmas checagens, auditoria e regras).
  const confirmarAcao = async (dadosFormulario, acao = acaoAtual) => {
    if (!acao) return;
    const { inputValor, inputObs, isSubstituicao, substitutoId, motivoSubstituicao, aulaoModalidadeId, aulaoHora, aulaoValor, aulaoData, professorNomeEfetivo, modalidadeNomeEfetiva, valorEfetivo, justificativa: justificativaBruta } = dadosFormulario;

    if (acao.tipo === 'validar' && !inputValor) return alert(t('dailyValidation.alerts.informStudents'));
    if (acao.tipo === 'aulao' && (!aulaoModalidadeId || !inputValor || !substitutoId || !aulaoData)) return alert(t('dailyValidation.alerts.fillSpecialClass'));

    // Número de alunos: inteiro, sem negativo e sem valor absurdo.
    if (acao.tipo === 'validar') {
        if (!alunosValidos(inputValor)) return alert(t('dailyValidation.deadline.invalidStudents', { max: LIMITE_ALUNOS }));
        const n = parseInt(inputValor, 10);
        if (n === 0 && !window.confirm(t('dailyValidation.deadline.confirmZeroStudents'))) return;
        // Número fora do normal para esta aula (ex.: 80 quando a média é 18): pede confirmação.
        const mediaInfo = acao.item?.mediaAlunos;
        if (n > 0 && numeroEstranho(n, mediaInfo) && !window.confirm(t('dailyValidation.quick.confirmUnusual', { n, media: mediaInfo.media, amostras: mediaInfo.amostras }))) return;
    }
    if (acao.tipo === 'aulao' && !alunosValidos(inputValor, 1000)) return alert(t('dailyValidation.deadline.invalidStudents', { max: 1000 }));

    // Prazo (mês fechado / 60 dias do líder) e justificativa.
    const prazo = regraDePrazo(role, acao.tipo === 'aulao' ? aulaoData : acao.item.data);
    if (!prazo.pode) return alert(mensagemPrazo(prazo.motivo));
    const justificativa = String(justificativaBruta || '').trim();
    if (prazo.precisaJustificativa && justificativa.length < MIN_JUSTIFICATIVA) {
        return alert(t('dailyValidation.deadline.justificationRequired', { min: MIN_JUSTIFICATIVA }));
    }

    setProcessando(true);
    try {
      const { tipo, item } = acao;
      const payload = {
        data: tipo === 'aulao' ? aulaoData : item.data, 
        validadoPor: userId,
        timestamp: serverTimestamp(), 
        professorNomeEfetivo: professorNomeEfetivo || "",
        modalidadeNomeEfetiva: modalidadeNomeEfetiva || "",
        valorEfetivo: valorEfetivo || 0
      };
      // Mexer em mês já fechado deixa registrado o porquê (no documento e na Auditoria).
      const textoJustificativa = prazo.precisaJustificativa ? ` | Justificativa (mês fechado): ${justificativa}` : '';
      if (prazo.precisaJustificativa) payload.justificativa = justificativa;

      if (tipo === 'aulao') {
          payload.status = 'realizada'; payload.isAulao = true; payload.unidadeId = item.unidade.id;
          payload.professorId = substitutoId; payload.modalidadeId = aulaoModalidadeId;
          payload.hora = aulaoHora; payload.alunos = parseInt(inputValor);
          payload.valorPago = aulaoValor ? parseFloat(aulaoValor) : 0; payload.substituicao = false; 
          
          await addDoc(collection(db, 'validacoes'), payload);
          await registrarLogAuditoria('NOVA', `Aulão Especial registrado.`, { unidade: item.unidade, professor: {nome: professorNomeEfetivo}, modalidade: {nome: modalidadeNomeEfetiva}, aulaBase: {hora: aulaoHora}, diaSemana: aulaoData }, `Qtd Alunos: ${inputValor} | Valor: ${formatCurrency(aulaoValor, item.unidade?.pais)}${textoJustificativa}`);
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
            // Editar uma validação não muda o valor da época: mantém o valor gravado quando a aula foi validada.
            if (item.validacao.valorEfetivo !== undefined && item.validacao.valorEfetivo !== null) payload.valorEfetivo = item.validacao.valorEfetivo;
            if (tipo === 'validar' && item.validacao.alunos !== payload.alunos) diffLog.push(`Edição Alunos: de ${item.validacao.alunos} para ${payload.alunos}`);
            await updateDoc(doc(db, 'validacoes', item.validacao.id), payload);
            await registrarLogAuditoria('ALTERADA', tipo === 'validar' ? `Validação editada.` : `Cancelamento editado.`, item, diffLog.join(' | ') + textoJustificativa);
          } else {
            // ID fixo por aula/dia: se outra pessoa validar ao mesmo tempo, atualiza o mesmo registro (sem duplicar).
            await setDoc(doc(db, 'validacoes', idValidacao(payload.aulaId, payload.data)), payload);
            await registrarLogAuditoria('NOVA', tipo === 'validar' ? `Aula validada.` : `Aula cancelada.`, item, diffLog.join(' | ') + textoJustificativa);
          }
      }
    } catch (error) { alert(error?.code === 'permission-denied' ? t('dailyValidation.deadline.permissionDenied') : t('dailyValidation.alerts.saveError')); }
    // Os números da Página de Início mudam com esta validação: ao voltar para lá, recalcula.
    finally { invalidarCacheInicio(); setProcessando(false); setModalOpen(false); setAcaoAtual(null); }
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
                    {t('dailyValidation.title')}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-sm md:text-base">{t('dailyValidation.subtitle')}</p>
            </div>

            <div className="flex gap-4">
                <div className="w-full md:w-auto grid grid-cols-3 gap-3">
                    <button onClick={() => { setFiltroStatus('todos'); setItensVisiveis(12); }} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md ${filtroStatus === 'todos' ? 'bg-slate-800 text-white border-slate-900 ring-2 ring-slate-800 ring-offset-2' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        <span className="text-2xl font-black">{counts.total}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1"><List className="w-3 h-3"/> {t('dailyValidation.counters.all')}</span>
                    </button>
                    <button onClick={() => { setFiltroStatus('pendente'); setItensVisiveis(12); }} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md ${filtroStatus === 'pendente' ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-500 ring-offset-2' : 'bg-white border-amber-100 text-amber-500 hover:bg-amber-50'}`}>
                        <span className="text-2xl font-black">{counts.pendentes}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1"><TriangleAlert className="w-3 h-3"/> {t('dailyValidation.counters.pending')}</span>
                    </button>
                    <button onClick={() => { setFiltroStatus('cancelada'); setItensVisiveis(12); }} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md ${filtroStatus === 'cancelada' ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-600 ring-offset-2' : 'bg-white border-rose-100 text-rose-500 hover:bg-rose-50'}`}>
                        <span className="text-2xl font-black">{counts.canceladas}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1"><CircleX className="w-3 h-3"/> {t('dailyValidation.counters.canceled')}</span>
                    </button>
                </div>

                {role !== 'professor' && (
                    <button onClick={handleNovoAulao} className="hidden md:flex flex-col items-center justify-center p-3 rounded-2xl border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-all shadow-sm hover:shadow-md min-w-[100px]">
                        <Star className="w-6 h-6 mb-1" />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-center leading-tight">{t('dailyValidation.addSpecialClass')}</span>
                    </button>
                )}
            </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm w-full">
            <div className="flex flex-wrap gap-2 items-center">
                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1 h-10 shrink-0">
                    <button onClick={() => setModoFiltro('dia')} className={`px-3 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${modoFiltro === 'dia' ? 'bg-white dark:bg-slate-600 shadow text-emerald-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>{t('common.period.day')}</button>
                    <button onClick={() => setModoFiltro('mes')} className={`px-3 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${modoFiltro === 'mes' ? 'bg-white dark:bg-slate-600 shadow text-emerald-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>{t('common.period.month')}</button>
                    {pedidoDoInicio && (
                        <button onClick={() => setModoFiltro('periodo')} className={`px-3 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${modoFiltro === 'periodo' ? 'bg-white dark:bg-slate-600 shadow text-emerald-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>{t('common.period.range')}</button>
                    )}
                </div>
                <div className={`relative h-10 shrink-0 ${modoFiltro === 'periodo' ? 'min-w-[140px]' : 'w-[140px]'}`}>
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-emerald-500"/>
                    {modoFiltro === 'periodo' ? (
                    // Período das pendências que a Página de Início mandou abrir (só leitura; Dia/Mês voltam ao normal).
                    <div className="w-full h-full pl-9 pr-3 flex items-center bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-700 dark:text-white uppercase whitespace-nowrap">
                        {formatPeriod(periodoFiltro.inicio, periodoFiltro.fim, 'dayMonth')}
                    </div>
                    ) : modoFiltro === 'dia' ? (
                    <input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} className="w-full h-full pl-9 pr-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none uppercase" />
                    ) : (
                    <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="w-full h-full pl-9 pr-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none uppercase" />
                    )}
                </div>

                {role === 'admin' && (
                    <>
                        <FilterMultiSelect options={estadosOptions} selected={filtroEstado} onChange={handleEstadoChange} placeholder={t('dailyValidation.filters.states')} icon={MapIcon} />
                        <FilterMultiSelect options={mentoresOptions} selected={filtroMentor} onChange={handleMentorChange} placeholder={t('dailyValidation.filters.mentors')} icon={UserCog} searchable={true} />
                    </>
                )}
                
                {(!ehLider(role) || liderDeVarias) && (
                    <FilterMultiSelect options={unidadesFiltradasSelect} selected={filtroUnidade} onChange={setFiltroUnidade} placeholder={t('dailyValidation.filters.units')} icon={MapPin} searchable={true} />
                )}

                <FilterMultiSelect options={modalidadesOptions} selected={filtroModalidade} onChange={setFiltroModalidade} placeholder={t('dailyValidation.filters.modalities')} icon={Filter} searchable={true} />

                {(role === 'admin' || role === 'mentor') && (
                    <div className="relative h-10 flex-1 min-w-[160px] max-w-[200px]">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                        <input type="text" placeholder={t('dailyValidation.filters.teacherPlaceholder')} value={filtroProfessor} onChange={e => setFiltroProfessor(e.target.value)} className="w-full h-full pl-9 pr-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none uppercase placeholder:normal-case" />
                    </div>
                )}

                {role !== 'professor' && (
                    <button onClick={handleNovoAulao} className="md:hidden w-full h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase shadow-md flex justify-center items-center gap-2 transition-all mt-2">
                        <Star className="w-4 h-4" /> {t('dailyValidation.addSpecialClassLong')}
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* AVISO DO PROFESSOR: o que ficou para trás no mês (some quando tudo estiver validado) */}
      {isProfessor && pendentesDoMes.length > 0 && !(modoFiltro === 'mes' && mesFiltro === mesLocal() && filtroStatus === 'pendente') && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 animate-fade-in">
              <TriangleAlert className="w-6 h-6 text-amber-500 shrink-0"/>
              <div className="flex-1">
                  <p className="text-sm font-black text-amber-800 dark:text-amber-300">{t('dailyValidation.deadline.pendingBannerTitle', { count: pendentesDoMes.length })}</p>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400/80 mt-0.5">{t('dailyValidation.deadline.pendingBannerDesc')}</p>
              </div>
              <button onClick={verPendentesDoMes} className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wide shadow-sm transition-all whitespace-nowrap">
                  {t('dailyValidation.deadline.pendingBannerButton')}
              </button>
          </div>
      )}

      {isCofreFechado ? (
          <div className="py-24 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm animate-fade-in">
            <div className="bg-slate-50 dark:bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800 shadow-inner">
              <MapPin className="w-8 h-8 text-emerald-500 animate-bounce"/>
            </div>
            <h3 className="text-xl font-black text-slate-700 dark:text-white mb-2 uppercase">
                {role === 'admin' ? t('dailyValidation.empty.noFilterTitle') : t('dailyValidation.empty.noUnitTitle')}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest max-w-md mx-auto">
                {role === 'admin' ? t('dailyValidation.empty.noFilterDesc') : t('dailyValidation.empty.noUnitDesc')}
            </p>
          </div>
      ) : (carregandoValidacoes || loadingCatalogs) ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-2 text-emerald-500"/>
          <p className="text-xs font-bold uppercase tracking-widest">{t('dailyValidation.empty.loading')}</p>
        </div>
      ) : listaFiltradaTotal.length === 0 ? (
        <div className="py-24 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 animate-fade-in">
          <div className="bg-slate-50 dark:bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard className="w-8 h-8 text-slate-300"/>
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-white uppercase tracking-tight">
              {filtroStatus === 'pendente' ? t('dailyValidation.empty.allValidatedTitle') : filtroStatus === 'cancelada' ? t('dailyValidation.empty.noCancellationsTitle') : t('dailyValidation.empty.noClassesTitle')}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">
              {filtroStatus === 'pendente' ? t('dailyValidation.empty.allValidatedDesc') : t('dailyValidation.empty.adjustFiltersDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6">
            {/* Barra da visualização: [Pilhas | Lista] e abrir/recolher pilhas */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1 h-10" role="group" aria-label={t('dailyValidation.views.label')}>
                    <button onClick={() => setVisualizacao('pilhas')} aria-pressed={visualizacao === 'pilhas'} className={`px-3 text-xs font-bold uppercase tracking-wide rounded-lg flex items-center gap-1.5 transition-all ${visualizacao === 'pilhas' ? 'bg-white dark:bg-slate-600 shadow text-emerald-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Layers className="w-4 h-4"/> {t('dailyValidation.views.stacks')}
                    </button>
                    <button onClick={() => setVisualizacao('lista')} aria-pressed={visualizacao === 'lista'} className={`px-3 text-xs font-bold uppercase tracking-wide rounded-lg flex items-center gap-1.5 transition-all ${visualizacao === 'lista' ? 'bg-white dark:bg-slate-600 shadow text-emerald-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                        <List className="w-4 h-4"/> {t('dailyValidation.views.list')}
                    </button>
                </div>
                {visualizacao === 'pilhas' && temPilhaDeVerdade && (
                    <div className="flex gap-2">
                        <button onClick={abrirTodasPilhas} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5">
                            <ChevronsUpDown className="w-4 h-4"/> {t('dailyValidation.views.openAll')}
                        </button>
                        <button onClick={recolherTodasPilhas} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5">
                            <ChevronsDownUp className="w-4 h-4"/> {t('dailyValidation.views.closeAll')}
                        </button>
                    </div>
                )}
            </div>

            {visualizacao === 'lista' ? (
                <ListaAulas
                    grupos={gruposExibicao}
                    mostrarProfessor={mostrarProfessorNoGrupo}
                    verificarFuturo={verificarFuturo}
                    onValidar={(i) => abrirModal('validar', i)}
                    onCancelar={(i) => abrirModal('cancelar', i)}
                    onValidarRapido={validarRapido}
                    salvando={processando}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-6 items-start">
                {gruposExibicao.map((grupo) => (
                    <PilhaAulas
                        key={grupo.chave}
                        grupo={grupo}
                        aberta={pilhasAbertas.has(grupo.chave)}
                        onAlternar={() => alternarPilha(grupo.chave)}
                        mostrarProfessor={mostrarProfessorNoGrupo}
                        verificarFuturo={verificarFuturo}
                        renderCartao={(item, variante) => (
                            <AulaCard
                                key={item.key} item={item} variante={variante}
                                onValidar={(i) => abrirModal('validar', i)}
                                onCancelar={(i) => abrirModal('cancelar', i)}
                                onValidarRapido={validarRapido}
                                salvando={processando}
                                ocultarProfessor={isProfessor && !item.professor?.isSubstituto && !item.somenteLeitura}
                                verificarFuturo={verificarFuturo}
                            />
                        )}
                    />
                ))}
                </div>
            )}

            {itensVisiveis < grupos.length && (
                <div className="flex flex-wrap justify-center gap-3 pt-6 pb-4 animate-fade-in">
                    <button onClick={() => handleCarregarMais(12)} className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm flex items-center gap-2 transition-all"><ArrowDown className="w-4 h-4"/> {t('common.actions.loadMore', { count: 12 })}</button>
                    <button onClick={() => handleCarregarMais('todos')} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-xl text-xs font-black uppercase text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 shadow-sm flex items-center gap-2 transition-all"><DownloadCloud className="w-4 h-4"/> {t('common.actions.viewAll')}</button>
                </div>
            )}
        </div>
      )}

      <ValidationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onConfirm={confirmarAcao} onRevert={handleReverterCancelamento} acaoAtual={acaoAtual} catalogs={catalogs} processando={processando} isMaster={isMaster} regraPrazo={(data) => regraDePrazo(role, data)} />
    </div>
  );
}