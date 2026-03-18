import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { collection, getDocs, onSnapshot, query, where, documentId, orderBy } from 'firebase/firestore'; 
import { 
  BarChart2, Filter, DollarSign, Users, Calendar, 
  CheckCircle2, XCircle, Clock, ChevronRight, ChevronDown, 
  LayoutDashboard, Map, Globe, UserCheck, AlertTriangle, 
  Download, FileSpreadsheet, FileText, X, User, MousePointerClick, ArrowRightLeft,
  ArrowDown, DownloadCloud, Star, AlignJustify, Layers, Lock, PieChart, Activity, TrendingUp, Search, CheckSquare, Square
} from 'lucide-react';

// --- HELPERS ---
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const diasSemanaMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
const DIAS_UTEIS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']; 
const DURACAO_AULA_PADRAO = 40; 
const GAP_MINIMO_OCIOSO = 60; 

const getTodayStr = () => new Date().toLocaleDateString('en-CA'); 

const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const timeToMins = (timeStr) => { if (!timeStr) return 0; const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; };
const minsToTime = (mins) => { const h = Math.floor(mins / 60).toString().padStart(2, '0'); const m = (mins % 60).toString().padStart(2, '0'); return `${h}:${m}`; };

const getTurnoFromTime = (timeStr) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const minutes = h * 60 + m;
    if (minutes >= 330 && minutes <= 719) return 'Manhã';
    if (minutes >= 720 && minutes <= 1020) return 'Tarde';
    if (minutes >= 1021 && minutes <= 1380) return 'Noite';
    return null;
};

const checkTurno = (timeStr, turnosArray) => {
    if (!timeStr || !turnosArray || turnosArray.length === 0) return true;
    const turno = getTurnoFromTime(timeStr);
    return turnosArray.includes(turno);
};

const getDatesByWeekdayInPeriod = (startStr, endStr, activeDaysArray) => {
  const datesByDay = {};
  (activeDaysArray || []).forEach(d => datesByDay[d] = []);
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayName = diasSemanaMap[d.getDay()];
    if ((activeDaysArray || []).includes(dayName)) {
      datesByDay[dayName].push(new Date(d).toISOString().split('T')[0]);
    }
  }
  return datesByDay;
};

const processarBuracos = (aulasDoDia, turnosArray) => {
    if (!aulasDoDia) return [];
    // Simplificação de turnos múltiplos para o cálculo de buracos
    let abertura = timeToMins("06:00");
    let fechamento = timeToMins("22:00");

    if (turnosArray && turnosArray.length === 1) {
        if (turnosArray.includes('Manhã')) { fechamento = timeToMins("12:00"); }
        else if (turnosArray.includes('Tarde')) { abertura = timeToMins("12:00"); fechamento = timeToMins("18:00"); }
        else if (turnosArray.includes('Noite')) { abertura = timeToMins("18:00"); fechamento = timeToMins("22:00"); }
    }

    const janelas = [];
    const aulasNoTurno = aulasDoDia.filter(a => {
        const inicioAula = timeToMins(a.hora);
        return inicioAula >= abertura && inicioAula < fechamento;
    }).sort((a, b) => timeToMins(a.hora) - timeToMins(b.hora));
    
    let tempoAtual = abertura;

    aulasNoTurno.forEach(aula => {
        const inicioAula = timeToMins(aula.hora);
        if (inicioAula - tempoAtual >= GAP_MINIMO_OCIOSO) {
            janelas.push({ inicio: tempoAtual, fim: inicioAula });
        }
        tempoAtual = Math.max(tempoAtual, inicioAula + DURACAO_AULA_PADRAO);
    });
    
    if (fechamento - tempoAtual >= GAP_MINIMO_OCIOSO) {
        janelas.push({ inicio: tempoAtual, fim: fechamento });
    }
    
    return janelas.map(j => `${minsToTime(j.inicio)} - ${minsToTime(j.fim)}`);
};

// 🟢 TEMAS DA DIRETORIA
const getOcupacaoTheme = (perc) => {
    if (perc <= 50) return { text: 'text-red-500', bg: 'bg-red-500' };
    if (perc <= 75) return { text: 'text-amber-500', bg: 'bg-amber-500' };
    return { text: 'text-emerald-500', bg: 'bg-emerald-500' };
};

const getMediaAlunosTheme = (media) => {
    if (media < 10) return { text: 'text-red-500', icon: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' };
    if (media <= 18) return { text: 'text-amber-500', icon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' };
    return { text: 'text-emerald-500', icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' };
};

// 🟢 COMPONENTE: MULTI-SELECT AVANÇADO
const MultiSelectDropdown = ({ label, options, selected, onChange, placeholder = "SELECIONAR..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");

    const filteredOptions = (options || []).filter(o => (o.label || '').toUpperCase().includes(search.toUpperCase()));

    const toggle = (id) => {
        if (selected.includes(id)) onChange(selected.filter(x => x !== id));
        else onChange([...selected, id]);
    };

    const handleSelectAll = () => {
        const allIds = filteredOptions.map(o => o.id);
        const uniqueSelected = Array.from(new Set([...selected, ...allIds]));
        onChange(uniqueSelected);
    };

    return (
        <div className="relative w-full">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 block tracking-widest">{label}</label>
            <div onClick={() => setIsOpen(!isOpen)} className={`w-full p-3 bg-slate-50 dark:bg-slate-900 border ${isOpen ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/30' : 'border-slate-200 dark:border-slate-700'} rounded-xl text-[10px] font-black outline-none cursor-pointer flex justify-between items-center transition-all uppercase shadow-sm`}>
                <span className="truncate text-slate-700 dark:text-slate-300">{selected.length === 0 ? placeholder : selected.length === 1 ? options.find(o => o.id === selected[0])?.label : `${selected.length} SELECIONADOS`}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
            </div>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[40]" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[50] overflow-hidden flex flex-col max-h-[350px]">
                        <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0">
                            <div className="relative"><Search className="w-3 h-3 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" placeholder="BUSCAR..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-[10px] font-black uppercase outline-none focus:border-blue-500 dark:text-white placeholder-slate-300 dark:placeholder-slate-600"/></div>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar p-2 flex-1 space-y-1">
                            {filteredOptions.length === 0 ? <div className="p-3 text-center text-[10px] font-bold text-slate-400 uppercase">NENHUM RESULTADO</div> : filteredOptions.map(opt => (
                                <div key={opt.id} onClick={() => toggle(opt.id)} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selected.includes(opt.id) ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300'}`}>
                                    {selected.includes(opt.id) ? <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />}<span className="text-[10px] font-black uppercase truncate">{opt.label}</span>
                                </div>
                            ))}
                        </div>
                        <div className="p-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0 flex gap-2">
                            <button onClick={handleSelectAll} className="flex-1 py-2 text-[9px] font-black text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded uppercase transition-colors">TODOS</button>
                            {selected.length > 0 && <button onClick={() => onChange([])} className="flex-1 py-2 text-[9px] font-black text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded uppercase transition-colors">LIMPAR</button>}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const SortableHeader = ({ label, field, currentSort, onSort, align = "left", className = "" }) => (
  <th 
    className={`p-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-${align} ${className}`}
    onClick={() => onSort(field)}
  >
    <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"}`}>
      {label}
      <div className="flex flex-col">
        <ChevronDown className={`w-2 h-2 ${currentSort.field === field && currentSort.direction === 'desc' ? 'text-red-500' : 'opacity-30'}`} />
        <ChevronRight className={`w-2 h-2 -mt-1 rotate-[-90deg] ${currentSort.field === field && currentSort.direction === 'asc' ? 'text-red-500' : 'opacity-30'}`} />
      </div>
    </div>
  </th>
);

export default function RelatorioPage() {
  const { userData } = useAuth();
  const role = String(userData?.role || "").toLowerCase();
  const userId = userData?.id || userData?.uid;

  const [loading, setLoading] = useState(true);
  const [catalogs, setCatalogs] = useState({ 
    unidades: [], professores: [], modalidades: [], users: [], feriados: []
  });
  
  const [aulasRealtime, setAulasRealtime] = useState([]);
  const [validacoesRealtime, setValidacoesRealtime] = useState([]);
  const [validacoesYTD, setValidacoesYTD] = useState([]);
  
  const [modoFiltro, setModoFiltro] = useState('mes'); 
  const [dataFiltro, setDataFiltro] = useState(getTodayStr());
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7));
  const [dataInicioFiltro, setDataInicioFiltro] = useState(() => {
      const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [dataFimFiltro, setDataFimFiltro] = useState(getTodayStr());
  
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [viewMode, setViewMode] = useState('agrupado'); 

  // 🟢 ARRAYS DE MÚLTIPLA ESCOLHA
  const [paisesFiltro, setPaisesFiltro] = useState([]);
  const [estadosFiltro, setEstadosFiltro] = useState([]);
  const [mentoresFiltro, setMentoresFiltro] = useState([]);
  const [unidadesFiltro, setUnidadesFiltro] = useState([]);
  const [modalidadesFiltro, setModalidadesFiltro] = useState([]);
  const [professoresFiltro, setProfessoresFiltro] = useState([]);
  const [turnosFiltro, setTurnosFiltro] = useState([]);

  const [filtroKPI, setFiltroKPI] = useState(null); 
  const [sortConfig, setSortConfig] = useState({ field: 'totalReceber', direction: 'desc' });
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [itensVisiveis, setItensVisiveis] = useState(20);

  // 🟢 O COFRE AGORA AVALIA SE ALGUM DOS ARRAYS TEM CONTEÚDO
  const isCofreFechado = (role === 'admin' || role === 'mentor') && 
      (paisesFiltro.length === 0 && estadosFiltro.length === 0 && mentoresFiltro.length === 0 && 
       unidadesFiltro.length === 0 && modalidadesFiltro.length === 0 && professoresFiltro.length === 0 && turnosFiltro.length === 0);

  const clearFilters = () => {
      setPaisesFiltro([]); setEstadosFiltro([]); setMentoresFiltro([]); setUnidadesFiltro([]);
      setModalidadesFiltro([]); setProfessoresFiltro([]); setTurnosFiltro([]); setFiltroKPI(null);
  };

  const toggleFiltroKPI = (tipo) => { setFiltroKPI(filtroKPI === tipo ? null : tipo); };

  const period = useMemo(() => {
    let start = "", end = "";
    if (modoFiltro === 'dia') { start = dataFiltro; end = dataFiltro; } 
    else if (modoFiltro === 'mes') {
      const [y, m] = mesFiltro.split('-');
      start = `${y}-${m}-01`; end = new Date(y, m, 0).toISOString().split('T')[0];
    } else { start = dataInicioFiltro; end = dataFimFiltro; }
    return { start, end };
  }, [modoFiltro, dataFiltro, mesFiltro, dataInicioFiltro, dataFimFiltro]);

  // 1. CARREGAMENTO DOS CATÁLOGOS
  useEffect(() => {
    const loadCatalogs = async () => {
      setLoading(true);
      try {
        let qUnidades = query(collection(db, 'unidades'), orderBy('nome'));
        if (role === 'mentor') qUnidades = query(collection(db, 'unidades'), where('mentorId', '==', userId));
        else if (role === 'unidade') qUnidades = query(collection(db, 'unidades'), where(documentId(), '==', userData.unidadeId));

        const usersQuery = query(collection(db, 'usuarios'), where('role', '==', 'mentor'));

        const [uniSnap, profSnap, modSnap, usersSnap, feriadosSnap] = await Promise.all([
          getDocs(qUnidades), getDocs(collection(db, 'professores')), getDocs(collection(db, 'modalidades')), 
          getDocs(usersQuery), getDocs(collection(db, 'feriados'))
        ]);

        setCatalogs({
          unidades: uniSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          professores: profSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          modalidades: modSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          users: usersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          feriados: feriadosSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

        if (role === 'unidade') setUnidadesFiltro([userData.unidadeId]);

      } catch (e) { console.error("Erro loading catálogos:", e); } 
      finally { setLoading(false); }
    };
    loadCatalogs();
  }, [role, userId, userData]);

  // 2. MOTOR TEMPO REAL 
  useEffect(() => {
      if (isCofreFechado) {
          setAulasRealtime([]); setValidacoesRealtime([]); setValidacoesYTD([]); return;
      }

      const aulasRef = collection(db, 'aulas');
      const validacoesRef = collection(db, 'validacoes');
      
      const currentYear = new Date(period.start + 'T00:00:00').getFullYear();
      const startOfYear = `${currentYear}-01-01`;
      const endOfYear = `${currentYear}-12-31`;

      let qAulas = query(aulasRef);
      let qValidacoes = query(validacoesRef, where('data', '>=', period.start), where('data', '<=', period.end));
      let qValidacoesYTD = query(validacoesRef, where('data', '>=', startOfYear), where('data', '<=', endOfYear));

      if (role === 'unidade') {
          qAulas = query(aulasRef, where('unidadeId', '==', userData.unidadeId));
          qValidacoes = query(qValidacoes, where('unidadeId', '==', userData.unidadeId));
          qValidacoesYTD = query(qValidacoesYTD, where('unidadeId', '==', userData.unidadeId));
      } else if (role === 'professor') {
          const meuPerfil = catalogs.professores.find(p => p.uidLogin === userId);
          if (meuPerfil) {
              qAulas = query(aulasRef, where('professorId', '==', meuPerfil.id));
              qValidacoes = query(qValidacoes, where('professorId', '==', meuPerfil.id));
              qValidacoesYTD = query(qValidacoesYTD, where('professorId', '==', meuPerfil.id));
          }
      }

      const unsubAulas = onSnapshot(qAulas, (snap) => setAulasRealtime(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      const unsubValidacoes = onSnapshot(qValidacoes, (snap) => setValidacoesRealtime(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      const unsubValidacoesYTD = onSnapshot(qValidacoesYTD, (snap) => setValidacoesYTD(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

      return () => { unsubAulas(); unsubValidacoes(); unsubValidacoesYTD(); };
  }, [role, userData.unidadeId, period, isCofreFechado, catalogs.professores, userId]);

  // Listas Dinâmicas de Filtros
  const listasFiltros = useMemo(() => {
    const units = catalogs.unidades.filter(u => 
        (paisesFiltro.length === 0 || paisesFiltro.includes(u.pais?.toUpperCase())) && 
        (estadosFiltro.length === 0 || estadosFiltro.includes(u.estado?.toUpperCase())) && 
        (mentoresFiltro.length === 0 || mentoresFiltro.includes(u.mentorId))
    ).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')); 

    const paises = [...new Set(catalogs.unidades.map(u => u.pais?.toUpperCase()).filter(Boolean))].sort();
    const estados = [...new Set(catalogs.unidades.filter(u => paisesFiltro.length === 0 || paisesFiltro.includes(u.pais?.toUpperCase())).map(u => u.estado?.toUpperCase()).filter(Boolean))].sort();
    
    const mentorIds = [...new Set(units.map(u => u.mentorId).filter(Boolean))];
    const mentores = mentorIds.map(id => {
        const user = catalogs.users.find(u => u.id === id || u.uid === id); 
        return { id, nome: (user?.nome || 'DESCONHECIDO').toUpperCase() };
    }).sort((a, b) => a.nome.localeCompare(b.nome));

    return { paises, estados, mentores, unidadesFiltradas: units };
  }, [catalogs, paisesFiltro, estadosFiltro, mentoresFiltro]);

  // 3. PROCESSAMENTO CORE 
  const processamentoBase = useMemo(() => {
    if (catalogs.unidades.length === 0 || isCofreFechado) return [];

    const todayStr = getTodayStr();
    const valMapTitular = {};
    const valMapSubstituto = {};
    const substituicoesMap = {};
    const auloes = [];

    (validacoesRealtime || []).forEach(v => {
        if (v.isAulao) { auloes.push(v); return; }
        if (v.substituicao) {
            if (!valMapSubstituto[v.aulaId]) valMapSubstituto[v.aulaId] = [];
            valMapSubstituto[v.aulaId].push(v);
            const subKey = `${v.aulaId}_${v.professorId}`;
            if (!substituicoesMap[subKey]) substituicoesMap[subKey] = [];
            substituicoesMap[subKey].push(v);
        } else {
            if (!valMapTitular[v.aulaId]) valMapTitular[v.aulaId] = [];
            valMapTitular[v.aulaId].push(v);
        }
    });

    const checkIsFeriado = (dateStr, unidadeId) => {
        const dObj = new Date(dateStr + 'T00:00:00');
        return (catalogs.feriados || []).some(f => {
            const aplica = !f.unidadeId || String(f.unidadeId) === String(unidadeId);
            if (!aplica) return false;
            if (f.data === dateStr) return true;
            if (f.dataInicio && f.dataFim) { return dObj >= new Date(f.dataInicio + 'T00:00:00') && dObj <= new Date(f.dataFim + 'T00:00:00'); }
            return false;
        });
    };

    const buildHistoricoComFeriados = (aula, validacoesExistentes) => {
        const historicoCompleto = [...(validacoesExistentes || [])];
        const start = new Date(period.start + 'T00:00:00');
        const end = new Date(period.end + 'T00:00:00');
        const todayObj = new Date(todayStr + 'T00:00:00');

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (d > todayObj) continue; 
            const dateStr = d.toISOString().split('T')[0];
            const diaNome = diasSemanaMap[d.getDay()];
            
            if (aula.dataInicio && dateStr < aula.dataInicio) continue;
            if (aula.dataFim && dateStr > aula.dataFim) continue;

            if (aula.dias && aula.dias.includes(diaNome)) {
                const jaTemValidacao = historicoCompleto.some(v => v.data === dateStr);
                if (!jaTemValidacao && checkIsFeriado(dateStr, aula.unidadeId)) {
                    historicoCompleto.push({ data: dateStr, status: 'cancelada', motivoCancelamento: 'RECESSO/FERIADO AUTOMÁTICO', isFeriadoVirtual: true });
                }
            }
        }
        return historicoCompleto;
    };

    let todasLinhas = [];

    (aulasRealtime || []).forEach(aula => {
        const historicoTitular = buildHistoricoComFeriados(aula, valMapTitular[aula.id]);
        todasLinhas.push({ tipo: 'titular', aulaBase: aula, professorId: aula.professorId, validacoes: historicoTitular, validacoesSubstituido: valMapSubstituto[aula.id] || [] });
    });

    Object.keys(substituicoesMap).forEach(key => {
        const [aulaId, profId] = key.split('_');
        const aulaBase = aulasRealtime.find(a => String(a.id) === String(aulaId));
        if (aulaBase) { todasLinhas.push({ tipo: 'substituto', aulaBase: aulaBase, professorId: profId, validacoes: substituicoesMap[key], validacoesSubstituido: [] }); }
    });

    auloes.forEach(v => {
        const diaSemana = diasSemanaMap[new Date(v.data + 'T00:00:00').getDay()];
        todasLinhas.push({ tipo: 'aulao', aulaBase: { id: `aulao_${v.id}`, unidadeId: v.unidadeId, modalidadeId: v.modalidadeId, professorId: v.professorId, hora: v.hora || "00:00", valor: v.valorPago || 0, dias: [diaSemana] }, professorId: v.professorId, validacoes: [v], validacoesSubstituido: [] });
    });

    return todasLinhas.map(item => {
        const { aulaBase, professorId, validacoes, validacoesSubstituido } = item;
        const unidade = catalogs.unidades.find(u => String(u.id) === String(aulaBase.unidadeId));
        if (!unidade) return null;

        // 🟢 CÓDIGO BLINDADO PARA ARRAYS DE FILTROS (MULTI-SELECT)
        if (paisesFiltro.length > 0 && !paisesFiltro.includes(unidade.pais?.toUpperCase())) return null;
        if (estadosFiltro.length > 0 && !estadosFiltro.includes(unidade.estado?.toUpperCase())) return null;
        if (mentoresFiltro.length > 0 && !mentoresFiltro.includes(unidade.mentorId)) return null;
        if (unidadesFiltro.length > 0 && !unidadesFiltro.includes(aulaBase.unidadeId)) return null;
        if (modalidadesFiltro.length > 0 && !modalidadesFiltro.includes(aulaBase.modalidadeId)) return null;
        if (turnosFiltro.length > 0 && !checkTurno(aulaBase.hora, turnosFiltro)) return null;

        if (role === 'professor') {
            const me = catalogs.professores.find(p => p.uidLogin === userId);
            if (!me || String(professorId) !== String(me.id)) return null;
        } else if (professoresFiltro.length > 0 && !professoresFiltro.includes(professorId)) return null;

        const professor = catalogs.professores.find(p => String(p.id) === String(professorId));
        const modalidade = catalogs.modalidades.find(m => String(m.id) === String(aulaBase.modalidadeId));

        const historicoSeguro = validacoes || [];
        const aulasRealizadas = historicoSeguro.filter(v => v.status === 'realizada').length;
        const aulasCanceladas = historicoSeguro.filter(v => v.status === 'cancelada').length; 
        
        if (filtroKPI === 'realizadas' && aulasRealizadas === 0) return null;
        if (filtroKPI === 'canceladas' && aulasCanceladas === 0) return null;

        const totalAlunos = historicoSeguro.filter(v => v.status === 'realizada').reduce((acc, v) => acc + (Number(v.alunos) || 0), 0);
        const mediaAlunos = aulasRealizadas > 0 ? Math.round(totalAlunos / aulasRealizadas) : 0;
        
        const valorHora = parseFloat(aulaBase.valor) || 0;
        const totalReceber = aulasRealizadas * valorHora; 

        const metragem = Number(unidade.metragemSalaColetiva) || 0;
        const indiceMod = Number(modalidade?.indiceOcupacao) || 3;
        const capacidade = metragem > 0 ? Math.floor(metragem / indiceMod) : 0;
        const ocupacao = capacidade > 0 ? (mediaAlunos / capacidade) * 100 : 0;

        return {
            id: item.tipo === 'titular' ? aulaBase.id : (item.tipo === 'aulao' ? `view_${aulaBase.id}` : `${aulaBase.id}_sub_${professorId}`),
            unidadeId: aulaBase.unidadeId,
            unidadeNome: (unidade.nome || '').toUpperCase(), 
            unidadeEstado: (unidade.estado || '').toUpperCase(), 
            unidadePais: (unidade.pais || '').toUpperCase(),
            professorNome: (professor?.nome || 'SEM PROFESSOR').toUpperCase(),
            tipoLinha: item.tipo,
            modalidadeNome: (modalidade?.nome || 'DESCONHECIDA').toUpperCase(), 
            modalidadeCor: modalidade?.cor || '#ccc',
            dias: aulaBase.dias || [], horario: aulaBase.hora,
            aulasRealizadas, aulasCanceladas, mediaAlunos, totalAlunos, valorHora, totalReceber,
            ocupacao, capacidade, metragem,
            historico: historicoSeguro, historicoSubstituido: validacoesSubstituido || [],
            aulaBase
        };
    }).filter(Boolean);
  }, [catalogs, aulasRealtime, validacoesRealtime, period, paisesFiltro, estadosFiltro, mentoresFiltro, unidadesFiltro, modalidadesFiltro, professoresFiltro, turnosFiltro, filtroKPI, role, userId, isCofreFechado]);

  const relatorioFinal = useMemo(() => {
      let resultado = [];
      if (viewMode === 'detalhado') { resultado = [...(processamentoBase || [])]; } 
      else {
          const grouped = {};
          (processamentoBase || []).forEach(row => {
              const groupKey = `${row.unidadeNome}_${row.modalidadeNome}_${row.professorNome}`;
              if (!grouped[groupKey]) {
                  grouped[groupKey] = { ...row, id: groupKey, isGroup: true, horariosSet: new Set([row.horario]), diasSet: new Set([...(row.dias || [])]), somaOcupacao: row.ocupacao || 0, countOcupacao: 1, aulasFilhas: [row] };
              } else {
                  grouped[groupKey].aulasRealizadas += row.aulasRealizadas; grouped[groupKey].aulasCanceladas += row.aulasCanceladas; grouped[groupKey].totalAlunos += row.totalAlunos; grouped[groupKey].totalReceber += row.totalReceber; grouped[groupKey].somaOcupacao += (row.ocupacao || 0); grouped[groupKey].countOcupacao += 1; grouped[groupKey].horariosSet.add(row.horario); (row.dias || []).forEach(d => grouped[groupKey].diasSet.add(d)); grouped[groupKey].aulasFilhas.push(row);
              }
          });
          resultado = Object.values(grouped).map(g => {
              g.mediaAlunos = g.aulasRealizadas > 0 ? Math.round(g.totalAlunos / g.aulasRealizadas) : 0; 
              g.horario = g.horariosSet.size > 1 ? "VÁRIOS HORÁRIOS" : Array.from(g.horariosSet)[0];
              g.dias = Array.from(g.diasSet); g.ocupacao = g.countOcupacao > 0 ? (g.somaOcupacao / g.countOcupacao) : 0; 
              return g;
          });
      }

      return resultado.sort((a, b) => {
        let valA = a[sortConfig.field] || 0; let valB = b[sortConfig.field] || 0;
        if (typeof valA === 'string') valA = valA.toLowerCase(); if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1; if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [processamentoBase, viewMode, sortConfig]);

  const relatorioVisivel = useMemo(() => (relatorioFinal || []).slice(0, itensVisiveis), [relatorioFinal, itensVisiveis]);
  
  const handleCarregarMais = (qtd) => {
    if (qtd === 'todos') setItensVisiveis(relatorioFinal.length);
    else setItensVisiveis(prev => prev + qtd);
  };

  const kpis = useMemo(() => {
    const baseSegura = processamentoBase || [];
    
    const totalRealizadas = baseSegura.reduce((acc, r) => acc + (r.aulasRealizadas || 0), 0);
    const totalCanceladas = baseSegura.reduce((acc, r) => acc + (r.aulasCanceladas || 0), 0);
    const totalFinanceiro = baseSegura.reduce((acc, r) => acc + (r.totalReceber || 0), 0);
    const somaAlunos = baseSegura.reduce((acc, r) => acc + (r.totalAlunos || 0), 0);
    const mediaAlunos = totalRealizadas > 0 ? Math.round(somaAlunos / totalRealizadas) : 0;
    const custoMedio = baseSegura.length > 0 ? baseSegura.reduce((acc, r) => acc + (r.valorHora || 0), 0) / baseSegura.length : 0;
    
    const itensComAulaRealizada = baseSegura.filter(r => r.aulasRealizadas > 0 && r.metragem > 0);
    const mediaOcupacao = itensComAulaRealizada.length > 0 ? itensComAulaRealizada.reduce((acc, r) => acc + (r.ocupacao || 0), 0) / itensComAulaRealizada.length : 0;

    let totalBuracosGlobais = 0; let maxSlotsGlobais = 0;
    const startMs = new Date(period.start + 'T00:00:00').getTime(); const endMs = new Date(period.end + 'T00:00:00').getTime();
    const difDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;

    (listasFiltros.unidadesFiltradas || []).forEach(u => {
        const aulasDaUnidade = (aulasRealtime || []).filter(a => String(a.unidadeId) === String(u.id));
        let buracosUnidade = 0;
        DIAS_UTEIS.forEach(dia => {
            const aulasNoDia = aulasDaUnidade.filter(a => (a.dias || []).includes(dia));
            const buracosStr = processarBuracos(aulasNoDia, turnosFiltro);
            buracosStr.forEach(j => {
                const [inicio, fim] = j.split(' - ');
                buracosUnidade += Math.floor((timeToMins(fim) - timeToMins(inicio)) / DURACAO_AULA_PADRAO);
            });
        });
        const semanasNoPeriodo = difDays / 7;
        totalBuracosGlobais += (buracosUnidade * semanasNoPeriodo);
    });
    
    let maxSlotsPorDia = 24; 
    if (turnosFiltro.length === 1) {
        if (turnosFiltro.includes('Manhã')) maxSlotsPorDia = 9; 
        else if (turnosFiltro.includes('Tarde')) maxSlotsPorDia = 9; 
        else if (turnosFiltro.includes('Noite')) maxSlotsPorDia = 6; 
    }
    
    const diasUteisNoPeriodo = difDays * (5/7); 
    maxSlotsGlobais = (listasFiltros.unidadesFiltradas || []).length * maxSlotsPorDia * diasUteisNoPeriodo;
    const taxaVacancia = maxSlotsGlobais > 0 ? Math.min((totalBuracosGlobais / maxSlotsGlobais) * 100, 100) : 0;

    // 🟢 INTELIGÊNCIA YTD REAL-TIME BLINDADA (LENDO AS VALIDAÇÕES DO BANCO)
    const currentYear = new Date(period.start + 'T00:00:00').getFullYear();
    const currentMonthIdx = new Date(period.start + 'T00:00:00').getMonth(); 
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const historicoYTD = mesesNomes.map((nome, idx) => {
        let valor = 0; let status = 'pendente'; 

        if (idx < currentMonthIdx) {
            const mesFormatado = String(idx + 1).padStart(2, '0');
            const prefix = `${currentYear}-${mesFormatado}`;
            
            // O Segredo: Filtra só as validações do mês específico que passaram pelo filtro gigante da base
            const valsMes = (validacoesYTD || []).filter(v => v.data && v.data.startsWith(prefix) && v.status === 'realizada');
            valsMes.forEach(v => {
                const aula = (aulasRealtime || []).find(a => String(a.id) === String(v.aulaId));
                if (!aula) return;
                
                // Filtros Múltiplos Espaciais Aplicados Retroativamente
                const u = (catalogs.unidades || []).find(x => String(x.id) === String(aula.unidadeId));
                if (!u) return;
                if (paisesFiltro.length > 0 && !paisesFiltro.includes(u.pais?.toUpperCase())) return;
                if (estadosFiltro.length > 0 && !estadosFiltro.includes(u.estado?.toUpperCase())) return;
                if (mentoresFiltro.length > 0 && !mentoresFiltro.includes(u.mentorId)) return;
                if (unidadesFiltro.length > 0 && !unidadesFiltro.includes(aula.unidadeId)) return;
                if (modalidadesFiltro.length > 0 && !modalidadesFiltro.includes(aula.modalidadeId)) return;
                if (professoresFiltro.length > 0 && !professoresFiltro.includes(aula.professorId)) return;
                if (turnosFiltro.length > 0 && !checkTurno(aula.hora, turnosFiltro)) return;

                valor += (parseFloat(aula.valor) || 0);
            });
            status = 'fechado';

        } else if (idx === currentMonthIdx) {
            valor = totalFinanceiro; status = 'atual';
        }

        return { mes: nome, valor, status };
    });

    const maxTrendYTD = Math.max(...historicoYTD.map(h => h.valor)) || 1;

    return { totalFinanceiro, totalRealizadas, totalCanceladas, mediaAlunos, custoMedio, mediaOcupacao, taxaVacancia, historicoYTD, maxTrendYTD };
  }, [processamentoBase, listasFiltros.unidadesFiltradas, aulasRealtime, period, turnosFiltro, validacoesYTD, paisesFiltro, estadosFiltro, mentoresFiltro, unidadesFiltro, modalidadesFiltro, professoresFiltro, catalogs.unidades]);

  const handleSort = (field) => {
    setSortConfig(prev => ({ field, direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc' }));
  };
  const toggleRow = (id) => setExpandedRowId(prev => prev === id ? null : id);

  const handleExport = (type) => {
    setShowExportMenu(false);
    const headers = ["País", "Estado", "Unidade", "Modalidade", "Horário", "Professor", "Tipo", "Aulas Realizadas", "Aulas Canceladas", "Média Alunos", "Taxa Ocupação", "Valor Hora Aula", "Total a Receber"];
    const rows = relatorioFinal.map(r => {
        return [ r.unidadePais||"-", r.unidadeEstado||"-", r.unidadeNome, r.modalidadeNome, r.horario, r.professorNome, r.isGroup ? "AGRUPADO" : (r.tipoLinha === 'aulao' ? "AULÃO" : (r.tipoLinha === 'substituto' ? "SUBSTITUTO" : "TITULAR")), r.aulasRealizadas, r.aulasCanceladas, r.mediaAlunos, `${(r.ocupacao || 0).toFixed(1)}%`, formatCurrency(r.valorHora), formatCurrency(r.totalReceber) ];
    });

    if (type === 'csv' || type === 'excel') {
        const csvContent = [headers.join(";"), ...rows.map(row => row.join(";"))].join("\n");
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `relatorio_folha_${type}_${period.start}.csv`);
        document.body.appendChild(link);
        link.click();
    }
  };

  if (loading && catalogs.unidades.length === 0) return <div className="flex h-screen items-center justify-center text-slate-400 dark:text-slate-500 gap-2"><LayoutDashboard className="animate-spin"/> Carregando Relatório...</div>;

  const themeOcupacao = getOcupacaoTheme(kpis.mediaOcupacao);
  const themeMedia = getMediaAlunosTheme(kpis.mediaAlunos);

  return (
    <div className="p-6 md:p-8 max-w-[1920px] mx-auto animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <span className="bg-emerald-600 text-white p-2 rounded-lg shadow-lg shadow-emerald-500/20"><BarChart2 className="w-6 h-6" /></span>
            Inteligência Financeira
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">Painel Executivo de Folha e Ocupação</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto max-w-full">
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1 shrink-0">
            <button onClick={() => setModoFiltro('dia')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all uppercase ${modoFiltro === 'dia' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>DIA</button>
            <button onClick={() => setModoFiltro('mes')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all uppercase ${modoFiltro === 'mes' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>MÊS</button>
            <button onClick={() => setModoFiltro('periodo')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all uppercase ${modoFiltro === 'periodo' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>PERÍODO</button>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-600 mx-1 shrink-0"></div>
          
          <div className="shrink-0 flex items-center gap-2">
            {modoFiltro === 'dia' && <input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-white outline-none text-sm p-1"/>}
            {modoFiltro === 'mes' && <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-white outline-none text-sm p-1"/>}
            {modoFiltro === 'periodo' && (
                <>
                  <input type="date" value={dataInicioFiltro} onChange={e => setDataInicioFiltro(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-white outline-none text-sm p-1"/>
                  <span className="text-[10px] font-black text-slate-400">ATÉ</span>
                  <input type="date" value={dataFimFiltro} onChange={e => setDataFimFiltro(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-white outline-none text-sm p-1"/>
                </>
            )}
          </div>
          
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-600 mx-1 shrink-0"></div>
          <div className="relative shrink-0">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-2 font-bold text-xs"><Download className="w-4 h-4"/> Exportar</button>
            {showExportMenu && (<div className="absolute right-0 top-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl w-40 z-50 overflow-hidden animate-in fade-in zoom-in duration-200"><button onClick={() => handleExport('excel')} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300"><FileSpreadsheet className="w-4 h-4 text-green-600"/> Excel (XLSX)</button><button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300"><FileText className="w-4 h-4 text-blue-600"/> CSV</button></div>)}
          </div>
        </div>
      </div>

      {/* 🟢 FILTROS AVANÇADOS COM MULTI-SELECT (SEMÁFORO) */}
      {role !== 'professor' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative group/filter animate-fade-in z-20">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-2"><Filter className="w-3 h-3"/> Filtros Avançados (Múltipla Escolha)</h4>
                <button onClick={clearFilters} className="text-[10px] font-bold text-red-500 hover:text-red-600 dark:text-red-400 flex items-center gap-1 opacity-0 group-hover/filter:opacity-100 transition-opacity bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg"><X className="w-3 h-3"/> Limpar Filtros</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                {role === 'admin' && (
                    <>
                        <MultiSelectDropdown label="País" options={(listasFiltros.paises || []).map(p => ({id: p, label: p}))} selected={paisesFiltro} onChange={setPaisesFiltro} placeholder="TODOS" />
                        <MultiSelectDropdown label="Estado" options={(listasFiltros.estados || []).map(e => ({id: e, label: e}))} selected={estadosFiltro} onChange={setEstadosFiltro} placeholder="TODOS" />
                        <MultiSelectDropdown label="Mentor" options={(listasFiltros.mentores || []).map(m => ({id: m.id, label: m.nome}))} selected={mentoresFiltro} onChange={setMentoresFiltro} placeholder="TODOS" />
                    </>
                )}
                {role !== 'unidade' && (
                    <MultiSelectDropdown label="Unidade" options={(listasFiltros.unidadesFiltradas || []).map(u => ({id: u.id, label: u.nome.toUpperCase()}))} selected={unidadesFiltro} onChange={setUnidadesFiltro} placeholder="TODAS" />
                )}
                <MultiSelectDropdown label="Modalidade" options={(catalogs.modalidades || []).map(m => ({id: m.id, label: m.nome.toUpperCase()}))} selected={modalidadesFiltro} onChange={setModalidadesFiltro} placeholder="TODAS" />
                <MultiSelectDropdown label="Professor" options={(catalogs.professores || []).map(p => ({id: p.id, label: p.nome.toUpperCase()}))} selected={professoresFiltro} onChange={setProfessoresFiltro} placeholder="TODOS" />
                <MultiSelectDropdown label="Turno" options={[{id: 'Manhã', label: 'MANHÃ (05:30 - 11:59)'}, {id: 'Tarde', label: 'TARDE (12:00 - 17:00)'}, {id: 'Noite', label: 'NOITE (17:01 - 23:00)'}]} selected={turnosFiltro} onChange={setTurnosFiltro} placeholder="TODOS" />
            </div>
        </div>
      )}

      {/* 🟢 O COFRE DE DADOS */}
      {isCofreFechado ? (
          <div className="py-24 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm animate-in fade-in zoom-in duration-300">
            <div className="bg-blue-50 dark:bg-slate-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100 dark:border-slate-800 shadow-inner">
              <Lock className="w-10 h-10 text-blue-500 animate-pulse"/>
            </div>
            <h3 className="text-2xl font-black text-slate-700 dark:text-white mb-3">
                Cofre de Relatórios Ativado
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium max-w-lg mx-auto leading-relaxed">
                Para manter a velocidade do sistema, selecione pelo menos um <strong>Filtro Avançado</strong> para destrancar a inteligência financeira.
            </p>
          </div>
      ) : (
        <>
          {/* 🟢 NOVO PAINEL DE BORDO EXECUTIVO */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              
              {/* BLOCO 1: O COFRE (VISÃO FINANCEIRA YTD) */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 rounded-3xl p-6 xl:p-8 border border-slate-700 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] flex flex-col relative overflow-hidden h-[340px]">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                  
                  <div className="relative z-10 shrink-0">
                      <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-emerald-400/80 font-bold uppercase tracking-widest text-[10px] xl:text-xs">
                              <DollarSign className="w-4 h-4"/> Resumo de Folha
                          </div>
                      </div>
                      <div className="text-4xl xl:text-5xl font-black tracking-tighter text-white mb-1">
                          {formatCurrency(kpis.totalFinanceiro)}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700 pb-4 mb-4">Total a Pagar no Período Filtrado</div>
                  </div>

                  {/* 🟢 GRÁFICO YTD VERTICAL E DINÂMICO */}
                  <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2.5">
                      {(kpis.historicoYTD || []).map((item, i) => (
                          <div key={i} className="flex items-center gap-3 group">
                              <span className={`w-8 text-[9px] font-black uppercase tracking-widest ${item.status === 'atual' ? 'text-emerald-400' : item.status === 'fechado' ? 'text-slate-300 group-hover:text-emerald-400 transition-colors' : 'text-slate-600'}`}>{item.mes}</span>
                              <div className="flex-1 h-3.5 bg-slate-800/50 rounded-sm overflow-hidden flex items-center relative">
                                  <div 
                                      className={`h-full transition-all duration-1000 ${item.status === 'atual' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : item.status === 'fechado' ? 'bg-slate-500 group-hover:bg-emerald-400' : 'bg-transparent'}`} 
                                      style={{ width: `${Math.max(item.valor > 0 ? 5 : 0, (item.valor / (kpis.maxTrendYTD || 1)) * 100)}%` }}
                                  ></div>
                              </div>
                              <span className={`w-16 text-right text-[10px] font-black tracking-tighter ${item.status === 'atual' ? 'text-emerald-400' : item.status === 'fechado' ? 'text-slate-200 group-hover:text-emerald-400 transition-colors' : 'text-slate-600'}`}>
                                  {item.valor > 0 ? formatCurrency(item.valor) : '-'}
                              </span>
                          </div>
                      ))}
                  </div>
              </div>

              {/* BLOCO 2: MOTOR OPERACIONAL */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 xl:p-8 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between relative overflow-hidden h-[340px]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                  
                  <div>
                      <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px] xl:text-xs">
                              <Activity className="w-4 h-4 text-blue-500"/> Motor Operacional
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div className="flex items-center justify-between p-3">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center"><CheckCircle2 className="w-4 h-4"/></div>
                                  <div>
                                      <span className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Aulas Realizadas</span>
                                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Volume Validado</span>
                                  </div>
                              </div>
                              <span className="text-xl font-black text-slate-800 dark:text-white">{kpis.totalRealizadas}</span>
                          </div>

                          <div className="flex items-center justify-between p-3">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 flex items-center justify-center"><XCircle className="w-4 h-4"/></div>
                                  <div>
                                      <span className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Aulas Canceladas</span>
                                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Perda de Receita</span>
                                  </div>
                              </div>
                              <span className="text-xl font-black text-red-500">{kpis.totalCanceladas}</span>
                          </div>

                          <div className="flex items-center justify-between p-3">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 flex items-center justify-center"><Clock className="w-4 h-4"/></div>
                                  <div>
                                      <span className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Valor Médio P/ Aula</span>
                                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Custo da Hora</span>
                                  </div>
                              </div>
                              <span className="text-lg font-black text-slate-800 dark:text-white">{formatCurrency(kpis.custoMedio)}</span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* BLOCO 3: SAÚDE DA GRADE (COM SEMÁFORO DE CORES) */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 xl:p-8 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between relative overflow-hidden h-[340px]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                  
                  <div>
                      <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px] xl:text-xs">
                              <TrendingUp className="w-4 h-4 text-purple-500"/> Saúde da Grade
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div className="p-3">
                              <div className="flex justify-between items-end mb-2">
                                  <div className="flex items-center gap-2">
                                      <PieChart className={`w-4 h-4 ${themeOcupacao.text}`}/>
                                      <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Taxa de Ocupação</span>
                                  </div>
                                  <span className={`text-xl font-black ${themeOcupacao.text}`}>{(kpis.mediaOcupacao || 0).toFixed(1)}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${themeOcupacao.bg}`} style={{ width: `${Math.min(kpis.mediaOcupacao || 0, 100)}%` }}></div>
                              </div>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase mt-1.5 text-right">Lotação das Salas M²</span>
                          </div>

                          <div className="p-3">
                              <div className="flex justify-between items-end mb-2">
                                  <div className="flex items-center gap-2">
                                      <AlertTriangle className="w-4 h-4 text-rose-500"/>
                                      <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Taxa de Vacância</span>
                                  </div>
                                  <span className="text-xl font-black text-rose-500 dark:text-rose-400">{(kpis.taxaVacancia || 0).toFixed(1)}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-rose-500" style={{ width: `${kpis.taxaVacancia || 0}%` }}></div>
                              </div>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase mt-1.5 text-right">Ociosidade da Grade</span>
                          </div>

                          <div className="flex items-center justify-between p-3 border-t border-slate-100 dark:border-slate-700 pt-4">
                              <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${themeMedia.icon}`}><Users className="w-4 h-4"/></div>
                                  <div>
                                      <span className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Média de Alunos</span>
                                  </div>
                              </div>
                              <span className={`text-xl font-black ${themeMedia.text}`}>{kpis.mediaAlunos}</span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* ÁREA DA TABELA (TABS + GRADE) */}
          <div className="space-y-4 animate-fade-in mt-6">
              <div className="flex justify-start">
                  <div className="flex p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <button 
                          onClick={() => { setViewMode('agrupado'); setExpandedRowId(null); }} 
                          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase transition-all ${viewMode === 'agrupado' ? 'bg-slate-100 dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                          <Layers className="w-4 h-4"/> Resumo da Folha
                      </button>
                      <button 
                          onClick={() => { setViewMode('detalhado'); setExpandedRowId(null); }} 
                          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase transition-all ${viewMode === 'detalhado' ? 'bg-slate-100 dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                          <AlignJustify className="w-4 h-4"/> Detalhado
                      </button>
                  </div>
              </div>

              {/* 🟢 TABELA DE DADOS COM CORES CONDICIONAIS */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1300px]">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                      <tr>
                        <th className="p-3 w-8"></th>
                        <SortableHeader label="UNIDADE (PAÍS/ESTADO)" field="unidadeNome" currentSort={sortConfig} onSort={handleSort} />
                        <SortableHeader label="MODALIDADE" field="modalidadeNome" currentSort={sortConfig} onSort={handleSort} />
                        <SortableHeader label={viewMode === 'agrupado' ? 'TURNOS' : 'HORÁRIO'} field="horario" currentSort={sortConfig} onSort={handleSort} />
                        <SortableHeader label="PROFESSOR" field="professorNome" currentSort={sortConfig} onSort={handleSort} />
                        
                        <SortableHeader label="REALIZADAS" field="aulasRealizadas" currentSort={sortConfig} onSort={handleSort} align="center" />
                        <SortableHeader label="CANCELADAS" field="aulasCanceladas" currentSort={sortConfig} onSort={handleSort} align="center" />
                        <SortableHeader label="MÉDIA ALUNOS" field="mediaAlunos" currentSort={sortConfig} onSort={handleSort} align="center" />
                        <SortableHeader label="TAXA OCUPAÇÃO" field="ocupacao" currentSort={sortConfig} onSort={handleSort} align="center" />
                        
                        <SortableHeader label="VALOR AULA" field="valorHora" currentSort={sortConfig} onSort={handleSort} align="right" />
                        <SortableHeader label="A RECEBER" field="totalReceber" currentSort={sortConfig} onSort={handleSort} align="right" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                      {(relatorioVisivel || []).map((row) => {
                          const rowOcupTheme = getOcupacaoTheme(row.ocupacao || 0);
                          const rowMediaTheme = getMediaAlunosTheme(row.mediaAlunos || 0);

                          return (
                            <React.Fragment key={row.id}>
                              <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group ${expandedRowId === row.id ? 'bg-slate-50 dark:bg-slate-700/30 border-l-4 border-l-blue-500' : ''}`} onClick={() => toggleRow(row.id)}>
                                <td className="p-3 text-slate-300 group-hover:text-blue-500 transition-colors">
                                  {expandedRowId === row.id ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                                </td>
                                <td className="p-3">
                                    <div className="font-bold text-slate-700 dark:text-slate-200 uppercase">{row.unidadeNome}</div>
                                    <div className="text-[9px] text-slate-400 uppercase">{row.unidadePais} - {row.unidadeEstado}</div>
                                </td>
                                <td className="p-3">
                                    <span className="px-2 py-0.5 rounded font-bold uppercase text-[9px]" style={{ backgroundColor: row.modalidadeCor + '20', color: row.modalidadeCor }}>{row.modalidadeNome}</span>
                                </td>
                                <td className="p-3 font-mono text-slate-600 dark:text-slate-400 text-xs">
                                    {row.isGroup && row.horario === 'VÁRIOS HORÁRIOS' ? (
                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded font-bold uppercase">VÁRIOS</span>
                                    ) : row.horario}
                                </td>
                                <td className="p-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border 
                                            ${row.tipoLinha === 'substituto' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                                              row.tipoLinha === 'aulao' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                              'bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                                            {getInitials(row.professorNome)}
                                        </div>
                                        <div>
                                            <span className={`font-bold uppercase ${row.tipoLinha === 'substituto' ? 'text-blue-600 dark:text-blue-400' : row.tipoLinha === 'aulao' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-800 dark:text-white'}`}>{row.professorNome}</span>
                                            {row.isGroup && <span className="block text-[8px] uppercase font-black text-slate-400">TOTAL CONSOLIDADO</span>}
                                            {!row.isGroup && row.tipoLinha === 'substituto' && <span className="block text-[8px] uppercase font-black text-blue-400 flex items-center gap-0.5"><ArrowRightLeft className="w-2 h-2"/> SUBSTITUTO</span>}
                                            {!row.isGroup && row.tipoLinha === 'aulao' && <span className="block text-[8px] uppercase font-black text-purple-400 flex items-center gap-0.5"><Star className="w-2 h-2"/> AULÃO ESPECIAL</span>}
                                        </div>
                                    </div>
                                </td>
                                
                                <td className="p-3 text-center font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/10 rounded">{row.aulasRealizadas}</td>
                                
                                <td className={`p-3 text-center font-bold rounded ${row.aulasCanceladas > 0 ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'text-slate-300'}`}>
                                    {row.aulasCanceladas > 0 ? row.aulasCanceladas : '-'}
                                </td>
                                
                                <td className={`p-3 text-center font-bold ${rowMediaTheme.text}`}>{row.mediaAlunos}</td>

                                <td className="p-3 align-middle min-w-[120px]">
                                    {row.metragem === 0 ? (
                                        <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-400 px-2 py-1 rounded block text-center">S/ M²</span>
                                    ) : (
                                        <div className="flex flex-col gap-1 w-full max-w-[90px] mx-auto">
                                            <div className="flex justify-between items-end">
                                                <span className={`text-[10px] font-black ${rowOcupTheme.text}`}>
                                                    {(row.ocupacao || 0).toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${rowOcupTheme.bg}`} style={{ width: `${Math.min(row.ocupacao || 0, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    )}
                                </td>
                                
                                <td className="p-3 text-right text-slate-500 dark:text-slate-400">{formatCurrency(row.valorHora)}</td>
                                <td className="p-3 text-right font-mono text-green-600 font-black text-sm">{formatCurrency(row.totalReceber)}</td>
                              </tr>
                              
                              {/* EXPANSÃO DA GAVETA */}
                              {expandedRowId === row.id && (
                                <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-700 shadow-inner">
                                  <td colSpan="11" className="p-4 pl-12">
                                    {row.isGroup ? (
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">DETALHAMENTO DOS HORÁRIOS</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {(row.aulasFilhas || []).map(filha => {
                                                    const filhaOcupTheme = getOcupacaoTheme(filha.ocupacao || 0);
                                                    return (
                                                    <div key={filha.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center hover:border-blue-300 transition-colors">
                                                        <div>
                                                            <div className="font-mono font-bold text-blue-600 dark:text-blue-400 mb-0.5"><Clock className="w-3 h-3 inline mr-1 -mt-0.5"/>{filha.horario}</div>
                                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{(filha.dias || []).join(', ').toUpperCase()}</div>
                                                        </div>
                                                        <div className="text-right flex flex-col items-end">
                                                            <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">{filha.aulasRealizadas} AULAS REALIZADAS</div>
                                                            <div className={`text-[10px] font-bold ${filhaOcupTheme.text} bg-slate-100 dark:bg-slate-700 mt-1 px-2 py-0.5 rounded uppercase`}>{filha.metragem > 0 ? `${(filha.ocupacao || 0).toFixed(0)}% OCUPAÇÃO` : 'S/ M²'}</div>
                                                            <div className="text-xs font-black text-slate-700 dark:text-slate-300 mt-1">{formatCurrency(filha.totalReceber)}</div>
                                                        </div>
                                                    </div>
                                                )})}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                                            {(row.dias || []).map(dia => {
                                                const datasDoDia = getDatesByWeekdayInPeriod(period.start, period.end, [dia])[dia] || [];
                                                
                                                return (
                                                    <div key={dia} className="flex-1 min-w-[130px] max-w-[180px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden flex flex-col shadow-sm">
                                                    <div className="bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-center border-b border-slate-200 dark:border-slate-600">
                                                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">{dia.toUpperCase()}</span>
                                                    </div>
                                                    <div className="p-2 space-y-1.5 flex-1 min-h-[50px]">
                                                        {(datasDoDia || []).length === 0 && <span className="text-[10px] text-slate-300 text-center block">-</span>}
                                                        {(datasDoDia || []).map(dataStr => {
                                                            const validacao = (row.historico || []).find(h => h.data === dataStr);
                                                            const foiSubstituido = (row.historicoSubstituido || []).find(h => h.data === dataStr);
                                                            
                                                            if (row.aulaBase.dataInicio && dataStr < row.aulaBase.dataInicio) return null;
                                                            if (row.aulaBase.dataFim && dataStr > row.aulaBase.dataFim) return null;

                                                            const diaMes = new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
                                                            
                                                            const itemClass = validacao 
                                                                ? (validacao.status === 'cancelada' 
                                                                    ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-900 dark:text-red-300' 
                                                                    : 'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/20 dark:border-green-900 dark:text-green-300')
                                                                : (foiSubstituido 
                                                                    ? 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 opacity-70' 
                                                                    : 'bg-slate-50 border-slate-100 text-slate-300 dark:bg-slate-900 dark:border-slate-800 opacity-60');

                                                            return (
                                                                <div key={dataStr} className={`text-[9px] px-2 py-1.5 rounded border flex flex-col gap-1 ${itemClass}`}>
                                                                <div className="flex justify-between items-center w-full">
                                                                    <span className="font-bold">{diaMes}</span>
                                                                    {validacao ? (
                                                                        validacao.status === 'cancelada' 
                                                                        ? <span className="font-bold text-[8px] uppercase">CANCEL</span> 
                                                                        : <span className="font-bold flex items-center gap-1"><Users className="w-3 h-3"/> {validacao.alunos}</span>
                                                                    ) : (
                                                                        foiSubstituido 
                                                                        ? <span className="font-bold text-[8px] uppercase flex items-center gap-1"><ArrowRightLeft className="w-2.5 h-2.5"/> SUBST</span> 
                                                                        : <span>--</span>
                                                                    )}
                                                                </div>
                                                                {validacao && validacao.status === 'cancelada' && (
                                                                    <div className="text-[8px] font-bold border-t border-red-200 dark:border-red-800 pt-1 mt-0.5 flex items-center gap-1">
                                                                        <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0"/>
                                                                        <span className="truncate max-w-[100px] uppercase" title={validacao.motivoCancelamento}>{validacao.motivoCancelamento}</span>
                                                                    </div>
                                                                )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                      })}
                      {(relatorioVisivel || []).length === 0 && <tr><td colSpan="11" className="p-8 text-center text-slate-400 text-sm uppercase">SEM DADOS ENCONTRADOS PARA O FILTRO ATUAL.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* BOTÕES DE CARREGAMENTO */}
              {itensVisiveis < (relatorioFinal || []).length && (
                  <div className="flex flex-wrap justify-center gap-3 pb-4 animate-fade-in">
                      <button 
                          onClick={() => handleCarregarMais(20)} 
                          className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm flex items-center gap-2 transition-all uppercase"
                      >
                          <ArrowDown className="w-4 h-4"/> CARREGAR +20
                      </button>
                      <button 
                          onClick={() => handleCarregarMais(50)} 
                          className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm flex items-center gap-2 transition-all uppercase"
                      >
                          CARREGAR +50
                      </button>
                      <button 
                          onClick={() => handleCarregarMais('todos')} 
                          className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-xl text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 shadow-sm flex items-center gap-2 transition-all uppercase"
                      >
                          <DownloadCloud className="w-4 h-4"/> VER TODOS ({(relatorioFinal || []).length})
                      </button>
                  </div>
              )}
          </div>
        </>
      )}
    </div>
  );
}