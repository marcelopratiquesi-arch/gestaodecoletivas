import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { 
  collection, query, where, getDocs, doc, setDoc, getDoc, orderBy 
} from 'firebase/firestore';
import { 
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, Building2, 
  BarChart3, Calendar, Loader2, Lock, PieChart, Users, Wallet, 
  Banknote, ChevronDown, Edit2, Check, X, ArrowUpDown, Trophy, AlertCircle, ArrowDown, DownloadCloud
} from 'lucide-react';

// --- HELPERS ---
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatPercent = (val) => new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val / 100);

// --- COMPONENTE: RANKING CARD ---
const RankingCard = ({ title, items, icon: Icon, colorClass, type }) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex-1">
        <div className={`p-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 ${colorClass.bgHeader}`}>
            <Icon className={`w-4 h-4 ${colorClass.icon}`} />
            <h3 className={`text-xs font-bold uppercase tracking-wider ${colorClass.textTitle}`}>{title}</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {items.length === 0 ? (
                <div className="p-4 text-center text-[10px] text-slate-400">Sem dados suficientes</div>
            ) : (
                items.map((item, idx) => (
                    <div key={item.unidade.id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${idx === 0 ? 'bg-yellow-400 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {idx + 1}
                            </span>
                            <div>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]" title={item.unidade.nome}>{item.unidade.nome}</p>
                                <p className="text-[9px] text-slate-400">{item.mentor}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className={`text-xs font-black ${type === 'good' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {formatPercent(item.percent)}
                            </p>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
);

// --- COMPONENTE: HEADER ORDENÁVEL ---
const SortableHeader = ({ label, field, currentSort, onSort, align = "left" }) => (
    <th 
        className={`p-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none text-${align}`}
        onClick={() => onSort(field)}
    >
        <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
            {label}
            <div className="flex flex-col">
                <ChevronDown className={`w-2 h-2 ${currentSort.field === field && currentSort.direction === 'desc' ? 'text-purple-600' : 'text-slate-300'}`} />
                <ChevronDown className={`w-2 h-2 rotate-180 -mt-1 ${currentSort.field === field && currentSort.direction === 'asc' ? 'text-purple-600' : 'text-slate-300'}`} />
            </div>
        </div>
    </th>
);

// --- COMPONENTE: LINHA DA TABELA ---
const PerformanceRow = ({ unidade, mentorNome, custoAuto, folhaManualInicial, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(folhaManualInicial || 0);
    const [saving, setSaving] = useState(false);

    useEffect(() => { setTempValue(folhaManualInicial || 0); }, [folhaManualInicial]);

    const handleSave = async () => {
        setSaving(true);
        await onSave(unidade.id, tempValue);
        setSaving(false);
        setIsEditing(false);
    };

    let percentual = 0;
    if (tempValue > 0) percentual = (custoAuto / tempValue) * 100;
    else if (!isEditing && folhaManualInicial > 0) percentual = (custoAuto / folhaManualInicial) * 100;

    let statusConfig = { text: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Saudável', bar: 'bg-emerald-500' };
    if (percentual > 15) statusConfig = { text: 'text-amber-600', bg: 'bg-amber-100', label: 'Atenção', bar: 'bg-amber-500' };
    if (percentual > 25) statusConfig = { text: 'text-rose-600', bg: 'bg-rose-100', label: 'Crítico', bar: 'bg-rose-500' };
    if (folhaManualInicial === 0 && !isEditing) statusConfig = { text: 'text-slate-400', bg: 'bg-slate-100', label: 'Pendente', bar: 'bg-slate-300' };

    return (
        <tr className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
            <td className="p-4">
                <div className="font-bold text-slate-700 dark:text-white text-sm">{unidade.nome}</div>
                <div className="text-[10px] text-slate-400">{unidade.cidade} - {unidade.estado}</div>
            </td>
            <td className="p-4 text-xs font-medium text-slate-500 hidden md:table-cell">{mentorNome}</td>
            <td className="p-4 text-right">
                <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">{formatCurrency(custoAuto)}</div>
            </td>
            <td className="p-4 text-right">
                <div className="flex items-center justify-end gap-2">
                    {isEditing ? (
                        <div className="flex items-center gap-1 animate-in zoom-in duration-200">
                            <input 
                                type="number" autoFocus
                                className="w-24 text-right p-1.5 text-sm border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-white"
                                value={tempValue} onChange={(e) => setTempValue(e.target.value)}
                            />
                            <button onClick={handleSave} disabled={saving} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
                            </button>
                            <button onClick={() => { setTempValue(folhaManualInicial || 0); setIsEditing(false); }} disabled={saving} className="p-1.5 bg-slate-200 text-slate-500 rounded-lg hover:bg-slate-300 transition-colors dark:bg-slate-700 dark:text-slate-300">
                                <X className="w-4 h-4"/>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group/edit cursor-pointer" onClick={() => setIsEditing(true)}>
                            <span className={`text-sm font-medium ${folhaManualInicial === 0 ? 'text-slate-300 italic' : 'text-slate-600 dark:text-slate-300'}`}>
                                {folhaManualInicial > 0 ? formatCurrency(folhaManualInicial) : "Definir valor"}
                            </span>
                            <div className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors opacity-0 group-hover/edit:opacity-100">
                                <Edit2 className="w-3.5 h-3.5"/>
                            </div>
                        </div>
                    )}
                </div>
            </td>
            <td className="p-4 text-center">
                {folhaManualInicial > 0 || isEditing ? (
                    <div className="flex flex-col items-center justify-center w-full">
                        <span className={`font-black text-sm ${statusConfig.text}`}>{formatPercent(percentual)}</span>
                        <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                            <div className={`h-full ${statusConfig.bar}`} style={{ width: `${Math.min(percentual, 100)}%` }}></div>
                        </div>
                    </div>
                ) : <span className="text-xs text-slate-300">-</span>}
            </td>
            <td className="p-4 text-center">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${statusConfig.bg} ${statusConfig.text} border-transparent`}>
                    {statusConfig.label}
                </span>
            </td>
        </tr>
    );
};

export default function PerformanceFinanceiraPage() {
  const { userData } = useAuth();
  const role = String(userData?.role || "").toLowerCase();
  const userId = userData?.id || userData?.uid;

  // Estados
  const [loading, setLoading] = useState(true);
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7)); 
  const [filtroMentor, setFiltroMentor] = useState("todos");
  
  // Ordenação e Paginação
  const [sortConfig, setSortConfig] = useState({ field: 'percent', direction: 'desc' });
  const [itensVisiveis, setItensVisiveis] = useState(12);

  // Dados
  const [unidades, setUnidades] = useState([]);
  const [mentores, setMentores] = useState([]);
  const [dadosFinanceiros, setDadosFinanceiros] = useState({});
  const [custosColetiva, setCustosColetiva] = useState({});
  const [comparativoAnoAnterior, setComparativoAnoAnterior] = useState({});

  // TRAVA DE SEGURANÇA
  if (role !== 'admin' && role !== 'mentor') {
      return (
          <div className="flex h-screen items-center justify-center flex-col gap-4 text-slate-400">
              <div className="bg-slate-100 p-6 rounded-full"><Lock className="w-12 h-12 text-slate-300" /></div>
              <h2 className="text-xl font-bold text-slate-600">Acesso Restrito</h2>
              <p>Apenas Gestores têm acesso à Performance Financeira.</p>
          </div>
      );
  }

  // 1. CARREGAMENTO
  useEffect(() => {
    const carregarDados = async () => {
      setLoading(true);
      try {
        let listaUnidades = [], listaMentores = [];

        if (role === 'admin') {
            const [uSnap, mSnap] = await Promise.all([
                getDocs(query(collection(db, 'unidades'), orderBy('nome'))),
                getDocs(query(collection(db, 'usuarios'), where('role', '==', 'mentor')))
            ]);
            listaUnidades = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            listaMentores = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
            const uSnap = await getDocs(query(collection(db, 'unidades'), where('mentorId', '==', userId)));
            listaUnidades = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        
        setUnidades(listaUnidades);
        setMentores(listaMentores);

        const processarPeriodo = async (ano, mes) => {
            const inicio = `${ano}-${mes}-01`;
            const fim = `${ano}-${mes}-${new Date(ano, mes, 0).getDate()}`;
            const qVal = query(collection(db, 'validacoes'), where('data', '>=', inicio), where('data', '<=', fim), where('status', '==', 'realizada'));
            const [valSnap, aulasSnap] = await Promise.all([getDocs(qVal), getDocs(collection(db, 'aulas'))]);
            const aulasMap = {};
            aulasSnap.docs.forEach(d => aulasMap[d.id] = d.data());
            const custosMap = {};
            valSnap.docs.forEach(d => {
                const val = d.data();
                if (listaUnidades.some(u => u.id === val.unidadeId)) {
                    const aula = aulasMap[val.aulaId];
                    if (aula) {
                        const valor = parseFloat(aula.valor) || 0;
                        if (!custosMap[val.unidadeId]) custosMap[val.unidadeId] = 0;
                        custosMap[val.unidadeId] += valor;
                    }
                }
            });
            return custosMap;
        };

        const [anoAtual, mesAtual] = mesFiltro.split('-');
        const anoAnterior = (parseInt(anoAtual) - 1).toString();
        const [custosAtual, custosAnterior] = await Promise.all([processarPeriodo(anoAtual, mesAtual), processarPeriodo(anoAnterior, mesAtual)]);

        setCustosColetiva(custosAtual);
        setComparativoAnoAnterior(custosAnterior);

        const inputsMap = {};
        const promessas = listaUnidades.map(async (u) => {
            const docId = `${mesFiltro}_${u.id}`;
            const docSnap = await getDoc(doc(db, 'indicadores_mensais', docId));
            if (docSnap.exists()) inputsMap[u.id] = docSnap.data().folhaPagamento || 0;
        });
        await Promise.all(promessas);
        setDadosFinanceiros(inputsMap);

      } catch (error) { console.error("Erro critico:", error); } finally { setLoading(false); }
    };
    carregarDados();
  }, [mesFiltro, role, userId]);

  const handleUpdateFolha = async (unidadeId, novoValor) => {
    try {
        const docId = `${mesFiltro}_${unidadeId}`;
        const valorNumerico = parseFloat(novoValor) || 0;
        await setDoc(doc(db, 'indicadores_mensais', docId), {
            unidadeId, mes: mesFiltro, folhaPagamento: valorNumerico, updatedAt: new Date(), userUpdate: userId
        }, { merge: true });
        setDadosFinanceiros(prev => ({...prev, [unidadeId]: valorNumerico}));
    } catch (e) { alert("Erro ao salvar"); }
  };

  // --- PROCESSAMENTO DA LISTA ---
  const tabelaDados = useMemo(() => {
      let lista = unidades;
      if (role === 'admin' && filtroMentor !== 'todos') lista = lista.filter(u => u.mentorId === filtroMentor);

      const linhas = lista.map(u => {
          const custo = custosColetiva[u.id] || 0;
          const folha = dadosFinanceiros[u.id] || 0;
          const percent = folha > 0 ? (custo / folha) * 100 : 0;
          const mentor = mentores.find(m => m.id === u.mentorId)?.nome || '-';
          
          // Diagnostico string para sort
          let diagnostico = 'Pendente';
          if (folha > 0) {
              if (percent <= 15) diagnostico = 'Saudável';
              else if (percent <= 25) diagnostico = 'Atenção';
              else diagnostico = 'Crítico';
          }

          return { unidade: u, mentor, custo, folha, percent, diagnostico };
      });

      // Ordenação Dinâmica
      return linhas.sort((a, b) => {
          let valA = a[sortConfig.field];
          let valB = b[sortConfig.field];
          
          if (sortConfig.field === 'unidade') { valA = a.unidade.nome; valB = b.unidade.nome; }
          
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [unidades, filtroMentor, role, custosColetiva, dadosFinanceiros, mentores, sortConfig]);

  // --- RANKINGS (TOP 3) ---
  const rankings = useMemo(() => {
      // Filtra apenas quem tem folha preenchida para o ranking
      const ativos = tabelaDados.filter(i => i.folha > 0);
      const topSaudaveis = [...ativos].sort((a, b) => a.percent - b.percent).slice(0, 3); // Menor % primeiro
      const topCriticos = [...ativos].sort((a, b) => b.percent - a.percent).slice(0, 3); // Maior % primeiro
      return { topSaudaveis, topCriticos };
  }, [tabelaDados]);

  // --- PAGINAÇÃO VISUAL ---
  const dadosVisiveis = useMemo(() => tabelaDados.slice(0, itensVisiveis), [tabelaDados, itensVisiveis]);

  const handleSort = (field) => {
      setSortConfig(prev => ({ field, direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const handleCarregarMais = (qtd) => {
      if (qtd === 'todos') setItensVisiveis(tabelaDados.length);
      else setItensVisiveis(prev => prev + qtd);
  };

  // --- TOTAIS ---
  const totais = useMemo(() => {
      const totalFolha = tabelaDados.reduce((acc, l) => acc + l.folha, 0);
      const totalColetiva = tabelaDados.reduce((acc, l) => acc + l.custo, 0);
      const totalColetivaAnt = tabelaDados.reduce((acc, l) => acc + (comparativoAnoAnterior[l.unidade.id] || 0), 0);
      const percentualGeral = totalFolha > 0 ? (totalColetiva / totalFolha) * 100 : 0;
      let variacao = 0;
      if (totalColetivaAnt > 0) variacao = ((totalColetiva - totalColetivaAnt) / totalColetivaAnt) * 100;
      return { totalFolha, totalColetiva, percentualGeral, variacao: Math.round(variacao) };
  }, [tabelaDados, comparativoAnoAnterior]);

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400 gap-2"><Loader2 className="w-8 h-8 animate-spin"/> Processando Dados...</div>;

  return (
    <div className="p-6 md:p-10 animate-fade-in max-w-[1920px] mx-auto space-y-8">
      
      {/* 1. TOPO */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-purple-500/20">
                    <TrendingUp className="w-6 h-6"/>
                </span>
                Performance Financeira
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Controle estratégico de custos e eficiência.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
            {role === 'admin' && (
                <div className="relative group">
                    <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 group-focus-within:text-purple-500"/>
                    <select value={filtroMentor} onChange={e => setFiltroMentor(e.target.value)} className="pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white shadow-sm outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer">
                        <option value="todos">Todos os Mentores</option>
                        {mentores.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none"/>
                </div>
            )}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="bg-slate-100 dark:bg-slate-700 p-1.5 rounded-lg"><Calendar className="w-4 h-4 text-slate-500 dark:text-slate-300"/></div>
                <input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 dark:text-white uppercase cursor-pointer"/>
            </div>
        </div>
      </div>

      {/* 2. KPI CARDS (RESUMO REDE) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start justify-between">
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Custo Coletiva</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">{formatCurrency(totais.totalColetiva)}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${totais.variacao > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {totais.variacao > 0 ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                        {Math.abs(totais.variacao)}% vs ano ant.
                    </span>
                </div>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600"><BarChart3 className="w-6 h-6" /></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start justify-between">
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Folha Total</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">{formatCurrency(totais.totalFolha)}</h3>
                <div className="flex items-center gap-2 mt-1"><span className="text-[10px] text-slate-400">Total Declarado</span></div>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600"><Wallet className="w-6 h-6" /></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start justify-between">
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Impacto Médio</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">{formatPercent(totais.percentualGeral)}</h3>
                <div className="flex items-center gap-2 mt-1"><span className={`text-[10px] font-bold ${totais.percentualGeral > 25 ? 'text-rose-500' : 'text-emerald-500'}`}>{totais.percentualGeral > 25 ? "ALTO CUSTO" : "SAUDÁVEL"}</span></div>
            </div>
            <div className={`p-3 rounded-lg ${totais.percentualGeral > 25 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}><PieChart className="w-6 h-6" /></div>
        </div>
      </div>

      {/* 3. RANKINGS (DESTAQUES E ALERTAS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RankingCard title="Top Eficiência (Menor Impacto) 🏆" items={rankings.topSaudaveis} icon={Trophy} colorClass={{bgHeader: 'bg-emerald-50 dark:bg-emerald-900/20', textTitle: 'text-emerald-700 dark:text-emerald-400', icon: 'text-emerald-600'}} type="good"/>
          <RankingCard title="Pontos de Atenção (Maior Impacto) ⚠️" items={rankings.topCriticos} icon={AlertCircle} colorClass={{bgHeader: 'bg-rose-50 dark:bg-rose-900/20', textTitle: 'text-rose-700 dark:text-rose-400', icon: 'text-rose-600'}} type="bad"/>
      </div>

      {/* 4. TABELA PLANILHADA */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-400"/> Detalhamento Operacional
              </h3>
              <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">{tabelaDados.length} Unidades</span>
          </div>
          
          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                      <tr>
                          <SortableHeader label="Unidade" field="unidade" currentSort={sortConfig} onSort={handleSort} />
                          <SortableHeader label="Mentor" field="mentor" currentSort={sortConfig} onSort={handleSort} />
                          <SortableHeader label="Custo Coletiva" field="custo" currentSort={sortConfig} onSort={handleSort} align="right" />
                          <SortableHeader label="Folha Total" field="folha" currentSort={sortConfig} onSort={handleSort} align="right" />
                          <SortableHeader label="Impacto %" field="percent" currentSort={sortConfig} onSort={handleSort} align="center" />
                          <SortableHeader label="Diagnóstico" field="diagnostico" currentSort={sortConfig} onSort={handleSort} align="center" />
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {dadosVisiveis.map(row => (
                          <PerformanceRow 
                              key={row.unidade.id} unidade={row.unidade} mentorNome={row.mentor}
                              custoAuto={row.custo} folhaManualInicial={row.folha} onSave={handleUpdateFolha}
                          />
                      ))}
                      {dadosVisiveis.length === 0 && (
                          <tr><td colSpan="6" className="p-12 text-center text-slate-400">Nenhuma unidade encontrada.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* 5. PAGINAÇÃO */}
      {itensVisiveis < tabelaDados.length && (
          <div className="flex flex-wrap justify-center gap-3 pb-4 animate-fade-in">
              <button onClick={() => handleCarregarMais(12)} className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-sm flex items-center gap-2"><ArrowDown className="w-4 h-4"/> Carregar +12</button>
              <button onClick={() => handleCarregarMais(50)} className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-sm">Carregar +50</button>
              <button onClick={() => handleCarregarMais('todos')} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-xl text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-200 shadow-sm flex items-center gap-2"><DownloadCloud className="w-4 h-4"/> Ver Todos ({tabelaDados.length})</button>
          </div>
      )}
    </div>
  );
}  

