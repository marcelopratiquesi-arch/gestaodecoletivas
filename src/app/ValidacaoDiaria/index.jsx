import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { 
  collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, orderBy 
} from 'firebase/firestore';
import { 
  Calendar, CircleCheck, CircleX, TriangleAlert, 
  MapPin, Filter, Search, List, ArrowDown, DownloadCloud, Loader2, LayoutDashboard, UserCog,
  Map as MapIcon, 
  Undo2
} from 'lucide-react';

// Importa os componentes filhos (que criamos no passo anterior)
import { AulaCard } from './AulaCard';
import { ValidationModal } from './ValidationModal';

// --- HELPERS ---
const getTodayStr = () => new Date().toLocaleDateString('en-CA'); 

const getMonthDates = (year, month) => {
  const date = new Date(year, month, 1);
  const dates = [];
  while (date.getMonth() === month) {
    dates.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
};

const diasSemanaMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

export default function ValidacaoDiariaPage() {
  const { userData } = useAuth();
  
  // --- PERMISSÕES ---
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);
  const userUnidadeId = useMemo(() => userData?.unidadeId, [userData]);
  
  const isMaster = useMemo(() => ['admin', 'mentor'].includes(role), [role]);

  // --- FILTROS ---
  const [modoFiltro, setModoFiltro] = useState('dia'); 
  const [dataFiltro, setDataFiltro] = useState(getTodayStr());
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7));
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroMentor, setFiltroMentor] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroModalidade, setFiltroModalidade] = useState("");
  const [filtroProfessor, setFiltroProfessor] = useState("");
  const [filtroStatus, setFiltroStatus] = useState('todos'); 

  // --- DADOS ---
  const [catalogs, setCatalogs] = useState({ 
      unidades: [], modalidades: [], professores: [], feriados: [], mentores: [] 
  });
  const [gradeGerada, setGradeGerada] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [itensVisiveis, setItensVisiveis] = useState(12);

  // --- MODAL STATES ---
  const [modalOpen, setModalOpen] = useState(false);
  const [acaoAtual, setAcaoAtual] = useState(null); 

  // 1. CARREGAMENTO INICIAL DOS DADOS
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        setLoading(true);
        const [unitsSnap, modsSnap, profsSnap, linksSnap, feriadosSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, 'unidades'), orderBy('nome'))),
          getDocs(query(collection(db, 'modalidades'), orderBy('nome'))),
          getDocs(query(collection(db, 'professores'), orderBy('nome'))),
          getDocs(collection(db, 'vinculos')),
          getDocs(collection(db, 'feriados')), // Baixa todos os feriados (datas e intervalos)
          getDocs(query(collection(db, 'usuarios'), where('role', '==', 'mentor')))
        ]);

        let unitsData = unitsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        let modsData = modsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const profsData = profsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const linksData = linksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const feriadosData = feriadosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const mentoresData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filtros de Permissão nos Catálogos
        if (role === 'mentor') {
          unitsData = unitsData.filter(u => u.mentorId === userId);
        } else if (role === 'unidade') {
          unitsData = unitsData.filter(u => String(u.id) === String(userUnidadeId));
          setFiltroUnidade(userUnidadeId); 
        } else if (role === 'professor') {
          const meuPerfil = profsData.find(p => p.uidLogin === userId);
          if (meuPerfil) {
             const meusLinks = linksData.filter(l => String(l.professorId) === String(meuPerfil.id));
             const minhasUnidadesIds = meusLinks.map(l => String(l.unidadeId));
             unitsData = unitsData.filter(u => minhasUnidadesIds.includes(String(u.id)));
          } else {
             unitsData = [];
          }
        }

        setCatalogs({ 
            unidades: unitsData, 
            modalidades: modsData, 
            professores: profsData, 
            feriados: feriadosData, 
            mentores: mentoresData 
        });
      } catch (error) {
        console.error("Erro ao carregar catálogos:", error);
      }
    };
    loadCatalogs();
  }, [role, userId, userUnidadeId]);

  // Filtros dinâmicos para os selects
  const estadosDisponiveis = useMemo(() => {
      const ufs = catalogs.unidades.map(u => u.estado).filter(Boolean);
      return [...new Set(ufs)].sort();
  }, [catalogs.unidades]);

  const unidadesFiltradasSelect = useMemo(() => {
      if (role !== 'admin') return catalogs.unidades;
      return catalogs.unidades.filter(u => {
          const matchEstado = filtroEstado ? u.estado === filtroEstado : true;
          const matchMentor = filtroMentor ? u.mentorId === filtroMentor : true;
          return matchEstado && matchMentor;
      });
  }, [catalogs.unidades, role, filtroEstado, filtroMentor]);

  // 4. MOTOR DE GERAÇÃO DA GRADE (AQUI ESTÁ A MÁGICA DO FERIADO)
  useEffect(() => {
    if (catalogs.unidades.length === 0 && role !== 'admin') return; 
      
    const gerarGrade = async () => {
      setLoading(true);
      try {
        let dataInicio, dataFim;
        let datasParaVerificar = [];

        if (modoFiltro === 'dia') {
          dataInicio = dataFiltro;
          dataFim = dataFiltro;
          datasParaVerificar = [new Date(dataFiltro + 'T12:00:00')]; 
        } else {
          const [ano, mes] = mesFiltro.split('-');
          const lastDay = new Date(parseInt(ano), parseInt(mes), 0).getDate();
          dataInicio = `${ano}-${mes}-01`;
          dataFim = `${ano}-${mes}-${lastDay}`;
          datasParaVerificar = getMonthDates(parseInt(ano), parseInt(mes) - 1);
        }

        // Buscando Aulas (Grade Padrão)
        let aulasRef = collection(db, 'aulas');
        let qAulas = query(aulasRef);

        if (role === 'unidade') {
            qAulas = query(aulasRef, where('unidadeId', '==', userUnidadeId));
        } else if (role === 'professor') {
            const meuPerfil = catalogs.professores.find(p => p.uidLogin === userId);
            const meuProfId = meuPerfil ? meuPerfil.id : 'xyz';
            qAulas = query(aulasRef, where('professorId', '==', meuProfId));
        }

        const aulasSnap = await getDocs(qAulas);
        let aulasBase = aulasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Buscando Validações Existentes (O que já foi feito manualmente)
        let validacoesRef = collection(db, 'validacoes');
        let qValidacoes = query(validacoesRef, where('data', '>=', dataInicio), where('data', '<=', dataFim));

        if (role === 'unidade') {
            qValidacoes = query(qValidacoes, where('unidadeId', '==', userUnidadeId));
        } else if (role === 'professor') {
            const meuPerfil = catalogs.professores.find(p => p.uidLogin === userId);
            const meuProfId = meuPerfil ? meuPerfil.id : 'xyz';
            qValidacoes = query(qValidacoes, where('professorId', '==', meuProfId));
        }

        const validacoesSnap = await getDocs(qValidacoes); 
        const validacoesExistentes = validacoesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        let meuProfessorId = null;
        if (role === 'professor') {
            const meuPerfil = catalogs.professores.find(p => p.uidLogin === userId);
            if (meuPerfil) meuProfessorId = meuPerfil.id;
        }

        // 🧠 FUNÇÃO INTELIGENTE DE FERIADO
        // Verifica se a data é feriado (exato) OU se cai dentro de um recesso (intervalo)
        const checkIsFeriado = (dateString) => {
            const targetDate = new Date(dateString + 'T00:00:00');
            return catalogs.feriados.some(f => {
                // Caso 1: Data exata (ex: 25/12/2025)
                if (f.data === dateString) return true;
                
                // Caso 2: Intervalo/Recesso (ex: de 20/12 a 04/01)
                if (f.dataInicio && f.dataFim) {
                    const inicio = new Date(f.dataInicio + 'T00:00:00');
                    const fim = new Date(f.dataFim + 'T00:00:00');
                    // Verifica se a data alvo está entre inicio e fim
                    return targetDate >= inicio && targetDate <= fim;
                }
                return false;
            });
        };

        let gradeFinal = [];

        // Loop principal: Percorre cada dia do calendário
        datasParaVerificar.forEach(dataObj => {
          const dataString = dataObj.toISOString().split('T')[0];
          const diaSemanaNome = diasSemanaMap[dataObj.getDay()];
          
          // 🟢 AQUI: Verifica se é feriado (seja dia único ou recesso)
          const isFeriadoGlobal = checkIsFeriado(dataString);

          // Filtra quais aulas acontecem nesse dia da semana
          const aulasDoDia = aulasBase.filter(aula => aula.dias && aula.dias.includes(diaSemanaNome));

          aulasDoDia.forEach(aula => {
            // Filtros de visualização...
            const unidadeValida = catalogs.unidades.find(u => String(u.id) === String(aula.unidadeId));
            if (!unidadeValida) return; 

            if (filtroUnidade && String(aula.unidadeId) !== String(filtroUnidade)) return;

            if (role === 'admin') {
                if (filtroEstado && unidadeValida.estado !== filtroEstado) return;
                if (filtroMentor && unidadeValida.mentorId !== filtroMentor) return;
            }

            if (filtroModalidade && String(aula.modalidadeId) !== String(filtroModalidade)) return;

            if (role === 'professor') {
                if (String(aula.professorId) !== String(meuProfessorId)) return;
            }

            const prof = catalogs.professores.find(p => String(p.id) === String(aula.professorId));
            if (filtroProfessor && prof) {
                const termo = filtroProfessor.toLowerCase();
                if (!prof.nome.toLowerCase().includes(termo)) return;
            }

            // Tenta achar se já existe validação no banco
            const validacao = validacoesExistentes.find(v => String(v.aulaId) === String(aula.id) && v.data === dataString);

            let professorExibicao = prof;
            let status = 'pendente';
            let dadosValidacao = validacao;

            // 🟢 LÓGICA DE PRIORIDADE:
            // 1. Se tem validação manual (Alguém foi lá e clicou), ela manda (pode ter aula no feriado se quiserem).
            // 2. Se NÃO tem validação E é feriado/recesso, o sistema cancela AUTOMATICAMENTE.
            // 3. Se não, fica Pendente.
            if (validacao) {
                status = validacao.status;
            } else if (isFeriadoGlobal) {
                status = 'cancelada';
                // Cria um objeto visual de validação (sem salvar no banco ainda) para mostrar o motivo
                dadosValidacao = { motivoCancelamento: 'Recesso/Feriado', status: 'cancelada' };
            }
            
            if (validacao && validacao.substituicao && validacao.professorId) {
                const profSub = catalogs.professores.find(p => String(p.id) === String(validacao.professorId));
                if (profSub) professorExibicao = { ...profSub, isSubstituto: true };
            }

            gradeFinal.push({
              key: `${aula.id}-${dataString}`,
              data: dataString,
              diaSemana: diaSemanaNome,
              aulaBase: aula,
              professor: professorExibicao, 
              professorTitular: prof,
              unidade: unidadeValida,
              modalidade: catalogs.modalidades.find(m => String(m.id) === String(aula.modalidadeId)),
              validacao: dadosValidacao || null, 
              status: status
            });
          });
        });

        gradeFinal.sort((a, b) => {
          if (a.data !== b.data) return a.data.localeCompare(b.data);
          return a.aulaBase.hora.localeCompare(b.aulaBase.hora);
        });

        setGradeGerada(gradeFinal);
        setItensVisiveis(12);

      } catch (error) {
        console.error("Erro ao gerar grade:", error);
      } finally {
        setLoading(false);
      }
    };

    gerarGrade();
  }, [modoFiltro, dataFiltro, mesFiltro, catalogs, filtroUnidade, filtroModalidade, filtroProfessor, filtroEstado, filtroMentor, role, userId, userUnidadeId]);

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

  const listaExibicao = useMemo(() => listaFiltradaTotal.slice(0, itensVisiveis), [listaFiltradaTotal, itensVisiveis]);

  const handleCarregarMais = (qtd) => {
      if (qtd === 'todos') setItensVisiveis(listaFiltradaTotal.length);
      else setItensVisiveis(prev => prev + qtd);
  };

  const verificarFuturo = (dataString) => {
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    return new Date(dataString + 'T00:00:00') > hoje;
  };

  // --- LÓGICA DE ABRIR MODAL ---
  const abrirModal = (tipo, item) => {
    if (verificarFuturo(item.data)) return alert("Aulas futuras não podem ser validadas.");

    // Trava de Segurança: Apenas Master pode reverter
    if (item.status === 'cancelada' && !isMaster) {
        // Permitir ver detalhes se for feriado automatico, mas avisar que é automatico
        if (item.validacao?.motivoCancelamento === 'Recesso/Feriado') {
             return alert("ℹ️ INFORMAÇÃO\n\nEsta aula foi cancelada automaticamente devido ao Recesso/Feriado cadastrado no sistema.");
        }
        return alert("⛔ AÇÃO BLOQUEADA\n\nEsta aula foi cancelada. Apenas a Mentoria ou a Administração podem reverter este status.");
    }

    setAcaoAtual({ tipo, item });
    setModalOpen(true);
  };

  // --- REVERTER CANCELAMENTO ---
  const handleReverterCancelamento = async () => {
      // Se for feriado automático (sem ID de validação), não tem o que deletar do banco.
      // O usuário teria que criar uma validação "Realizada" para sobrescrever.
      if (!acaoAtual.item.validacao?.id && acaoAtual.item.validacao?.motivoCancelamento === 'Recesso/Feriado') {
          return alert("Esta aula é um Feriado Automático. Para que ela aconteça, basta clicar em 'Voltar' e depois em 'Validar' (botão verde) para confirmar a presença.");
      }

      if (!acaoAtual || !acaoAtual.item.validacao?.id) return;
      if (!window.confirm("Tem certeza que deseja reverter este cancelamento manual?")) return;

      setProcessando(true);
      try {
          await deleteDoc(doc(db, 'validacoes', acaoAtual.item.validacao.id));
          setGradeGerada(prevGrade => prevGrade.map(gridItem => {
              if (gridItem.key === acaoAtual.item.key) {
                  return { 
                      ...gridItem, 
                      status: 'pendente', 
                      validacao: null,
                      professor: gridItem.professorTitular 
                  };
              }
              return gridItem;
          }));
          setModalOpen(false);
          setAcaoAtual(null);
      } catch (error) {
          console.error("Erro ao reverter:", error);
          alert("Erro ao reverter cancelamento.");
      } finally {
          setProcessando(false);
      }
  };

  // --- SALVAR AÇÃO DO MODAL ---
  const confirmarAcao = async (dadosFormulario) => {
    const { inputValor, inputObs, isSubstituicao, substitutoId, motivoSubstituicao } = dadosFormulario;
    
    // Validações
    if (acaoAtual.tipo === 'validar' && !inputValor) return alert("Informe o número de alunos.");
    if (acaoAtual.tipo === 'validar' && isSubstituicao) {
        if (!substitutoId || !motivoSubstituicao) return alert("Preencha os dados da substituição.");
    }
    if (acaoAtual.tipo === 'cancelar' && !inputValor) return alert("Selecione um motivo.");
    if (acaoAtual.tipo === 'cancelar' && inputValor === 'Outros' && !inputObs.trim()) return alert("Descreva o motivo.");

    setProcessando(true);
    try {
      const { tipo, item } = acaoAtual;
      const payload = {
        aulaId: item.aulaBase.id,
        unidadeId: item.aulaBase.unidadeId,
        professorId: (tipo === 'validar' && isSubstituicao) ? substitutoId : item.aulaBase.professorId,
        data: item.data,
        validadoPor: userId,
        timestamp: serverTimestamp(), 
        status: tipo === 'validar' ? 'realizada' : 'cancelada'
      };

      if (tipo === 'validar') {
        payload.alunos = parseInt(inputValor);
        if (isSubstituicao) {
            payload.substituicao = true;
            payload.professorOriginalId = item.aulaBase.professorId;
            payload.motivoSubstituicao = motivoSubstituicao;
        } else {
            payload.substituicao = false;
            payload.professorOriginalId = null;
            payload.motivoSubstituicao = null;
        }
      } else {
        payload.motivoCancelamento = inputValor === 'Outros' ? inputObs : inputValor;
        payload.substituicao = false;
      }

      let validacaoId = item.validacao?.id;
      // Se já existe ID (mesmo que seja cancelada), atualiza.
      // Se NÃO existe ID (era pendente ou feriado automático), cria novo.
      if (item.validacao?.id) {
        await updateDoc(doc(db, 'validacoes', item.validacao.id), payload);
      } else {
        const docRef = await addDoc(collection(db, 'validacoes'), payload);
        validacaoId = docRef.id;
      }

      setGradeGerada(prevGrade => prevGrade.map(gridItem => {
        if (gridItem.key === item.key) {
           let novoProfessor = item.professorTitular;
           if (payload.substituicao && payload.professorId) {
                const sub = catalogs.professores.find(p => String(p.id) === String(payload.professorId));
                if (sub) novoProfessor = { ...sub, isSubstituto: true };
           }
           // Atualiza localmente com o novo status
           return { ...gridItem, status: payload.status, professor: novoProfessor, validacao: { id: validacaoId, ...payload } };
        }
        return gridItem;
      }));
    } catch (error) { console.error(error); alert("Erro ao salvar."); } 
    finally { setProcessando(false); setModalOpen(false); setAcaoAtual(null); }
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in max-w-[1920px] mx-auto space-y-6">
      {/* HEADER & FILTROS (MANTIDO) */}
      <div className="flex flex-col gap-6 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                    <span className="bg-gradient-to-tr from-emerald-500 to-green-600 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-500/20">
                    <CircleCheck className="w-6 h-6 md:w-7 md:h-7" />
                    </span>
                    Validação Diária
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-sm md:text-base">Gestão operacional e controle de frequência.</p>
            </div>

            {/* BOTÕES DE STATUS */}
            <div className="w-full md:w-auto grid grid-cols-3 gap-3">
                <button onClick={() => { setFiltroStatus('todos'); setItensVisiveis(12); }} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md ${filtroStatus === 'todos' ? 'bg-slate-800 text-white border-slate-900 ring-2 ring-slate-800 ring-offset-2' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <span className="text-2xl font-black">{counts.total}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1"><List className="w-3 h-3"/> Todos</span>
                </button>
                <button onClick={() => { setFiltroStatus('pendente'); setItensVisiveis(12); }} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md ${filtroStatus === 'pendente' ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-500 ring-offset-2' : 'bg-white border-amber-100 text-amber-500 hover:bg-amber-50'}`}>
                    <span className="text-2xl font-black">{counts.pendentes}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1"><TriangleAlert className="w-3 h-3"/> Pendentes</span>
                </button>
                <button onClick={() => { setFiltroStatus('cancelada'); setItensVisiveis(12); }} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md ${filtroStatus === 'cancelada' ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-600 ring-offset-2' : 'bg-white border-rose-100 text-rose-500 hover:bg-rose-50'}`}>
                    <span className="text-2xl font-black">{counts.canceladas}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1"><CircleX className="w-3 h-3"/> Canceladas</span>
                </button>
            </div>
        </div>
        
        {/* BARRA DE FILTROS */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm w-full">
            <div className="flex flex-wrap gap-2 items-center">
                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1 h-10 shrink-0">
                    <button onClick={() => setModoFiltro('dia')} className={`px-3 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${modoFiltro === 'dia' ? 'bg-white dark:bg-slate-600 shadow text-emerald-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>Dia</button>
                    <button onClick={() => setModoFiltro('mes')} className={`px-3 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${modoFiltro === 'mes' ? 'bg-white dark:bg-slate-600 shadow text-emerald-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>Mês</button>
                </div>
                <div className="relative h-10 w-[140px] shrink-0">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-emerald-500"/>
                    {modoFiltro === 'dia' ? (
                    <input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} className="w-full h-full pl-9 pr-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none uppercase" />
                    ) : (
                    <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="w-full h-full pl-9 pr-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none uppercase" />
                    )}
                </div>
                {role === 'admin' && (
                    <>
                        <div className="relative h-10 w-[90px] shrink-0">
                            <MapIcon className="absolute left-3 top-2.5 w-4 h-4 text-blue-500"/>
                            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="w-full h-full pl-9 pr-1 border-0 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold uppercase text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"><option value="">UF</option>{estadosDisponiveis.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select>
                        </div>
                        <div className="relative h-10 w-[160px] shrink-0">
                            <UserCog className="absolute left-3 top-2.5 w-4 h-4 text-purple-500"/>
                            <select value={filtroMentor} onChange={e => setFiltroMentor(e.target.value)} className="w-full h-full pl-9 pr-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold uppercase text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer"><option value="">MENTOR</option>{catalogs.mentores.map(m => <option key={m.id} value={m.id}>{m.nome?.toUpperCase().split(' ')[0]}</option>)}</select>
                        </div>
                    </>
                )}
                {role !== 'unidade' && (
                    <div className="relative h-10 flex-1 min-w-[200px]">
                        <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                        <select value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)} className="w-full h-full pl-9 pr-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold uppercase text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"><option value="">TODAS AS UNIDADES</option>{unidadesFiltradasSelect.map(u => <option key={u.id} value={u.id}>{u.nome?.toUpperCase()}</option>)}</select>
                    </div>
                )}
                <div className="relative h-10 w-[180px] shrink-0">
                    <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                    <select value={filtroModalidade} onChange={e => setFiltroModalidade(e.target.value)} className="w-full h-full pl-9 pr-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold uppercase text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"><option value="">MODALIDADE</option>{catalogs.modalidades.map(m => <option key={m.id} value={m.id}>{m.nome?.toUpperCase()}</option>)}</select>
                </div>
                {(role === 'admin' || role === 'mentor') && (
                    <div className="relative h-10 flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                        <input type="text" placeholder="BUSCAR PROFESSOR..." value={filtroProfessor} onChange={e => setFiltroProfessor(e.target.value)} className="w-full h-full pl-9 pr-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none uppercase placeholder:normal-case" />
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* GRID DE AULAS */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-2 text-emerald-500"/>
          <p className="text-sm font-medium">Carregando grade...</p>
        </div>
      ) : listaFiltradaTotal.length === 0 ? (
        <div className="py-24 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
          <div className="bg-slate-50 dark:bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard className="w-8 h-8 text-slate-300"/>
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-white">
              {filtroStatus === 'pendente' ? "Tudo Validado!" : filtroStatus === 'cancelada' ? "Nenhum cancelamento" : "Nenhuma aula encontrada"}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {filtroStatus === 'pendente' ? "Parabéns, você zerou as pendências." : "Tente ajustar os filtros ou a data selecionada."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
            {listaExibicao.map((item) => (
                <AulaCard 
                    key={item.key} 
                    item={item} 
                    onValidar={(i) => abrirModal('validar', i)}
                    onCancelar={(i) => abrirModal('cancelar', i)}
                    verificarFuturo={verificarFuturo}
                />
            ))}
            </div>

            {itensVisiveis < listaFiltradaTotal.length && (
                <div className="flex flex-wrap justify-center gap-3 pt-6 pb-4 animate-fade-in">
                    <button onClick={() => handleCarregarMais(12)} className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm flex items-center gap-2 transition-all"><ArrowDown className="w-4 h-4"/> Carregar +12</button>
                    <button onClick={() => handleCarregarMais('todos')} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-xl text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 shadow-sm flex items-center gap-2 transition-all"><DownloadCloud className="w-4 h-4"/> Ver Todos</button>
                </div>
            )}
        </div>
      )}

      {/* MODAL */}
      <ValidationModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        onConfirm={confirmarAcao}
        onRevert={handleReverterCancelamento}
        acaoAtual={acaoAtual}
        catalogs={catalogs}
        processando={processando}
        isMaster={isMaster}
      />
    </div>
  );
}