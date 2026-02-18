import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { 
  BarChart2, Filter, Calendar, CheckCircle2, AlertCircle, 
  Search, Trophy, ChevronRight, ChevronDown, User, Clock, ShieldCheck, 
  LayoutDashboard, Download, AlertTriangle, Building2, UserCog, List, Construction, 
  History, Eye, EyeOff, Activity, ArrowUpDown, MessageSquare, Copy, Users, FileText, CalendarClock
} from 'lucide-react';

const diasSemanaMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
const getTodayStr = () => new Date().toLocaleDateString('en-CA'); 

// --- HELPERS ---

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
    
    return `${d1.toLocaleDateString('pt-BR')} a ${d2.toLocaleDateString('pt-BR')}`;
};

const getFirstLast = (fullName) => {
    if (!fullName) return '-';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
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

// --- COMPONENTES AUXILIARES (FORA DO ESCOPO PRINCIPAL PARA PERFORMANCE) ---

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
      {subTitle && <p className="text-xs text-slate-400 mt-1 font-medium">{subTitle}</p>}
    </div>
    <div className={`p-3 rounded-xl shadow-inner ${iconBg}`}>
      <Icon className="w-7 h-7" />
    </div>
  </div>
);

const MentorAvatar = ({ name }) => (
  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-md border-2 border-slate-600 flex-shrink-0">
    {name ? name.charAt(0).toUpperCase() : 'M'}
  </div>
);

const StatusBadge = ({ type, text }) => {
    const configs = {
        'Parabéns!': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
        'Em andamento': 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
        'Em construção': 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600',
        'Aguardando início': 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
        'realizada': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400',
        'cancelada': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400',
        'atrasado': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400',
        'futuro': 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500'
    };
    
    const Icons = {
        'Parabéns!': Trophy,
        'Em andamento': Activity,
        'Em construção': Construction,
        'Aguardando início': CalendarClock, // Ícone adicionado aqui
        'realizada': CheckCircle2,
        'cancelada': AlertCircle,
        'atrasado': Clock
    };

    const IconComp = Icons[type] || Icons[text] || Icons['futuro'];

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap w-fit ${configs[type] || configs[text] || configs['futuro']}`}>
            {IconComp && <IconComp className="w-3 h-3" />}
            {text}
        </span>
    );
};

export default function ValidacaoColetiva() {
  const { userData } = useAuth();
  const role = String(userData?.role || "").toLowerCase();
  const userId = userData?.id || userData?.uid;
  const isMentor = role === 'mentor';
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ 
    unidades: [], mentores: [], aulas: [], validacoes: [], usuarios: [], modalidades: [], professores: []
  });

  const [modoFiltro, setModoFiltro] = useState('dia'); 
  const [dataInicio, setDataInicio] = useState(getTodayStr());
  const [dataFim, setDataFim] = useState(getTodayStr());
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

  // VALIDAÇÃO DE DATA (SEGURANÇA)
  useEffect(() => {
      if (dataInicio > dataFim) {
          setDataFim(dataInicio);
      }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const qValidacoes = query(
            collection(db, 'validacoes'), 
            where('data', '>=', dataInicio),
            where('data', '<=', dataFim)
        );

        let qUnidades = collection(db, 'unidades');
        if (isMentor) {
            qUnidades = query(collection(db, 'unidades'), where('mentorId', '==', userId));
        }

        const [uniSnap, userSnap, aulaSnap, valSnap, modSnap, profSnap] = await Promise.all([
          getDocs(qUnidades),
          getDocs(collection(db, 'usuarios')),
          getDocs(collection(db, 'aulas')),
          getDocs(qValidacoes),
          getDocs(collection(db, 'modalidades')),
          getDocs(collection(db, 'professores'))
        ]);

        setData({
          unidades: uniSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          usuarios: userSnap.docs.map(d => ({ id: d.id, ...d.data() })), 
          mentores: userSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === 'mentor' || u.role === 'admin'),
          aulas: aulaSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          validacoes: valSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          modalidades: modSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          professores: profSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

      } catch (e) {
        console.error("Erro ao carregar:", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [dataInicio, dataFim, role, userId]); 

  const dadosProcessados = useMemo(() => {
    if (data.unidades.length === 0) return { mentores: [], unidades: [], kpis: { totalAulas: 0, unidadesValidadas: 0, unidadesPendentes: 0 } };

    const mentorMap = {};
    data.mentores.forEach(m => mentorMap[m.id] = m.nome);
    const usuariosMap = {};
    data.usuarios.forEach(u => usuariosMap[u.id] = { nome: u.nome, role: u.role });
    const modMap = {};
    data.modalidades.forEach(m => modMap[m.id] = m.nome);
    const profMap = {};
    data.professores.forEach(p => profMap[p.id] = p.nome);

    const datasDoPeriodo = getDatesInRange(dataInicio, dataFim);

    const statusUnidades = data.unidades.map(unidade => {
        let totalEsperadoAteAgora = 0;
        let totalValidado = 0;
        let pendencias = []; 
        let historicoDetalhado = []; 

        const gradeUnidade = data.aulas.filter(a => String(a.unidadeId) === String(unidade.id));
        const temCronograma = gradeUnidade.length > 0;

        datasDoPeriodo.forEach(dataStr => {
            const dateObj = new Date(dataStr + 'T00:00:00');
            const diaSemana = diasSemanaMap[dateObj.getDay()];
            const aulasDoDia = gradeUnidade.filter(a => a.dias && a.dias.includes(diaSemana));

            aulasDoDia.forEach(aula => {
                const [h, m] = aula.hora.split(':');
                const dataHoraAula = new Date(dataStr);
                dataHoraAula.setHours(parseInt(h), parseInt(m), 59); 

                const jaPassou = dataHoraAula < now;
                if (jaPassou) totalEsperadoAteAgora++;

                const validacao = data.validacoes.find(v => String(v.aulaId) === String(aula.id) && v.data === dataStr);
                
                let statusItem = 'pendente';
                let responsavelNome = '-';
                let horaValidacao = '-';
                let dataValidacao = '-';
                let diffDays = 0;

                if (validacao) {
                    if (!jaPassou) totalEsperadoAteAgora++; 
                    totalValidado++;
                    statusItem = validacao.status; 
                    
                    const userLog = usuariosMap[validacao.userId || validacao.validadoPor];
                    responsavelNome = userLog ? userLog.nome : (validacao.validadoPorNome || 'Sistema');

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
                            const diffTime = dateValidacao - dateAula;
                            diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        }
                    }
                } else {
                    if (jaPassou) {
                        pendencias.push({ data: dataStr, dia: diaSemana, info: `Aula das ${aula.hora}` });
                        statusItem = 'atrasado';
                    } else {
                        statusItem = 'futuro';
                    }
                }

                historicoDetalhado.push({
                    key: aula.id + dataStr,
                    data: new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR'),
                    dia: diaSemana,
                    horaAula: aula.hora,
                    modalidade: modMap[aula.modalidadeId] || 'Geral',
                    professor: profMap[aula.professorId] || 'Sem professor',
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

        let percentual = 0;
        if (totalEsperadoAteAgora > 0) {
            percentual = Math.round((totalValidado / totalEsperadoAteAgora) * 100);
        }

        let statusTexto = 'Em andamento';
        if (!temCronograma) statusTexto = 'Em construção'; 
        else if (percentual === 100 && totalEsperadoAteAgora > 0) statusTexto = 'Parabéns!';
        else if (totalEsperadoAteAgora === 0) statusTexto = 'Aguardando início';

        // Correção de Referência Circular: Busca em 'data' original
        const lastVal = data.validacoes.filter(v => String(v.unidadeId) === String(unidade.id))
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
            mentorId: unidade.mentorId,
            mentorNome: mentorMap[unidade.mentorId] || 'Sem Mentor',
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
            acc[unit.mentorId] = {
                id: unit.mentorId,
                nome: unit.mentorNome,
                totalUnidades: 0,
                somaPercentuais: 0,
                unidadesList: []
            };
        }
        acc[unit.mentorId].totalUnidades++;
        acc[unit.mentorId].somaPercentuais += unit.percentual;
        acc[unit.mentorId].unidadesList.push(unit);
        return acc;
    }, {})).map(m => ({
        ...m,
        mediaGeral: Math.round(m.somaPercentuais / m.totalUnidades)
    })).sort((a, b) => b.mediaGeral - a.mediaGeral);

    const kpis = {
        totalAulas: statusUnidades.reduce((acc, u) => acc + u.totalEsperado, 0),
        unidadesValidadas: statusUnidades.filter(u => u.percentual === 100 && u.temCronograma).length,
        unidadesPendentes: statusUnidades.filter(u => u.percentual < 100).length
    };

    return { mentores: ranking, unidades: statusUnidades, kpis };
  }, [data, dataInicio, dataFim, now]); 

  const rankingUnidades = useMemo(() => {
      return [...dadosProcessados.unidades].sort((a, b) => {
          if (b.percentual !== a.percentual) return b.percentual - a.percentual;
          return a.nome.localeCompare(b.nome);
      });
  }, [dadosProcessados.unidades]);

  const sortedUnidades = useMemo(() => {
      let sortableItems = [...dadosProcessados.unidades];
      
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
  }, [dadosProcessados.unidades, sortConfig, searchTerm, showOnlyIssues]);

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
    const headers = "Unidade,Mentor,Realizado,Esperado,Status,Progresso\n";
    const rows = sortedUnidades.map(u => 
        `${u.nome},${u.mentorNome},${u.totalValidado},${u.totalEsperado},${u.statusTexto},${u.percentual}%`
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
      return [...new Set(pendencias
          .map(p => p.data)
          .filter(d => d <= today) // Datas até hoje
      )].sort();
  };

  // --- MENSAGENS COM TEXTO PURO (SEM ENCODING) ---

  const msgAdminToMentor = (mentor) => {
    const unidadesComPendencias = mentor.unidadesList
        .filter(u => u.temCronograma)
        .map(u => ({ ...u, datasReais: filterPendingDates(u.pendencias) }))
        .filter(u => u.datasReais.length > 0);

    const lista = unidadesComPendencias.map(u => {
        const datas = u.datasReais.map(d => formatDateShort(d)).join(', ');
        return `📍 *${u.nome}* ${datas ? `(Dias: ${datas})` : ''}`;
    }).join('\n');

    return `Olá ${getFirstLast(mentor.nome)}, tudo bem? 🚀\n\nIdentificamos pendências na validação diária das seguintes unidades:\n\n${lista}\n\n⚠️ *Atenção:* A ausência de validação indica que o líder não está conferindo a sala coletiva presencialmente. Precisamos garantir esse monitoramento na ponta.\n\nPor favor, verifique a atualização do relatório para mantermos nosso padrão de excelência.\n\nConto com você! 👊`;
  };

  const msgMentorToUnit = (unidade) => {
      const datas = filterPendingDates(unidade.pendencias).map(d => formatDateShort(d)).join(', ');
      return `Fala Líder *${unidade.nome}*, tudo bem? 👊\n\nEstou conferindo o relatório de gestão aqui e vi que temos pendências na validação das coletivas:\n\n📅 *Período:* ${formatHeaderPeriodo(dataInicio, dataFim)}\n⚠️ *Dias em aberto:* ${datas}\n\nÉ fundamental que a conferência seja feita diariamente. Consegue regularizar isso pra gente hoje?\n\nValeu! 🚀`;
  };

  const msgAdminGeneralReport = () => {
      const destaques = dadosProcessados.mentores.filter(m => m.mediaGeral === 100);
      const atencao = dadosProcessados.mentores
          .filter(m => m.mediaGeral < 100)
          .sort((a, b) => b.mediaGeral - a.mediaGeral);

      let msg = `📢 *Status Validação Coletiva - ${formatHeaderPeriodo(dataInicio, dataFim)}*\n\n`;
      
      if (destaques.length > 0) {
          msg += `🏆 *Parabéns (100% Validado):*\n`;
          msg += destaques.map(m => `✅ ${getFirstLast(m.nome)}`).join('\n');
          msg += `\n\n`;
      }

      if (atencao.length > 0) {
          msg += `⚠️ *Pendentes de Validação:*\n`;
          msg += atencao.map(m => {
              const emoji = getEmojiByPercent(m.mediaGeral);
              return `${emoji} ${getFirstLast(m.nome)} (${m.mediaGeral}%)`;
          }).join('\n');
          msg += `\n`;
      }

      msg += `\nGestão de Coletivas - Pratique Fitness 💪`;
      return msg;
  };

  const msgMentorGeneralReport = () => {
      const minhasUnidades = dadosProcessados.unidades; 
      const destaques = minhasUnidades.filter(u => u.percentual === 100 && u.temCronograma);
      const pendentes = minhasUnidades
          .filter(u => u.percentual < 100 && u.temCronograma)
          .sort((a, b) => b.percentual - a.percentual);

      let msg = `📢 *Status Validação Coletiva - ${formatHeaderPeriodo(dataInicio, dataFim)}*\n\n`;

      if (destaques.length > 0) {
          msg += `🏆 *Unidades em Dia (100%):*\n`;
          msg += destaques.map(u => `✅ ${u.nome}`).join('\n');
          msg += `\n\n`;
      }

      if (pendentes.length > 0) {
          msg += `⚠️ *Atenção (Pendências):*\n`;
          msg += pendentes.map(u => {
              const emoji = getEmojiByPercent(u.percentual);
              return `${emoji} ${u.nome} (${u.percentual}%)`;
          }).join('\n');
          msg += `\n`;
      }

      msg += `\nBora regularizar e garantir a excelência nas aulas! Conto com todos. 🚀`;
      return msg;
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Texto copiado com sucesso!');
  };

  const getRowColor = (status, diffDays) => {
    if (status !== 'realizada' && status !== 'cancelada') {
        return 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-4 border-l-transparent'; 
    }
    if (diffDays <= 0) return 'bg-emerald-100/80 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 border-l-4 border-l-emerald-500';
    if (diffDays === 1) return 'bg-amber-100/80 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 border-l-4 border-l-amber-500';
    if (diffDays >= 2) return 'bg-red-100/80 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 border-l-4 border-l-red-500';
    return 'hover:bg-slate-50 dark:hover:bg-slate-700/50';
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400 gap-2"><LayoutDashboard className="animate-spin"/> Carregando Sistema...</div>;

  return (
    <div className="p-6 md:p-8 max-w-[1920px] mx-auto animate-fade-in space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <span className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2 rounded-lg shadow-lg shadow-blue-500/20"><ShieldCheck className="w-7 h-7" /></span>
            Validação Coletiva
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">Monitoramento de adesão e auditoria em tempo real</p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                <button onClick={() => handleDateChange('dia')} className={`px-4 py-2 text-xs font-bold rounded-md uppercase transition-all ${modoFiltro === 'dia' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Dia</button>
                <button onClick={() => setModoFiltro('periodo')} className={`px-4 py-2 text-xs font-bold rounded-md uppercase transition-all ${modoFiltro === 'periodo' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Período</button>
                <button onClick={() => handleDateChange('mes')} className={`px-4 py-2 text-xs font-bold rounded-md uppercase transition-all ${modoFiltro === 'mes' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Mês</button>
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
            <button onClick={exportarCSV} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors tooltip" title="Exportar CSV"><Download className="w-5 h-5"/></button>
        </div>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard title="Aulas Esperadas" value={dadosProcessados.kpis.totalAulas} icon={Calendar} colorClass="border-l-4 border-l-blue-500" iconBg="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"/>
        <KPICard title="Unidades 100%" value={dadosProcessados.kpis.unidadesValidadas} icon={CheckCircle2} colorClass="border-l-4 border-l-emerald-500" iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" subTitle={`de ${dadosProcessados.unidades.length} unidades`}/>
        <KPICard title="Unidades Pendentes" value={dadosProcessados.kpis.unidadesPendentes} icon={AlertCircle} colorClass="border-l-4 border-l-rose-500" iconBg="bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"/>
      </div>

      {/* TABS */}
      <div className="flex gap-8 border-b border-slate-200 dark:border-slate-700">
        {[
            { id: 'ranking', label: 'Ranking', icon: Trophy },
            { id: 'status', label: 'Status Detalhado', icon: List },
            { id: 'cobranca', label: 'Central de Cobrança', icon: MessageSquare }
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
            <div className="grid gap-4">
                {!isMentor && dadosProcessados.mentores.map((mentor, index) => (
                    <div key={mentor.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-shadow group relative">
                        <div className="flex items-center gap-4 w-full md:w-1/4 min-w-[200px]">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-sm ${index === 0 ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-200' : index === 1 ? 'bg-slate-300 text-slate-800 ring-2 ring-slate-200' : index === 2 ? 'bg-orange-300 text-orange-900 ring-2 ring-orange-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>{index + 1}</div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-lg">{mentor.nome}</h3>
                                <p className="text-xs text-slate-400 font-medium">{mentor.totalUnidades} unidades gerenciadas</p>
                            </div>
                        </div>
                        <div className="flex-1 w-full relative">
                            <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative shadow-inner group/bar cursor-help">
                                <div className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${getColorClassByPercent(mentor.mediaGeral)}`} style={{ width: `${mentor.mediaGeral}%` }}></div>
                            </div>
                        </div>
                        <div className="w-full md:w-32 text-right">
                             <StatusBadge type={mentor.mediaGeral === 100 ? 'Parabéns!' : 'Em andamento'} text={mentor.mediaGeral === 100 ? 'Parabéns!' : `${mentor.mediaGeral}%`} />
                        </div>
                    </div>
                ))}

                {isMentor && rankingUnidades.map((unidade, index) => (
                    <div key={unidade.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-shadow group relative">
                        <div className="flex items-center gap-4 w-full md:w-1/4 min-w-[200px]">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-sm ${index === 0 ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-200' : index === 1 ? 'bg-slate-300 text-slate-800 ring-2 ring-slate-200' : index === 2 ? 'bg-orange-300 text-orange-900 ring-2 ring-orange-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>{index + 1}</div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-lg">{unidade.nome}</h3>
                                <p className="text-xs text-slate-400 font-medium">{unidade.totalValidado}/{unidade.totalEsperado} aulas</p>
                            </div>
                        </div>
                        <div className="flex-1 w-full relative">
                            <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative shadow-inner group/bar cursor-help">
                                <div className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${getColorClassByPercent(unidade.percentual)}`} style={{ width: `${unidade.percentual}%` }}></div>
                            </div>
                        </div>
                        <div className="w-full md:w-32 text-right">
                             <StatusBadge type={unidade.percentual === 100 ? 'Parabéns!' : 'Em andamento'} text={unidade.percentual === 100 ? 'Parabéns!' : `${unidade.percentual}%`} />
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* === ABA STATUS INDIVIDUAL === */}
        {activeTab === 'status' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                        <input type="text" placeholder="Buscar..." className="w-full pl-10 p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <button onClick={() => setShowOnlyIssues(!showOnlyIssues)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase transition-all shadow-sm ${showOnlyIssues ? 'bg-red-600 text-white shadow-red-200' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300'}`}>{showOnlyIssues ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>} {showOnlyIssues ? 'Apenas Pendentes' : 'Mostrar Tudo'}</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="p-4 w-10"></th>
                                <SortableHeader label="Unidade / Mentor" sortKey="nome" currentSort={sortConfig} onSort={requestSort} />
                                <SortableHeader label="Progresso" sortKey="percentual" currentSort={sortConfig} onSort={requestSort} align="center" />
                                <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} align="center" />
                                <SortableHeader label="Última Atualização" sortKey="lastValidation" currentSort={sortConfig} onSort={requestSort} />
                                <SortableHeader label="Responsável" sortKey="responsavel" currentSort={sortConfig} onSort={requestSort} align="right" />
                                <th className="p-4 text-center">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {sortedUnidades.map(u => (
                                <React.Fragment key={u.id}>
                                    <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group ${expandedUnitId === u.id ? 'bg-slate-50 dark:bg-slate-700/30' : ''}`} onClick={() => toggleUnit(u.id)}>
                                        <td className="p-4 text-slate-300 group-hover:text-blue-500 transition-colors">{expandedUnitId === u.id ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}</td>
                                        <td className="p-4"><div className="font-bold text-slate-700 dark:text-slate-200 text-base">{u.nome}</div><div className="text-[10px] text-slate-400 flex items-center gap-1 uppercase mt-0.5 font-bold"><User className="w-3 h-3"/> {u.mentorNome}</div></td>
                                        <td className="p-4 text-center">{!u.temCronograma ? <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">Construção</span> : <div className="flex items-center gap-3 justify-center"><div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${getColorClassByPercent(u.percentual)}`} style={{width: `${u.percentual}%`}}></div></div><span className="text-xs font-black text-slate-600 dark:text-slate-300">{u.percentual}%</span></div>}</td>
                                        <td className="p-4 text-center"><StatusBadge type={u.statusTexto} text={u.statusTexto} /></td>
                                        <td className="p-4">{u.lastValidation ? <div className="flex flex-col text-xs"><span className="text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400"/> {u.lastValidation.data}</span><span className="text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3"/> {u.historicoDetalhado[0]?.horaValidacao || '-'}</span></div> : <span className="text-xs text-slate-300 italic">-</span>}</td>
                                        <td className="p-4 text-right">{u.lastValidation ? <div className="flex justify-end"><div className="text-right"><span className="block text-xs font-bold text-slate-700 dark:text-white truncate max-w-[150px]">{u.lastValidation.responsavelNome}</span><span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded mt-0.5 border border-slate-200 dark:border-slate-600">{u.lastValidation.responsavelRole}</span></div></div> : <span className="text-xs text-slate-300">-</span>}</td>
                                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            {u.percentual < 100 && u.temCronograma && (
                                                <button 
                                                    onClick={() => copyToClipboard(msgMentorToUnit(u))} 
                                                    className="inline-flex items-center justify-center p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors"
                                                    title="Copiar mensagem de cobrança"
                                                >
                                                    <Copy className="w-4 h-4"/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {expandedUnitId === u.id && (
                                        <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-700 shadow-inner">
                                            <td colSpan="7" className="p-0"><div className="p-4"><div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm"><table className="w-full text-xs text-left"><thead className="bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-600"><tr><th className="p-3">Data / Hora Aula</th><th className="p-3">Modalidade / Aula</th><th className="p-3">Professor</th><th className="p-3 text-center">Status</th><th className="p-3 text-right">Validação</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{u.historicoDetalhado.map((h) => (<tr key={h.key} className={`transition-colors ${getRowColor(h.status, h.diffDays)}`}><td className="p-3"><div className="font-bold text-slate-700 dark:text-slate-200">{h.data}</div><div className="text-slate-400 font-mono">{h.horaAula}</div></td><td className="p-3 font-medium text-slate-600 dark:text-slate-300">{h.modalidade}</td><td className="p-3 text-slate-600 dark:text-slate-300">{getFirstLast(h.professor)}</td><td className="p-3 text-center"><div className="flex justify-center"><StatusBadge type={h.status} text={h.status === 'atrasado' ? 'Pendente' : h.status} /></div></td><td className="p-3 text-right">{(h.status === 'realizada' || h.status === 'cancelada') ? (<div><div className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px] ml-auto">{h.responsavelNome}</div><div className="text-slate-400 text-[10px] flex items-center justify-end gap-1">{h.dataValidacao} às {h.horaValidacao}</div></div>) : <span className="text-slate-300 text-[10px]">-</span>}</td></tr>))}</tbody></table></div></div></td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* === ABA CENTRAL DE COBRANÇA (EXCEL STYLE) === */}
        {activeTab === 'cobranca' && (
            <div className="animate-fade-in space-y-6">
                
                <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-xl p-6 shadow-xl border border-indigo-500/30 text-white relative overflow-hidden mb-6">
                    <div className="flex justify-between items-center relative z-10">
                        <div>
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-400"/> 
                                Relatório Geral ({isMentor ? 'Minhas Unidades' : 'Grupo de Mentores'})
                            </h3>
                            <p className="text-indigo-200 text-xs mt-1">Resumo consolidado para envio no grupo oficial.</p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => copyToClipboard(isMentor ? msgMentorGeneralReport() : msgAdminGeneralReport())}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg"
                            >
                                <Copy className="w-4 h-4"/> Copiar Texto
                            </button>
                            <a 
                                href={`https://wa.me/?text=${encodeURIComponent(isMentor ? msgMentorGeneralReport() : msgAdminGeneralReport())}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg"
                            >
                                <MessageSquare className="w-4 h-4"/> Enviar no Grupo
                            </a>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider border-b border-slate-300 dark:border-slate-600">
                            <tr>
                                <th className="p-3 border-r border-slate-200 dark:border-slate-600">{isMentor ? 'Unidade' : 'Mentor'}</th>
                                <th className="p-3 border-r border-slate-200 dark:border-slate-600 text-center w-24">Status</th>
                                <th className="p-3 border-r border-slate-200 dark:border-slate-600">Pendências Detalhadas</th>
                                <th className="p-3 text-center w-24">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            
                            {!isMentor && dadosProcessados.mentores
                                .filter(m => m.unidadesList.some(u => filterPendingDates(u.pendencias).length > 0)) 
                                .sort((a, b) => b.mediaGeral - a.mediaGeral) // Ordena do maior (99%) para o menor (0%)
                                .map((mentor) => (
                                <tr key={mentor.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200">
                                        {mentor.nome}
                                    </td>
                                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-center">
                                        <span className={`font-bold px-2 py-0.5 rounded text-xs text-white ${getColorClassByPercent(mentor.mediaGeral)}`}>{mentor.mediaGeral}%</span>
                                    </td>
                                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-xs text-slate-500">
                                        {mentor.unidadesList.filter(u => filterPendingDates(u.pendencias).length > 0).map(u => u.nome).join(', ')}
                                    </td>
                                    <td className="p-3 text-center">
                                        <button 
                                            onClick={() => copyToClipboard(msgAdminToMentor(mentor))}
                                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold transition-colors inline-flex items-center gap-1"
                                        >
                                            <Copy className="w-3 h-3"/> Copiar
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {isMentor && dadosProcessados.unidades
                                .filter(u => filterPendingDates(u.pendencias).length > 0)
                                .sort((a, b) => b.percentual - a.percentual) // Ordena do maior para o menor
                                .map((unidade) => (
                                <tr key={unidade.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200">
                                        {unidade.nome}
                                    </td>
                                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-center">
                                        <span className={`font-bold px-2 py-0.5 rounded text-xs text-white ${getColorClassByPercent(unidade.percentual)}`}>{unidade.percentual}%</span>
                                    </td>
                                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-xs text-slate-500">
                                        {(() => {
                                            const datas = filterPendingDates(unidade.pendencias).map(d => formatDateShort(d));
                                            return datas.length > 5 
                                                ? `${datas.slice(0, 5).join(', ')} +${datas.length - 5} dias`
                                                : datas.join(', ');
                                        })()}
                                    </td>
                                    <td className="p-3 text-center">
                                        <button 
                                            onClick={() => copyToClipboard(msgMentorToUnit(unidade))}
                                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold transition-colors inline-flex items-center gap-1"
                                        >
                                            <Copy className="w-3 h-3"/> Copiar
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {((!isMentor && dadosProcessados.mentores.filter(m => m.unidadesList.some(u => filterPendingDates(u.pendencias).length > 0)).length === 0) || 
                              (isMentor && dadosProcessados.unidades.filter(u => filterPendingDates(u.pendencias).length > 0).length === 0)) && (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-400 italic">
                                        Nenhuma pendência encontrada para cobrança.
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