import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { 
  BarChart2, Filter, Calendar, CheckCircle2, AlertCircle, 
  Search, Trophy, ChevronRight, ChevronDown, User, Clock, ShieldCheck, 
  LayoutDashboard, Download, AlertTriangle, Building2, UserCog, List, Construction, 
  History, Eye, EyeOff, Activity, ArrowUpDown, MessageSquare, Copy, Users, FileText, Smartphone, CalendarClock, Palmtree, MapPin, Lock, ArrowDown, DownloadCloud
} from 'lucide-react';

const diasSemanaMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
const getTodayStr = () => new Date().toLocaleDateString('en-CA'); 

// --- HELPERS DA VALIDAÇÃO ---
const normalizeDate = (d) => {
    if (!d) return null;
    if (d.seconds) return new Date(d.seconds * 1000).toLocaleDateString('en-CA');
    if (typeof d === 'string') {
        if (d.includes('/')) { 
            const [dia, mes, ano] = d.split('/');
            return `${ano}-${mes}-${dia}`;
        }
        return d.substring(0, 10);
    }
    return null;
};

const getDatesInRange = (startDate, endDate) => {
  const dates = [];
  const curr = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (curr <= end) {
    dates.push(new Date(curr).toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
};

const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
};

const formatHeaderPeriodo = (inicio, fim) => {
    if (!inicio || !fim) return '';
    const d1 = new Date(inicio + 'T12:00:00'); 
    const d2 = new Date(fim + 'T12:00:00');
    
    const ultimoDiaMes = new Date(d1.getFullYear(), d1.getMonth() + 1, 0).getDate();
    
    if (d1.getDate() === 1 && d2.getDate() === ultimoDiaMes && d1.getMonth() === d2.getMonth()) {
        const mesAno = d1.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        return mesAno.toUpperCase();
    }
    
    if (inicio === fim) return d1.toLocaleDateString('pt-BR');
    
    return `${d1.toLocaleDateString('pt-BR')} A ${d2.toLocaleDateString('pt-BR')}`;
};

const getFirstLast = (fullName) => {
    if (!fullName) return '-';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
};

const sendWhatsApp = (telefone, mensagem) => {
    if (!telefone) {
        alert("⚠️ TELEFONE NÃO CADASTRADO PARA ESTE CONTATO! ATUALIZE O CADASTRO NA ABA DE CONFIGURAÇÕES.");
        return;
    }
    const numeroLimpo = telefone.replace(/\D/g, '');
    const url = `https://api.whatsapp.com/send?phone=${numeroLimpo}&text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
};

const getEmojiByPercent = (percent) => {
    if (percent === 100) return '✅';
    if (percent >= 90) return '🟢'; 
    if (percent >= 80) return '🟡'; 
    if (percent >= 60) return '🟠'; 
    return '🔴'; 
};

const getColorClassByPercent = (percent) => {
    if (percent === 100) return 'bg-emerald-500 shadow-emerald-500/50';
    if (percent >= 90) return 'bg-lime-500 shadow-lime-500/50';
    if (percent >= 80) return 'bg-yellow-400 shadow-yellow-400/50';
    if (percent >= 60) return 'bg-orange-500 shadow-orange-500/50';
    return 'bg-red-600 shadow-red-600/50';
};

// --- COMPONENTES AUXILIARES ---
const SortableHeader = ({ label, sortKey, currentSort, onSort, align = 'left' }) => (
    <th 
      className={`p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(sortKey)}
    >
        <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
            {label}
            <ArrowUpDown className={`w-3 h-3 ${currentSort.key === sortKey ? 'text-blue-500 opacity-100' : 'text-slate-300 opacity-50'}`}/>
        </div>
    </th>
);

const KPICard = ({ title, value, icon: Icon, colorClass, iconBg, subTitle }) => (
  <div className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border shadow-sm flex items-center justify-between transition-all hover:shadow-lg hover:-translate-y-1 duration-300 ${colorClass}`}>
    <div>
      <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{value}</h3>
      {subTitle && <p className="text-xs text-slate-400 mt-1 font-medium uppercase">{subTitle}</p>}
    </div>
    <div className={`p-3 rounded-xl shadow-inner ${iconBg}`}>
      <Icon className="w-7 h-7" />
    </div>
  </div>
);

const StatusBadge = ({ type, text }) => {
    const configs = {
        'PARABÉNS!': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
        'TUDO OK!': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
        'EM ANDAMENTO': 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
        'EM CONSTRUÇÃO': 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600',
        'AGUARDANDO INÍCIO': 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
        'REALIZADA': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400',
        'CANCELADA': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400',
        'FERIADO': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
        'ATRASADO': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400',
        'PENDENTE': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400',
        'FUTURO': 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500'
    };
    
    const Icons = {
        'PARABÉNS!': Trophy,
        'TUDO OK!': CheckCircle2,
        'EM ANDAMENTO': Activity,
        'EM CONSTRUÇÃO': Construction,
        'AGUARDANDO INÍCIO': CalendarClock,
        'REALIZADA': CheckCircle2,
        'CANCELADA': AlertCircle,
        'FERIADO': Palmtree,
        'ATRASADO': Clock,
        'PENDENTE': AlertCircle
    };

    const upperType = String(type).toUpperCase();
    const upperText = String(text).toUpperCase();
    const IconComp = Icons[upperType] || Icons[upperText] || Icons['FUTURO'];

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap w-fit ${configs[upperType] || configs[upperText] || configs['FUTURO']}`}>
            {IconComp && <IconComp className="w-3 h-3" />}
            {upperText}
        </span>
    );
};

// 🟢 COMPONENTE CUSTOMIZADO MULTI-SELECT (CAIXINHAS)
const MultiSelectDropdown = ({ options, selectedValues, onChange, placeholder, icon: Icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (val) => {
        if (selectedValues.includes(val)) {
            onChange(selectedValues.filter(v => v !== val));
        } else {
            onChange([...selectedValues, val]);
        }
    };

    const selectAll = () => onChange(options.map(o => o.value));
    const clearAll = () => onChange([]);

    const displayText = selectedValues.length === 0 
        ? placeholder
        : selectedValues.includes('todos') || (selectedValues.length === options.length && options.length > 0)
            ? `TODOS SELECIONADOS`
            : selectedValues.length === 1 
                ? options.find(o => o.value === selectedValues[0])?.label 
                : `${selectedValues.length} SELECIONADOS`;

    return (
        <div className="relative w-full sm:w-64" ref={dropdownRef}>
            <Icon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 z-10 pointer-events-none"/>
            <div 
                onClick={() => setIsOpen(!isOpen)} 
                className={`w-full pl-10 pr-8 p-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white cursor-pointer shadow-sm select-none flex items-center h-[38px] ${isOpen ? 'ring-2 ring-blue-500' : ''}`}
            >
                <span className="truncate font-bold uppercase">{displayText}</span>
                <ChevronDown className={`absolute right-3 top-3 w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </div>
            
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl rounded-lg z-50 max-h-60 flex flex-col overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700 flex justify-between shrink-0 bg-slate-50 dark:bg-slate-900">
                        <button onClick={selectAll} className="text-[10px] font-black text-blue-600 dark:text-blue-400 px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded uppercase transition-colors">SELECIONAR TODOS</button>
                        <button onClick={clearAll} className="text-[10px] font-black text-rose-600 dark:text-rose-400 px-2 py-1 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded uppercase transition-colors">LIMPAR</button>
                    </div>
                    <div className="overflow-y-auto p-1 custom-scrollbar">
                        {options.length === 0 && <div className="p-2 text-xs text-slate-400 text-center font-bold uppercase">NENHUMA OPÇÃO</div>}
                        {options.map(o => (
                            <label key={o.value} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer rounded-md transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={selectedValues.includes(o.value)} 
                                    onChange={() => toggleOption(o.value)} 
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 cursor-pointer"
                                />
                                <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300 truncate">{o.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function ValidacaoColetiva() {
  const { userData } = useAuth();
  const role = String(userData?.role || "").toLowerCase();
  const userId = userData?.id || userData?.uid;
  const isMentor = role === 'mentor';
  
  const [loading, setLoading] = useState(true);

  // ESTADOS DO BANCO (CATÁLOGOS LEVES)
  const [unidadesBase, setUnidadesBase] = useState([]);
  const [usuariosBase, setUsuariosBase] = useState([]);
  const [modalidadesBase, setModalidadesBase] = useState([]);
  const [professoresBase, setProfessoresBase] = useState([]);
  const [feriadosBase, setFeriadosBase] = useState([]);

  // ESTADOS DO BANCO (DADOS PESADOS - CONTROLADOS PELO COFRE)
  const [aulasBase, setAulasBase] = useState([]);
  const [validacoesBase, setValidacoesBase] = useState([]);

  // UX & FILTROS
  const [modoFiltro, setModoFiltro] = useState('dia'); 
  const [dataInicio, setDataInicio] = useState(getTodayStr());
  const [dataFim, setDataFim] = useState(getTodayStr());
  
  // 🟢 OS FILTROS DO COFRE GLOBAL AGORA SÃO ARRAYS (MULTI-SELECT)
  const [estadoFiltro, setEstadoFiltro] = useState([]);
  const [mentorFiltro, setMentorFiltro] = useState([]);
  const [unidadeFiltro, setUnidadeFiltro] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [activeTab, setActiveTab] = useState('ranking'); 
  const [expandedUnitId, setExpandedUnitId] = useState(null);
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);

  // 🟢 ORDENAÇÃO PADRÃO: Crescente por Percentual (Mostra o MAIS pendente = 0% no topo)
  const [sortConfig, setSortConfig] = useState({ key: 'percentual', direction: 'ascending' });
  
  // 🟢 LAZY RENDERING: Itens visíveis da tabela detalhada
  const [itensVisiveisStatus, setItensVisiveisStatus] = useState(12);

  // 🟢 COFRE GLOBAL: Bloqueia a renderização e LEITURAS DE BANCO para admins/mentores sem filtro
  const isCofreGlobalFechado = 
      role === 'admin' 
      ? (estadoFiltro.length === 0 && mentorFiltro.length === 0 && unidadeFiltro.length === 0 && !searchTerm.trim())
      : role === 'mentor' 
      ? (estadoFiltro.length === 0 && unidadeFiltro.length === 0 && !searchTerm.trim()) 
      : false;

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (dataInicio > dataFim) setDataFim(dataInicio);
  }, [dataInicio, dataFim]);

  // ==========================================
  // 0. MOTOR DE AUDITORIA (X-9)
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
      } catch (e) { console.error("Erro log auditoria", e); }
  };

  // ==========================================
  // 1. CARREGAMENTO DOS CATÁLOGOS BASE (Roda sempre)
  // ==========================================
  useEffect(() => {
    if (!userId) return;
    
    let qUnidades = collection(db, 'unidades');
    if (isMentor) {
        qUnidades = query(collection(db, 'unidades'), where('mentorId', '==', userId));
    }

    const unsubsCatalogs = [
        onSnapshot(qUnidades, snap => setUnidadesBase(snap.docs.map(d => ({id: d.id, ...d.data()})))),
        onSnapshot(collection(db, 'usuarios'), snap => setUsuariosBase(snap.docs.map(d => ({id: d.id, ...d.data()})))),
        onSnapshot(collection(db, 'modalidades'), snap => setModalidadesBase(snap.docs.map(d => ({id: d.id, ...d.data()})))),
        onSnapshot(collection(db, 'professores'), snap => setProfessoresBase(snap.docs.map(d => ({id: d.id, ...d.data()})))),
        onSnapshot(collection(db, 'feriados'), snap => {
            setFeriadosBase(snap.docs.map(d => {
                const f = d.data();
                return { id: d.id, ...f, inicio: normalizeDate(f.dataInicio || f.inicio || f.data), fim: normalizeDate(f.dataFim || f.fim || f.data) };
            }));
        })
    ];

    return () => unsubsCatalogs.forEach(fn => fn());
  }, [role, userId, isMentor]);

  // ==========================================
  // 2. MOTOR V8 GUARDADO PELO COFRE GLOBAL (Aulas e Validações)
  // ==========================================
  useEffect(() => {
    if (!userId) return;
    
    // SE O COFRE TIVER FECHADO, DERRUBA AS LEITURAS PARA PROTEGER O BANCO DE DADOS
    if (isCofreGlobalFechado) {
        setAulasBase([]);
        setValidacoesBase([]);
        setLoading(false);
        return;
    }

    setLoading(true);

    const qValidacoes = query(
        collection(db, 'validacoes'), 
        where('data', '>=', dataInicio),
        where('data', '<=', dataFim)
    );

    const unsubsDados = [
        onSnapshot(collection(db, 'aulas'), snap => setAulasBase(snap.docs.map(d => ({id: d.id, ...d.data()})))),
        onSnapshot(qValidacoes, snap => {
            setValidacoesBase(snap.docs.map(d => ({id: d.id, ...d.data()})));
            setLoading(false);
        })
    ];

    return () => unsubsDados.forEach(fn => fn());
  }, [dataInicio, dataFim, userId, isCofreGlobalFechado]); 

  // --- OPÇÕES PARA MULTI-SELECT ---
  const estadosDisponiveis = useMemo(() => {
      // Como unidadesBase já é filtrado pelo Firebase para Mentores, isso isola perfeitamente.
      return [...new Set(unidadesBase.map(u => u.estado).filter(Boolean))].sort();
  }, [unidadesBase]);

  const mentoresDisponiveis = useMemo(() => {
      const mapaMentores = new Map();
      unidadesBase.forEach(u => {
          if (u.mentorId) {
              const m = usuariosBase.find(x => x.id === u.mentorId);
              if (m) mapaMentores.set(u.mentorId, m.nome);
          }
      });
      return Array.from(mapaMentores, ([id, nome]) => ({ id, nome })).sort((a,b) => a.nome.localeCompare(b.nome));
  }, [unidadesBase, usuariosBase]);

  const unidadesDisponiveis = useMemo(() => {
      let units = unidadesBase;
      if (estadoFiltro.length > 0 && !estadoFiltro.includes('todos')) {
          units = units.filter(u => estadoFiltro.includes(u.estado));
      }
      if (mentorFiltro.length > 0 && !mentorFiltro.includes('todos')) {
          units = units.filter(u => mentorFiltro.includes(u.mentorId));
      }
      return units.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [unidadesBase, estadoFiltro, mentorFiltro]);

  const estadosOptions = [{ value: 'todos', label: 'TODOS OS ESTADOS' }, ...estadosDisponiveis.map(e => ({ value: e, label: e }))];
  const mentoresOptions = [{ value: 'todos', label: 'TODOS OS MENTORES' }, ...mentoresDisponiveis.map(m => ({ value: m.id, label: m.nome }))];
  const unidadesOptions = [{ value: 'todos', label: 'TODAS AS UNIDADES' }, ...unidadesDisponiveis.map(u => ({ value: u.id, label: u.nome }))];

  // --- PROCESSAMENTO DO RANKING E KPIs ---
  const dadosProcessados = useMemo(() => {
    if (unidadesBase.length === 0 || isCofreGlobalFechado) return { mentores: [], unidades: [], kpis: { totalAulas: 0, unidadesValidadas: 0, unidadesPendentes: 0 } };

    const mentorMap = {};
    usuariosBase.forEach(u => { if(u.role === 'mentor' || u.role === 'admin') mentorMap[u.id] = u.nome; });
    const usuariosMap = {};
    usuariosBase.forEach(u => usuariosMap[u.id] = { nome: u.nome, role: u.role });
    const modMap = {};
    modalidadesBase.forEach(m => modMap[m.id] = m.nome);
    const profMap = {};
    professoresBase.forEach(p => profMap[p.id] = p.nome);

    const datasDoPeriodo = getDatesInRange(dataInicio, dataFim);
    const todayStr = getTodayStr();

    const validacoesIndex = {};
    validacoesBase.forEach(v => {
        const dataVal = normalizeDate(v.data) || String(v.data);
        const key = `${v.unidadeId}_${dataVal}`;
        if(!validacoesIndex[key]) validacoesIndex[key] = [];
        validacoesIndex[key].push(v);
    });

    // Filtro Global CASCATA para o Processamento Base
    let unidadesAtivas = unidadesBase;
    if (estadoFiltro.length > 0 && !estadoFiltro.includes('todos')) {
        unidadesAtivas = unidadesAtivas.filter(u => estadoFiltro.includes(u.estado));
    }

    const statusUnidades = unidadesAtivas.map(unidade => {
        let totalEsperadoAteAgora = 0;
        let totalValidado = 0;
        let pendencias = []; 
        let historicoDetalhado = []; 

        const gradeUnidade = aulasBase.filter(a => String(a.unidadeId) === String(unidade.id));
        const temCronograma = gradeUnidade.length > 0;

        datasDoPeriodo.forEach(dataStr => {
            if (dataStr > todayStr) return;

            const isFeriado = feriadosBase.some(f => {
                if (!f.inicio || !f.fim) return false;
                const feriadoAplica = !f.unidadeId || String(f.unidadeId) === String(unidade.id);
                const dentroDoPrazo = dataStr >= f.inicio && dataStr <= f.fim;
                return feriadoAplica && dentroDoPrazo;
            });

            const dateObj = new Date(dataStr + 'T00:00:00');
            const diaSemana = diasSemanaMap[dateObj.getDay()];
            
            const aulasDoDia = gradeUnidade.filter(a => {
                if (!a.dias || !a.dias.includes(diaSemana)) return false;
                const dataInicioValida = a.dataInicio ? dataStr >= a.dataInicio : true;
                const dataFimValida = a.dataFim ? dataStr <= a.dataFim : true;
                return dataInicioValida && dataFimValida;
            });

            if (aulasDoDia.length === 0) return;

            const poolValidacoes = [...(validacoesIndex[`${unidade.id}_${dataStr}`] || [])];

            aulasDoDia.forEach(aula => {
                const [h, m] = aula.hora.split(':');
                const dataHoraAula = new Date(dataStr);
                dataHoraAula.setHours(parseInt(h), parseInt(m), 59); 

                const jaPassou = (dataStr < todayStr) || (dataStr === todayStr && dataHoraAula < now);
                if (!jaPassou) return;

                totalEsperadoAteAgora++; 

                if (isFeriado) {
                    totalValidado++;
                    historicoDetalhado.push({
                        key: aula.id + dataStr,
                        data: new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR'),
                        dia: diaSemana,
                        horaAula: aula.hora,
                        modalidade: modMap[aula.modalidadeId] || 'GERAL',
                        professor: profMap[aula.professorId] || 'SEM PROFESSOR',
                        status: 'FERIADO', 
                        alunos: 0,
                        motivoCancelamento: 'RECESSO AUTOMÁTICO',
                        responsavelNome: 'SISTEMA',
                        horaValidacao: '-',
                        dataValidacao: '-',
                        diffDays: 0, 
                        timestampOrdenacao: dataHoraAula 
                    });
                    return; 
                }

                let foundIndex = poolValidacoes.findIndex(v => String(v.aulaId) === String(aula.id));
                if (foundIndex === -1) {
                    foundIndex = poolValidacoes.findIndex(v => v.hora === aula.hora);
                }

                let validacao = null;
                if (foundIndex !== -1) {
                    validacao = poolValidacoes[foundIndex];
                    poolValidacoes.splice(foundIndex, 1); 
                }
                
                let statusItem = 'PENDENTE';
                let responsavelNome = '-';
                let horaValidacao = '-';
                let dataValidacao = '-';
                let diffDays = 0;

                if (validacao) {
                    totalValidado++;
                    statusItem = validacao.status || 'REALIZADA'; 
                    
                    const userLog = usuariosMap[validacao.userId || validacao.validadoPor];
                    responsavelNome = userLog ? userLog.nome : (validacao.validadoPorNome || 'SISTEMA');

                    const campoData = validacao.validadoEm || validacao.timestamp;
                    if (campoData) {
                        const dateVal = campoData.seconds ? new Date(campoData.seconds * 1000) : new Date(campoData);
                        if (!isNaN(dateVal.getTime())) {
                            horaValidacao = dateVal.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                            dataValidacao = dateVal.toLocaleDateString('pt-BR', {day: '2-digit', month:'2-digit'});
                            const dateAula = new Date(dataStr + 'T00:00:00');
                            const dateValidacao = new Date(dateVal);
                            dateAula.setHours(0,0,0,0);
                            dateValidacao.setHours(0,0,0,0);
                            diffDays = Math.floor((dateValidacao - dateAula) / (1000 * 60 * 60 * 24));
                        }
                    }
                } else {
                    pendencias.push({ data: dataStr, dia: diaSemana, info: `AULA DAS ${aula.hora}` });
                    statusItem = 'ATRASADO';
                }

                historicoDetalhado.push({
                    key: aula.id + dataStr,
                    data: new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR'),
                    dia: diaSemana,
                    horaAula: aula.hora,
                    modalidade: modMap[aula.modalidadeId] || 'GERAL',
                    professor: profMap[aula.professorId] || 'SEM PROFESSOR',
                    status: statusItem, 
                    alunos: validacao?.alunos || 0,
                    motivoCancelamento: validacao?.motivoCancelamento,
                    responsavelNome,
                    horaValidacao,
                    dataValidacao,
                    diffDays, 
                    timestampOrdenacao: dataHoraAula 
                });
            });
        });

        historicoDetalhado.sort((a, b) => b.timestampOrdenacao - a.timestampOrdenacao);

        let percentual = 100;
        if (totalEsperadoAteAgora > 0) {
            percentual = Math.round((totalValidado / totalEsperadoAteAgora) * 100);
        }

        let statusTexto = 'EM ANDAMENTO';
        if (!temCronograma) statusTexto = 'EM CONSTRUÇÃO'; 
        else if (percentual === 100 && totalEsperadoAteAgora > 0) statusTexto = 'PARABÉNS!';
        else if (totalEsperadoAteAgora === 0) statusTexto = 'AGUARDANDO INÍCIO';

        const lastVal = validacoesBase.filter(v => String(v.unidadeId) === String(unidade.id))
            .sort((a,b) => (b.validadoEm?.seconds || 0) - (a.validadoEm?.seconds || 0))[0];
        
        let responsavelInfo = { nome: '-', role: '-' };
        if (lastVal) {
            const userLog = usuariosMap[lastVal.userId || lastVal.validadoPor]; 
            if (userLog) responsavelInfo = { nome: userLog.nome, role: userLog.role };
        }

        const lastValidationTime = lastVal ? (lastVal.validadoEm?.seconds || lastVal.timestamp?.seconds || 0) : 0;

        return {
            id: unidade.id,
            nome: unidade.nome,
            telefone: unidade.telefone,
            mentorId: unidade.mentorId,
            mentorNome: mentorMap[unidade.mentorId] || 'SEM MENTOR',
            totalEsperado: totalEsperadoAteAgora,
            totalValidado,
            percentual,
            pendencias,
            statusTexto,
            temCronograma,
            historicoDetalhado, 
            lastValidationTime, 
            lastValidation: lastVal ? {
                data: new Date(lastVal.data + 'T00:00:00').toLocaleDateString('pt-BR'),
                responsavelNome: responsavelInfo.nome,
                responsavelRole: responsavelInfo.role
            } : null
        };
    });

    const ranking = Object.values(statusUnidades.reduce((acc, unit) => {
        if (!unit.mentorId) return acc;
        if (!acc[unit.mentorId]) {
            const mData = usuariosBase.find(u => u.id === unit.mentorId);
            acc[unit.mentorId] = {
                id: unit.mentorId,
                nome: unit.mentorNome,
                telefone: mData?.telefone || "",
                totalUnidades: 0,
                somaPercentuais: 0,
                totalPendencias: 0, 
                unidadesList: []
            };
        }
        acc[unit.mentorId].totalUnidades++;
        acc[unit.mentorId].somaPercentuais += unit.percentual; 
        acc[unit.mentorId].totalPendencias += unit.pendencias.length; 
        acc[unit.mentorId].unidadesList.push(unit);
        return acc;
    }, {})).map(m => ({
        ...m,
        mediaGeral: Math.round(m.somaPercentuais / m.totalUnidades)
    })).sort((a, b) => b.mediaGeral - a.mediaGeral);

    const kpis = {
        totalAulas: statusUnidades.reduce((acc, u) => acc + u.totalEsperado, 0),
        unidadesValidadas: statusUnidades.filter(u => u.percentual === 100 && u.temCronograma && u.totalEsperado > 0).length,
        unidadesPendentes: statusUnidades.filter(u => u.percentual < 100 && u.temCronograma).length
    };

    return { mentores: ranking, unidades: statusUnidades, kpis };
  }, [unidadesBase, usuariosBase, aulasBase, validacoesBase, modalidadesBase, professoresBase, feriadosBase, dataInicio, dataFim, now, estadoFiltro, isCofreGlobalFechado]); 

  const rankingUnidades = useMemo(() => {
      return [...dadosProcessados.unidades].sort((a, b) => {
          if (b.percentual !== a.percentual) return b.percentual - a.percentual;
          return a.nome.localeCompare(b.nome);
      });
  }, [dadosProcessados.unidades]);

  // 🟢 MENTORES RELATÓRIO GERAL (ESPECÍFICO PARA A CENTRAL DE COBRANÇA DO ADMIN)
  const mentoresRelatorioGeral = useMemo(() => {
      let mentores = dadosProcessados.mentores;
      
      if (mentorFiltro.length > 0 && !mentorFiltro.includes('todos')) {
          mentores = mentores.filter(m => mentorFiltro.includes(m.id));
      }
      
      if (unidadeFiltro.length > 0 && !unidadeFiltro.includes('todos')) {
          mentores = mentores.map(m => {
              const filtradas = m.unidadesList.filter(u => unidadeFiltro.includes(u.id));
              const totalUnidades = filtradas.length;
              const somaPercentuais = filtradas.reduce((acc, u) => acc + u.percentual, 0);
              const totalPendencias = filtradas.reduce((acc, u) => acc + u.pendencias.length, 0);
              const mediaGeral = totalUnidades > 0 ? Math.round(somaPercentuais / totalUnidades) : 0;
              
              return { 
                  ...m, 
                  unidadesList: filtradas,
                  totalUnidades,
                  somaPercentuais,
                  totalPendencias,
                  mediaGeral
              };
          }).filter(m => m.totalUnidades > 0);
      }
      return mentores;
  }, [dadosProcessados.mentores, mentorFiltro, unidadeFiltro]);

  // 🟢 UNIDADES RELATÓRIO GERAL (ESPECÍFICO PARA A CENTRAL DE COBRANÇA DO MENTOR)
  const unidadesRelatorioGeral = useMemo(() => {
      let unidades = dadosProcessados.unidades;
      
      if (mentorFiltro.length > 0 && !mentorFiltro.includes('todos')) {
          unidades = unidades.filter(u => mentorFiltro.includes(u.mentorId));
      }
      
      if (unidadeFiltro.length > 0 && !unidadeFiltro.includes('todos')) {
          unidades = unidades.filter(u => unidadeFiltro.includes(u.id));
      }
      return unidades;
  }, [dadosProcessados.unidades, mentorFiltro, unidadeFiltro]);


  // APLICAÇÃO DOS FILTROS EM CASCATA NA LISTA DETALHADA E NA COBRANÇA
  const sortedUnidades = useMemo(() => {
      let sortableItems = [...dadosProcessados.unidades];
      
      if (mentorFiltro.length > 0 && !mentorFiltro.includes('todos')) {
          sortableItems = sortableItems.filter(u => mentorFiltro.includes(u.mentorId));
      }
      
      if (unidadeFiltro.length > 0 && !unidadeFiltro.includes('todos')) {
          sortableItems = sortableItems.filter(u => unidadeFiltro.includes(u.id));
      }

      sortableItems = sortableItems.filter(u => {
        const matchSearch = u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || u.mentorNome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchIssue = showOnlyIssues ? (u.percentual < 100 && u.temCronograma) : true;
        return matchSearch && matchIssue;
      });

      if (sortConfig.key) {
        sortableItems.sort((a, b) => {
          let aValue, bValue;
          if (sortConfig.key === 'nome') { aValue = a.nome; bValue = b.nome; }
          if (sortConfig.key === 'percentual') { aValue = a.percentual; bValue = b.percentual; }
          if (sortConfig.key === 'status') { aValue = a.statusTexto; bValue = b.statusTexto; }
          if (sortConfig.key === 'lastValidation') { aValue = a.lastValidationTime; bValue = b.lastValidationTime; }
          if (sortConfig.key === 'responsavel') { aValue = a.lastValidation?.responsavelNome || ''; bValue = b.lastValidation?.responsavelNome || ''; }

          if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        });
      }
      return sortableItems;
  }, [dadosProcessados.unidades, sortConfig, searchTerm, showOnlyIssues, mentorFiltro, unidadeFiltro]);

  // 🟢 LAZY RENDERING P/ TABELA DETALHADA
  const statusExibicao = useMemo(() => sortedUnidades.slice(0, itensVisiveisStatus), [sortedUnidades, itensVisiveisStatus]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleDateChange = (type) => {
    setModoFiltro(type);
    const hoje = getTodayStr();
    if (type === 'dia') { setDataInicio(hoje); setDataFim(hoje); } 
    else if (type === 'periodo') { setDataInicio(hoje); setDataFim(hoje); }
    else if (type === 'mes') {
        const d = new Date();
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        setDataInicio(`${y}-${String(m).padStart(2,'0')}-01`);
        setDataFim(new Date(y, m, 0).toISOString().split('T')[0]);
    }
  };

  const handleMonthChange = (e) => {
      const val = e.target.value; 
      const [y, m] = val.split('-');
      setDataInicio(`${y}-${m}-01`);
      setDataFim(new Date(y, m, 0).toISOString().split('T')[0]);
  };

  const toggleUnit = (unitId) => setExpandedUnitId(prev => prev === unitId ? null : unitId);

  const exportarCSV = () => {
    const headers = "UNIDADE,MENTOR,REALIZADO,ESPERADO,STATUS,PROGRESSO,PENDENCIAS\n";
    const rows = sortedUnidades.map(u => 
        `${u.nome.toUpperCase()},${u.mentorNome.toUpperCase()},${u.totalValidado},${u.totalEsperado},${u.statusTexto.toUpperCase()},${u.percentual}%,${u.pendencias.length}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `validacao_coletiva_${dataInicio}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const filterPendingDates = (pendencias) => {
      const today = getTodayStr(); 
      return [...new Set(pendencias.map(p => p.data).filter(d => d <= today))].sort();
  };

  // --- MENSAGENS COM TEXTO PURO ---
  const msgAdminToMentor = (mentor) => {
    const unidadesComPendencias = mentor.unidadesList
        .filter(u => u.temCronograma && u.percentual < 100)
        .map(u => ({ ...u, datasReais: filterPendingDates(u.pendencias) }))
        .filter(u => u.datasReais.length > 0);

    const lista = unidadesComPendencias.map(u => {
        const datas = u.datasReais.map(d => formatDateShort(d)).join(', ');
        return `📍 *${u.nome.toUpperCase()}* ${datas ? `(DIAS: ${datas})` : ''}`;
    }).join('\n');

    return `OLÁ ${getFirstLast(mentor.nome).toUpperCase()}, TUDO BEM? 🚀\n\nIDENTIFICAMOS PENDÊNCIAS NA VALIDAÇÃO DIÁRIA DAS SEGUINTES UNIDADES:\n\n${lista}\n\n⚠️ *ATENÇÃO:* A AUSÊNCIA DE VALIDAÇÃO INDICA QUE O LÍDER NÃO ESTÁ CONFERINDO A SALA COLETIVA PRESENCIALMENTE. PRECISAMOS GARANTIR ESSE MONITORAMENTO NA PONTA.\n\nPOR FAVOR, VERIFIQUE A ATUALIZAÇÃO DO RELATÓRIO PARA MANTERMOS NOSSO PADRÃO DE EXCELÊNCIA.\n\nCONTO COM VOCÊ! 👊`;
  };

  const msgMentorToUnit = (unidade) => {
      const datas = filterPendingDates(unidade.pendencias).map(d => formatDateShort(d)).join(', ');
      return `FALA LÍDER *${unidade.nome.toUpperCase()}*, TUDO BEM? 👊\n\nESTOU CONFERINDO O RELATÓRIO DE GESTÃO AQUI E VI QUE TEMOS PENDÊNCIAS NA VALIDAÇÃO DAS COLETIVAS:\n\n📅 *PERÍODO:* ${formatHeaderPeriodo(dataInicio, dataFim)}\n⚠️ *DIAS EM ABERTO:* ${datas}\n\nÉ FUNDAMENTAL QUE A CONFERÊNCIA SEJA FEITA DIARIAMENTE. CONSEGUE REGULARIZAR ISSO PRA GENTE HOJE?\n\nVALEU! 🚀`;
  };

  const msgAdminGeneralReport = () => {
      const destaques = mentoresRelatorioGeral.filter(m => m.totalPendencias === 0);
      const atencao = mentoresRelatorioGeral.filter(m => m.totalPendencias > 0).sort((a, b) => b.mediaGeral - a.mediaGeral);

      let msg = `📢 *STATUS VALIDAÇÃO COLETIVA - ${formatHeaderPeriodo(dataInicio, dataFim)}*\n\n`;
      if (destaques.length > 0) {
          msg += `🏆 *PARABÉNS (100% VALIDADO):*\n`;
          msg += destaques.map(m => `✅ ${getFirstLast(m.nome).toUpperCase()}`).join('\n');
          msg += `\n\n`;
      }
      if (atencao.length > 0) {
          msg += `⚠️ *PENDENTES DE VALIDAÇÃO:*\n`;
          msg += atencao.map(m => {
              const emoji = getEmojiByPercent(m.mediaGeral);
              return `${emoji} ${getFirstLast(m.nome).toUpperCase()} (${m.totalPendencias} FALTAS)`;
          }).join('\n');
          msg += `\n`;
      }
      msg += `\nGESTÃO DE COLETIVAS - PRATIQUE FITNESS 💪`;
      return msg;
  };

  const msgMentorGeneralReport = () => {
      const minhasUnidades = unidadesRelatorioGeral; 
      const destaques = minhasUnidades.filter(u => u.pendencias.length === 0 && u.temCronograma && u.totalEsperado > 0);
      const pendentes = minhasUnidades.filter(u => u.pendencias.length > 0 && u.temCronograma).sort((a, b) => b.percentual - a.percentual);

      let msg = `📢 *STATUS VALIDAÇÃO COLETIVA - ${formatHeaderPeriodo(dataInicio, dataFim)}*\n\n`;
      if (destaques.length > 0) {
          msg += `🏆 *UNIDADES EM DIA (100%):*\n`;
          msg += destaques.map(u => `✅ ${u.nome.toUpperCase()}`).join('\n');
          msg += `\n\n`;
      }
      if (pendentes.length > 0) {
          msg += `⚠️ *ATENÇÃO (PENDÊNCIAS):*\n`;
          msg += pendentes.map(u => {
              const emoji = getEmojiByPercent(u.percentual);
              return `${emoji} ${u.nome.toUpperCase()} (${u.pendencias.length} FALTAS)`;
          }).join('\n');
          msg += `\n`;
      }
      msg += `\nBORA REGULARIZAR E GARANTIR A EXCELÊNCIA NAS AULAS! CONTO COM TODOS. 🚀`;
      return msg;
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('TEXTO COPIADO COM SUCESSO!');
  };

  const getRowColor = (status, diffDays) => {
    if (status === 'FERIADO') return 'bg-purple-50 hover:bg-purple-100 border-l-4 border-l-purple-500';
    if (status !== 'REALIZADA' && status !== 'CANCELADA') {
        return 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-4 border-l-transparent'; 
    }
    if (diffDays <= 0) return 'bg-emerald-100/80 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 border-l-4 border-l-emerald-500';
    if (diffDays === 1) return 'bg-amber-100/80 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 border-l-4 border-l-amber-500';
    if (diffDays >= 2) return 'bg-red-100/80 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 border-l-4 border-l-red-500';
    return 'hover:bg-slate-50 dark:hover:bg-slate-700/50';
  };

  if (loading && unidadesBase.length === 0) return <div className="flex h-screen items-center justify-center text-slate-400 gap-2 uppercase font-bold"><LayoutDashboard className="animate-spin"/> CARREGANDO SISTEMA...</div>;

  return (
    <div className="p-6 md:p-8 max-w-[1920px] mx-auto animate-fade-in space-y-8 uppercase">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <span className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2 rounded-lg shadow-lg shadow-blue-500/20"><ShieldCheck className="w-7 h-7" /></span>
            VALIDAÇÃO COLETIVA
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">MONITORAMENTO DE ADESÃO E AUDITORIA EM TEMPO REAL</p>
        </div>
        
        <div className="flex flex-col gap-3 w-full md:w-auto">
            {/* FILTRO DE DATA E EXPORTAÇÃO */}
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                    <button onClick={() => handleDateChange('dia')} className={`px-4 py-2 text-xs font-bold rounded-md uppercase transition-all ${modoFiltro === 'dia' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>DIA</button>
                    <button onClick={() => setModoFiltro('periodo')} className={`px-4 py-2 text-xs font-bold rounded-md uppercase transition-all ${modoFiltro === 'periodo' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>PERÍODO</button>
                    <button onClick={() => handleDateChange('mes')} className={`px-4 py-2 text-xs font-bold rounded-md uppercase transition-all ${modoFiltro === 'mes' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>MÊS</button>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-600 mx-1"></div>
                <div className="flex items-center gap-2">
                    {modoFiltro === 'mes' ? (
                        <input type="month" value={dataInicio.substring(0, 7)} onChange={handleMonthChange} className="bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none cursor-pointer"/>
                    ) : (
                        <input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setDataFim(e.target.value); }} className="bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none cursor-pointer"/>
                    )}
                    {modoFiltro === 'periodo' && (
                        <>
                            <span className="text-slate-400">-</span>
                            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none cursor-pointer"/>
                        </>
                    )}
                </div>
                <button onClick={exportarCSV} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors tooltip" title="EXPORTAR CSV"><Download className="w-5 h-5"/></button>
            </div>
        </div>
      </div>

      {/* 🟢 FILTROS GLOBAIS AVANÇADOS (O COMANDO CENTRAL) */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
              <input 
                  type="text" 
                  placeholder="BUSCAR UNIDADE OU MENTOR..." 
                  className="w-full pl-10 p-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm uppercase placeholder:normal-case h-[38px]" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
              />
          </div>
          
          {/* MULTI-SELECT ESTADO */}
          {role === 'admin' && (
              <MultiSelectDropdown 
                  options={estadosOptions} 
                  selectedValues={estadoFiltro} 
                  onChange={(vals) => { setEstadoFiltro(vals); setUnidadeFiltro([]); }} 
                  placeholder="NENHUM ESTADO"
                  icon={MapPin}
              />
          )}

          {/* MULTI-SELECT MENTOR */}
          {!isMentor && (
              <MultiSelectDropdown 
                  options={mentoresOptions} 
                  selectedValues={mentorFiltro} 
                  onChange={(vals) => { setMentorFiltro(vals); setUnidadeFiltro([]); }} 
                  placeholder="NENHUM MENTOR"
                  icon={UserCog}
              />
          )}

          {/* MULTI-SELECT UNIDADE */}
          <MultiSelectDropdown 
              options={unidadesOptions} 
              selectedValues={unidadeFiltro} 
              onChange={setUnidadeFiltro} 
              placeholder="NENHUMA UNIDADE"
              icon={Building2}
          />
      </div>

      {/* 🟢 O COFRE GLOBAL: TRAVA TUDO SE ESTIVER FECHADO */}
      {isCofreGlobalFechado ? (
          <div className="py-24 text-center bg-white dark:bg-slate-800 border-dashed border-2 border-slate-300 dark:border-slate-700 shadow-sm animate-in fade-in zoom-in duration-300 m-4 rounded-2xl">
              <div className="bg-blue-50 dark:bg-slate-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100 dark:border-slate-800 shadow-inner">
                  <Lock className="w-10 h-10 text-blue-500 animate-pulse"/>
              </div>
              <h3 className="text-2xl font-black text-slate-700 dark:text-white mb-3 uppercase">
                  SELECIONE UM FILTRO PARA INICIAR
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium max-w-lg mx-auto leading-relaxed uppercase">
                  SELECIONE UM ESTADO, MENTOR OU UNIDADE NO FILTRO ACIMA PARA CARREGAR OS DADOS DO SISTEMA.
              </p>
          </div>
      ) : (
          <>
            {/* KPIS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title="AULAS ESPERADAS" value={dadosProcessados.kpis.totalAulas} icon={Calendar} colorClass="border-l-4 border-l-blue-500" iconBg="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"/>
                <KPICard title="UNIDADES 100%" value={dadosProcessados.kpis.unidadesValidadas} icon={CheckCircle2} colorClass="border-l-4 border-l-emerald-500" iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" subTitle={`DE ${dadosProcessados.unidades.length} UNIDADES`}/>
                <KPICard title="UNIDADES PENDENTES" value={dadosProcessados.kpis.unidadesPendentes} icon={AlertCircle} colorClass="border-l-4 border-l-rose-500" iconBg="bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"/>
            </div>

            {/* TABS */}
            <div className="flex gap-8 border-b border-slate-200 dark:border-slate-700">
                {[
                    { id: 'ranking', label: 'RANKING', icon: Trophy },
                    { id: 'status', label: 'STATUS DETALHADO', icon: List },
                    { id: 'cobranca', label: 'CENTRAL DE COBRANÇA', icon: MessageSquare }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)} 
                        className={`pb-4 text-sm font-bold uppercase flex items-center gap-2 transition-all relative ${activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
                    >
                        <tab.icon className="w-4 h-4"/> {tab.label}
                        {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full"></div>}
                    </button>
                ))}
            </div>

            <div className="min-h-[400px]">
                {/* === ABA RANKING === */}
                {activeTab === 'ranking' && (
                    <div className="grid gap-4 uppercase">
                        {!isMentor && dadosProcessados.mentores.map((mentor, index) => (
                            <div key={mentor.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-shadow group relative z-10 hover:z-50">
                                <div className="flex items-center gap-4 w-full md:w-1/4 min-w-[200px]">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-sm ${index === 0 ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-200' : index === 1 ? 'bg-slate-300 text-slate-800 ring-2 ring-slate-200' : index === 2 ? 'bg-orange-300 text-orange-900 ring-2 ring-orange-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>{index + 1}</div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">{mentor.nome.toUpperCase()}</h3>
                                        <p className="text-xs text-slate-400 font-medium">{mentor.totalUnidades} UNIDADES GERENCIADAS</p>
                                    </div>
                                </div>
                                
                                {/* ENVOLVEDOR DA BARRA E TOOLTIP */}
                                <div className="flex-1 w-full relative group/bar py-2 cursor-help">
                                    {/* A BARRA DE PROGRESSO EM SI */}
                                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                                        <div className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${getColorClassByPercent(mentor.mediaGeral)}`} style={{ width: `${mentor.mediaGeral}%` }}></div>
                                    </div>
                                    
                                    {/* O BALÃO DE TOOLTIP */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/bar:opacity-100 pointer-events-none transition-all duration-200 bg-slate-800 dark:bg-slate-900 border border-slate-700 text-white p-3 rounded-xl shadow-2xl z-50 min-w-[240px] flex flex-col gap-2">
                                        <div className="font-black border-b border-slate-700 pb-2 text-slate-300 uppercase tracking-widest text-[10px]">PENDÊNCIAS POR UNIDADE</div>
                                        <div className="flex flex-col gap-1.5">
                                            {mentor.unidadesList.map(u => {
                                                const pendenciasCount = u.pendencias.length;
                                                return (
                                                    <div key={u.id} className="flex justify-between items-center gap-4">
                                                        <span className="font-bold truncate max-w-[150px] uppercase text-[11px]">{u.nome.toUpperCase()}</span>
                                                        <span className={`font-black text-[11px] px-1.5 py-0.5 rounded ${!u.temCronograma ? 'bg-slate-700 text-slate-400' : pendenciasCount === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                            {!u.temCronograma ? 'CONSTRUÇÃO' : pendenciasCount === 0 ? 'TUDO OK' : `${pendenciasCount} FALTA(M)`}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full md:w-36 text-right">
                                    <StatusBadge 
                                        type={mentor.totalPendencias === 0 ? 'TUDO OK!' : 'PENDENTE'} 
                                        text={mentor.totalPendencias === 0 ? 'TUDO OK!' : `${mentor.totalPendencias} FALTAS`} 
                                    />
                                </div>
                            </div>
                        ))}

                        {isMentor && rankingUnidades.map((unidade, index) => (
                            <div key={unidade.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-shadow group relative z-10 hover:z-50">
                                <div className="flex items-center gap-4 w-full md:w-1/4 min-w-[200px]">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-sm ${index === 0 ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-200' : index === 1 ? 'bg-slate-300 text-slate-800 ring-2 ring-slate-200' : index === 2 ? 'bg-orange-300 text-orange-900 ring-2 ring-orange-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>{index + 1}</div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">{unidade.nome.toUpperCase()}</h3>
                                        <p className="text-xs text-slate-400 font-medium uppercase">{unidade.totalValidado}/{unidade.totalEsperado} AULAS</p>
                                    </div>
                                </div>
                                
                                <div className="flex-1 w-full relative group/bar py-2 cursor-help">
                                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                                        <div className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${getColorClassByPercent(unidade.percentual)}`} style={{ width: `${unidade.percentual}%` }}></div>
                                    </div>

                                    {/* TOOLTIP DA UNIDADE */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/bar:opacity-100 pointer-events-none transition-all duration-200 bg-slate-800 dark:bg-slate-900 border border-slate-700 text-white text-[11px] uppercase font-bold p-3 rounded-xl shadow-2xl z-50 whitespace-nowrap">
                                        {unidade.pendencias.length === 0 
                                            ? <span className="text-emerald-400">TODAS AS AULAS VALIDADAS</span> 
                                            : <span>FALTAM <span className="text-rose-400 font-black text-sm">{unidade.pendencias.length}</span> VALIDAÇÕES</span>
                                        }
                                    </div>
                                </div>

                                <div className="w-full md:w-36 text-right">
                                    <StatusBadge 
                                        type={unidade.pendencias.length === 0 ? 'TUDO OK!' : 'PENDENTE'} 
                                        text={unidade.pendencias.length === 0 ? 'TUDO OK!' : `${unidade.pendencias.length} FALTAS`} 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* === ABA STATUS INDIVIDUAL COM PAGINAÇÃO LAZY RENDERING === */}
                {activeTab === 'status' && (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm uppercase">
                        
                        {/* CABEÇALHO DA TABELA DETALHADA */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
                            {/* BOTÃO INTELIGENTE DE PENDÊNCIAS */}
                            <button 
                                onClick={() => setShowOnlyIssues(!showOnlyIssues)} 
                                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase transition-all shadow-sm w-full md:w-auto shrink-0 h-[38px] ${showOnlyIssues ? 'bg-blue-600 text-white shadow-blue-200 dark:shadow-none' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300'}`}
                            >
                                {showOnlyIssues ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>} 
                                {showOnlyIssues ? 'MOSTRAR TUDO' : 'MOSTRAR PENDÊNCIAS'}
                            </button>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="p-4 w-10"></th>
                                        <SortableHeader label="UNIDADE / MENTOR" sortKey="nome" currentSort={sortConfig} onSort={requestSort} />
                                        <SortableHeader label="PROGRESSO" sortKey="percentual" currentSort={sortConfig} onSort={requestSort} align="center" />
                                        <SortableHeader label="STATUS" sortKey="status" currentSort={sortConfig} onSort={requestSort} align="center" />
                                        <SortableHeader label="ÚLTIMA ATUALIZAÇÃO" sortKey="lastValidation" currentSort={sortConfig} onSort={requestSort} />
                                        <SortableHeader label="RESPONSÁVEL" sortKey="responsavel" currentSort={sortConfig} onSort={requestSort} align="right" />
                                        <th className="p-4 text-center">AÇÕES</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {statusExibicao.map(u => (
                                        <React.Fragment key={u.id}>
                                            <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group ${expandedUnitId === u.id ? 'bg-slate-50 dark:bg-slate-700/30' : ''}`} onClick={() => toggleUnit(u.id)}>
                                                <td className="p-4 text-slate-300 group-hover:text-blue-500 transition-colors">{expandedUnitId === u.id ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}</td>
                                                <td className="p-4"><div className="font-bold text-slate-700 dark:text-slate-200 text-base uppercase">{u.nome}</div><div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-bold uppercase"><User className="w-3 h-3"/> {u.mentorNome}</div></td>
                                                
                                                {/* COLUNA DE PROGRESSO / FALTAS */}
                                                <td className="p-4 text-center">
                                                    {!u.temCronograma ? (
                                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full uppercase">CONSTRUÇÃO</span>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1 justify-center">
                                                            <div className="flex items-center gap-2 w-full max-w-[120px]">
                                                                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                    <div className={`h-full rounded-full transition-all duration-500 ${getColorClassByPercent(u.percentual)}`} style={{width: `${u.percentual}%`}}></div>
                                                                </div>
                                                            </div>
                                                            <span className={`text-[10px] font-black uppercase tracking-wider ${u.pendencias.length === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {u.pendencias.length === 0 ? '100% OK' : `${u.pendencias.length} FALTA(S)`}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                
                                                <td className="p-4 text-center"><StatusBadge type={u.statusTexto} text={u.statusTexto} /></td>
                                                <td className="p-4">{u.lastValidation ? <div className="flex flex-col text-xs"><span className="text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1 uppercase"><Calendar className="w-3 h-3 text-slate-400"/> {u.lastValidation.data}</span><span className="text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5 uppercase"><Clock className="w-3 h-3"/> {u.historicoDetalhado[0]?.horaValidacao || '-'}</span></div> : <span className="text-xs text-slate-300 italic">-</span>}</td>
                                                <td className="p-4 text-right">{u.lastValidation ? <div className="flex justify-end"><div className="text-right"><span className="block text-xs font-bold text-slate-700 dark:text-white truncate max-w-[150px] uppercase">{u.lastValidation.responsavelNome}</span><span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded mt-0.5 border border-slate-200 dark:border-slate-600 uppercase">{u.lastValidation.responsavelRole}</span></div></div> : <span className="text-xs text-slate-300">-</span>}</td>
                                                
                                                {/* AÇÕES STATUS DETALHADO */}
                                                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                    {u.percentual < 100 && u.temCronograma && (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button 
                                                                onClick={() => copyToClipboard(msgMentorToUnit(u))} 
                                                                className="inline-flex items-center justify-center p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors"
                                                                title="COPIAR MENSAGEM DE COBRANÇA"
                                                            >
                                                                <Copy className="w-4 h-4"/>
                                                            </button>
                                                            <button 
                                                                onClick={() => sendWhatsApp(u.telefone, msgMentorToUnit(u))} 
                                                                className="inline-flex items-center justify-center p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors"
                                                                title="ENVIAR PARA WHATSAPP DA UNIDADE"
                                                            >
                                                                <Smartphone className="w-4 h-4"/>
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                            {expandedUnitId === u.id && (
                                                <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-700 shadow-inner">
                                                    <td colSpan="7" className="p-0"><div className="p-4"><div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm"><table className="w-full text-xs text-left"><thead className="bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-600"><tr><th className="p-3">DATA / HORA AULA</th><th className="p-3">MODALIDADE / AULA</th><th className="p-3">PROFESSOR</th><th className="p-3 text-center">STATUS</th><th className="p-3 text-right">VALIDAÇÃO</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{u.historicoDetalhado.map((h) => (<tr key={h.key} className={`transition-colors ${getRowColor(h.status, h.diffDays)}`}><td className="p-3"><div className="font-bold text-slate-700 dark:text-slate-200 uppercase">{h.data}</div><div className="text-slate-400 font-mono uppercase">{h.horaAula}</div></td><td className="p-3 font-medium text-slate-600 dark:text-slate-300 uppercase">{h.modalidade}</td><td className="p-3 text-slate-600 dark:text-slate-300 uppercase">{getFirstLast(h.professor).toUpperCase()}</td><td className="p-3 text-center"><div className="flex justify-center"><StatusBadge type={h.status} text={h.status === 'ATRASADO' ? 'PENDENTE' : h.status} /></div></td><td className="p-3 text-right">{(h.status === 'REALIZADA' || h.status === 'CANCELADA') ? (<div><div className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px] ml-auto uppercase">{h.responsavelNome}</div><div className="text-slate-400 text-[10px] flex items-center justify-end gap-1 uppercase">{h.dataValidacao} ÀS {h.horaValidacao}</div></div>) : (h.status === 'FERIADO' ? <span className="text-purple-500 font-bold text-[10px] uppercase">RECESSO/FERIADO</span> : <span className="text-slate-300 text-[10px]">-</span>)}</td></tr>))}</tbody></table></div></div></td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {statusExibicao.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="p-8 text-center text-slate-400 font-bold uppercase">NENHUMA UNIDADE ENCONTRADA.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            
                            {/* 🟢 PAGINAÇÃO LAZY RENDERING */}
                            {itensVisiveisStatus < sortedUnidades.length && (
                                <div className="flex flex-wrap justify-center gap-3 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                                    <button 
                                        onClick={() => setItensVisiveisStatus(prev => prev + 12)} 
                                        className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm flex items-center gap-2 transition-all uppercase"
                                    >
                                        <ArrowDown className="w-4 h-4"/> CARREGAR +12
                                    </button>
                                    <button 
                                        onClick={() => setItensVisiveisStatus(sortedUnidades.length)} 
                                        className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-xl text-xs font-black text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 shadow-sm flex items-center gap-2 transition-all uppercase"
                                    >
                                        <DownloadCloud className="w-4 h-4"/> VER TODOS ({sortedUnidades.length})
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* === ABA CENTRAL DE COBRANÇA === */}
                {activeTab === 'cobranca' && (
                    <div className="animate-fade-in space-y-6 uppercase">
                        
                        {/* 1. RELATÓRIO GERAL */}
                        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-xl p-6 shadow-xl border border-indigo-500/30 text-white relative overflow-hidden mb-6">
                            <div className="flex justify-between items-center relative z-10">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2 uppercase">
                                        <FileText className="w-5 h-5 text-indigo-400"/> 
                                        RELATÓRIO GERAL ({isMentor ? 'MINHAS UNIDADES' : 'GRUPO DE MENTORES'})
                                    </h3>
                                    <p className="text-indigo-200 text-xs mt-1 font-medium uppercase">RESUMO CONSOLIDADO PARA ENVIO NO GRUPO OFICIAL.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => copyToClipboard(isMentor ? msgMentorGeneralReport() : msgAdminGeneralReport())}
                                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg uppercase"
                                    >
                                        <Copy className="w-4 h-4"/> COPIAR TEXTO
                                    </button>
                                    <a 
                                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(isMentor ? msgMentorGeneralReport() : msgAdminGeneralReport())}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg uppercase"
                                    >
                                        <MessageSquare className="w-4 h-4"/> ENVIAR NO GRUPO
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* 2. TABELA DE COBRANÇA INDIVIDUAL */}
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider border-b border-slate-300 dark:border-slate-600">
                                    <tr>
                                        <th className="p-3 border-r border-slate-200 dark:border-slate-600 uppercase">{isMentor ? 'UNIDADE' : 'MENTOR'}</th>
                                        <th className="p-3 border-r border-slate-200 dark:border-slate-600 text-center w-24 uppercase">STATUS</th>
                                        <th className="p-3 border-r border-slate-200 dark:border-slate-600 uppercase">PENDÊNCIAS DETALHADAS</th>
                                        <th className="p-3 text-center w-64 uppercase">ENVIAR MENSAGEM</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    
                                    {/* MODO ADMIN: LISTA MENTORES (SÓ QUEM DEVE REAIS) */}
                                    {!isMentor && mentoresRelatorioGeral
                                        .filter(m => m.unidadesList.some(u => filterPendingDates(u.pendencias).length > 0)) 
                                        .sort((a, b) => b.mediaGeral - a.mediaGeral) 
                                        .map((mentor) => (
                                        <tr key={mentor.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="p-3 border-r border-slate-100 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 uppercase">
                                                {mentor.nome.toUpperCase()}
                                            </td>
                                            <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-center uppercase">
                                                <span className={`font-bold px-2 py-0.5 rounded text-xs text-white ${getColorClassByPercent(mentor.mediaGeral)}`}>{mentor.mediaGeral}%</span>
                                            </td>
                                            <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-xs text-slate-500 font-medium uppercase">
                                                {mentor.unidadesList.filter(u => filterPendingDates(u.pendencias).length > 0).map(u => u.nome.toUpperCase()).join(', ')}
                                            </td>
                                            <td className="p-3 text-center uppercase">
                                                <div className="flex justify-center gap-2">
                                                    <button 
                                                        onClick={() => copyToClipboard(msgAdminToMentor(mentor))}
                                                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-black transition-colors inline-flex items-center gap-1"
                                                        title="COPIAR TEXTO"
                                                    >
                                                        <Copy className="w-3 h-3"/> COPIAR
                                                    </button>
                                                    <button 
                                                        onClick={() => sendWhatsApp(mentor.telefone, msgAdminToMentor(mentor))}
                                                        className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-[10px] font-black transition-colors inline-flex items-center gap-1 shadow-sm"
                                                        title="MANDAR NO WHATSAPP"
                                                    >
                                                        <Smartphone className="w-3 h-3"/> WHATSAPP
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* MODO MENTOR: LISTA UNIDADES (SÓ QUEM DEVE REAIS) */}
                                    {isMentor && unidadesRelatorioGeral
                                        .filter(u => filterPendingDates(u.pendencias).length > 0) 
                                        .sort((a, b) => b.percentual - a.percentual) 
                                        .map((unidade) => (
                                        <tr key={unidade.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="p-3 border-r border-slate-100 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 uppercase">
                                                {unidade.nome.toUpperCase()}
                                            </td>
                                            <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-center uppercase">
                                                <span className={`font-bold px-2 py-0.5 rounded text-xs text-white ${getColorClassByPercent(unidade.percentual)}`}>{unidade.percentual}%</span>
                                            </td>
                                            <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-xs text-slate-500 font-medium uppercase">
                                                {(() => {
                                                    const datas = filterPendingDates(unidade.pendencias).map(d => formatDateShort(d));
                                                    return datas.length > 5 
                                                        ? `${datas.slice(0, 5).join(', ')} +${datas.length - 5} DIAS`
                                                        : datas.join(', ');
                                                })()}
                                            </td>
                                            <td className="p-3 text-center uppercase">
                                                <div className="flex justify-center gap-2">
                                                    <button 
                                                        onClick={() => copyToClipboard(msgMentorToUnit(unidade))}
                                                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-black transition-colors inline-flex items-center gap-1"
                                                    >
                                                        <Copy className="w-3 h-3"/> COPIAR
                                                    </button>
                                                    <button 
                                                        onClick={() => sendWhatsApp(unidade.telefone, msgMentorToUnit(unidade))}
                                                        className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-[10px] font-black transition-colors inline-flex items-center gap-1 shadow-sm"
                                                    >
                                                        <Smartphone className="w-3 h-3"/> WHATSAPP
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {((!isMentor && mentoresRelatorioGeral.filter(m => m.unidadesList.some(u => filterPendingDates(u.pendencias).length > 0)).length === 0) || 
                                      (isMentor && unidadesRelatorioGeral.filter(u => filterPendingDates(u.pendencias).length > 0).length === 0)) && (
                                        <tr>
                                            <td colSpan="4" className="p-8 text-center text-slate-400 italic uppercase">
                                                NENHUMA PENDÊNCIA ENCONTRADA PARA COBRANÇA.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
          </>
      )}
    </div>
  );
}