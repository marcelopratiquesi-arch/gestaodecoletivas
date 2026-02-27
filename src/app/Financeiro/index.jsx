import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCatalogs } from '../../contexts/CatalogContext'; 
import { db } from '../../services/firebase';
import { 
  collection, query, where, getDocs, doc, setDoc, getDoc, orderBy, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, Building2, 
  BarChart3, Calendar, Loader2, Lock, PieChart, Users, Wallet, 
  ChevronDown, Edit2, Check, X, Trophy, ArrowDown, DownloadCloud, Search, FileSpreadsheet
} from 'lucide-react';

// Bibliotecas Externas
import * as XLSX from 'xlsx';

// --- HELPERS ---
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatPercent = (val) => new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val / 100);

const getPreviousMonthStr = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
};

// --- SUB-COMPONENTES ---

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
        <div className="relative w-full sm:w-56" ref={dropdownRef}>
            <Icon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 z-10 pointer-events-none"/>
            <div 
                onClick={() => setIsOpen(!isOpen)} 
                className={`w-full pl-10 pr-8 p-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-700 dark:text-white cursor-pointer shadow-sm select-none flex items-center h-[38px] uppercase ${isOpen ? 'ring-2 ring-purple-500' : ''}`}
            >
                <span className="truncate">{displayText}</span>
                <ChevronDown className={`absolute right-3 top-3 w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </div>
            
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl rounded-xl z-50 max-h-60 flex flex-col overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700 flex justify-between shrink-0 bg-slate-50 dark:bg-slate-900">
                        <button onClick={selectAll} className="text-[10px] font-black text-purple-600 dark:text-purple-400 px-2 py-1 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded uppercase transition-colors">SELECIONAR TODOS</button>
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
                                    className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-700 cursor-pointer"
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

const AlertasInteligentes = ({ dados }) => {
    const semFolha = dados.filter(d => d.folha === 0);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col h-full overflow-y-auto custom-scrollbar uppercase">
            <h3 className="text-xs font-bold text-slate-500 mb-4 flex items-center gap-2 tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-500"/> PENDÊNCIAS DE PREENCHIMENTO
            </h3>
            {semFolha.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-emerald-500 opacity-80">
                    <Check className="w-8 h-8 mb-2"/>
                    <p className="text-xs font-black tracking-wider">100% PREENCHIDO</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm mb-1">
                            <Wallet className="w-4 h-4"/> {semFolha.length} {semFolha.length === 1 ? 'FOLHA PENDENTE' : 'FOLHAS PENDENTES'}
                        </div>
                        <p className="text-xs text-amber-600/80 font-medium">
                            UNIDADES SEM LANÇAMENTO FINANCEIRO NESTE PERÍODO:<br/>
                            <strong className="mt-1 block text-amber-700 dark:text-amber-500">
                                {semFolha.slice(0, 3).map(u => u.unidade.nome).join(', ')}{semFolha.length > 3 && '...'}
                            </strong>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

const RankingCard = ({ title, items, icon: Icon, colorClass, type }) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex-1 uppercase">
        <div className={`p-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 ${colorClass.bgHeader}`}>
            <Icon className={`w-4 h-4 ${colorClass.icon}`} />
            <h3 className={`text-xs font-bold tracking-wider ${colorClass.textTitle}`}>{title}</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {items.length === 0 ? (
                <div className="p-4 text-center text-[10px] text-slate-400 font-bold tracking-widest">SEM DADOS SUFICIENTES</div>
            ) : (
                items.map((item, idx) => (
                    <div key={item.unidade.id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${idx === 0 ? 'bg-yellow-400 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                                {idx + 1}
                            </span>
                            <div>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]" title={item.unidade.nome}>{item.unidade.nome}</p>
                                <p className="text-[9px] text-slate-400 font-bold">{item.mentor}</p>
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

const SortableHeader = ({ label, field, currentSort, onSort, align = "left" }) => (
    <th 
        className={`p-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none text-${align}`}
        onClick={() => onSort(field)}
    >
        <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"}`}>
            {label}
            <div className="flex flex-col">
                <ChevronDown className={`w-2 h-2 ${currentSort.field === field && currentSort.direction === 'desc' ? 'text-purple-600' : 'text-slate-300'}`} />
                <ChevronDown className={`w-2 h-2 rotate-180 -mt-1 ${currentSort.field === field && currentSort.direction === 'asc' ? 'text-purple-600' : 'text-slate-300'}`} />
            </div>
        </div>
    </th>
);

const PerformanceRow = ({ unidade, mentorNome, custoAuto, folhaManualInicial, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(folhaManualInicial || 0);
    const [saving, setSaving] = useState(false);

    useEffect(() => { setTempValue(folhaManualInicial || 0); }, [folhaManualInicial]);

    const handleSave = async () => {
        setSaving(true);
        await onSave(unidade.id, tempValue, folhaManualInicial);
        setSaving(false);
        setIsEditing(false);
    };

    let percentual = 0;
    if (tempValue > 0) percentual = (custoAuto / tempValue) * 100;
    else if (!isEditing && folhaManualInicial > 0) percentual = (custoAuto / folhaManualInicial) * 100;

    return (
        <tr className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group uppercase">
            <td className="p-4">
                <div className="font-bold text-slate-700 dark:text-white text-sm">{unidade.nome}</div>
                <div className="text-[10px] text-slate-400 font-bold">{unidade.cidade} - {unidade.estado}</div>
            </td>
            <td className="p-4 text-xs font-bold text-slate-500 hidden md:table-cell">{mentorNome}</td>
            <td className="p-4 text-right">
                <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">{formatCurrency(custoAuto)}</div>
            </td>
            <td className="p-4 text-right">
                <div className="flex items-center justify-end gap-2">
                    {isEditing ? (
                        <div className="flex items-center gap-1 animate-in zoom-in duration-200">
                            <input 
                                type="number" autoFocus
                                className="w-24 text-right p-1.5 text-sm border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-white font-bold"
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
                            <span className={`text-sm font-bold ${folhaManualInicial === 0 ? 'text-slate-300 italic' : 'text-slate-600 dark:text-slate-300'}`}>
                                {folhaManualInicial > 0 ? formatCurrency(folhaManualInicial) : "DEFINIR VALOR"}
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
                        <span className="font-black text-sm text-blue-600 dark:text-blue-400">
                            {formatPercent(percentual)}
                        </span>
                        <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(percentual, 100)}%` }}></div>
                        </div>
                    </div>
                ) : <span className="text-[10px] text-slate-300 font-bold tracking-widest">-</span>}
            </td>
        </tr>
    );
};

export default function PerformanceFinanceiraPage() {
  const { userData } = useAuth();
  const role = String(userData?.role || "").toLowerCase();
  const userId = userData?.id || userData?.uid;

  // 🟢 INJEÇÃO DA MEMÓRIA GLOBAL (FASE 3)
  const { catalogs: globalCatalogs, loadingCatalogs } = useCatalogs();

  // Estados
  const [loadingRealtime, setLoadingRealtime] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState(false); // 🟢 CORREÇÃO: Controle de Erro de Rede
  const [mesFiltro, setMesFiltro] = useState(getPreviousMonthStr());
  const [filtroMentor, setFiltroMentor] = useState([]); 
  const [busca, setBusca] = useState("");
  
  // Ordenação e Paginação
  const [sortConfig, setSortConfig] = useState({ field: 'percent', direction: 'desc' });
  const [itensVisiveis, setItensVisiveis] = useState(12);

  // Dados Financeiros
  const [dadosFinanceiros, setDadosFinanceiros] = useState({});
  const [custosColetiva, setCustosColetiva] = useState({});
  const [comparativoAnoAnterior, setComparativoAnoAnterior] = useState({});

  // 🟢 LÓGICA DO COFRE
  const isCofreFechado = role === 'admin' && filtroMentor.length === 0;

  // ==========================================
  // 1. APLICAÇÃO DE PERMISSÕES NA MEMÓRIA GLOBAL (ACL)
  // ==========================================
  const { unidades, mentores } = useMemo(() => {
      if (!globalCatalogs || loadingCatalogs) return { unidades: [], mentores: [] };
      
      let unitsData = [...(globalCatalogs.unidades || [])];
      let mentoresData = [...(globalCatalogs.mentores || [])]; 

      if (role === 'mentor') {
          unitsData = unitsData.filter(u => u.mentorId === userId);
      }
      
      return { unidades: unitsData, mentores: mentoresData };
  }, [globalCatalogs, loadingCatalogs, role, userId]);

  // --- OPÇÕES PARA MULTI-SELECT ---
  const mentoresOptions = useMemo(() => {
      return [
          { value: 'todos', label: 'TODOS OS MENTORES' },
          ...mentores.map(m => ({ value: m.id, label: m.nome.toUpperCase() }))
      ];
  }, [mentores]);

  // ==========================================
  // 2. MOTOR DE TEMPO REAL BLINDADO (O COFRE & SANGUE)
  // ==========================================
  useEffect(() => {
    if (loadingCatalogs) return;

    const carregarDados = async () => {
        // GATILHO DE ECONOMIA
        if (isCofreFechado) {
            setCustosColetiva({});
            setComparativoAnoAnterior({});
            setDadosFinanceiros({});
            setLoadingRealtime(false);
            return;
        }

        setLoadingRealtime(true);
        setErroCarregamento(false); // Reseta o status de erro
        try {
            // MAPA DE AULAS LOCAL
            const aulasMap = {};
            (globalCatalogs.aulas || []).forEach(d => aulasMap[d.id] = d);

            // 🟢 CORREÇÃO O(1): Usar SET para performance máxima
            const unidadesSet = new Set(unidades.map(u => u.id));

            const processarPeriodo = async (ano, mes) => {
                const inicio = `${ano}-${mes}-01`;
                const fim = `${ano}-${mes}-${new Date(ano, mes, 0).getDate()}`;
                
                const qVal = query(collection(db, 'validacoes'), where('data', '>=', inicio), where('data', '<=', fim), where('status', '==', 'realizada'));
                const valSnap = await getDocs(qVal);
                
                const custosMap = {};
                valSnap.docs.forEach(d => {
                    const val = d.data();
                    // 🟢 OTIMIZAÇÃO: Busca no SET é 100x mais rápida que o .some() num array
                    if (unidadesSet.has(val.unidadeId)) {
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
            
            const [custosAtual, custosAnterior] = await Promise.all([
                processarPeriodo(anoAtual, mesAtual), 
                processarPeriodo(anoAnterior, mesAtual)
            ]);

            setCustosColetiva(custosAtual);
            setComparativoAnoAnterior(custosAnterior);

            // 🟢 CORREÇÃO DE LEITURA: 1 única query em vez de 150 getDocs separados
            const qIndicadores = query(collection(db, 'indicadores_mensais'), where('mes', '==', mesFiltro));
            const indSnap = await getDocs(qIndicadores);
            
            const inputsMap = {};
            indSnap.docs.forEach(d => {
                const data = d.data();
                // 🟢 Usando o Set de alta performance de novo
                if (unidadesSet.has(data.unidadeId)) {
                     inputsMap[data.unidadeId] = data.folhaPagamento || 0;
                }
            });
            
            setDadosFinanceiros(inputsMap);

        } catch (error) { 
            console.error("Erro no processamento financeiro:", error); 
            setErroCarregamento(true); // 🟢 Dispara a tela de erro
        } finally { 
            setLoadingRealtime(false); 
        }
    };
    carregarDados();
    // 🟢 CORREÇÃO DEPENDÊNCIAS: Removido globais voláteis para evitar Loop Infinito de renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesFiltro, role, userId, filtroMentor, isCofreFechado, loadingCatalogs]);

  // 🟢 MOTOR DE AUDITORIA (X-9 FINANCEIRO)
  const handleUpdateFolha = async (unidadeId, novoValor, valorAntigo) => {
    try {
        const docId = `${mesFiltro}_${unidadeId}`;
        const valorNumerico = parseFloat(novoValor) || 0;
        const unidadeAfetada = unidades.find(u => u.id === unidadeId)?.nome || unidadeId;

        // Atualiza Valor
        await setDoc(doc(db, 'indicadores_mensais', docId), {
            unidadeId, mes: mesFiltro, folhaPagamento: valorNumerico, updatedAt: new Date(), userUpdate: userId
        }, { merge: true });

        // Log de Auditoria X-9
        await addDoc(collection(db, 'auditoria_financeiro'), {
            tipoAcao: 'EDICAO_FOLHA',
            usuarioNome: userData?.nome || 'Gestor',
            usuarioId: userId,
            unidadeId: unidadeId,
            unidadeNome: unidadeAfetada,
            mesReferencia: mesFiltro,
            valorAntigo: valorAntigo,
            valorNovo: valorNumerico,
            timestamp: serverTimestamp()
        });

        setDadosFinanceiros(prev => ({...prev, [unidadeId]: valorNumerico}));
    } catch (e) { alert("ERRO AO SALVAR O VALOR!"); }
  };

  // --- PROCESSAMENTO DA LISTA ---
  const tabelaDados = useMemo(() => {
      let lista = unidades;
      
      if (role === 'admin' && filtroMentor.length > 0 && !filtroMentor.includes('todos')) {
          lista = lista.filter(u => filtroMentor.includes(u.mentorId));
      }
      
      // Busca
      if (busca) {
          const termo = busca.toLowerCase();
          lista = lista.filter(u => 
              u.nome.toLowerCase().includes(termo) || 
              u.cidade?.toLowerCase().includes(termo)
          );
      }

      const linhas = lista.map(u => {
          const custo = custosColetiva[u.id] || 0;
          const folha = dadosFinanceiros[u.id] || 0;
          const percent = folha > 0 ? (custo / folha) * 100 : 0;
          const mentor = mentores.find(m => m.id === u.mentorId)?.nome || '-';

          return { unidade: u, mentor, custo, folha, percent };
      });

      return linhas.sort((a, b) => {
          let valA = a[sortConfig.field];
          let valB = b[sortConfig.field];
          
          if (sortConfig.field === 'unidade') { valA = a.unidade.nome; valB = b.unidade.nome; }
          if (sortConfig.field === 'mentor') { valA = a.mentor; valB = b.mentor; }
          
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [unidades, filtroMentor, busca, role, custosColetiva, dadosFinanceiros, mentores, sortConfig]);

  // --- RANKINGS ---
  const rankings = useMemo(() => {
      const ativos = tabelaDados.filter(i => i.folha > 0);
      const topSaudaveis = [...ativos].sort((a, b) => a.percent - b.percent).slice(0, 3);
      return { topSaudaveis };
  }, [tabelaDados]);

  // --- PAGINAÇÃO ---
  const dadosVisiveis = useMemo(() => tabelaDados.slice(0, itensVisiveis), [tabelaDados, itensVisiveis]);

  const handleSort = (field) => {
      setSortConfig(prev => ({ field, direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const handleCarregarMais = (qtd) => {
      if (qtd === 'todos') setItensVisiveis(tabelaDados.length);
      else setItensVisiveis(prev => prev + qtd);
  };

  // --- EXPORTAR EXCEL ---
  const exportarRelatorio = () => {
      const dadosExport = tabelaDados.map(row => ({
          'UNIDADE': row.unidade.nome.toUpperCase(),
          'CIDADE': row.unidade.cidade?.toUpperCase() || "",
          'MENTOR': row.mentor.toUpperCase(),
          'CUSTO COLETIVA': row.custo,
          'FOLHA PAGAMENTO': row.folha,
          'IMPACTO %': (row.percent / 100).toFixed(4)
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosExport);
      
      const wscols = [{wch:30}, {wch:15}, {wch:20}, {wch:15}, {wch:15}, {wch:10}];
      ws['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, "FINANCEIRO");
      XLSX.writeFile(wb, `PERFORMANCE_FINANCEIRA_${mesFiltro}.xlsx`);
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

  // 🟢 BLOQUEIO DE TELA
  if (role !== 'admin' && role !== 'mentor') {
      return (
          <div className="flex h-screen items-center justify-center flex-col gap-4 text-slate-400 uppercase">
              <div className="bg-slate-100 p-6 rounded-full"><Lock className="w-12 h-12 text-slate-300" /></div>
              <h2 className="text-xl font-black text-slate-600 tracking-wider">ACESSO RESTRITO</h2>
              <p className="font-bold">APENAS GESTORES TÊM ACESSO À PERFORMANCE FINANCEIRA.</p>
          </div>
      );
  }

  // 🟢 TRATAMENTO DE ERRO (UX)
  if (erroCarregamento) {
      return (
          <div className="flex h-[80vh] items-center justify-center flex-col gap-4 text-rose-500 uppercase animate-fade-in">
              <div className="bg-rose-50 p-6 rounded-full border border-rose-200 shadow-inner"><AlertTriangle className="w-12 h-12 text-rose-500" /></div>
              <h2 className="text-xl font-black tracking-wider text-slate-800">FALHA DE COMUNICAÇÃO</h2>
              <p className="font-bold text-slate-500">NÃO FOI POSSÍVEL CARREGAR OS DADOS FINANCEIROS. TENTE NOVAMENTE.</p>
              <button onClick={() => window.location.reload()} className="mt-4 px-6 py-3 bg-rose-500 text-white rounded-xl font-black shadow-lg shadow-rose-500/30 hover:bg-rose-600 transition-colors active:scale-95">
                  ATUALIZAR PÁGINA
              </button>
          </div>
      );
  }

  // Loading principal que aguarda a Memória Global baixar pela primeira vez
  if (loadingCatalogs) return <div className="flex h-screen items-center justify-center text-slate-400 gap-2 font-bold uppercase tracking-wider"><Loader2 className="w-8 h-8 animate-spin"/> CARREGANDO MEMÓRIA GLOBAL...</div>;

  return (
    <div className="p-6 md:p-10 animate-fade-in max-w-[1920px] mx-auto space-y-8 uppercase">
      
      {/* 1. TOPO (AJUSTE DE TAMANHO E ORGANIZAÇÃO) */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3 tracking-tight">
                <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-purple-500/20">
                    <TrendingUp className="w-6 h-6"/>
                </span>
                PERFORMANCE FINANCEIRA
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-bold text-xs">CONTROLE ESTRATÉGICO DE CUSTOS E EFICIÊNCIA.</p>
        </div>
        
        {/* Container de Filtros Agrupado */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full xl:w-auto">
            
            {/* BUSCA */}
            <div className="relative w-full sm:w-56 group">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 group-focus-within:text-purple-500"/>
                <input 
                    type="text" 
                    placeholder="BUSCAR UNIDADE..." 
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white shadow-sm outline-none focus:ring-2 focus:ring-purple-500 transition-all uppercase placeholder:normal-case h-[38px]"
                />
            </div>

            {/* MENTOR */}
            {role === 'admin' && (
                <MultiSelectDropdown 
                    options={mentoresOptions} 
                    selectedValues={filtroMentor} 
                    onChange={setFiltroMentor} 
                    placeholder="NENHUM MENTOR"
                    icon={Users}
                />
            )}
            
            {/* GRUPO LADO A LADO: MÊS + EXPORTAR EXCEL */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex flex-1 sm:flex-none items-center gap-2 bg-white dark:bg-slate-800 px-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-[38px]">
                    <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-300"/>
                    <input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 dark:text-white uppercase cursor-pointer w-full"/>
                </div>
                
                <button onClick={exportarRelatorio} className="px-4 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-sm h-[38px] flex items-center justify-center gap-2 font-bold text-xs" title="EXPORTAR EXCEL">
                    <FileSpreadsheet className="w-4 h-4"/> EXCEL
                </button>
            </div>

        </div>
      </div>

      {/* 🟢 O COFRE E LOADING TEMPO REAL */}
      {isCofreFechado ? (
          <div className="py-24 text-center bg-white dark:bg-slate-800 border-dashed border-2 border-slate-300 dark:border-slate-700 shadow-sm animate-in fade-in zoom-in duration-300 m-4 rounded-2xl">
              <div className="bg-purple-50 dark:bg-slate-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-100 dark:border-slate-800 shadow-inner">
                  <TrendingUp className="w-10 h-10 text-purple-500 animate-pulse"/>
              </div>
              <h3 className="text-2xl font-black text-slate-700 dark:text-white mb-3 uppercase tracking-wider">
                  SELECIONE UM MENTOR PARA INICIAR
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-bold max-w-lg mx-auto leading-relaxed uppercase">
                  SELECIONE UM OU MAIS MENTORES NO FILTRO ACIMA PARA OBTER O RELATÓRIO FINANCEIRO.
              </p>
          </div>
      ) : loadingRealtime ? (
          <div className="flex h-64 items-center justify-center text-slate-400 gap-2 font-bold uppercase tracking-wider"><Loader2 className="w-8 h-8 animate-spin"/> PROCESSANDO DADOS...</div>
      ) : (
          <>
            {/* 2. KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">CUSTO COLETIVA</p>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">{formatCurrency(totais.totalColetiva)}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 uppercase ${totais.variacao > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {totais.variacao > 0 ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                                {Math.abs(totais.variacao)}% VS ANO ANT.
                            </span>
                        </div>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50 text-purple-600 shadow-inner"><BarChart3 className="w-6 h-6" /></div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">FOLHA TOTAL</p>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">{formatCurrency(totais.totalFolha)}</h3>
                        <div className="flex items-center gap-2 mt-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL DECLARADO</span></div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 text-blue-600 shadow-inner"><Wallet className="w-6 h-6" /></div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">IMPACTO MÉDIO</p>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">{formatPercent(totais.percentualGeral)}</h3>
                        <div className="flex items-center gap-2 mt-1"><span className={`text-[10px] font-black tracking-wider uppercase ${totais.percentualGeral > 25 ? 'text-rose-500' : 'text-emerald-500'}`}>{totais.percentualGeral > 25 ? "ALTO CUSTO" : "SAUDÁVEL"}</span></div>
                    </div>
                    <div className={`p-3 rounded-lg shadow-inner ${totais.percentualGeral > 25 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}><PieChart className="w-6 h-6" /></div>
                </div>
            </div>

            {/* 3. DASHBOARD VISUAL (ALERTAS E RANKING) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[300px]">
                <div className="h-full">
                    <AlertasInteligentes dados={tabelaDados} />
                </div>
                <div className="h-full flex flex-col gap-4">
                    <RankingCard title="TOP EFICIÊNCIA 🏆" items={rankings.topSaudaveis} icon={Trophy} colorClass={{bgHeader: 'bg-emerald-50 dark:bg-emerald-900/20', textTitle: 'text-emerald-700 dark:text-emerald-400', icon: 'text-emerald-600'}} type="good"/>
                </div>
            </div>

            {/* 4. TABELA PLANILHADA */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                    <h3 className="font-black text-slate-700 dark:text-white flex items-center gap-2 uppercase tracking-wide">
                        <Building2 className="w-5 h-5 text-slate-400"/> DETALHAMENTO OPERACIONAL
                    </h3>
                    <span className="text-xs font-black text-slate-500 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full uppercase">{tabelaDados.length} UNIDADES</span>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                            <tr>
                                <SortableHeader label="UNIDADE" field="unidade" currentSort={sortConfig} onSort={handleSort} />
                                <SortableHeader label="MENTOR" field="mentor" currentSort={sortConfig} onSort={handleSort} />
                                <SortableHeader label="CUSTO COLETIVA" field="custo" currentSort={sortConfig} onSort={handleSort} align="right" />
                                <SortableHeader label="FOLHA TOTAL" field="folha" currentSort={sortConfig} onSort={handleSort} align="right" />
                                <SortableHeader label="IMPACTO %" field="percent" currentSort={sortConfig} onSort={handleSort} align="center" />
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
                                <tr><td colSpan="5" className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest">NENHUMA UNIDADE ENCONTRADA.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 5. PAGINAÇÃO */}
            {itensVisiveis < tabelaDados.length && (
                <div className="flex flex-wrap justify-center gap-3 pb-4 animate-fade-in">
                    <button onClick={() => handleCarregarMais(12)} className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-sm flex items-center gap-2 uppercase tracking-wide"><ArrowDown className="w-4 h-4"/> CARREGAR +12</button>
                    <button onClick={() => handleCarregarMais(50)} className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-sm uppercase tracking-wide">CARREGAR +50</button>
                    <button onClick={() => handleCarregarMais('todos')} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-xl text-xs font-black text-slate-700 dark:text-white hover:bg-slate-200 shadow-sm flex items-center gap-2 uppercase tracking-wide"><DownloadCloud className="w-4 h-4"/> VER TODOS ({tabelaDados.length})</button>
                </div>
            )}
          </>
      )}
    </div>
  );
}