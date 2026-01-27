import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { 
  BarChart2, Filter, DollarSign, Users, Calendar, 
  CheckCircle2, XCircle, Clock, ChevronRight, ChevronDown, 
  LayoutDashboard, Map, Globe, UserCheck, AlertTriangle, 
  Download, FileSpreadsheet, FileText, MoreVertical 
} from 'lucide-react';

// --- HELPERS ---
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const diasSemanaMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

const getTodayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

// Gera datas para as colunas do detalhamento
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

// Conta dias úteis no período
const countWeekdaysInPeriod = (startStr, endStr) => {
  const counts = { 'Domingo': 0, 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0 };
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayName = diasSemanaMap[d.getDay()];
    counts[dayName]++;
  }
  return counts;
};

// --- COMPONENTE CARD KPI (DESIGN "CLEAN ENTERPRISE") ---
const KPICard = ({ title, value, icon: Icon, colorClass, iconColorClass, subValue }) => (
  <div className={`p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${colorClass}`}>
    <div className="flex justify-between items-start mb-2">
      <div className={`p-2 rounded-lg ${iconColorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      {subValue && (
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          {subValue}
        </span>
      )}
    </div>
    <div>
      <h3 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">{value}</h3>
      <p className="text-[11px] font-bold uppercase tracking-wider opacity-60 mt-1 text-slate-500 dark:text-slate-400">{title}</p>
    </div>
  </div>
);

// Header Ordenável
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

  // --- ESTADO ---
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ 
    aulas: [], validacoes: [], unidades: [], professores: [], modalidades: [], users: [] 
  });
  
  // Filtro de Data
  const [modoFiltro, setModoFiltro] = useState('mes'); 
  const [dataFiltro, setDataFiltro] = useState(getTodayStr());
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7));

  // Menu Exportar
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Filtros Hierárquicos
  const [paisFiltro, setPaisFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [mentorFiltro, setMentorFiltro] = useState("");
  const [unidadeFiltro, setUnidadeFiltro] = useState("");
  const [modalidadeFiltro, setModalidadeFiltro] = useState("");
  const [professorFiltro, setProfessorFiltro] = useState("");

  const [sortConfig, setSortConfig] = useState({ field: 'totalReceber', direction: 'desc' });
  const [expandedRowId, setExpandedRowId] = useState(null);

  // 1. CÁLCULO DO PERÍODO
  const period = useMemo(() => {
    let start = "", end = "";
    if (modoFiltro === 'dia') {
      start = dataFiltro;
      end = dataFiltro;
    } else {
      const [y, m] = mesFiltro.split('-');
      start = `${y}-${m}-01`;
      end = new Date(y, m, 0).toISOString().split('T')[0];
    }
    return { start, end };
  }, [modoFiltro, dataFiltro, mesFiltro]);

  // 2. CARREGAMENTO (Server-Side Filtering)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        let qUnidades = collection(db, 'unidades');
        if (role === 'mentor') {
            qUnidades = query(collection(db, 'unidades'), where('mentorId', '==', userId));
        } else if (role === 'unidade') {
            qUnidades = query(collection(db, 'unidades'), where('id', '==', userData.unidadeId));
        }

        const validacoesQuery = query(
            collection(db, 'validacoes'), 
            where('data', '>=', period.start),
            where('data', '<=', period.end)
        );

        const [aulasSnap, valSnap, uniSnap, profSnap, modSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, 'aulas')),
          getDocs(validacoesQuery),
          getDocs(qUnidades),
          getDocs(collection(db, 'professores')),
          getDocs(collection(db, 'modalidades')),
          getDocs(collection(db, 'usuarios'))
        ]);

        const unidadesCarregadas = uniSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        setData({
          aulas: aulasSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          validacoes: valSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          unidades: unidadesCarregadas,
          professores: profSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          modalidades: modSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          users: usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

        if (role === 'unidade') setUnidadeFiltro(userData.unidadeId);

      } catch (e) { 
          console.error("Erro loading:", e);
      } finally { 
          setLoading(false); 
      }
    };
    loadData();
  }, [role, userId, userData, period]);

  // --- Listas de Filtros (CASCATA INTELIGENTE) ---
  const listasFiltros = useMemo(() => {
    // 1. Filtra Unidades baseadas nos filtros geográficos
    const units = data.unidades.filter(u => 
        (!paisFiltro || u.pais === paisFiltro) &&
        (!estadoFiltro || u.estado === estadoFiltro) &&
        (!mentorFiltro || u.mentorId === mentorFiltro)
    );

    const paises = [...new Set(data.unidades.map(u => u.pais).filter(Boolean))].sort();
    const estados = [...new Set(data.unidades.filter(u => !paisFiltro || u.pais === paisFiltro).map(u => u.estado).filter(Boolean))].sort();
    
    const mentorIds = [...new Set(units.map(u => u.mentorId).filter(Boolean))];
    const mentores = mentorIds.map(id => {
        const user = data.users.find(u => u.id === id || u.uid === id); 
        return { id, nome: user?.nome || 'Desconhecido' };
    }).sort((a, b) => a.nome.localeCompare(b.nome));

    // 2. Filtra Aulas baseadas na Unidade Selecionada
    // Isso é crucial para que o filtro de Modalidade e Professor só mostre o que existe na unidade/modalidade
    const aulasFiltradas = data.aulas.filter(a => {
        if (unidadeFiltro && String(a.unidadeId) !== String(unidadeFiltro)) return false;
        // Se a unidade não foi selecionada, considera todas as unidades "visíveis" (filtros geo)
        if (!unidadeFiltro && !units.map(u=>u.id).includes(a.unidadeId)) return false;
        return true;
    });

    // Modalidades disponíveis nas aulas filtradas
    const modIds = [...new Set(aulasFiltradas.map(a => a.modalidadeId))];
    const modalidades = data.modalidades.filter(m => modIds.includes(m.id));

    // Professores disponíveis (respeitando filtro de modalidade se houver)
    const aulasParaProf = aulasFiltradas.filter(a => !modalidadeFiltro || String(a.modalidadeId) === String(modalidadeFiltro));
    const profIds = [...new Set(aulasParaProf.map(a => a.professorId))];
    const professores = data.professores.filter(p => profIds.includes(p.id));

    return { paises, estados, mentores, unidadesFiltradas: units, modalidades, professores };
  }, [data, paisFiltro, estadoFiltro, mentorFiltro, unidadeFiltro, modalidadeFiltro]);

  // 3. PROCESSAMENTO (CORE)
  const relatorio = useMemo(() => {
    if (data.unidades.length === 0) return [];
    
    const validacoesNoPeriodo = data.validacoes;

    let linhas = data.aulas.map(aula => {
      const unidade = data.unidades.find(u => String(u.id) === String(aula.unidadeId));
      if (!unidade) return null;

      // Filtros
      if (paisFiltro && unidade.pais !== paisFiltro) return null;
      if (estadoFiltro && unidade.estado !== estadoFiltro) return null;
      if (mentorFiltro && unidade.mentorId !== mentorFiltro) return null;
      if (unidadeFiltro && String(aula.unidadeId) !== String(unidadeFiltro)) return null;
      if (modalidadeFiltro && String(aula.modalidadeId) !== String(modalidadeFiltro)) return null;
      
      // Filtro Professor
      if (role === 'professor') {
          const me = data.professores.find(p => p.uidLogin === userId);
          if (!me || String(aula.professorId) !== String(me.id)) return null;
      } else if (professorFiltro && String(aula.professorId) !== String(professorFiltro)) {
          return null;
      }

      const professor = data.professores.find(p => String(p.id) === String(aula.professorId));
      const modalidade = data.modalidades.find(m => String(m.id) === String(aula.modalidadeId));

      // Métricas
      const valsDestaAula = validacoesNoPeriodo.filter(v => String(v.aulaId) === String(aula.id));
      const aulasRealizadas = valsDestaAula.filter(v => v.status === 'realizada').length;
      const aulasCanceladas = valsDestaAula.filter(v => v.status === 'cancelada').length;
      
      const totalAlunos = valsDestaAula.filter(v => v.status === 'realizada').reduce((acc, v) => acc + (Number(v.alunos) || 0), 0);
      const mediaAlunos = aulasRealizadas > 0 ? Math.round(totalAlunos / aulasRealizadas) : 0;
      
      const valorHora = parseFloat(aula.valor) || 0;
      const totalReceber = aulasRealizadas * valorHora; 

      const diasTrabalho = aula.dias || [];
      const mapaDatas = getDatesByWeekdayInPeriod(period.start, period.end, diasTrabalho);

      return {
        id: aula.id,
        unidadeNome: unidade.nome,
        unidadeEstado: unidade.estado,
        unidadePais: unidade.pais,
        professorNome: professor?.nome || 'Sem Professor',
        modalidadeNome: modalidade?.nome || 'Desconhecida',
        modalidadeCor: modalidade?.cor || '#ccc',
        dias: diasTrabalho,
        horario: aula.hora,
        aulasRealizadas,
        aulasCanceladas,
        mediaAlunos,
        valorHora,
        totalReceber,
        historico: valsDestaAula,
        mapaDatas
      };
    }).filter(Boolean); 

    // Ordenação
    return linhas.sort((a, b) => {
      let valA = a[sortConfig.field];
      let valB = b[sortConfig.field];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, period, paisFiltro, estadoFiltro, mentorFiltro, unidadeFiltro, modalidadeFiltro, professorFiltro, sortConfig, role, userId]);

  // 4. KPIs
  const kpis = useMemo(() => {
    const totalRealizadas = relatorio.reduce((acc, r) => acc + r.aulasRealizadas, 0);
    const totalCanceladas = relatorio.reduce((acc, r) => acc + r.aulasCanceladas, 0);
    const totalFinanceiro = relatorio.reduce((acc, r) => acc + r.totalReceber, 0);
    const somaAlunos = relatorio.reduce((acc, r) => acc + (r.mediaAlunos * r.aulasRealizadas), 0);
    const mediaAlunos = totalRealizadas > 0 ? Math.round(somaAlunos / totalRealizadas) : 0;
    const custoMedio = relatorio.length > 0 ? relatorio.reduce((acc, r) => acc + r.valorHora, 0) / relatorio.length : 0;
    return { totalFinanceiro, totalRealizadas, totalCanceladas, mediaAlunos, custoMedio };
  }, [relatorio]);

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const toggleRow = (id) => setExpandedRowId(prev => prev === id ? null : id);

  // --- EXPORTAÇÃO ---
  const handleExport = (type) => {
    setShowExportMenu(false);
    
    // Dados para exportar
    const headers = [
        "País", "Estado", "Unidade", "Modalidade", "Professor", 
        "Aulas Realizadas", "Aulas Canceladas", "Média Alunos", 
        "Valor Hora Aula", "Total a Receber"
    ];
    
    const rows = relatorio.map(r => [
      r.unidadePais || "-",
      r.unidadeEstado || "-",
      r.unidadeNome,
      r.modalidadeNome,
      r.professorNome,
      r.aulasRealizadas,
      r.aulasCanceladas,
      r.mediaAlunos,
      formatCurrency(r.valorHora),
      formatCurrency(r.totalReceber)
    ]);

    if (type === 'csv' || type === 'excel') {
        // Gerador Universal CSV (Compatível com Excel)
        const csvContent = [
            headers.join(";"), 
            ...rows.map(row => row.join(";"))
        ].join("\n");
        
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `relatorio_${type}_${period.start}.csv`);
        document.body.appendChild(link);
        link.click();
    } else if (type === 'pdf') {
        // Simulação de PDF (Em produção, usaria jsPDF)
        alert("A exportação em PDF requer a biblioteca 'jspdf'. No momento, baixe a versão Excel/CSV para imprimir.");
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400 dark:text-slate-500 gap-2"><LayoutDashboard className="animate-spin"/> Carregando Relatório...</div>;

  return (
    <div className="p-6 md:p-8 max-w-[1920px] mx-auto animate-fade-in space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <span className="bg-red-600 text-white p-2 rounded-lg shadow-lg shadow-red-500/20"><BarChart2 className="w-6 h-6" /></span>
            Relatórios
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">Painel de inteligência financeira e operacional</p>
        </div>
        
        {/* CONTROLES */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button onClick={() => setModoFiltro('dia')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all uppercase ${modoFiltro === 'dia' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>DIA</button>
            <button onClick={() => setModoFiltro('mes')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all uppercase ${modoFiltro === 'mes' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>MÊS</button>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-600 mx-1"></div>
          {modoFiltro === 'dia' ? (
            <input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-white outline-none text-sm p-1"/>
          ) : (
            <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-white outline-none text-sm p-1"/>
          )}
          
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-600 mx-1"></div>
          
          {/* BOTÃO EXPORTAR COM DROPDOWN */}
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-2 font-bold text-xs">
                <Download className="w-4 h-4"/> Exportar
            </button>
            {showExportMenu && (
                <div className="absolute right-0 top-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl w-40 z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                    <button onClick={() => handleExport('excel')} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <FileSpreadsheet className="w-4 h-4 text-green-600"/> Excel (XLSX)
                    </button>
                    <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <FileText className="w-4 h-4 text-blue-600"/> CSV
                    </button>
                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <Download className="w-4 h-4 text-red-600"/> PDF
                    </button>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* CARDS KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KPICard title="Total a Pagar" value={formatCurrency(kpis.totalFinanceiro)} icon={DollarSign} colorClass="border-l-4 border-l-emerald-500" iconColorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" subValue="Validado" />
        <KPICard title="Aulas Realizadas" value={kpis.totalRealizadas} icon={CheckCircle2} colorClass="border-l-4 border-l-blue-500" iconColorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" subValue="Confirmadas" />
        <KPICard title="Aulas Canceladas" value={kpis.totalCanceladas} icon={XCircle} colorClass="border-l-4 border-l-red-500" iconColorClass="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400" subValue="Problemas" />
        <KPICard title="Média de Alunos" value={kpis.mediaAlunos} icon={Users} colorClass="border-l-4 border-l-orange-500" iconColorClass="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" subValue="P/ Aula" />
        <KPICard title="Valor Hora Médio" value={formatCurrency(kpis.custoMedio)} icon={Clock} colorClass="border-l-4 border-l-purple-500" iconColorClass="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" subValue="Média Geral" />
      </div>

      {/* FILTROS (VISIBILIDADE POR ROLE) */}
      {role !== 'professor' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-4 flex items-center gap-2"><Filter className="w-3 h-3"/> Filtros Avançados</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                
                {/* Admin vê tudo */}
                {role === 'admin' && (
                    <>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">País</label><select value={paisFiltro} onChange={e => setPaisFiltro(e.target.value)} className="w-full p-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white dark:border-slate-600 outline-none"><option value="">Todos</option>{listasFiltros.paises.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Estado</label><select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)} className="w-full p-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white dark:border-slate-600 outline-none"><option value="">Todos</option>{listasFiltros.estados.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Mentor</label><select value={mentorFiltro} onChange={e => setMentorFiltro(e.target.value)} className="w-full p-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white dark:border-slate-600 outline-none"><option value="">Todos</option>{listasFiltros.mentores.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
                    </>
                )}

                {/* Admin e Mentor veem Unidades */}
                {role !== 'unidade' && (
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Unidade</label><select value={unidadeFiltro} onChange={e => setUnidadeFiltro(e.target.value)} className="w-full p-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white dark:border-slate-600 outline-none"><option value="">Todas</option>{listasFiltros.unidadesFiltradas.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></div>
                )}

                {/* Todos (Exceto Professor) veem Modalidade e Professor */}
                <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Modalidade</label><select value={modalidadeFiltro} onChange={e => setModalidadeFiltro(e.target.value)} className="w-full p-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white dark:border-slate-600 outline-none"><option value="">Todas</option>{listasFiltros.modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Professor</label><select value={professorFiltro} onChange={e => setProfessorFiltro(e.target.value)} className="w-full p-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white dark:border-slate-600 outline-none"><option value="">Todos</option>{listasFiltros.professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
            </div>
        </div>
      )}

      {/* TABELA DE DADOS */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
              <tr>
                <th className="p-3 w-8"></th>
                <SortableHeader label="Unidade (País/Estado)" field="unidadeNome" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label="Modalidade" field="modalidadeNome" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label="Professor" field="professorNome" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label="Aulas Realizadas" field="aulasRealizadas" currentSort={sortConfig} onSort={handleSort} align="center" />
                <SortableHeader label="Aulas Canceladas" field="aulasCanceladas" currentSort={sortConfig} onSort={handleSort} align="center" />
                <SortableHeader label="Média de Alunos" field="mediaAlunos" currentSort={sortConfig} onSort={handleSort} align="center" />
                <SortableHeader label="Valor Hora Aula" field="valorHora" currentSort={sortConfig} onSort={handleSort} align="right" />
                <SortableHeader label="Total a Receber" field="totalReceber" currentSort={sortConfig} onSort={handleSort} align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
              {relatorio.map((row) => (
                <React.Fragment key={row.id}>
                  <tr 
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group ${expandedRowId === row.id ? 'bg-slate-50 dark:bg-slate-700/30 border-l-4 border-l-blue-500' : ''}`} 
                    onClick={() => toggleRow(row.id)}
                  >
                    <td className="p-3 text-slate-300 group-hover:text-blue-500 transition-colors">
                      {expandedRowId === row.id ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                    </td>
                    <td className="p-3">
                        <div className="font-bold text-slate-700 dark:text-slate-200">{row.unidadeNome}</div>
                        <div className="text-[9px] text-slate-400">{row.unidadePais} - {row.unidadeEstado}</div>
                    </td>
                    <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-bold uppercase text-[9px]" style={{ backgroundColor: row.modalidadeCor + '20', color: row.modalidadeCor }}>
                            {row.modalidadeNome}
                        </span>
                    </td>
                    <td className="p-3 font-bold text-slate-800 dark:text-white">{row.professorNome}</td>
                    <td className="p-3 text-center font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/10 rounded">{row.aulasRealizadas}</td>
                    <td className="p-3 text-center font-bold text-red-500 bg-red-50 dark:bg-red-900/10 rounded">{row.aulasCanceladas > 0 ? row.aulasCanceladas : '-'}</td>
                    <td className="p-3 text-center font-bold text-orange-500">{row.mediaAlunos}</td>
                    <td className="p-3 text-right text-slate-500 dark:text-slate-400">{formatCurrency(row.valorHora)}</td>
                    <td className="p-3 text-right font-mono text-green-600 font-black text-sm">{formatCurrency(row.totalReceber)}</td>
                  </tr>

                  {/* EXPANSÃO */}
                  {expandedRowId === row.id && (
                    <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-700 shadow-inner">
                      <td colSpan="10" className="p-4">
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                          {row.dias.map(dia => (
                            <div key={dia} className="flex-1 min-w-[130px] max-w-[180px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden flex flex-col shadow-sm">
                              <div className="bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-center border-b border-slate-200 dark:border-slate-600">
                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">{dia}</span>
                              </div>
                              <div className="p-2 space-y-1.5 flex-1 min-h-[50px]">
                                {row.mapaDatas[dia]?.length === 0 && <span className="text-[10px] text-slate-300 text-center block">-</span>}
                                {row.mapaDatas[dia]?.map(dataStr => {
                                  const validacao = row.historico.find(h => h.data === dataStr);
                                  const diaMes = new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
                                  
                                  return (
                                    <div key={dataStr} className={`text-[9px] px-2 py-1.5 rounded border flex flex-col gap-1 ${
                                      validacao 
                                        ? (validacao.status === 'cancelada' 
                                            ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-900 dark:text-red-300' 
                                            : 'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/20 dark:border-green-900 dark:text-green-300')
                                        : 'bg-slate-50 border-slate-100 text-slate-300 dark:bg-slate-900 dark:border-slate-800 opacity-60' 
                                    }`}>
                                      <div className="flex justify-between items-center w-full">
                                        <span className="font-bold">{diaMes}</span>
                                        {validacao ? (
                                          validacao.status === 'cancelada' ? (
                                            <span className="font-bold text-[8px] uppercase">CANCEL</span>
                                          ) : (
                                            <span className="font-bold flex items-center gap-1"><Users className="w-3 h-3"/> {validacao.alunos}</span>
                                          )
                                        ) : <span>--</span>}
                                      </div>
                                      {validacao && validacao.status === 'cancelada' && (
                                        <div className="text-[8px] font-bold border-t border-red-200 dark:border-red-800 pt-1 mt-0.5 flex items-center gap-1">
                                            <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0"/>
                                            <span className="truncate max-w-[100px]" title={validacao.motivoCancelamento || 'Sem motivo'}>
                                                {validacao.motivoCancelamento || 'Motivo n/a'}
                                            </span>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {relatorio.length === 0 && <tr><td colSpan="10" className="p-8 text-center text-slate-400 text-sm">Sem dados encontrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}