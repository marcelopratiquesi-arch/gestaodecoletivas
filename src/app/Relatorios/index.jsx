import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { collection, getDocs, onSnapshot, query, where, documentId, orderBy } from 'firebase/firestore'; 
import { 
  BarChart2, Filter, DollarSign, Users, Calendar, 
  CheckCircle2, XCircle, Clock, ChevronRight, ChevronDown, 
  LayoutDashboard, Map, Globe, UserCheck, AlertTriangle, 
  Download, FileSpreadsheet, FileText, X, User, MousePointerClick, ArrowRightLeft,
  ArrowDown, DownloadCloud, Star, AlignJustify, Layers
} from 'lucide-react';

// --- HELPERS ---
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const diasSemanaMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

const getTodayStr = () => new Date().toLocaleDateString('en-CA'); 

const toTitleCase = (str) => {
  if (!str) return "";
  const lower = str.toLowerCase();
  const connectors = ['da', 'de', 'do', 'das', 'dos', 'e', 'em'];
  return lower.split(' ').map((word, index) => {
    if (index > 0 && connectors.includes(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};

const getFirstLast = (fullName) => {
    if (!fullName) return '-';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return toTitleCase(parts[0]);
    const first = parts[0];
    const last = parts[parts.length - 1];
    return toTitleCase(`${first} ${last}`);
};

const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const checkTurno = (timeStr, turno) => {
    if (!timeStr) return false;
    const [h, m] = timeStr.split(':').map(Number);
    const minutes = h * 60 + m;
    if (turno === 'Manhã') return minutes >= 330 && minutes <= 719; 
    if (turno === 'Tarde') return minutes >= 720 && minutes <= 1020; 
    if (turno === 'Noite') return minutes >= 1021 && minutes <= 1380; 
    return true;
};

const getDatesByWeekdayInPeriod = (startStr, endStr, activeDaysArray) => {
  const datesByDay = {};
  activeDaysArray.forEach(d => datesByDay[d] = []);
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayName = diasSemanaMap[d.getDay()];
    if (activeDaysArray.includes(dayName)) {
      datesByDay[dayName].push(new Date(d).toISOString().split('T')[0]);
    }
  }
  return datesByDay;
};

// --- COMPONENTE CARD KPI ---
const KPICard = ({ title, value, icon: Icon, colorClass, iconColorClass, subValue, onClick, isActive }) => (
  <div 
    onClick={onClick}
    className={`p-5 rounded-2xl bg-white dark:bg-slate-800 border transition-all duration-300 cursor-pointer relative group overflow-hidden
      ${isActive 
        ? `border-${colorClass.split('-')[4]}-500 ring-2 ring-${colorClass.split('-')[4]}-200 dark:ring-${colorClass.split('-')[4]}-900 transform -translate-y-1 shadow-lg` 
        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md hover:-translate-y-0.5'
      }
      ${colorClass}
    `}
  >
    <div className="absolute inset-0 bg-white/50 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
    <div className="flex justify-between items-start mb-2 relative z-10">
      <div className={`p-2 rounded-lg ${iconColorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      {subValue && (
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          {subValue}
        </span>
      )}
    </div>
    <div className="relative z-10">
      <h3 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">{value}</h3>
      <p className="text-[11px] font-bold uppercase tracking-wider opacity-60 mt-1 text-slate-500 dark:text-slate-400 flex items-center gap-1">
        {title}
        {isActive && <CheckCircle2 className="w-3 h-3 text-green-500"/>}
      </p>
    </div>
  </div>
);

const SortableHeader = ({ label, field, currentSort, onSort, align = "left", className = "" }) => (
  <th 
    className={`p-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-${align} ${className}`}
    onClick={() => onSort(field)}
  >
    <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
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
  
  const [modoFiltro, setModoFiltro] = useState('mes'); 
  const [dataFiltro, setDataFiltro] = useState(getTodayStr());
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7));
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [viewMode, setViewMode] = useState('agrupado'); // 'detalhado' ou 'agrupado'

  const [paisFiltro, setPaisFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [mentorFiltro, setMentorFiltro] = useState("");
  const [unidadeFiltro, setUnidadeFiltro] = useState("");
  const [modalidadeFiltro, setModalidadeFiltro] = useState("");
  const [professorFiltro, setProfessorFiltro] = useState("");
  const [turnoFiltro, setTurnoFiltro] = useState(""); 

  const [filtroKPI, setFiltroKPI] = useState(null); 
  const [sortConfig, setSortConfig] = useState({ field: 'totalReceber', direction: 'desc' });
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [itensVisiveis, setItensVisiveis] = useState(20);

  const clearFilters = () => {
      setPaisFiltro(""); setEstadoFiltro(""); setMentorFiltro(""); setUnidadeFiltro("");
      setModalidadeFiltro(""); setProfessorFiltro(""); setTurnoFiltro(""); setFiltroKPI(null);
  };

  const toggleFiltroKPI = (tipo) => {
      setFiltroKPI(filtroKPI === tipo ? null : tipo);
  };

  const period = useMemo(() => {
    let start = "", end = "";
    if (modoFiltro === 'dia') {
      start = dataFiltro; end = dataFiltro;
    } else {
      const [y, m] = mesFiltro.split('-');
      start = `${y}-${m}-01`;
      end = new Date(y, m, 0).toISOString().split('T')[0];
    }
    return { start, end };
  }, [modoFiltro, dataFiltro, mesFiltro]);

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
          getDocs(qUnidades),
          getDocs(collection(db, 'professores')), 
          getDocs(collection(db, 'modalidades')), 
          getDocs(usersQuery),
          getDocs(collection(db, 'feriados')) 
        ]);

        setCatalogs({
          unidades: uniSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          professores: profSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          modalidades: modSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          users: usersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          feriados: feriadosSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

        if (role === 'unidade') setUnidadeFiltro(userData.unidadeId);

      } catch (e) { console.error("Erro loading catálogos:", e); } 
      finally { setLoading(false); }
    };
    loadCatalogs();
  }, [role, userId, userData]);

  // 2. MOTOR TEMPO REAL
  useEffect(() => {
      let qAulas = collection(db, 'aulas');
      if (role === 'unidade') qAulas = query(collection(db, 'aulas'), where('unidadeId', '==', userData.unidadeId));

      const validacoesQuery = query(
          collection(db, 'validacoes'), 
          where('data', '>=', period.start), 
          where('data', '<=', period.end)
      );

      const unsubAulas = onSnapshot(qAulas, (snap) => {
          setAulasRealtime(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      const unsubValidacoes = onSnapshot(validacoesQuery, (snap) => {
          setValidacoesRealtime(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      return () => {
          unsubAulas();
          unsubValidacoes();
      };
  }, [role, userData.unidadeId, period]);

  // Listas Dinâmicas de Filtros
  const listasFiltros = useMemo(() => {
    const units = catalogs.unidades.filter(u => 
        (!paisFiltro || u.pais === paisFiltro) && (!estadoFiltro || u.estado === estadoFiltro) && (!mentorFiltro || u.mentorId === mentorFiltro)
    ).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')); 

    const paises = [...new Set(catalogs.unidades.map(u => u.pais).filter(Boolean))].sort();
    const estados = [...new Set(catalogs.unidades.filter(u => !paisFiltro || u.pais === paisFiltro).map(u => u.estado).filter(Boolean))].sort();
    
    const mentorIds = [...new Set(units.map(u => u.mentorId).filter(Boolean))];
    const mentores = mentorIds.map(id => {
        const user = catalogs.users.find(u => u.id === id || u.uid === id); 
        return { id, nome: toTitleCase(user?.nome || 'Desconhecido') };
    }).sort((a, b) => a.nome.localeCompare(b.nome));

    const aulasFiltradas = aulasRealtime.filter(a => {
        if (unidadeFiltro && String(a.unidadeId) !== String(unidadeFiltro)) return false;
        if (!unidadeFiltro && !units.map(u=>u.id).includes(a.unidadeId)) return false;
        if (turnoFiltro && !checkTurno(a.hora, turnoFiltro)) return false;
        return true;
    });

    const modIds = [...new Set(aulasFiltradas.map(a => a.modalidadeId))];
    const modalidades = catalogs.modalidades.filter(m => modIds.includes(m.id));

    const aulasParaProf = aulasFiltradas.filter(a => !modalidadeFiltro || String(a.modalidadeId) === String(modalidadeFiltro));
    const profIds = [...new Set(aulasParaProf.map(a => a.professorId))];
    const professores = catalogs.professores.filter(p => profIds.includes(p.id));

    return { paises, estados, mentores, unidadesFiltradas: units, modalidades, professores };
  }, [catalogs, aulasRealtime, paisFiltro, estadoFiltro, mentorFiltro, unidadeFiltro, modalidadeFiltro, turnoFiltro]);

  // 3. PROCESSAMENTO CORE 
  const processamentoBase = useMemo(() => {
    if (catalogs.unidades.length === 0) return [];

    const todayStr = getTodayStr();
    const valMapTitular = {};
    const valMapSubstituto = {};
    const substituicoesMap = {};
    const auloes = [];

    validacoesRealtime.forEach(v => {
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
        return catalogs.feriados.some(f => {
            const aplica = !f.unidadeId || String(f.unidadeId) === String(unidadeId);
            if (!aplica) return false;
            if (f.data === dateStr) return true;
            if (f.dataInicio && f.dataFim) {
                return dObj >= new Date(f.dataInicio + 'T00:00:00') && dObj <= new Date(f.dataFim + 'T00:00:00');
            }
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
                    historicoCompleto.push({
                        data: dateStr,
                        status: 'cancelada',
                        motivoCancelamento: 'Recesso/Feriado Automático',
                        isFeriadoVirtual: true
                    });
                }
            }
        }
        return historicoCompleto;
    };

    let todasLinhas = [];

    // Titulares
    aulasRealtime.forEach(aula => {
        const historicoTitular = buildHistoricoComFeriados(aula, valMapTitular[aula.id]);
        todasLinhas.push({
            tipo: 'titular', aulaBase: aula, professorId: aula.professorId,
            validacoes: historicoTitular, validacoesSubstituido: valMapSubstituto[aula.id] || []
        });
    });

    // Substitutos
    Object.keys(substituicoesMap).forEach(key => {
        const [aulaId, profId] = key.split('_');
        const aulaBase = aulasRealtime.find(a => String(a.id) === String(aulaId));
        if (aulaBase) {
            todasLinhas.push({
                tipo: 'substituto', aulaBase: aulaBase, professorId: profId,
                validacoes: substituicoesMap[key], validacoesSubstituido: [] 
            });
        }
    });

    // Aulões
    auloes.forEach(v => {
        const diaSemana = diasSemanaMap[new Date(v.data + 'T00:00:00').getDay()];
        todasLinhas.push({
            tipo: 'aulao',
            aulaBase: { id: `aulao_${v.id}`, unidadeId: v.unidadeId, modalidadeId: v.modalidadeId, professorId: v.professorId, hora: v.hora || "00:00", valor: v.valorPago || 0, dias: [diaSemana] },
            professorId: v.professorId,
            validacoes: [v], validacoesSubstituido: []
        });
    });

    return todasLinhas.map(item => {
        const { aulaBase, professorId, validacoes, validacoesSubstituido } = item;
        const unidade = catalogs.unidades.find(u => String(u.id) === String(aulaBase.unidadeId));
        if (!unidade) return null;

        if (paisFiltro && unidade.pais !== paisFiltro) return null;
        if (estadoFiltro && unidade.estado !== estadoFiltro) return null;
        if (mentorFiltro && unidade.mentorId !== mentorFiltro) return null;
        if (unidadeFiltro && String(aulaBase.unidadeId) !== String(unidadeFiltro)) return null;
        if (modalidadeFiltro && String(aulaBase.modalidadeId) !== String(modalidadeFiltro)) return null;
        if (turnoFiltro && !checkTurno(aulaBase.hora, turnoFiltro)) return null;

        if (role === 'professor') {
            const me = catalogs.professores.find(p => p.uidLogin === userId);
            if (!me || String(professorId) !== String(me.id)) return null;
        } else if (professorFiltro && String(professorId) !== String(professorFiltro)) return null;

        const professor = catalogs.professores.find(p => String(p.id) === String(professorId));
        const modalidade = catalogs.modalidades.find(m => String(m.id) === String(aulaBase.modalidadeId));

        const aulasRealizadas = validacoes.filter(v => v.status === 'realizada').length;
        const aulasCanceladas = validacoes.filter(v => v.status === 'cancelada').length; 
        
        if (filtroKPI === 'canceladas' && aulasCanceladas === 0) return null;
        if (filtroKPI === 'realizadas' && aulasRealizadas === 0) return null;

        const totalAlunos = validacoes.filter(v => v.status === 'realizada').reduce((acc, v) => acc + (Number(v.alunos) || 0), 0);
        const mediaAlunos = aulasRealizadas > 0 ? Math.round(totalAlunos / aulasRealizadas) : 0;
        
        const valorHora = parseFloat(aulaBase.valor) || 0;
        const totalReceber = aulasRealizadas * valorHora; 

        return {
            id: item.tipo === 'titular' ? aulaBase.id : (item.tipo === 'aulao' ? `view_${aulaBase.id}` : `${aulaBase.id}_sub_${professorId}`),
            unidadeNome: toTitleCase(unidade.nome), unidadeEstado: toTitleCase(unidade.estado), unidadePais: toTitleCase(unidade.pais),
            professorNome: getFirstLast(professor?.nome || 'Sem Professor'),
            tipoLinha: item.tipo,
            modalidadeNome: toTitleCase(modalidade?.nome || 'Desconhecida'), modalidadeCor: modalidade?.cor || '#ccc',
            dias: aulaBase.dias || [], horario: aulaBase.hora,
            aulasRealizadas, aulasCanceladas, mediaAlunos, totalAlunos, valorHora, totalReceber,
            historico: validacoes, historicoSubstituido: validacoesSubstituido || [],
            aulaBase
        };
    }).filter(Boolean);
  }, [catalogs, aulasRealtime, validacoesRealtime, period, paisFiltro, estadoFiltro, mentorFiltro, unidadeFiltro, modalidadeFiltro, professorFiltro, turnoFiltro, filtroKPI, role, userId]);

  // 4. SEPARAÇÃO DAS VISÕES: DETALHADA E AGRUPADA 
  const relatorioFinal = useMemo(() => {
      let resultado = [];
      
      if (viewMode === 'detalhado') {
          resultado = [...processamentoBase];
      } else {
          // VISÃO CONSOLIDADA
          const grouped = {};
          processamentoBase.forEach(row => {
              const groupKey = `${row.unidadeNome}_${row.modalidadeNome}_${row.professorNome}`;
              if (!grouped[groupKey]) {
                  grouped[groupKey] = {
                      ...row, 
                      id: groupKey, 
                      isGroup: true,
                      horariosSet: new Set([row.horario]),
                      diasSet: new Set([...row.dias]),
                      aulasFilhas: [row]
                  };
              } else {
                  grouped[groupKey].aulasRealizadas += row.aulasRealizadas;
                  grouped[groupKey].aulasCanceladas += row.aulasCanceladas;
                  grouped[groupKey].totalAlunos += row.totalAlunos;
                  grouped[groupKey].totalReceber += row.totalReceber;
                  grouped[groupKey].horariosSet.add(row.horario);
                  row.dias.forEach(d => grouped[groupKey].diasSet.add(d));
                  grouped[groupKey].aulasFilhas.push(row);
              }
          });
          
          resultado = Object.values(grouped).map(g => {
              // Limpando dados que não fazem sentido na visão consolidada (como média)
              g.mediaAlunos = "-"; 
              g.horario = g.horariosSet.size > 1 ? "Vários Horários" : Array.from(g.horariosSet)[0];
              g.dias = Array.from(g.diasSet);
              return g;
          });
      }

      return resultado.sort((a, b) => {
        let valA = a[sortConfig.field];
        let valB = b[sortConfig.field];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [processamentoBase, viewMode, sortConfig]);


  // PAGINAÇÃO E KPIS
  const relatorioVisivel = useMemo(() => relatorioFinal.slice(0, itensVisiveis), [relatorioFinal, itensVisiveis]);
  const handleCarregarMais = (qtd) => {
    if (qtd === 'todos') setItensVisiveis(relatorioFinal.length);
    else setItensVisiveis(prev => prev + qtd);
  };

  const kpis = useMemo(() => {
    const totalRealizadas = processamentoBase.reduce((acc, r) => acc + r.aulasRealizadas, 0);
    const totalCanceladas = processamentoBase.reduce((acc, r) => acc + r.aulasCanceladas, 0);
    const totalFinanceiro = processamentoBase.reduce((acc, r) => acc + r.totalReceber, 0);
    const somaAlunos = processamentoBase.reduce((acc, r) => acc + r.totalAlunos, 0);
    const mediaAlunos = totalRealizadas > 0 ? Math.round(somaAlunos / totalRealizadas) : 0;
    const custoMedio = processamentoBase.length > 0 ? processamentoBase.reduce((acc, r) => acc + r.valorHora, 0) / processamentoBase.length : 0;
    return { totalFinanceiro, totalRealizadas, totalCanceladas, mediaAlunos, custoMedio };
  }, [processamentoBase]);

  const handleSort = (field) => {
    setSortConfig(prev => ({ field, direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc' }));
  };
  const toggleRow = (id) => setExpandedRowId(prev => prev === id ? null : id);

  const handleExport = (type) => {
    setShowExportMenu(false);
    
    // Tira a média de alunos do export também se for consolidado
    const headers = viewMode === 'agrupado' 
        ? ["País", "Estado", "Unidade", "Modalidade", "Horário", "Professor", "Tipo", "Aulas Realizadas", "Aulas Canceladas", "Valor Base", "Total a Receber"]
        : ["País", "Estado", "Unidade", "Modalidade", "Horário", "Professor", "Tipo", "Aulas Realizadas", "Aulas Canceladas", "Média Alunos", "Valor Hora Aula", "Total a Receber"];
    
    const rows = relatorioFinal.map(r => {
        const baseRow = [
            r.unidadePais||"-", r.unidadeEstado||"-", r.unidadeNome, r.modalidadeNome, r.horario, r.professorNome, 
            r.isGroup ? "AGRUPADO" : (r.tipoLinha === 'aulao' ? "AULÃO" : (r.tipoLinha === 'substituto' ? "SUBSTITUTO" : "TITULAR")),
            r.aulasRealizadas, r.aulasCanceladas
        ];
        if (viewMode === 'detalhado') baseRow.push(r.mediaAlunos);
        baseRow.push(formatCurrency(r.valorHora), formatCurrency(r.totalReceber));
        return baseRow;
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

  return (
    <div className="p-6 md:p-8 max-w-[1920px] mx-auto animate-fade-in space-y-8">
      {/* HEADER, KPIS, FILTROS */}
      <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <span className="bg-red-600 text-white p-2 rounded-lg shadow-lg shadow-red-500/20"><BarChart2 className="w-6 h-6" /></span>
            Relatórios Financeiros
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">Painel de inteligência financeira e controle de folha</p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button onClick={() => setModoFiltro('dia')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all uppercase ${modoFiltro === 'dia' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>DIA</button>
            <button onClick={() => setModoFiltro('mes')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all uppercase ${modoFiltro === 'mes' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>MÊS</button>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-600 mx-1"></div>
          {modoFiltro === 'dia' ? <input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-white outline-none text-sm p-1"/> : <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-white outline-none text-sm p-1"/>}
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-600 mx-1"></div>
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-2 font-bold text-xs"><Download className="w-4 h-4"/> Exportar</button>
            {showExportMenu && (<div className="absolute right-0 top-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl w-40 z-50 overflow-hidden animate-in fade-in zoom-in duration-200"><button onClick={() => handleExport('excel')} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300"><FileSpreadsheet className="w-4 h-4 text-green-600"/> Excel (XLSX)</button><button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300"><FileText className="w-4 h-4 text-blue-600"/> CSV</button></div>)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KPICard title="Total a Pagar" value={formatCurrency(kpis.totalFinanceiro)} icon={DollarSign} colorClass="border-l-4 border-l-emerald-500" iconColorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" subValue="Validado" />
        <KPICard title="Aulas Realizadas" value={kpis.totalRealizadas} icon={CheckCircle2} colorClass={`border-l-4 border-l-blue-500 ${filtroKPI === 'realizadas' ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/10' : ''}`} iconColorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" subValue={filtroKPI === 'realizadas' ? 'Filtrado' : 'Clique para filtrar'} onClick={() => toggleFiltroKPI('realizadas')} isActive={filtroKPI === 'realizadas'}/>
        <KPICard title="Aulas Canceladas" value={kpis.totalCanceladas} icon={XCircle} colorClass={`border-l-4 border-l-red-500 ${filtroKPI === 'canceladas' ? 'ring-2 ring-red-400 bg-red-50 dark:bg-red-900/10' : ''}`} iconColorClass="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400" subValue={filtroKPI === 'canceladas' ? 'Filtrado' : 'Clique para filtrar'} onClick={() => toggleFiltroKPI('canceladas')} isActive={filtroKPI === 'canceladas'}/>
        <KPICard title="Média de Alunos" value={kpis.mediaAlunos} icon={Users} colorClass="border-l-4 border-l-orange-500" iconColorClass="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" subValue="P/ Aula" />
        <KPICard title="Valor Hora Médio" value={formatCurrency(kpis.custoMedio)} icon={Clock} colorClass="border-l-4 border-l-purple-500" iconColorClass="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" subValue="Média Geral" />
      </div>

      {filtroKPI && (<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2"><div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 font-bold"><MousePointerClick className="w-4 h-4"/> Visualizando apenas: <span className="uppercase">{filtroKPI}</span></div><button onClick={() => setFiltroKPI(null)} className="text-xs text-blue-500 hover:text-blue-700 underline">Remover Filtro Rápido</button></div>)}

      {/* FILTROS AVANÇADOS (Oculto para professor para manter a segurança) */}
      {role !== 'professor' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative group/filter">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-2"><Filter className="w-3 h-3"/> Filtros Avançados</h4>
                <button onClick={clearFilters} className="text-[10px] font-bold text-red-500 hover:text-red-600 dark:text-red-400 flex items-center gap-1 opacity-0 group-hover/filter:opacity-100 transition-opacity bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg"><X className="w-3 h-3"/> Limpar Filtros</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                {role === 'admin' && (<><div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">País</label><select value={paisFiltro} onChange={e => setPaisFiltro(e.target.value)} className="w-full p-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white dark:border-slate-600 outline-none"><option value="">Todos</option>{listasFiltros.paises.map(p => <option key={p} value={p}>{p}</option>)}</select></div><div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Estado</label><select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)} className="w-full p-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white dark:border-slate-600 outline-none"><option value="">Todos</option>{listasFiltros.estados.map(e => <option key={e} value={e}>{e}</option>)}</select></div><div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Mentor</label><select value={mentorFiltro} onChange={e => setMentorFiltro(e.target.value)} className="w-full p-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white dark:border-slate-600 outline-none"><option value="">Todos</option>{listasFiltros.mentores.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></div></>)}
                {role !== 'unidade' && (<div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Unidade</label><select value={unidadeFiltro} onChange={e => setUnidadeFiltro(e.target.value)} className="w-full p-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white dark:border-slate-600 outline-none"><option value="">Todas</option>{listasFiltros.unidadesFiltradas.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></div>)}
                <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Modalidade</label><select value={modalidadeFiltro} onChange={e => setModalidadeFiltro(e.target.value)} className="w-full p-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white dark:border-slate-600 outline-none"><option value="">Todas</option>{listasFiltros.modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Professor</label><select value={professorFiltro} onChange={e => setProfessorFiltro(e.target.value)} className="w-full p-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white dark:border-slate-600 outline-none"><option value="">Todos</option>{listasFiltros.professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Turno</label><select value={turnoFiltro} onChange={e => setTurnoFiltro(e.target.value)} className="w-full p-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white dark:border-slate-600 outline-none"><option value="">Todos</option><option value="Manhã">Manhã (05:30 - 11:59)</option><option value="Tarde">Tarde (12:00 - 17:00)</option><option value="Noite">Noite (17:01 - 23:00)</option></select></div>
            </div>
        </div>
      )}

      {/* ÁREA DA TABELA (TABS + GRADE) */}
      <div className="space-y-4">
          
          {/* TABS DE VISÃO (Visível para TODOS, incluindo Professor) */}
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

          {/* TABELA DE DADOS */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 w-8"></th>
                    <SortableHeader label="Unidade (País/Estado)" field="unidadeNome" currentSort={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Modalidade" field="modalidadeNome" currentSort={sortConfig} onSort={handleSort} />
                    <SortableHeader label={viewMode === 'agrupado' ? 'Turnos' : 'Horário'} field="horario" currentSort={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Professor" field="professorNome" currentSort={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Aulas Realizadas" field="aulasRealizadas" currentSort={sortConfig} onSort={handleSort} align="center" />
                    <SortableHeader label="Aulas Canceladas" field="aulasCanceladas" currentSort={sortConfig} onSort={handleSort} align="center" />
                    
                    {/* A Coluna some na visão Agrupada para não causar confusão matemática */}
                    {viewMode === 'detalhado' && (
                        <SortableHeader label="Média de Alunos" field="mediaAlunos" currentSort={sortConfig} onSort={handleSort} align="center" />
                    )}
                    
                    <SortableHeader label={viewMode === 'agrupado' ? 'Valor Base' : 'Valor Hora Aula'} field="valorHora" currentSort={sortConfig} onSort={handleSort} align="right" />
                    <SortableHeader label="Total a Receber" field="totalReceber" currentSort={sortConfig} onSort={handleSort} align="right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                  {relatorioVisivel.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group ${expandedRowId === row.id ? 'bg-slate-50 dark:bg-slate-700/30 border-l-4 border-l-blue-500' : ''}`} onClick={() => toggleRow(row.id)}>
                        <td className="p-3 text-slate-300 group-hover:text-blue-500 transition-colors">
                          {expandedRowId === row.id ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                        </td>
                        <td className="p-3">
                            <div className="font-bold text-slate-700 dark:text-slate-200">{row.unidadeNome}</div>
                            <div className="text-[9px] text-slate-400">{row.unidadePais} - {row.unidadeEstado}</div>
                        </td>
                        <td className="p-3">
                            <span className="px-2 py-0.5 rounded font-bold uppercase text-[9px]" style={{ backgroundColor: row.modalidadeCor + '20', color: row.modalidadeCor }}>{row.modalidadeNome}</span>
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400 text-xs">
                            {row.isGroup && row.horario === 'Vários Horários' ? (
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded font-bold">Vários</span>
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
                                    <span className={`font-bold ${row.tipoLinha === 'substituto' ? 'text-blue-600 dark:text-blue-400' : row.tipoLinha === 'aulao' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-800 dark:text-white'}`}>{row.professorNome}</span>
                                    {row.isGroup && <span className="block text-[8px] uppercase font-black text-slate-400">Total Consolidado</span>}
                                    {!row.isGroup && row.tipoLinha === 'substituto' && <span className="block text-[8px] uppercase font-black text-blue-400 flex items-center gap-0.5"><ArrowRightLeft className="w-2 h-2"/> Substituto</span>}
                                    {!row.isGroup && row.tipoLinha === 'aulao' && <span className="block text-[8px] uppercase font-black text-purple-400 flex items-center gap-0.5"><Star className="w-2 h-2"/> Aulão Especial</span>}
                                </div>
                            </div>
                        </td>
                        <td className="p-3 text-center font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/10 rounded">{row.aulasRealizadas}</td>
                        <td className={`p-3 text-center font-bold rounded ${row.aulasCanceladas > 0 ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'text-slate-300'}`}>
                            {row.aulasCanceladas > 0 ? row.aulasCanceladas : '-'}
                        </td>
                        
                        {/* Se estiver no Resumo da Folha, a média oculta também os dados para manter alinhamento */}
                        {viewMode === 'detalhado' && (
                            <td className="p-3 text-center font-bold text-orange-500">{row.mediaAlunos}</td>
                        )}
                        
                        <td className="p-3 text-right text-slate-500 dark:text-slate-400">{formatCurrency(row.valorHora)}</td>
                        <td className="p-3 text-right font-mono text-green-600 font-black text-sm">{formatCurrency(row.totalReceber)}</td>
                      </tr>
                      
                      {/* EXPANSÃO DA GAVETA */}
                      {expandedRowId === row.id && (
                        <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-700 shadow-inner">
                          <td colSpan={viewMode === 'detalhado' ? "10" : "9"} className="p-4 pl-12">
                            {row.isGroup ? (
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Detalhamento dos Horários</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {row.aulasFilhas.map(filha => (
                                            <div key={filha.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center hover:border-blue-300 transition-colors">
                                                <div>
                                                    <div className="font-mono font-bold text-blue-600 dark:text-blue-400 mb-0.5"><Clock className="w-3 h-3 inline mr-1 -mt-0.5"/>{filha.horario}</div>
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{filha.dias.join(', ')}</div>
                                                </div>
                                                <div className="text-right flex flex-col items-end">
                                                    <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{filha.aulasRealizadas} Aulas Realizadas</div>
                                                    <div className="text-xs font-black text-slate-700 dark:text-slate-300 mt-1">{formatCurrency(filha.totalReceber)}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                                    {row.dias.map(dia => {
                                        const datasDoDia = getDatesByWeekdayInPeriod(period.start, period.end, [dia])[dia] || [];
                                        
                                        return (
                                            <div key={dia} className="flex-1 min-w-[130px] max-w-[180px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden flex flex-col shadow-sm">
                                            <div className="bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-center border-b border-slate-200 dark:border-slate-600">
                                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">{dia}</span>
                                            </div>
                                            <div className="p-2 space-y-1.5 flex-1 min-h-[50px]">
                                                {datasDoDia.length === 0 && <span className="text-[10px] text-slate-300 text-center block">-</span>}
                                                {datasDoDia.map(dataStr => {
                                                    const validacao = row.historico.find(h => h.data === dataStr);
                                                    const foiSubstituido = row.historicoSubstituido?.find(h => h.data === dataStr);
                                                    
                                                    // Trava de Vigência da Aula na exibição das caixinhas (Para não exibir caixas fantasmas)
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
                                                                <span className="truncate max-w-[100px]" title={validacao.motivoCancelamento}>{validacao.motivoCancelamento}</span>
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
                  ))}
                  {relatorioVisivel.length === 0 && <tr><td colSpan="10" className="p-8 text-center text-slate-400 text-sm">Sem dados encontrados para o filtro atual.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* BOTÕES DE CARREGAMENTO */}
          {itensVisiveis < relatorioFinal.length && (
              <div className="flex flex-wrap justify-center gap-3 pb-4 animate-fade-in">
                  <button 
                      onClick={() => handleCarregarMais(20)} 
                      className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm flex items-center gap-2 transition-all"
                  >
                      <ArrowDown className="w-4 h-4"/> Carregar +20
                  </button>
                  <button 
                      onClick={() => handleCarregarMais(50)} 
                      className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm flex items-center gap-2 transition-all"
                  >
                      Carregar +50
                  </button>
                  <button 
                      onClick={() => handleCarregarMais('todos')} 
                      className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-xl text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 shadow-sm flex items-center gap-2 transition-all"
                  >
                      <DownloadCloud className="w-4 h-4"/> Ver Todos ({relatorioFinal.length})
                  </button>
              </div>
          )}
      </div>
    </div>
  );
}