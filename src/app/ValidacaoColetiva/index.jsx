import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCatalogs } from '../../contexts/CatalogContext'; 
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { ShieldCheck, LayoutDashboard, Download, MapPin, UserCog, Building2, Lock, Calendar, CheckCircle2, AlertCircle, Trophy, List, MessageSquare } from 'lucide-react';

import { KPICard, MultiSelectDropdown, getTodayStr, normalizeDate, getDatesInRange, diasSemanaMap, formatHeaderPeriodo, formatDateShort, filterPendingDates, getFirstLast, getEmojiByPercent } from './components';
import { RankingTab, StatusTab, CobrancaTab } from './Tabs';

export default function ValidacaoColetiva() {
  const { userData } = useAuth();
  const role = String(userData?.role || "").toLowerCase();
  const userId = userData?.id || userData?.uid;
  const isMentor = role === 'mentor';
  
  const { catalogs, loadingCatalogs } = useCatalogs();
  const [loadingRealtime, setLoadingRealtime] = useState(true);
  const [usuariosBase, setUsuariosBase] = useState([]);
  const [validacoesBase, setValidacoesBase] = useState([]);
  
  const [modoFiltro, setModoFiltro] = useState('dia'); 
  const [dataInicio, setDataInicio] = useState(getTodayStr());
  const [dataFim, setDataFim] = useState(getTodayStr());
  
  const [estadoFiltro, setEstadoFiltro] = useState([]);
  const [mentorFiltro, setMentorFiltro] = useState([]);
  const [unidadeFiltro, setUnidadeFiltro] = useState([]);

  const [activeTab, setActiveTab] = useState('ranking'); 
  const [expandedUnitId, setExpandedUnitId] = useState(null);
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'percentual', direction: 'descending' });
  const [itensVisiveisStatus, setItensVisiveisStatus] = useState(12);

  const isCofreGlobalFechado = role === 'admin' ? (estadoFiltro.length === 0 && mentorFiltro.length === 0 && unidadeFiltro.length === 0) : role === 'mentor' ? (estadoFiltro.length === 0 && unidadeFiltro.length === 0) : false;

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { if (dataInicio > dataFim) setDataFim(dataInicio); }, [dataInicio, dataFim]);

  useEffect(() => {
      if (!userId) return;
      getDocs(collection(db, 'usuarios')).then(snap => setUsuariosBase(snap.docs.map(d => ({id: d.id, ...d.data()})))).catch(e => console.error(e));
  }, [userId]);

  const unidadesBase = useMemo(() => {
      if (!catalogs?.unidades) return [];
      return isMentor ? catalogs.unidades.filter(u => u.mentorId === userId) : catalogs.unidades;
  }, [catalogs?.unidades, isMentor, userId]);

  const estadosOptions = useMemo(() => [...new Set(unidadesBase.map(u => u.estado).filter(Boolean))].sort().map(e => ({ value: e, label: e })), [unidadesBase]);
  const unidadesFiltradasEstado = useMemo(() => estadoFiltro.length === 0 ? unidadesBase : unidadesBase.filter(u => estadoFiltro.includes(u.estado)), [unidadesBase, estadoFiltro]);
  
  const mentoresOptions = useMemo(() => {
      const m = new Map();
      unidadesFiltradasEstado.forEach(u => { if (u.mentorId) { const usr = usuariosBase.find(x => x.id === u.mentorId || x.uid === u.mentorId); if (usr) m.set(u.mentorId, usr.nome); } });
      return Array.from(m, ([v, l]) => ({ value: v, label: l })).sort((a,b) => a.label.localeCompare(b.label));
  }, [unidadesFiltradasEstado, usuariosBase]);
  
  const unidadesOptions = useMemo(() => {
      let u = unidadesFiltradasEstado;
      if (mentorFiltro.length > 0) u = u.filter(x => mentorFiltro.includes(x.mentorId));
      return u.map(x => ({ value: x.id, label: x.nome })).sort((a,b) => a.label.localeCompare(b.label));
  }, [unidadesFiltradasEstado, mentorFiltro]);

  const modalidadesBase = catalogs?.modalidades || [];
  const professoresBase = catalogs?.professores || [];
  const aulasBase = catalogs?.aulas || [];

  const feriadosBase = useMemo(() => {
      return (catalogs?.feriados || []).map(f => ({ id: f.id, ...f, inicio: normalizeDate(f.dataInicio || f.inicio || f.data), fim: normalizeDate(f.dataFim || f.fim || f.data) }));
  }, [catalogs?.feriados]);

  useEffect(() => {
    if (!userId || loadingCatalogs) return;
    if (isCofreGlobalFechado) { setValidacoesBase([]); setLoadingRealtime(false); return; }
    setLoadingRealtime(true);
    const q = query(collection(db, 'validacoes'), where('data', '>=', dataInicio), where('data', '<=', dataFim));
    const u = onSnapshot(q, s => { setValidacoesBase(s.docs.map(d => ({id: d.id, ...d.data()}))); setLoadingRealtime(false); });
    return () => u();
  }, [dataInicio, dataFim, userId, isCofreGlobalFechado, loadingCatalogs]); 

  const dadosProcessados = useMemo(() => {
    if (unidadesBase.length === 0 || isCofreGlobalFechado) return { mentores: [], unidades: [], kpis: { totalAulas: 0, unidadesValidadas: 0, unidadesPendentes: 0 } };
    
    const usuariosMap = {};
    usuariosBase.forEach(u => { 
        const userData = { nome: u.nome, role: u.role, telefone: u.telefone || u.phone || "" };
        usuariosMap[u.id] = userData; 
        if (u.uid) usuariosMap[u.uid] = userData; 
        if (u.uidLogin) usuariosMap[u.uidLogin] = userData; 
    });

    const modMap = {}; (catalogs.modalidades || []).forEach(m => modMap[m.id] = m.nome);
    const profMap = {}; (catalogs.professores || []).forEach(p => profMap[p.id] = p.nome);
    const datas = getDatesInRange(dataInicio, dataFim);
    const todayStr = getTodayStr();
    const vIndex = {};
    validacoesBase.forEach(v => { const key = `${v.unidadeId}_${normalizeDate(v.data)}`; if(!vIndex[key]) vIndex[key] = []; vIndex[key].push(v); });

    let uAtivas = unidadesBase;
    if (estadoFiltro.length > 0) uAtivas = uAtivas.filter(u => estadoFiltro.includes(u.estado));

    const statusUnidades = uAtivas.filter(u => unidadeFiltro.length === 0 ? true : unidadeFiltro.includes(u.id)).map(unidade => {
        let totalEsp = 0, totalVal = 0, pends = [], hist = [];
        const grade = aulasBase.filter(a => String(a.unidadeId) === String(unidade.id));
        const temCronograma = grade.length > 0;
        
        datas.forEach(dStr => {
            if (dStr > todayStr) return;
            const isFer = feriadosBase.some(f => (!f.unidadeId || String(f.unidadeId) === String(unidade.id)) && (dStr >= normalizeDate(f.inicio) && dStr <= normalizeDate(f.fim)));
            const diaSem = diasSemanaMap[new Date(dStr + 'T00:00:00').getDay()];
            
            const aulasDia = grade.filter(a => {
                if (!a.dias?.includes(diaSem)) return false;
                const inicioValido = a.dataInicio ? dStr >= normalizeDate(a.dataInicio) : true;
                const fimValido = a.dataFim ? dStr <= normalizeDate(a.dataFim) : true;
                return inicioValido && fimValido;
            });
            
            aulasDia.forEach(aula => {
                const [h, m] = aula.hora.split(':');
                const dHa = new Date(dStr); dHa.setHours(parseInt(h), parseInt(m), 59);
                if (dStr < todayStr || (dStr === todayStr && dHa < now)) {
                    totalEsp++;
                    if (isFer) { totalVal++; hist.push({ key: aula.id + dStr, data: new Date(dStr + 'T00:00:00').toLocaleDateString('pt-BR'), dia: diaSem, horaAula: aula.hora, modalidade: modMap[aula.modalidadeId] || 'GERAL', professor: profMap[aula.professorId] || 'SEM PROF', status: 'FERIADO', responsavelNome: 'SISTEMA', timestampOrdenacao: dHa }); return; }
                    
                    const pool = [...(vIndex[`${unidade.id}_${dStr}`] || [])];
                    let fIdx = pool.findIndex(v => String(v.aulaId) === String(aula.id) || v.hora === aula.hora);
                    
                    if (fIdx !== -1) {
                        totalVal++;
                        const v = pool[fIdx];
                        // 🟢 FIX FOR VALIDATOR NAME: Protegido contra "undefined" e fallbacks cravados
                        const validadoPorUid = v.userId || v.validadoPor || v.user_id || v.uid;
                        const uL = usuariosMap[validadoPorUid];
                        
                        let dataValidacao = '-';
                        let horaValidacao = '-';
                        let diffDays = 0;
                        const campoData = v.validadoEm || v.timestamp || v.createdAt || v.data_validacao;
                        
                        if (campoData && campoData.seconds) {
                            const dateVal = new Date(campoData.seconds * 1000);
                            horaValidacao = dateVal.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                            dataValidacao = dateVal.toLocaleDateString('pt-BR', {day: '2-digit', month:'2-digit', year:'numeric'});
                            const dateAula = new Date(dStr + 'T00:00:00');
                            const dateValidacaoTime = new Date(dateVal);
                            dateAula.setHours(0,0,0,0);
                            dateValidacaoTime.setHours(0,0,0,0);
                            diffDays = Math.floor((dateValidacaoTime - dateAula) / (1000 * 60 * 60 * 24));
                        } else {
                            dataValidacao = v.data ? v.data.split('-').reverse().join('/') : '-'; 
                            horaValidacao = v.hora || '-';
                        }

                        // Extração pesada e blindada para sempre exibir o nome de quem validou
                        const extractedName = uL?.nome || v.userName || v.validadoPorNome || v.nome_usuario || 'RECEPCAO / SISTEMA';

                        hist.push({ 
                            key: aula.id + dStr, 
                            data: new Date(dStr + 'T00:00:00').toLocaleDateString('pt-BR'), 
                            dia: diaSem, 
                            horaAula: aula.hora, 
                            modalidade: modMap[aula.modalidadeId] || 'GERAL', 
                            professor: profMap[aula.professorId] || 'SEM PROF', 
                            status: String(v.status || 'REALIZADA').toUpperCase(), 
                            alunos: v.alunos || v.fluxo || v.quantidadeAlunos || 0,
                            responsavelNome: extractedName, 
                            dataValidacao: dataValidacao, 
                            horaValidacao: horaValidacao, 
                            diffDays: diffDays,
                            timestampOrdenacao: dHa 
                        });
                    } else { 
                        pends.push({data: dStr, dia: diaSem, info: aula.hora}); 
                        hist.push({ key: aula.id + dStr, data: new Date(dStr + 'T00:00:00').toLocaleDateString('pt-BR'), dia: diaSem, horaAula: aula.hora, modalidade: modMap[aula.modalidadeId] || 'GERAL', professor: profMap[aula.professorId] || 'SEM PROF', status: 'ATRASADO', alunos: 0, responsavelNome: '-', timestampOrdenacao: dHa }); 
                    }
                }
            });
        });
        
        hist.sort((a,b) => b.timestampOrdenacao - a.timestampOrdenacao);
        const pct = totalEsp > 0 ? Math.round((totalVal / totalEsp) * 100) : 100;
        
        const lastV = validacoesBase.filter(v => String(v.unidadeId) === String(unidade.id)).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))[0];
        
        let responsavelInfo = { nome: '-', role: '-', data: '-', horaValidacao: '-' };
        if (lastV) {
            const validadoPorUid = lastV.userId || lastV.uid || lastV.validadoPor;
            const uL = usuariosMap[validadoPorUid];
            responsavelInfo.nome = uL?.nome || lastV.userName || lastV.validadoPorNome || 'RECEPCAO / SISTEMA';
            responsavelInfo.role = uL?.role || lastV.userRole || lastV.validadoPorRole || 'SISTEMA';
            responsavelInfo.data = normalizeDate(lastV.data).split('-').reverse().join('/');
            
            const t = lastV.validadoEm || lastV.timestamp;
            if (t && t.seconds) {
                responsavelInfo.horaValidacao = new Date(t.seconds * 1000).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            }
        }

        return { 
            id: unidade.id, nome: unidade.nome, telefone: unidade.telefone, mentorId: unidade.mentorId, 
            mentorNome: usuariosMap[unidade.mentorId]?.nome || 'SEM MENTOR', totalEsperado: totalEsp, totalValidado: totalVal, 
            percentual: pct, pendencias: pends, statusTexto: totalEsp === 0 ? 'AGUARDANDO' : pct === 100 ? 'PARABÉNS!' : 'EM ANDAMENTO', 
            temCronograma: temCronograma,
            historicoDetalhado: hist, 
            lastValidation: lastV ? responsavelInfo : null 
        };
    });

    const rankingMentores = Object.values(statusUnidades.reduce((acc, u) => {
        if (!u.mentorId) return acc;
        if (!acc[u.mentorId]) {
            const mentorData = usuariosMap[u.mentorId];
            acc[u.mentorId] = { 
                id: u.mentorId, 
                nome: u.mentorNome, 
                telefone: mentorData?.telefone || "", 
                totalUnidades: 0, 
                somaPercentuais: 0, 
                totalPendencias: 0, 
                unidadesList: [] 
            };
        }
        acc[u.mentorId].totalUnidades++; 
        acc[u.mentorId].somaPercentuais += u.percentual; 
        acc[u.mentorId].totalPendencias += u.pendencias.length; 
        acc[u.mentorId].unidadesList.push(u);
        return acc;
    }, {})).map(m => ({ ...m, mediaGeral: Math.round(m.somaPercentuais / m.totalUnidades) }))
    .sort((a, b) => {
        if (b.mediaGeral !== a.mediaGeral) return b.mediaGeral - a.mediaGeral;
        if (a.totalPendencias !== b.totalPendencias) return a.totalPendencias - b.totalPendencias;
        return a.nome.localeCompare(b.nome);
    });

    return { mentores: rankingMentores, unidades: statusUnidades, kpis: { totalAulas: statusUnidades.reduce((acc, u) => acc + u.totalEsperado, 0), unidadesValidadas: statusUnidades.filter(u => u.percentual === 100 && u.totalEsperado > 0).length, unidadesPendentes: statusUnidades.filter(u => u.percentual < 100).length } };
  }, [unidadesBase, usuariosBase, catalogs, validacoesBase, dataInicio, dataFim, now, estadoFiltro, unidadeFiltro, isCofreGlobalFechado]);

  const rankingUnidades = useMemo(() => {
      let filtered = [...dadosProcessados.unidades];
      if (mentorFiltro.length > 0) filtered = filtered.filter(u => mentorFiltro.includes(u.mentorId));
      if (unidadeFiltro.length > 0) filtered = filtered.filter(u => unidadeFiltro.includes(u.id));
      
      return filtered.sort((a, b) => {
          if (b.percentual !== a.percentual) return b.percentual - a.percentual;
          if (a.pendencias.length !== b.pendencias.length) return a.pendencias.length - b.pendencias.length;
          return a.nome.localeCompare(b.nome);
      });
  }, [dadosProcessados.unidades, mentorFiltro, unidadeFiltro]);

  const mentoresRelGeral = useMemo(() => {
      let mentores = dadosProcessados.mentores;
      if (mentorFiltro.length > 0) mentores = mentores.filter(m => mentorFiltro.includes(m.id));
      if (unidadeFiltro.length > 0) {
          mentores = mentores.map(m => {
              const filtradas = m.unidadesList.filter(u => unidadeFiltro.includes(u.id));
              const totalUnidades = filtradas.length;
              const somaPercentuais = filtradas.reduce((acc, u) => acc + u.percentual, 0);
              const totalPendencias = filtradas.reduce((acc, u) => acc + u.pendencias.length, 0);
              const mediaGeral = totalUnidades > 0 ? Math.round(somaPercentuais / totalUnidades) : 0;
              return { ...m, unidadesList: filtradas, totalUnidades, somaPercentuais, totalPendencias, mediaGeral };
          }).filter(m => m.totalUnidades > 0);
      }
      return mentores;
  }, [dadosProcessados.mentores, mentorFiltro, unidadeFiltro]);

  const unidadesRelGeral = useMemo(() => {
      let unidades = dadosProcessados.unidades;
      if (mentorFiltro.length > 0) unidades = unidades.filter(u => mentorFiltro.includes(u.mentorId));
      if (unidadeFiltro.length > 0) unidades = unidades.filter(u => unidadeFiltro.includes(u.id));
      return unidades;
  }, [dadosProcessados.unidades, mentorFiltro, unidadeFiltro]);

  const sortedUnidades = useMemo(() => {
      let items = [...dadosProcessados.unidades];
      if (mentorFiltro.length > 0) items = items.filter(u => mentorFiltro.includes(u.mentorId));
      if (unidadeFiltro.length > 0) items = items.filter(u => unidadeFiltro.includes(u.id));
      if (showOnlyIssues) items = items.filter(u => u.percentual < 100);
      
      return items.sort((a,b) => {
          let aValue = a[sortConfig.key];
          let bValue = b[sortConfig.key];
          if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
      });
  }, [dadosProcessados.unidades, mentorFiltro, unidadeFiltro, showOnlyIssues, sortConfig]);

  const statusExibicao = useMemo(() => sortedUnidades.slice(0, itensVisiveisStatus), [sortedUnidades, itensVisiveisStatus]);
  const requestSort = (key) => setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'descending' ? 'ascending' : 'descending' });
  const toggleUnit = (unitId) => setExpandedUnitId(prev => prev === unitId ? null : unitId);

  const handleDateChange = (type) => {
    setModoFiltro(type);
    const hoje = getTodayStr();
    if (type === 'dia' || type === 'periodo') { setDataInicio(hoje); setDataFim(hoje); } 
    else if (type === 'mes') {
        const d = new Date();
        setDataInicio(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-01`);
        setDataFim(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]);
    }
  };

  const handleMonthChange = (e) => {
      const [y, m] = e.target.value.split('-');
      setDataInicio(`${y}-${m}-01`);
      setDataFim(new Date(y, m, 0).toISOString().split('T')[0]);
  };

  const exportarCSV = () => {
    const headers = "UNIDADE,MENTOR,REALIZADO,ESPERADO,STATUS,PROGRESSO,PENDENCIAS\n";
    const rows = sortedUnidades.map(u => `${u.nome.toUpperCase()},${u.mentorNome.toUpperCase()},${u.totalValidado},${u.totalEsperado},${u.statusTexto.toUpperCase()},${u.percentual}%,${u.pendencias.length}`).join("\n");
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' }));
    link.setAttribute('download', `validacao_coletiva_${dataInicio}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const msgAdminToMentor = (m) => {
      const u100 = m.unidadesList.filter(u => u.percentual === 100).map(u => `✅ *${u.nome.toUpperCase()}*`);
      const uPendentes = m.unidadesList.filter(u => u.percentual < 100).map(u => {
          const datas = filterPendingDates(u.pendencias).map(d => formatDateShort(d)).join(', ');
          return `⚠️ *${u.nome.toUpperCase()}* (Faltam ${u.pendencias.length} aulas: ${datas})`;
      });

      let msg = `OLÁ LÍDER ${getFirstLast(m.nome).toUpperCase()}, TUDO BEM? 🚀\n\n`;
      msg += `ESTOU ACOMPANHANDO O PLACAR DE VALIDAÇÕES DAS SUAS UNIDADES COLETIVAS:\n\n`;
      
      if (u100.length > 0) {
          msg += `🏆 *PARABÉNS (100% OK):*\n${u100.join('\n')}\n\n`;
      }
      
      if (uPendentes.length > 0) {
          msg += `🚨 *PRECISAM DE ATENÇÃO (PENDÊNCIAS):*\n${uPendentes.join('\n')}\n\n`;
          msg += `CONSEGUE VERIFICAR COM OS LÍDERES DESSAS UNIDADES PARA REGULARIZAREM HOJE? CONTO COM A SUA GESTÃO! 👊`;
      } else {
          msg += `SUA REDE ESTÁ 100% IMPECÁVEL! PARABÉNS PELO ACOMPANHAMENTO! 🏆👏`;
      }
      
      return msg;
  };

  const msgMentorToUnit = (u) => {
      const datas = filterPendingDates(u.pendencias).map(d => formatDateShort(d)).join(', ');
      return `FALA LÍDER *${u.nome.toUpperCase()}*, IDENTIFICAMOS PENDÊNCIAS NA VALIDAÇÃO DAS COLETIVAS.\nDIAS: ${datas}\nCONSEGUE REGULARIZAR HOJE? 🚀`;
  };

  const msgAdminGeneralReport = () => `📢 *STATUS VALIDAÇÃO COLETIVA - ${formatHeaderPeriodo(dataInicio, dataFim)}*\n\n🏆 *PARABÉNS (100% VALIDADO):*\n${mentoresRelGeral.filter(m => m.totalPendencias === 0).map(m => `✅ ${getFirstLast(m.nome).toUpperCase()}`).join('\n')}\n\n⚠️ *PENDENTES DE VALIDAÇÃO:*\n${mentoresRelGeral.filter(m => m.totalPendencias > 0).map(m => `${getEmojiByPercent(m.mediaGeral)} ${getFirstLast(m.nome).toUpperCase()} (${m.totalPendencias} FALTAS)`).join('\n')}\n\nGESTÃO DE COLETIVAS - PRATIQUE FITNESS 💪`;
  
  const msgMentorGeneralReport = () => `📢 *STATUS VALIDAÇÃO COLETIVA - ${formatHeaderPeriodo(dataInicio, dataFim)}*\n\n🏆 *UNIDADES EM DIA (100%):*\n${rankingUnidades.filter(u => u.pendencias.length === 0 && u.totalEsperado > 0).map(u => `✅ ${u.nome.toUpperCase()}`).join('\n')}\n\n⚠️ *ATENÇÃO (PENDÊNCIAS):*\n${rankingUnidades.filter(u => u.pendencias.length > 0).map(u => `${getEmojiByPercent(u.percentual)} ${u.nome.toUpperCase()} (${u.pendencias.length} FALTAS)`).join('\n')}\n\nBORA REGULARIZAR E GARANTIR A EXCELÊNCIA NAS AULAS! CONTO COM TODOS. 🚀`;

  if (loadingCatalogs) return <div className="h-screen flex items-center justify-center text-slate-400 font-black uppercase animate-pulse">SINCRONIZANDO SISTEMA...</div>;

  return (
    <div className="p-6 md:p-8 max-w-[1920px] mx-auto animate-fade-in space-y-8 uppercase">
      <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <span className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2 rounded-lg shadow-lg shadow-blue-500/20"><ShieldCheck className="w-7 h-7" /></span>
            VALIDAÇÃO COLETIVA
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">MONITORAMENTO DE ADESÃO E AUDITORIA EM TEMPO REAL</p>
        </div>
        
        <div className="flex flex-col gap-3 w-full md:w-auto">
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
                        <input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); if(modoFiltro==='dia') setDataFim(e.target.value); }} className="bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none cursor-pointer"/>
                    )}
                    {modoFiltro === 'periodo' && <><span className="text-slate-400">-</span><input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none cursor-pointer"/></>}
                </div>
                <button onClick={exportarCSV} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors tooltip" title="EXPORTAR CSV"><Download className="w-5 h-5"/></button>
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
          {role === 'admin' && <MultiSelectDropdown options={estadosOptions} selectedValues={estadoFiltro} onChange={(v) => { setEstadoFiltro(v); setMentorFiltro([]); setUnidadeFiltro([]); }} placeholder="NENHUM ESTADO" icon={MapPin} />}
          {!isMentor && <MultiSelectDropdown options={mentoresOptions} selectedValues={mentorFiltro} onChange={(v) => { setMentorFiltro(v); setUnidadeFiltro([]); }} placeholder="NENHUM MENTOR" icon={UserCog} />}
          <MultiSelectDropdown options={unidadesOptions} selectedValues={unidadeFiltro} onChange={setUnidadeFiltro} placeholder="NENHUMA UNIDADE" icon={Building2} />
      </div>

      {isCofreGlobalFechado ? (
          <div className="py-24 text-center bg-white dark:bg-slate-800 border-dashed border-2 border-slate-300 dark:border-slate-700 shadow-sm animate-in fade-in zoom-in duration-300 m-4 rounded-2xl">
              <div className="bg-blue-50 dark:bg-slate-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100 dark:border-slate-800 shadow-inner">
                  <Lock className="w-10 h-10 text-blue-500 animate-pulse"/>
              </div>
              <h3 className="text-2xl font-black text-slate-700 dark:text-white mb-3 uppercase">SELECIONE UM FILTRO PARA INICIAR</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium max-w-lg mx-auto leading-relaxed uppercase">SELECIONE UM ESTADO, MENTOR OU UNIDADE NO FILTRO ACIMA PARA CARREGAR OS DADOS DO SISTEMA.</p>
          </div>
      ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title="AULAS ESPERADAS" value={dadosProcessados.kpis.totalAulas} icon={Calendar} colorClass="border-l-4 border-l-blue-500" iconBg="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"/>
                <KPICard title="UNIDADES 100%" value={dadosProcessados.kpis.unidadesValidadas} icon={CheckCircle2} colorClass="border-l-4 border-l-emerald-500" iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" subTitle={`DE ${dadosProcessados.unidades.length} UNIDADES`}/>
                <KPICard title="UNIDADES PENDENTES" value={dadosProcessados.kpis.unidadesPendentes} icon={AlertCircle} colorClass="border-l-4 border-l-rose-500" iconBg="bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"/>
            </div>

            <div className="flex gap-8 border-b border-slate-200 dark:border-slate-700">
                {[{ id: 'ranking', label: 'RANKING', icon: Trophy }, { id: 'status', label: 'STATUS DETALHADO', icon: List }, { id: 'cobranca', label: 'CENTRAL DE COBRANÇA', icon: MessageSquare }].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-4 text-sm font-bold uppercase flex items-center gap-2 transition-all relative ${activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}>
                        <tab.icon className="w-4 h-4"/> {tab.label}
                        {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full"></div>}
                    </button>
                ))}
            </div>

            <div className="min-h-[400px]">
                {/* 🟢 CORREÇÃO: Variável de rankingMentores passada corretamente */}
                {activeTab === 'ranking' && <RankingTab isMentor={isMentor} rankingMentores={mentoresRelGeral} rankingUnidades={rankingUnidades} />}
                {activeTab === 'status' && <StatusTab showOnlyIssues={showOnlyIssues} setShowOnlyIssues={setShowOnlyIssues} sortConfig={sortConfig} requestSort={requestSort} statusExibicao={statusExibicao} toggleUnit={toggleUnit} expandedUnitId={expandedUnitId} itensVisiveisStatus={itensVisiveisStatus} sortedUnidades={sortedUnidades} setItensVisiveisStatus={setItensVisiveisStatus} msgMentorToUnit={msgMentorToUnit} />}
                {activeTab === 'cobranca' && <CobrancaTab isMentor={isMentor} mentoresRelatorioGeral={mentoresRelGeral} unidadesRelatorioGeral={unidadesRelGeral} msgAdminToMentor={msgAdminToMentor} msgMentorToUnit={msgMentorToUnit} msgAdminGeneralReport={msgAdminGeneralReport} msgMentorGeneralReport={msgMentorGeneralReport} />}
            </div>
          </>
      )}
    </div>
  );
}