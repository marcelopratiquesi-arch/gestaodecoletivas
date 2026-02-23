import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  BarChart2, Filter, Calendar, CheckCircle2, AlertCircle, 
  Search, Trophy, ChevronRight, ChevronDown, User, Clock, ShieldCheck, 
  LayoutDashboard, Download, AlertTriangle, Building2, UserCog, List, Construction, 
  History, Eye, EyeOff, Activity, ArrowUpDown, MessageSquare, Copy, Users, FileText, Smartphone, CalendarClock, Palmtree, MapPin
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

// --- MENSAGERIA WHATSAPP (CORRIGIDO PARA UTF-8) ---
const sendWhatsApp = (telefone, mensagem) => {
    if (!telefone) {
        alert("⚠️ TELEFONE NÃO CADASTRADO PARA ESTE CONTATO! ATUALIZE O CADASTRO NA ABA DE CONFIGURAÇÕES.");
        return;
    }
    const numeroLimpo = telefone.replace(/\D/g, '');
    // Rota API Oficial do WhatsApp (Garante que Emojis não quebrem no Windows)
    const url = `https://api.whatsapp.com/send?phone=${numeroLimpo}&text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
};

// --- CORES GRADIENTE ---
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
        'EM ANDAMENTO': 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
        'EM CONSTRUÇÃO': 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600',
        'AGUARDANDO INÍCIO': 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
        'REALIZADA': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400',
        'CANCELADA': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400',
        'FERIADO': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
        'ATRASADO': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400',
        'PENDENTE': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400',
        'FUTURO': 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500'
    };
    
    const Icons = {
        'PARABÉNS!': Trophy,
        'EM ANDAMENTO': Activity,
        'EM CONSTRUÇÃO': Construction,
        'AGUARDANDO INÍCIO': CalendarClock,
        'REALIZADA': CheckCircle2,
        'CANCELADA': AlertCircle,
        'FERIADO': Palmtree,
        'ATRASADO': Clock,
        'PENDENTE': Clock
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

export default function ValidacaoColetiva() {
  const { userData } = useAuth();
  const role = String(userData?.role || "").toLowerCase();
  const userId = userData?.id || userData?.uid;
  const isMentor = role === 'mentor';
  
  const [loading, setLoading] = useState(true);

  // ESTADOS DO BANCO (TEMPO REAL)
  const [unidadesBase, setUnidadesBase] = useState([]);
  const [usuariosBase, setUsuariosBase] = useState([]);
  const [aulasBase, setAulasBase] = useState([]);
  const [validacoesBase, setValidacoesBase] = useState([]);
  const [modalidadesBase, setModalidadesBase] = useState([]);
  const [professoresBase, setProfessoresBase] = useState([]);
  const [feriadosBase, setFeriadosBase] = useState([]);

  // UX & FILTROS
  const [modoFiltro, setModoFiltro] = useState('dia'); 
  const [dataInicio, setDataInicio] = useState(getTodayStr());
  const [dataFim, setDataFim] = useState(getTodayStr());
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [mentorFiltro, setMentorFiltro] = useState("");

  const [activeTab, setActiveTab] = useState('ranking'); 
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedUnitId, setExpandedUnitId] = useState(null);
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);

  const [sortConfig, setSortConfig] = useState({ key: 'percentual', direction: 'descending' });

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (dataInicio > dataFim) setDataFim(dataInicio);
  }, [dataInicio, dataFim]);

  // ==========================================
  // MOTOR V8 (ON SNAPSHOT)
  // ==========================================
  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    let qUnidades = collection(db, 'unidades');
    if (isMentor) {
        qUnidades = query(collection(db, 'unidades'), where('mentorId', '==', userId));
    }

    const qValidacoes = query(
        collection(db, 'validacoes'), 
        where('data', '>=', dataInicio),
        where('data', '<=', dataFim)
    );

    const unsubs = [
        onSnapshot(qUnidades, snap => setUnidadesBase(snap.docs.map(d => ({id: d.id, ...d.data()})))),
        onSnapshot(collection(db, 'usuarios'), snap => setUsuariosBase(snap.docs.map(d => ({id: d.id, ...d.data()})))),
        onSnapshot(collection(db, 'aulas'), snap => setAulasBase(snap.docs.map(d => ({id: d.id, ...d.data()})))),
        onSnapshot(qValidacoes, snap => setValidacoesBase(snap.docs.map(d => ({id: d.id, ...d.data()})))),
        onSnapshot(collection(db, 'modalidades'), snap => setModalidadesBase(snap.docs.map(d => ({id: d.id, ...d.data()})))),
        onSnapshot(collection(db, 'professores'), snap => setProfessoresBase(snap.docs.map(d => ({id: d.id, ...d.data()})))),
        onSnapshot(collection(db, 'feriados'), snap => {
            setFeriadosBase(snap.docs.map(d => {
                const f = d.data();
                return { id: d.id, ...f, inicio: normalizeDate(f.dataInicio || f.inicio || f.data), fim: normalizeDate(f.dataFim || f.fim || f.data) };
            }));
        })
    ];

    const t = setTimeout(() => setLoading(false), 1200);

    return () => {
        clearTimeout(t);
        unsubs.forEach(fn => fn());
    };
  }, [dataInicio, dataFim, role, userId, isMentor]); 

  // --- FILTROS DISPONÍVEIS ---
  const estadosDisponiveis = useMemo(() => {
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

  // --- PROCESSAMENTO DO RANKING E KPIs ---
  const dadosProcessados = useMemo(() => {
    if (unidadesBase.length === 0) return { mentores: [], unidades: [], kpis: { totalAulas: 0, unidadesValidadas: 0, unidadesPendentes: 0 } };

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

    // APLICA O FILTRO DE ESTADO GERAL ANTES DE CALCULAR
    let unidadesAtivas = unidadesBase;
    if (estadoFiltro) {
        unidadesAtivas = unidadesAtivas.filter(u => u.estado === estadoFiltro);
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
            const aulasDoDia = gradeUnidade.filter(a => a.dias && a.dias.includes(diaSemana));

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

        // AQUI ESTÁ A MÁGICA DE NÃO PREJUDICAR A MÉDIA DO MENTOR:
        // Se a unidade não tem cronograma ou não teve aula no período, ela vale 100%.
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
                unidadesList: []
            };
        }
        acc[unit.mentorId].totalUnidades++;
        acc[unit.mentorId].somaPercentuais += unit.percentual; // Unidades em construção agora contam como 100%
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
  }, [unidadesBase, usuariosBase, aulasBase, validacoesBase, modalidadesBase, professoresBase, feriadosBase, dataInicio, dataFim, now, estadoFiltro]); 

  const rankingUnidades = useMemo(() => {
      return [...dadosProcessados.unidades].sort((a, b) => {
          if (b.percentual !== a.percentual) return b.percentual - a.percentual;
          return a.nome.localeCompare(b.nome);
      });
  }, [dadosProcessados.unidades]);

  const sortedUnidades = useMemo(() => {
      let sortableItems = [...dadosProcessados.unidades];
      
      if (mentorFiltro) {
          sortableItems = sortableItems.filter(u => u.mentorId === mentorFiltro);
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
  }, [dadosProcessados.unidades, sortConfig, searchTerm, showOnlyIssues, mentorFiltro]);

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
    const headers = "UNIDADE,MENTOR,REALIZADO,ESPERADO,STATUS,PROGRESSO\n";
    const rows = sortedUnidades.map(u => 
        `${u.nome.toUpperCase()},${u.mentorNome.toUpperCase()},${u.totalValidado},${u.totalEsperado},${u.statusTexto.toUpperCase()},${u.percentual}%`
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
      const destaques = dadosProcessados.mentores.filter(m => m.mediaGeral === 100);
      const atencao = dadosProcessados.mentores.filter(m => m.mediaGeral < 100).sort((a, b) => b.mediaGeral - a.mediaGeral);

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
              return `${emoji} ${getFirstLast(m.nome).toUpperCase()} (${m.mediaGeral}%)`;
          }).join('\n');
          msg += `\n`;
      }
      msg += `\nGESTÃO DE COLETIVAS - PRATIQUE FITNESS 💪`;
      return msg;
  };

  const msgMentorGeneralReport = () => {
      const minhasUnidades = dadosProcessados.unidades; 
      const destaques = minhasUnidades.filter(u => u.percentual === 100 && u.temCronograma && u.totalEsperado > 0);
      const pendentes = minhasUnidades.filter(u => u.percentual < 100 && u.temCronograma).sort((a, b) => b.percentual - a.percentual);

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
              return `${emoji} ${u.nome.toUpperCase()} (${u.percentual}%)`;
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

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400 gap-2 uppercase font-bold"><LayoutDashboard className="animate-spin"/> CARREGANDO SISTEMA...</div>;

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

            {/* FILTRO DE ESTADO GERAL (NOVO) */}
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 px-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><MapPin className="w-4 h-4"/> ESTADO:</span>
                <select 
                    value={estadoFiltro} 
                    onChange={(e) => setEstadoFiltro(e.target.value)} 
                    className="bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none cursor-pointer w-full"
                >
                    <option value="">TODOS OS ESTADOS</option>
                    {estadosDisponiveis.map(est => (
                        <option key={est} value={est}>{est}</option>
                    ))}
                </select>
            </div>
        </div>
      </div>

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
                    <div key={mentor.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-shadow group relative">
                        <div className="flex items-center gap-4 w-full md:w-1/4 min-w-[200px]">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-sm ${index === 0 ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-200' : index === 1 ? 'bg-slate-300 text-slate-800 ring-2 ring-slate-200' : index === 2 ? 'bg-orange-300 text-orange-900 ring-2 ring-orange-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>{index + 1}</div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-lg">{mentor.nome}</h3>
                                <p className="text-xs text-slate-400 font-medium">{mentor.totalUnidades} UNIDADES GERENCIADAS</p>
                            </div>
                        </div>
                        
                        {/* ENVOLVEDOR DA BARRA E TOOLTIP */}
                        <div className="flex-1 w-full relative group/bar py-2 cursor-help">
                            {/* A BARRA DE PROGRESSO EM SI (com overflow-hidden) */}
                            <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                                <div className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${getColorClassByPercent(mentor.mediaGeral)}`} style={{ width: `${mentor.mediaGeral}%` }}></div>
                            </div>
                            
                            {/* O BALÃO DE TOOLTIP (Fica fora da barra, flutuando em cima) */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover/bar:opacity-100 pointer-events-none transition-opacity bg-slate-800 dark:bg-slate-900 border border-slate-700 text-white text-xs p-3 rounded-lg shadow-2xl z-50 min-w-[200px] flex flex-col gap-1">
                                <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-slate-300 uppercase">STATUS DAS UNIDADES</div>
                                {mentor.unidadesList.map(u => (
                                    <div key={u.id} className="flex justify-between items-center gap-4">
                                        <span className="font-medium truncate max-w-[150px] uppercase">{u.nome}</span>
                                        <span className={`font-black ${!u.temCronograma ? 'text-slate-400' : u.percentual === 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {!u.temCronograma ? 'CONSTRUÇÃO' : `${u.percentual}%`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="w-full md:w-32 text-right">
                             <StatusBadge type={mentor.mediaGeral === 100 ? 'PARABÉNS!' : 'EM ANDAMENTO'} text={mentor.mediaGeral === 100 ? 'PARABÉNS!' : `${mentor.mediaGeral}%`} />
                        </div>
                    </div>
                ))}

                {isMentor && rankingUnidades.map((unidade, index) => (
                    <div key={unidade.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-shadow group relative">
                        <div className="flex items-center gap-4 w-full md:w-1/4 min-w-[200px]">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-sm ${index === 0 ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-200' : index === 1 ? 'bg-slate-300 text-slate-800 ring-2 ring-slate-200' : index === 2 ? 'bg-orange-300 text-orange-900 ring-2 ring-orange-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>{index + 1}</div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-lg">{unidade.nome}</h3>
                                <p className="text-xs text-slate-400 font-medium uppercase">{unidade.totalValidado}/{unidade.totalEsperado} AULAS</p>
                            </div>
                        </div>
                        
                        <div className="flex-1 w-full relative group/bar py-2 cursor-help">
                            <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                                <div className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${getColorClassByPercent(unidade.percentual)}`} style={{ width: `${unidade.percentual}%` }}></div>
                            </div>

                            {/* TOOLTIP DO MENTOR */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover/bar:opacity-100 pointer-events-none transition-opacity bg-slate-800 dark:bg-slate-900 border border-slate-700 text-white text-xs p-3 rounded-lg shadow-2xl z-50 whitespace-nowrap">
                                <span className="font-black text-emerald-400">{unidade.totalValidado}</span> DE <span className="font-black text-slate-300">{unidade.totalEsperado}</span> AULAS VALIDADAS
                            </div>
                        </div>

                        <div className="w-full md:w-32 text-right">
                             <StatusBadge type={unidade.percentual === 100 ? 'PARABÉNS!' : 'EM ANDAMENTO'} text={unidade.percentual === 100 ? 'PARABÉNS!' : `${unidade.percentual}%`} />
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* === ABA STATUS INDIVIDUAL === */}
        {activeTab === 'status' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm uppercase">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    
                    <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                            <input type="text" placeholder="BUSCAR UNIDADE OU MENTOR..." className="w-full pl-10 p-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        
                        {/* FILTRO DE MENTORES (CAIXINHA) */}
                        {!isMentor && (
                            <div className="relative w-full sm:w-64">
                                <UserCog className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                                <select 
                                    value={mentorFiltro} 
                                    onChange={(e) => setMentorFiltro(e.target.value)} 
                                    className="w-full pl-10 pr-4 p-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm appearance-none"
                                >
                                    <option value="">TODOS OS MENTORES</option>
                                    {mentoresDisponiveis.map(m => (
                                        <option key={m.id} value={m.id}>{m.nome.toUpperCase()}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none"/>
                            </div>
                        )}
                    </div>

                    {/* BOTÃO INTELIGENTE DE PENDÊNCIAS */}
                    <button 
                        onClick={() => setShowOnlyIssues(!showOnlyIssues)} 
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase transition-all shadow-sm w-full md:w-auto ${showOnlyIssues ? 'bg-blue-600 text-white shadow-blue-200 dark:shadow-none' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300'}`}
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
                            {sortedUnidades.map(u => (
                                <React.Fragment key={u.id}>
                                    <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group ${expandedUnitId === u.id ? 'bg-slate-50 dark:bg-slate-700/30' : ''}`} onClick={() => toggleUnit(u.id)}>
                                        <td className="p-4 text-slate-300 group-hover:text-blue-500 transition-colors">{expandedUnitId === u.id ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}</td>
                                        <td className="p-4"><div className="font-bold text-slate-700 dark:text-slate-200 text-base uppercase">{u.nome}</div><div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-bold uppercase"><User className="w-3 h-3"/> {u.mentorNome}</div></td>
                                        <td className="p-4 text-center">{!u.temCronograma ? <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full uppercase">CONSTRUÇÃO</span> : <div className="flex items-center gap-3 justify-center"><div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${getColorClassByPercent(u.percentual)}`} style={{width: `${u.percentual}%`}}></div></div><span className="text-xs font-black text-slate-600 dark:text-slate-300">{u.percentual}%</span></div>}</td>
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
                                            <td colSpan="7" className="p-0"><div className="p-4"><div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm"><table className="w-full text-xs text-left"><thead className="bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-600"><tr><th className="p-3">DATA / HORA AULA</th><th className="p-3">MODALIDADE / AULA</th><th className="p-3">PROFESSOR</th><th className="p-3 text-center">STATUS</th><th className="p-3 text-right">VALIDAÇÃO</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{u.historicoDetalhado.map((h) => (<tr key={h.key} className={`transition-colors ${getRowColor(h.status, h.diffDays)}`}><td className="p-3"><div className="font-bold text-slate-700 dark:text-slate-200 uppercase">{h.data}</div><div className="text-slate-400 font-mono uppercase">{h.horaAula}</div></td><td className="p-3 font-medium text-slate-600 dark:text-slate-300 uppercase">{h.modalidade}</td><td className="p-3 text-slate-600 dark:text-slate-300 uppercase">{getFirstLast(h.professor)}</td><td className="p-3 text-center"><div className="flex justify-center"><StatusBadge type={h.status} text={h.status === 'ATRASADO' ? 'PENDENTE' : h.status} /></div></td><td className="p-3 text-right">{(h.status === 'REALIZADA' || h.status === 'CANCELADA') ? (<div><div className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px] ml-auto uppercase">{h.responsavelNome}</div><div className="text-slate-400 text-[10px] flex items-center justify-end gap-1 uppercase">{h.dataValidacao} ÀS {h.horaValidacao}</div></div>) : (h.status === 'FERIADO' ? <span className="text-purple-500 font-bold text-[10px]">RECESSO/FERIADO</span> : <span className="text-slate-300 text-[10px]">-</span>)}</td></tr>))}</tbody></table></div></div></td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
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
                            {!isMentor && dadosProcessados.mentores
                                .filter(m => m.unidadesList.some(u => filterPendingDates(u.pendencias).length > 0)) 
                                .sort((a, b) => b.mediaGeral - a.mediaGeral) 
                                .map((mentor) => (
                                <tr key={mentor.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 uppercase">
                                        {mentor.nome}
                                    </td>
                                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-center uppercase">
                                        <span className={`font-bold px-2 py-0.5 rounded text-xs text-white ${getColorClassByPercent(mentor.mediaGeral)}`}>{mentor.mediaGeral}%</span>
                                    </td>
                                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-xs text-slate-500 font-medium uppercase">
                                        {mentor.unidadesList.filter(u => filterPendingDates(u.pendencias).length > 0).map(u => u.nome).join(', ')}
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
                            {isMentor && dadosProcessados.unidades
                                .filter(u => filterPendingDates(u.pendencias).length > 0) 
                                .sort((a, b) => b.percentual - a.percentual) 
                                .map((unidade) => (
                                <tr key={unidade.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 uppercase">
                                        {unidade.nome}
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

                            {((!isMentor && dadosProcessados.mentores.filter(m => m.unidadesList.some(u => filterPendingDates(u.pendencias).length > 0)).length === 0) || 
                              (isMentor && dadosProcessados.unidades.filter(u => filterPendingDates(u.pendencias).length > 0).length === 0)) && (
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
    </div>
  );
}