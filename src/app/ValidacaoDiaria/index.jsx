import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCatalogs } from '../../contexts/CatalogContext'; 
import { db } from '../../services/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, setDoc, deleteField, getDoc
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
import { getDiaSemana, formatCurrency, formatPeriod, formatCancelReason } from '../../utils/formatters';
import {
  idValidacao, deduplicarValidacoes, regraDePrazo, hojeLocal, mesLocal, dataLocal,
  alunosValidos, LIMITE_ALUNOS, MIN_JUSTIFICATIVA, DIAS_RETROATIVOS_LIDER, pendenciasDoProfessor
} from '../../utils/validacoes';
import { feriadoNoDia, ehCancelamentoAutomaticoDeFeriado, ehReforma } from '../../utils/feriados';

// Cancelamento automático de feriado/recesso ("Recesso/Feriado") ou de unidade fechada para reforma ("Reforma").
const MOTIVOS_AUTOMATICOS = ['Recesso/Feriado', 'Reforma'];
import { aulaNaGradeDoDia, datasEntre, somarDias } from '../../utils/agendaAulas';
import { invalidarCacheInicio } from '../../services/cacheInicio';
import { useValidacoesDoProfessor, meuProfessorId } from '../../hooks/useValidacoesDoProfessor';
import { useMediaAlunos, numeroEstranho } from '../../hooks/useMediaAlunos';
import { useTranslation } from 'react-i18next';
import { ehLider, unidadesDoLider, ehDoMeuEscopo } from '../../permissions';

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

// Teto de alunos de um aulão (a aula da grade usa LIMITE_ALUNOS).
const LIMITE_ALUNOS_AULAO = 1000;

// Valores de "unidadeId" a procurar nas validações destas unidades, em blocos de 30 (limite do filtro "in").
// A validação copia o unidadeId da aula; em aula antiga ele pode estar gravado como número,
// então procura também o número, senão aquela validação sumiria e a aula apareceria como pendente.
const blocosDeUnidades = (idsUnidades, aulas = []) => {
  const alvo = new Set(idsUnidades.map(String));
  const valores = new Map([...alvo].map(id => [`s:${id}`, id]));
  aulas.forEach(a => {
    if (a.unidadeId != null && typeof a.unidadeId !== 'string' && alvo.has(String(a.unidadeId))) {
      valores.set(`${typeof a.unidadeId}:${a.unidadeId}`, a.unidadeId);
    }
  });
  const lista = [...valores.values()];
  const blocos = [];
  for (let i = 0; i < lista.length; i += 30) blocos.push(lista.slice(i, i + 30));
  return blocos;
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
  const [erroRealtime, setErroRealtime] = useState(false);
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
      unitsData = unitsData.filter(u => ehDoMeuEscopo(userData, u.mentorId));
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
  }, [globalCatalogs, loadingCatalogs, role, unidadesLiderKey, userData]);

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

  // Professor: duas buscas que não se repetem.
  // 1) Mês atual até hoje (aviso de pendências). É a MESMA busca do selo do menu, e o Firebase
  //    divide a mesma busca entre os dois (sem ler em dobro).
  // 2) Só se ele olhar algo de meses anteriores: aquele pedaço, até o último dia do mês passado.
  //    (Antes carregava do mês escolhido até hoje: olhar janeiro em novembro lia 11 meses.)
  //    Dia futuro não tem validação, então nada depois de hoje é buscado.
  const inicioMesAtual = `${mesLocal()}-01`;
  const hoje = hojeLocal();
  const fimDoMesPassado = somarDias(inicioMesAtual, -1);
  const extraInicio = periodo.inicio < inicioMesAtual ? periodo.inicio : null;
  const extraFim = extraInicio ? [periodo.fim, hoje, fimDoMesPassado].sort()[0] : null;
  const mesAtualProf = useValidacoesDoProfessor(meuProfId, inicioMesAtual, hoje);
  const anterioresProf = useValidacoesDoProfessor(extraInicio && extraFim >= extraInicio ? meuProfId : null, extraInicio, extraFim);

  const carregandoProfessor = mesAtualProf.carregando || anterioresProf.carregando;
  const erroProfessor = mesAtualProf.erro || anterioresProf.erro;
  const validacoesProfessor = useMemo(() => {
      const porId = new Map();
      [...mesAtualProf.validacoes, ...anterioresProf.validacoes].forEach(v => porId.set(v.id, v));
      return deduplicarValidacoes([...porId.values()]);
  }, [mesAtualProf.validacoes, anterioresProf.validacoes]);

  const validacoesDaTela = isProfessor ? validacoesProfessor : validacoesRealtime;
  // O banco recusou a leitura: a tela NÃO mostra a lista (senão tudo pareceria pendente e alguém validaria em dobro).
  const erroValidacoes = isProfessor ? erroProfessor : erroRealtime;
  // Líder/mentor/professor sem nenhuma unidade (admin sempre enxerga a rede).
  const semUnidade = !loadingCatalogs && role !== 'admin' && catalogs.unidades.length === 0;

  const pendentesDoMes = useMemo(() => {
    if (!isProfessor || loadingCatalogs || mesAtualProf.carregando) return [];
    return pendenciasDoProfessor({
      aulas: catalogs.aulas, unidades: catalogs.unidades, feriados: catalogs.feriados,
      validacoes: mesAtualProf.validacoes, professorId: meuProfId, getDiaSemana, feriadoNoDia,
    });
  }, [isProfessor, loadingCatalogs, mesAtualProf.carregando, catalogs, mesAtualProf.validacoes, meuProfId]);

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
  // Unidades cujas validações a tela vai pedir ao banco (nunca a rede inteira):
  // - líder: as dele (só as escolhidas no filtro, se ele tiver mais de uma);
  // - admin/mentor com unidades marcadas: essas;
  // - admin só com Estado e/ou Mentor: as unidades daquele Estado/Mentor.
  // Vira texto para a escuta só reabrir quando o conjunto mudar de verdade.
  const blocosAlvoKey = useMemo(() => {
      let ids;
      if (ehLider(role)) {
          const minhas = unidadesLiderKey.split(",").filter(Boolean);
          const escolhidas = filtroUnidade.filter(id => minhas.includes(String(id)));
          ids = escolhidas.length > 0 ? escolhidas : minhas;
      } else if (filtroUnidade.length > 0) {
          ids = filtroUnidade;
      } else {
          ids = unidadesFiltradasSelect.map(u => u.id);
      }
      return JSON.stringify(blocosDeUnidades(ids, globalCatalogs?.aulas || []));
  }, [role, unidadesLiderKey, filtroUnidade, unidadesFiltradasSelect, globalCatalogs?.aulas]);

  // Quem marca várias unidades uma a uma não abre uma busca nova a cada clique: a busca espera
  // a pessoa parar de mexer no filtro por um instante (na primeira vez vai direto).
  const [blocosEscutados, setBlocosEscutados] = useState(blocosAlvoKey);
  useEffect(() => {
      if (blocosEscutados === blocosAlvoKey) return undefined;
      const espera = setTimeout(() => setBlocosEscutados(blocosAlvoKey), blocosEscutados === '[]' ? 0 : 700);
      return () => clearTimeout(espera);
  }, [blocosAlvoKey, blocosEscutados]);
  // Enquanto espera, a tela fica em "carregando" (senão a unidade recém-marcada pareceria toda pendente).
  const filtroMudando = !isProfessor && blocosEscutados !== blocosAlvoKey;
  const carregandoValidacoes = isProfessor ? carregandoProfessor : (loading || filtroMudando);

  useEffect(() => {
    // Professor: as validações vêm do useValidacoesDoProfessor (as dele + as das aulas dele substituídas).
    if (role === 'professor') return;
    if (loadingCatalogs) return;
    setErroRealtime(false);

    if (isCofreFechado || (catalogs.unidades.length === 0 && role !== 'admin')) {
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

    // Uma consulta por bloco de até 30 unidades, cada uma escutando o banco ao vivo; a lista final junta
    // todas (sem repetir) e tira duplicatas antigas. Nenhum caminho lê a rede inteira.
    // (O professor não passa por aqui: as validações dele vêm do useValidacoesDoProfessor.)
    const consultas = JSON.parse(blocosEscutados).map(bloco => query(ref, ...periodo, where('unidadeId', 'in', bloco)));
    if (consultas.length === 0) {
        setValidacoesRealtime([]);
        setLoading(false);
        return;
    }

    const resultados = consultas.map(() => null);
    let falhou = false;
    const atualizar = () => {
        if (resultados.some(r => r === null)) return; // espera todas responderem
        const porId = new Map();
        resultados.flat().forEach(v => porId.set(v.id, v));
        setValidacoesRealtime(deduplicarValidacoes([...porId.values()]));
        setErroRealtime(falhou);
        setLoading(false);
    };

    const cancelar = consultas.map((q, i) => onSnapshot(q, (snap) => {
        resultados[i] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        atualizar();
    }, (error) => {
        console.error('Erro ao escutar validações:', error);
        falhou = true;
        resultados[i] = [];
        atualizar();
    }));

    return () => cancelar.forEach(unsub => unsub());
  // (Não depende mais do catálogo de professores: editar um professor em qualquer lugar reabria a busca e relia tudo.)
  }, [modoFiltro, dataFiltro, mesFiltro, periodoFiltro, blocosEscutados, catalogs.unidades.length, role, isCofreFechado, loadingCatalogs]);

  // ==========================================
  // 3. PROCESSADOR DE GRADE VISUAL
  // ==========================================
  useEffect(() => {
    if (carregandoValidacoes || loadingCatalogs || catalogs.unidades.length === 0 || isCofreFechado) {
      if (isProfessor && !loadingCatalogs && catalogs.unidades.length === 0) setGradeGerada([]);
      return;
    }
    // Sem as validações não dá para saber o que está pendente: não monta nada (os contadores ficam zerados).
    if (erroValidacoes) { setGradeGerada([]); return; }

    let datasParaVerificar = [];
    if (modoFiltro === 'dia') datasParaVerificar = [new Date(dataFiltro + 'T12:00:00')];
    else if (modoFiltro === 'periodo') datasParaVerificar = datasEntre(periodoFiltro.inicio, periodoFiltro.fim).map(d => new Date(d + 'T12:00:00'));
    else {
      const [ano, mes] = mesFiltro.split('-');
      datasParaVerificar = getMonthDates(parseInt(ano), parseInt(mes) - 1);
    }

    const meuProfessorId = meuProfId;

    // Fichários em memória: cada busca vira consulta direta, em vez de varrer as listas inteiras
    // para cada aula de cada dia (no mês de muitas unidades eram milhões de comparações e a tela travava).
    const porId = (lista) => new Map((lista || []).map(x => [String(x.id), x]));
    const unidadesPorId = porId(catalogs.unidades);
    const professoresPorId = porId(catalogs.professores);
    const modalidadesPorId = porId(catalogs.modalidades);
    const validacaoPorAulaDia = new Map();
    const auloesPorDia = new Map();
    validacoesDaTela.forEach(v => {
        if (v.isAulao) {
            if (!auloesPorDia.has(v.data)) auloesPorDia.set(v.data, []);
            auloesPorDia.get(v.data).push(v);
        }
        const chave = `${v.aulaId}|${v.data}`;
        if (!validacaoPorAulaDia.has(chave)) validacaoPorAulaDia.set(chave, v); // a 1ª, como antes
    });
    const unidadesEscolhidas = new Set(filtroUnidade.map(String));
    const filtraPorRede = role === 'admin' || role === 'mentor';
    // Filtro de unidade/estado/mentor/modalidade não depende do dia: aplicado uma vez só.
    const unidadePassaNoFiltro = (unidade, idBruto) => {
        if (!unidade) return false;
        if (unidadesEscolhidas.size > 0 && !unidadesEscolhidas.has(String(idBruto))) return false;
        if (filtraPorRede) {
            if (filtroEstado.length > 0 && !filtroEstado.includes(unidade.estado)) return false;
            if (filtroMentor.length > 0 && !filtroMentor.includes(unidade.mentorId)) return false;
        }
        return true;
    };
    const aulasCandidatas = catalogs.aulas.filter(aula =>
        unidadePassaNoFiltro(unidadesPorId.get(String(aula.unidadeId)), aula.unidadeId)
        && !(filtroModalidade.length > 0 && !filtroModalidade.includes(String(aula.modalidadeId))));

    let gradeFinal = [];

    datasParaVerificar.forEach(dataObj => {
      const dataString = dataLocal(dataObj);
      const diaSemanaNome = getDiaSemana(dataObj);

      // Regra única (src/utils/agendaAulas.js): dia da semana + vigência da aula. A Página de Início usa a mesma.
      const aulasDoDia = aulasCandidatas.filter(aula => aulaNaGradeDoDia(aula, dataString, diaSemanaNome));

      aulasDoDia.forEach(aula => {
        const unidadeValida = unidadesPorId.get(String(aula.unidadeId));

        const validacao = validacaoPorAulaDia.get(`${aula.id}|${dataString}`);

        // Professor vê as aulas em que é titular e também as que ele deu como SUBSTITUTO
        // (essas só para consulta: quem valida/edita é o titular, a unidade ou o mentor).
        let somenteLeitura = false;
        if (role === 'professor') {
            const souTitular = String(aula.professorId) === String(meuProfessorId);
            const souSubstituto = !!validacao && String(validacao.professorId) === String(meuProfessorId);
            if (!souTitular && !souSubstituto) return;
            somenteLeitura = !souTitular;
        }
        
        const profDoCatalogo = professoresPorId.get(String(aula.professorId));
        const modDoCatalogo = modalidadesPorId.get(String(aula.modalidadeId));

        let professorExibicao = profDoCatalogo ? { ...profDoCatalogo } : { nome: t('common.unknown.deletedTeacher') }; 
        let modalidadeExibicao = modDoCatalogo ? { ...modDoCatalogo } : { nome: t('common.unknown.deletedModality') };

        if (validacao) {
            if (validacao.professorNomeEfetivo) professorExibicao.nome = validacao.professorNomeEfetivo;
            if (validacao.modalidadeNomeEfetiva) modalidadeExibicao.nome = validacao.modalidadeNomeEfetiva;
            if (validacao.substituicao && validacao.professorId) {
                const profSub = professoresPorId.get(String(validacao.professorId));
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
        // Cancelada só por ser feriado (sem ninguém ter decidido): a de agora, calculada na hora, ou um registro
        // antigo gravado pelo sistema (validadoPor SISTEMA_FERIADO).
        let feriadoAutomatico = ehCancelamentoAutomaticoDeFeriado(validacao);

        if (validacao) {
            status = validacao.status;
        } else {
            // Regra única de feriado (src/utils/feriados.js): só a unidade dentro da abrangência do feriado.
            const feriadoDoDia = feriadoNoDia(dataString, unidadeValida, catalogs.feriados);
            if (feriadoDoDia) {
                status = 'cancelada';
                dadosValidacao = { motivoCancelamento: ehReforma(feriadoDoDia) ? 'Reforma' : 'Recesso/Feriado', status: 'cancelada' };
                feriadoAutomatico = true;
            }
        }

        const prazo = regraDePrazo(role, dataString);
        gradeFinal.push({
          key: `${aula.id}-${dataString}`,
          data: dataString, diaSemana: diaSemanaNome, aulaBase: aula,
          professor: professorExibicao, professorTitular: profDoCatalogo,
          unidade: unidadeValida, modalidade: modalidadeExibicao,
          validacao: dadosValidacao || null, status: status,
          somenteLeitura, prazo,
          // A unidade abriu no feriado e a aula aconteceu: admin, mentor e líder podem validar mesmo assim.
          podeValidarNoFeriado: feriadoAutomatico && status === 'cancelada' && !somenteLeitura && prazo.pode
            && (role === 'admin' || role === 'mentor' || ehLider(role)),
        });
      });

      const auloesDoDia = auloesPorDia.get(dataString) || [];
      auloesDoDia.forEach(v => {
         const unidadeValida = unidadesPorId.get(String(v.unidadeId));
         if (!unidadePassaNoFiltro(unidadeValida, v.unidadeId)) return;
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

  }, [validacoesDaTela, carregandoValidacoes, erroValidacoes, loadingCatalogs, catalogs, filtroUnidade, filtroModalidade, filtroProfessor, filtroEstado, filtroMentor, dataFiltro, mesFiltro, modoFiltro, periodoFiltro, role, isProfessor, meuProfId, isCofreFechado, t]);

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
        if (MOTIVOS_AUTOMATICOS.includes(item.validacao?.motivoCancelamento)) return alert(t(item.validacao.motivoCancelamento === 'Reforma' ? 'dailyValidation.alerts.renovationInfo' : 'dailyValidation.alerts.holidayInfo'));
        return alert(t('dailyValidation.alerts.blockedCanceled'));
    }
    setAcaoAtual({ tipo, item }); setModalOpen(true);
  };

  // Aula cancelada só por ser feriado, mas a unidade abriu: admin, mentor e líder validam normalmente.
  // A janela abre como aula pendente; ao gravar, o registro do dia (ID fixo aulaId_data) vira a validação
  // de verdade. Registro antigo do sistema com outro ID perde para a validação feita por pessoa.
  const validarNoFeriado = (item) => {
    if (!item?.podeValidarNoFeriado) return;
    if (!window.confirm(t('dailyValidation.alerts.confirmHolidayValidation'))) return;
    abrirModal('validar', { ...item, status: 'pendente', validacao: null, validadoNoFeriado: true });
  };

  const handleReverterCancelamento = async () => {
      if (!acaoAtual?.item) return;
      if (!acaoAtual.item.validacao?.id && MOTIVOS_AUTOMATICOS.includes(acaoAtual.item.validacao?.motivoCancelamento)) return alert(t('dailyValidation.alerts.autoHolidayRevert'));
      if (!acaoAtual.item.validacao?.id) return;
      const prazo = regraDePrazo(role, acaoAtual.item.data);
      if (!prazo.pode) return alert(mensagemPrazo(prazo.motivo));
      let justificativa = '';
      if (prazo.precisaJustificativa) {
          justificativa = (window.prompt(t('dailyValidation.deadline.justificationPrompt', { min: MIN_JUSTIFICATIVA })) || '').trim();
          if (justificativa.length < MIN_JUSTIFICATIVA) return alert(t('dailyValidation.deadline.justificationRequired', { min: MIN_JUSTIFICATIVA }));
      } else if (!window.confirm(t('dailyValidation.alerts.confirmRevert'))) return;

      setProcessando(true);
      try {
          if (acaoAtual.item.isAulao) {
              // Aulão: apagar o registro apagaria o próprio aulão. Volta a "realizada" com os alunos que já tinha.
              const mudancas = { status: 'realizada', motivoCancelamento: deleteField(), validadoPor: userId, timestamp: serverTimestamp() };
              if (prazo.precisaJustificativa) mudancas.justificativa = justificativa;
              await updateDoc(doc(db, 'validacoes', acaoAtual.item.validacao.id), mudancas);
              await registrarLogAuditoria('ALTERADA', `Cancelamento de Aulão Especial revertido.`, acaoAtual.item,
                  `Cancelamento por motivo de "${acaoAtual.item.validacao?.motivoCancelamento}" desfeito.` + (justificativa ? ` | Justificativa (mês fechado): ${justificativa}` : ''));
              return;
          }
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
        const teto = acao.item?.isAulao ? LIMITE_ALUNOS_AULAO : LIMITE_ALUNOS;
        if (!alunosValidos(inputValor, teto)) return alert(t('dailyValidation.deadline.invalidStudents', { max: teto }));
        const n = parseInt(inputValor, 10);
        if (n === 0 && !window.confirm(t('dailyValidation.deadline.confirmZeroStudents'))) return;
        // Número fora do normal para esta aula (ex.: 80 quando a média é 18): pede confirmação.
        const mediaInfo = acao.item?.mediaAlunos;
        if (n > 0 && numeroEstranho(n, mediaInfo) && !window.confirm(t('dailyValidation.quick.confirmUnusual', { n, media: mediaInfo.media, amostras: mediaInfo.amostras }))) return;
    }
    if (acao.tipo === 'aulao' && !alunosValidos(inputValor, LIMITE_ALUNOS_AULAO)) return alert(t('dailyValidation.deadline.invalidStudents', { max: LIMITE_ALUNOS_AULAO }));

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

      if (item?.isAulao && item.validacao?.id) {
          // EDITAR OU CANCELAR UM AULÃO JÁ LANÇADO: mexe só no número de alunos ou no cancelamento.
          // Aulão não tem aula da grade: não ganha aulaId, e professor, unidade, valor e data ficam como foram lançados
          // (antes ganhava o próprio id como aulaId e o banco recusava a edição do líder e do mentor).
          const mudancas = { validadoPor: userId, timestamp: serverTimestamp() };
          if (prazo.precisaJustificativa) mudancas.justificativa = justificativa;
          let detalhe;
          if (tipo === 'validar') {
              mudancas.status = 'realizada';
              mudancas.alunos = parseInt(inputValor, 10);
              detalhe = `Alunos: de ${item.validacao.alunos ?? '-'} para ${mudancas.alunos}`;
          } else {
              mudancas.status = 'cancelada';
              mudancas.motivoCancelamento = inputValor === 'Outros' ? inputObs : inputValor;
              detalhe = `Cancelamento: ${mudancas.motivoCancelamento}`;
          }
          await updateDoc(doc(db, 'validacoes', item.validacao.id), mudancas);
          await registrarLogAuditoria('ALTERADA', tipo === 'validar' ? `Aulão Especial editado.` : `Aulão Especial cancelado.`, item, detalhe + textoJustificativa);
      } else if (tipo === 'aulao') {
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
          if (item.validadoNoFeriado) diffLog.push('Unidade abriu no feriado');

          if (item.validacao?.id) {
            // Editar uma validação não muda o valor da época: mantém o valor gravado quando a aula foi validada.
            if (item.validacao.valorEfetivo !== undefined && item.validacao.valorEfetivo !== null) payload.valorEfetivo = item.validacao.valorEfetivo;
            if (tipo === 'validar' && item.validacao.alunos !== payload.alunos) diffLog.push(`Edição Alunos: de ${item.validacao.alunos} para ${payload.alunos}`);
            // A edição junta com o que já estava gravado: tira o que não vale mais, para não sobrar resto
            // (ex.: aula realizada que vira cancelada continuava com o número de alunos e o substituto).
            const limpeza = tipo === 'validar'
                ? { motivoCancelamento: deleteField() }
                : { alunos: deleteField(), professorOriginalId: deleteField(), motivoSubstituicao: deleteField() };
            await updateDoc(doc(db, 'validacoes', item.validacao.id), { ...payload, ...limpeza });
            await registrarLogAuditoria('ALTERADA', tipo === 'validar' ? `Validação editada.` : `Cancelamento editado.`, item, diffLog.join(' | ') + textoJustificativa);
          } else {
            // ID fixo por aula/dia: se outra pessoa validar ao mesmo tempo, atualiza o mesmo registro (sem duplicar).
            const refDia = doc(db, 'validacoes', idValidacao(payload.aulaId, payload.data));
            // A tela pode estar atrasada (sem internet, banco lento): confere no banco antes de gravar por cima
            // do que outra pessoa já registrou. O cancelamento automático de feriado pode ser substituído sem aviso.
            const existente = await getDoc(refDia);
            if (existente.exists() && !ehCancelamentoAutomaticoDeFeriado(existente.data())) {
                const atual = existente.data();
                const comoEsta = atual.status === 'cancelada'
                    ? t('dailyValidation.alerts.alreadyCanceled', { motivo: formatCancelReason(atual.motivoCancelamento) || '-' })
                    : t('dailyValidation.alerts.alreadyValidated', { count: atual.alunos ?? 0 });
                if (!window.confirm(t('dailyValidation.alerts.confirmOverwrite', { comoEsta }))) return;
            }
            await setDoc(refDia, payload);
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
                    <span className="bg-gradient-to-tr from-emerald-500 to-emerald-600 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-500/20">
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
                    <button onClick={() => { setFiltroStatus('cancelada'); setItensVisiveis(12); }} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md ${filtroStatus === 'cancelada' ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-600 ring-offset-2' : 'bg-white border-red-100 text-red-500 hover:bg-red-50'}`}>
                        <span className="text-2xl font-black">{counts.canceladas}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1"><CircleX className="w-3 h-3"/> {t('dailyValidation.counters.canceled')}</span>
                    </button>
                </div>

                {role !== 'professor' && (
                    <button onClick={handleNovoAulao} className="hidden md:flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm hover:shadow-md min-w-[100px]">
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
                    <button onClick={handleNovoAulao} className="md:hidden w-full h-10 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase shadow-md flex justify-center items-center gap-2 transition-all mt-2">
                        <Star className="w-4 h-4" /> {t('dailyValidation.addSpecialClassLong')}
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* AVISO DO PROFESSOR: o que ficou para trás no mês (some quando tudo estiver validado) */}
      {isProfessor && !erroProfessor && pendentesDoMes.length > 0 && !(modoFiltro === 'mes' && mesFiltro === mesLocal() && filtroStatus === 'pendente') && (
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

      {semUnidade ? (
          <div className="py-24 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm animate-fade-in">
            <div className="bg-slate-50 dark:bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800 shadow-inner">
              <MapPin className="w-8 h-8 text-slate-300"/>
            </div>
            <h3 className="text-xl font-black text-slate-700 dark:text-white mb-2 uppercase">{t('dailyValidation.empty.noLinkedUnitTitle')}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest max-w-md mx-auto">{t('dailyValidation.empty.noLinkedUnitDesc')}</p>
          </div>
      ) : isCofreFechado ? (
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
      ) : erroValidacoes ? (
        <div role="alert" className="py-16 px-6 text-center bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-200 dark:border-red-900/40 animate-fade-in">
          <TriangleAlert className="w-10 h-10 text-red-500 mx-auto mb-3"/>
          <h3 className="text-lg font-black text-red-700 dark:text-red-400 uppercase tracking-tight">{t('dailyValidation.empty.loadErrorTitle')}</h3>
          <p className="text-red-600/80 dark:text-red-400/80 text-sm font-medium mt-2 max-w-lg mx-auto">{t('dailyValidation.empty.loadErrorDesc')}</p>
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
                    onValidarNoFeriado={validarNoFeriado}
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
                                onValidarNoFeriado={validarNoFeriado}
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