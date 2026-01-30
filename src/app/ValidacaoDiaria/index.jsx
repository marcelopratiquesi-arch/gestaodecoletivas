import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { 
  collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc 
} from 'firebase/firestore';
import { 
  Calendar, CheckCircle2, XCircle, Users, MapPin, 
  Filter, Search, Clock, AlertTriangle, Loader2, Lock, 
  LayoutDashboard, UserCog, ArrowRightLeft, User, ChevronDown,
  List, AlertCircle
} from 'lucide-react';

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

const formatDateBr = (dateStr) => {
  if(!dateStr) return "-";
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

// Componente de Badge de Status
const StatusBadge = ({ status }) => {
    if (status === 'realizada') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm">
                <CheckCircle2 className="w-3 h-3" /> Realizada
            </span>
        );
    }
    if (status === 'cancelada') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-rose-100 text-rose-700 border border-rose-200 shadow-sm">
                <XCircle className="w-3 h-3" /> Cancelada
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-slate-100 text-slate-500 border border-slate-200">
            <Clock className="w-3 h-3" /> Pendente
        </span>
    );
};

export default function ValidacaoDiariaPage() {
  const { userData } = useAuth();
  
  // --- PERMISSÕES ---
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);
  const userUnidadeId = useMemo(() => userData?.unidadeId, [userData]);

  // --- FILTROS ---
  const [modoFiltro, setModoFiltro] = useState('dia'); 
  const [dataFiltro, setDataFiltro] = useState(getTodayStr());
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7));

  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroModalidade, setFiltroModalidade] = useState("");
  const [filtroProfessor, setFiltroProfessor] = useState("");

  // 🟢 NOVO CONTROLE: Filtro de Status (Todos, Pendentes, Cancelados)
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos', 'pendente', 'cancelada'

  // --- DADOS ---
  const [catalogs, setCatalogs] = useState({ unidades: [], modalidades: [], professores: [], feriados: [] });
  const [gradeGerada, setGradeGerada] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);

  // --- MODAL ---
  const [modalOpen, setModalOpen] = useState(false);
  const [acaoAtual, setAcaoAtual] = useState(null); 
  const [inputValor, setInputValor] = useState(""); 
  const [inputObs, setInputObs] = useState(""); 
  
  // SUBS
  const [isSubstituicao, setIsSubstituicao] = useState(false);
  const [substitutoId, setSubstitutoId] = useState("");
  const [motivoSubstituicao, setMotivoSubstituicao] = useState("");

  // 1. CARREGAMENTO INICIAL
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        setLoading(true);
        const [unitsSnap, modsSnap, profsSnap, linksSnap, feriadosSnap] = await Promise.all([
          getDocs(collection(db, 'unidades')),
          getDocs(collection(db, 'modalidades')),
          getDocs(collection(db, 'professores')),
          getDocs(collection(db, 'vinculos')),
          getDocs(collection(db, 'feriados')) 
        ]);

        let unitsData = unitsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        let modsData = modsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const profsData = profsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const linksData = linksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const feriadosData = feriadosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filtros de Permissão
        if (role === 'mentor') {
          unitsData = unitsData.filter(u => u.mentorId === userId);
        } else if (role === 'unidade') {
          unitsData = unitsData.filter(u => u.id === userUnidadeId);
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

        // Ordenação
        unitsData.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        modsData.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        profsData.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

        setCatalogs({ unidades: unitsData, modalidades: modsData, professores: profsData, feriados: feriadosData });
      } catch (error) {
        console.error("Erro ao carregar:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCatalogs();
  }, [role, userId, userUnidadeId]);

  // 2. MOTOR DE GERAÇÃO DA GRADE
  useEffect(() => {
    if (catalogs.unidades.length === 0 && role !== 'admin') return; 
      
    const gerarGrade = async () => {
      setLoading(true);
      try {
        let datasParaVerificar = [];
        if (modoFiltro === 'dia') {
          datasParaVerificar = [new Date(dataFiltro + 'T12:00:00')]; 
        } else {
          const [ano, mes] = mesFiltro.split('-');
          datasParaVerificar = getMonthDates(parseInt(ano), parseInt(mes) - 1);
        }

        const aulasRef = collection(db, 'aulas');
        const aulasSnap = await getDocs(query(aulasRef));
        let aulasBase = aulasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const validacoesRef = collection(db, 'validacoes');
        const validacoesSnap = await getDocs(validacoesRef); 
        const validacoesExistentes = validacoesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        let meuProfessorId = null;
        if (role === 'professor') {
            const meuPerfil = catalogs.professores.find(p => p.uidLogin === userId);
            if (meuPerfil) meuProfessorId = meuPerfil.id;
        }

        // MAPA DE FERIADOS
        const feriadosSet = new Set(catalogs.feriados.map(f => f.data));

        let gradeFinal = [];

        datasParaVerificar.forEach(dataObj => {
          const dataString = dataObj.toISOString().split('T')[0];
          const diaSemanaNome = diasSemanaMap[dataObj.getDay()];
          const isFeriado = feriadosSet.has(dataString);

          const aulasDoDia = aulasBase.filter(aula => aula.dias && aula.dias.includes(diaSemanaNome));

          aulasDoDia.forEach(aula => {
            if (filtroUnidade && String(aula.unidadeId) !== String(filtroUnidade)) return;
            if (filtroModalidade && String(aula.modalidadeId) !== String(filtroModalidade)) return;
            
            const unidadeValida = catalogs.unidades.find(u => String(u.id) === String(aula.unidadeId));
            if (!unidadeValida) return; 

            if (role === 'professor') {
                if (String(aula.professorId) !== String(meuProfessorId)) return;
            }

            const prof = catalogs.professores.find(p => String(p.id) === String(aula.professorId));
            if (filtroProfessor && prof) {
                const termo = filtroProfessor.toLowerCase();
                if (!prof.nome.toLowerCase().includes(termo)) return;
            }

            const validacao = validacoesExistentes.find(v => String(v.aulaId) === String(aula.id) && v.data === dataString);

            let professorExibicao = prof;
            
            // LÓGICA DE STATUS
            let status = 'pendente';
            let dadosValidacao = validacao;

            if (validacao) {
                status = validacao.status;
            } else if (isFeriado) {
                status = 'cancelada';
                dadosValidacao = { 
                    motivoCancelamento: 'Recesso/Feriado',
                    status: 'cancelada' 
                };
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

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    gerarGrade();
  }, [modoFiltro, dataFiltro, mesFiltro, catalogs, filtroUnidade, filtroModalidade, filtroProfessor, role, userId]);

  // 🟢 CONTADORES INTELIGENTES
  const counts = useMemo(() => {
      return {
          total: gradeGerada.length,
          pendentes: gradeGerada.filter(i => i.status === 'pendente').length,
          canceladas: gradeGerada.filter(i => i.status === 'cancelada').length
      };
  }, [gradeGerada]);

  // 🟢 FILTRAGEM DE EXIBIÇÃO (Baseada nos Botões)
  const listaExibicao = useMemo(() => {
      if (filtroStatus === 'todos') return gradeGerada;
      return gradeGerada.filter(item => item.status === filtroStatus);
  }, [gradeGerada, filtroStatus]);

  const verificarFuturo = (dataString) => {
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const dataAula = new Date(dataString + 'T00:00:00'); 
    return dataAula > hoje;
  };

  const abrirModal = (tipo, item) => {
    if (verificarFuturo(item.data)) {
      alert("Aulas futuras não podem ser validadas.");
      return;
    }
    setAcaoAtual({ tipo, item });
    setInputValor("");
    setInputObs(""); 
    
    setIsSubstituicao(false);
    setSubstitutoId("");
    setMotivoSubstituicao("");

    if (item.validacao?.substituicao) {
        setIsSubstituicao(true);
        setSubstitutoId(item.validacao.professorId);
        setMotivoSubstituicao(item.validacao.motivoSubstituicao || "");
        setInputValor(item.validacao.alunos || "");
    } else if (item.validacao?.alunos) {
        setInputValor(item.validacao.alunos);
    }

    setModalOpen(true);
  };

  const confirmarAcao = async (e) => {
    e.preventDefault(); 
    e.stopPropagation();

    if (acaoAtual.tipo === 'validar' && !inputValor) return alert("Informe o número de alunos.");
    
    if (acaoAtual.tipo === 'validar' && isSubstituicao) {
        if (!substitutoId) return alert("Selecione o professor substituto.");
        if (!motivoSubstituicao) return alert("Informe o motivo da troca.");
    }

    if (acaoAtual.tipo === 'cancelar' && !inputValor) return alert("Selecione um motivo.");
    if (acaoAtual.tipo === 'cancelar' && inputValor === 'Outros' && !inputObs.trim()) {
        return alert("Descreva o motivo em 'Outros'.");
    }
    
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

      if (item.validacao?.id) {
        await updateDoc(doc(db, 'validacoes', item.validacao.id), payload);
      } else {
        const docRef = await addDoc(collection(db, 'validacoes'), payload);
        validacaoId = docRef.id;
      }

      // Atualização Otimista
      setGradeGerada(prevGrade => prevGrade.map(gridItem => {
        if (gridItem.key === item.key) {
           let novoProfessor = item.professorTitular;
           if (payload.substituicao && payload.professorId) {
                const sub = catalogs.professores.find(p => String(p.id) === String(payload.professorId));
                if (sub) novoProfessor = { ...sub, isSubstituto: true };
           }
           return {
             ...gridItem,
             status: payload.status,
             professor: novoProfessor,
             validacao: { id: validacaoId, ...payload }
           };
        }
        return gridItem;
      }));
      
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar.");
    } finally {
      setProcessando(false);
      setModalOpen(false);
      setAcaoAtual(null);
    }
  };

  return (
    <div className="p-6 md:p-10 animate-fade-in max-w-[1920px] mx-auto space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 border-b border-slate-200 dark:border-slate-700 pb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <span className="bg-gradient-to-tr from-emerald-500 to-green-600 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-7 h-7" />
            </span>
            Validação Diária
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Gestão operacional e controle de frequência.</p>
        </div>
        
        {/* ÁREA DE CONTROLE (BOTÕES + FILTROS) */}
        <div className="flex flex-col items-end gap-3 w-full xl:w-auto">
            
            {/* 🟢 GRUPO DE BOTÕES DE STATUS (A, B, C) */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                
                {/* Botão A: TODOS */}
                <button
                    onClick={() => setFiltroStatus('todos')}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all
                        ${filtroStatus === 'todos' 
                            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }
                    `}
                >
                    <List className="w-4 h-4"/>
                    Todos
                </button>

                {/* Botão B: PENDENTES */}
                <button
                    onClick={() => setFiltroStatus('pendente')}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ml-1
                        ${filtroStatus === 'pendente' 
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-orange-600'
                        }
                    `}
                >
                    <AlertCircle className="w-4 h-4"/>
                    Pendentes
                    {counts.pendentes > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-white/20 text-white rounded-md text-[10px] min-w-[20px] text-center">
                            {counts.pendentes}
                        </span>
                    )}
                </button>

                {/* Botão C: CANCELADOS */}
                <button
                    onClick={() => setFiltroStatus('cancelada')}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ml-1
                        ${filtroStatus === 'cancelada' 
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-rose-600'
                        }
                    `}
                >
                    <XCircle className="w-4 h-4"/>
                    Cancelados
                    {counts.canceladas > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-white/20 text-white rounded-md text-[10px] min-w-[20px] text-center">
                            {counts.canceladas}
                        </span>
                    )}
                </button>
            </div>

            {/* FILTROS PADRÃO (Data, Unidade, etc) */}
            <div className="w-full xl:w-auto bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
                    <button onClick={() => setModoFiltro('dia')} className={`px-5 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${modoFiltro === 'dia' ? 'bg-white dark:bg-slate-600 shadow text-emerald-700 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Dia</button>
                    <button onClick={() => setModoFiltro('mes')} className={`px-5 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${modoFiltro === 'mes' ? 'bg-white dark:bg-slate-600 shadow text-emerald-700 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Mês</button>
                </div>

                <div className="h-px md:h-auto md:w-px bg-slate-200 dark:bg-slate-600 mx-1"></div>

                <div className="flex flex-col md:flex-row gap-2 flex-1">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-emerald-500"/>
                        {modoFiltro === 'dia' ? (
                        <input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} className="pl-10 p-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500 w-full md:w-auto outline-none h-full" />
                        ) : (
                        <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="pl-10 p-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500 w-full md:w-auto outline-none h-full" />
                        )}
                    </div>

                    {role !== 'unidade' && (
                        <div className="relative">
                            <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                            <select value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)} className="pl-9 p-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 w-full md:w-48 outline-none h-full appearance-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-950 transition-colors">
                                <option value="">Todas as Unidades</option>
                                {catalogs.unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                        <select value={filtroModalidade} onChange={e => setFiltroModalidade(e.target.value)} className="pl-9 p-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 w-full md:w-40 outline-none h-full appearance-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-950 transition-colors">
                            <option value="">Modalidade</option>
                            {catalogs.modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                        </select>
                    </div>

                    {(role === 'admin' || role === 'mentor') && (
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                            <input type="text" placeholder="Buscar Professor..." value={filtroProfessor} onChange={e => setFiltroProfessor(e.target.value)} className="pl-9 p-2 border-0 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 w-full outline-none h-full" />
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* GRID DE AULAS */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-2 text-emerald-500"/>
          <p className="text-sm font-medium">Carregando grade...</p>
        </div>
      ) : listaExibicao.length === 0 ? (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
          {listaExibicao.map((item) => {
            const isFuture = verificarFuturo(item.data);
            const status = item.status; 
            const isSub = item.professor?.isSubstituto;

            return (
              <div key={item.key} className="group bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                {/* Indicador de Status */}
                <div className={`absolute top-0 left-0 w-full h-1.5 ${status === 'realizada' ? 'bg-emerald-500' : status === 'cancelada' ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>

                {/* Header */}
                <div className="flex justify-between items-start mb-4 pt-2">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1">
                            <Calendar className="w-3 h-3"/> {item.diaSemana}, {formatDateBr(item.data)}
                        </span>
                        <h3 className="font-black text-lg text-slate-800 dark:text-white leading-tight">{item.modalidade?.nome}</h3>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg text-sm font-mono font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                        <Clock className="w-3.5 h-3.5 text-emerald-500"/> {item.aulaBase.hora}
                    </div>
                </div>

                {/* Detalhes */}
                <div className="space-y-3 mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-400 border border-slate-100 dark:border-slate-600">
                            <MapPin className="w-4 h-4"/>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Unidade</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{item.unidade?.nome}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${isSub ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 border-slate-100 dark:border-slate-600'}`}>
                            {isSub ? <ArrowRightLeft className="w-4 h-4"/> : <User className="w-4 h-4"/>}
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase flex justify-between items-center">
                                Professor 
                                {isSub && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 rounded font-black tracking-wide">SUBSTITUTO</span>}
                            </p>
                            <div className="flex flex-col">
                                {isSub && (
                                    <span className="text-[10px] text-slate-400 line-through decoration-red-400 decoration-2">
                                        {item.professorTitular?.nome}
                                    </span>
                                )}
                                <p className={`text-sm font-bold truncate max-w-[200px] ${isSub ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {item.professor?.nome || "Sem Professor"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <StatusBadge status={status} />
                    
                    {status === 'realizada' && (
                        <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5"/> {item.validacao?.alunos} Alunos
                        </div>
                    )}
                    {status === 'cancelada' && (
                        <div className="text-[10px] font-bold text-rose-600 max-w-[100px] truncate text-right" title={item.validacao?.motivoCancelamento}>
                            {item.validacao?.motivoCancelamento || "Recesso"}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => abrirModal('validar', item)} 
                        disabled={isFuture || status === 'cancelada'} // Bloqueia validação se for feriado/cancelado
                        className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2
                        ${status === 'realizada' 
                            ? 'bg-white border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50' 
                            : (isFuture || status === 'cancelada')
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 hover:shadow-emerald-500/40 hover:-translate-y-0.5'}`}
                    >
                        {status === 'realizada' ? 'Editar' : 'Validar'}
                    </button>

                    <button 
                        onClick={() => abrirModal('cancelar', item)} 
                        disabled={isFuture || (status === 'cancelada' && item.validacao?.motivoCancelamento === 'Recesso/Feriado')} 
                        className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2
                        ${status === 'cancelada' 
                            ? 'bg-white border-2 border-rose-500 text-rose-600 hover:bg-rose-50' 
                            : isFuture 
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                : 'bg-white text-rose-500 border border-rose-200 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600'}`}
                    >
                        {status === 'cancelada' ? 'Detalhes' : 'Cancelar'}
                    </button>
                </div>

                {isFuture && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-2xl">
                        <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-xl border border-slate-200 dark:border-slate-600 flex items-center gap-2">
                            <Lock className="w-3 h-3 text-slate-400"/>
                            <span className="text-xs font-bold text-slate-500">Aguarde a data</span>
                        </div>
                    </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL (Mantido igual) */}
      {modalOpen && acaoAtual && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            
            <div className={`p-6 text-center relative overflow-hidden ${acaoAtual.tipo === 'validar' ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-current to-transparent opacity-20"></div>
                
                <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3 shadow-sm ${acaoAtual.tipo === 'validar' ? 'bg-white text-emerald-500' : 'bg-white text-rose-500'}`}>
                    {acaoAtual.tipo === 'validar' ? <CheckCircle2 className="w-8 h-8"/> : <XCircle className="w-8 h-8"/>}
                </div>
                
                <h3 className="font-black text-xl text-slate-800 dark:text-white">
                    {acaoAtual.tipo === 'validar' ? 'Validar Aula' : 'Cancelar Aula'}
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase mt-1 tracking-wide">{acaoAtual.item.modalidade?.nome} • {acaoAtual.item.professorTitular?.nome}</p>

                <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 transition-colors">
                    <XCircle className="w-5 h-5 text-slate-400"/>
                </button>
            </div>

            <form onSubmit={confirmarAcao} className="p-6 space-y-5">
              
              {acaoAtual.tipo === 'validar' ? (
                <>
                    <div className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${isSubstituicao ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 hover:border-blue-200'}`}>
                        <label className="flex items-center gap-4 p-4 cursor-pointer select-none">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSubstituicao ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                                {isSubstituicao && <CheckCircle2 className="w-3 h-3 text-white"/>}
                            </div>
                            <input type="checkbox" className="hidden" checked={isSubstituicao} onChange={(e) => setIsSubstituicao(e.target.checked)}/>
                            <div className="flex-1">
                                <span className={`block font-bold text-sm ${isSubstituicao ? 'text-blue-700' : 'text-slate-600'}`}>Substituição de Professor</span>
                                <span className="text-[10px] text-slate-400">Marque se outro professor deu esta aula</span>
                            </div>
                            <ArrowRightLeft className={`w-5 h-5 ${isSubstituicao ? 'text-blue-500' : 'text-slate-300'}`}/>
                        </label>

                        {isSubstituicao && (
                            <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-2">
                                <div className="h-px w-full bg-blue-200 mb-3"></div>
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Quem deu a aula?</label>
                                    <div className="relative">
                                        <select 
                                            className="w-full p-2.5 bg-white border border-blue-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                            value={substitutoId}
                                            onChange={(e) => setSubstitutoId(e.target.value)}
                                        >
                                            <option value="">Selecione o professor...</option>
                                            {catalogs.professores
                                                .filter(p => String(p.id) !== String(acaoAtual.item.professorTitular?.id))
                                                .map(p => (<option key={p.id} value={p.id}>{p.nome}</option>))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-blue-400 pointer-events-none"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Motivo da Troca</label>
                                    <div className="relative">
                                        <select 
                                            className="w-full p-2.5 bg-white border border-blue-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                            value={motivoSubstituicao}
                                            onChange={(e) => setMotivoSubstituicao(e.target.value)}
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="Atestado do Titular">Atestado do Titular</option>
                                            <option value="Férias">Férias</option>
                                            <option value="Folga Programada">Folga Programada</option>
                                            <option value="Emergência">Emergência</option>
                                            <option value="Outros">Outros</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-blue-400 pointer-events-none"/>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 ml-1">Quantidade de Alunos</label>
                        <div className="relative group">
                            <Users className="absolute left-4 top-3.5 w-5 h-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors"/>
                            <input 
                                type="number" 
                                min="0" 
                                className="w-full pl-12 p-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 rounded-xl text-xl font-bold text-slate-800 dark:text-white outline-none transition-all placeholder:text-slate-300" 
                                value={inputValor} 
                                onChange={e => setInputValor(e.target.value)} 
                                placeholder="00"
                                autoFocus
                            />
                        </div>
                    </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 ml-1">Motivo do Cancelamento</label>
                    <div className="relative">
                        <select className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-rose-500 rounded-xl text-sm font-bold text-slate-700 outline-none appearance-none" value={inputValor} onChange={e => setInputValor(e.target.value)}>
                        <option value="">Selecione o motivo...</option>
                        <option value="Feriado">Feriado</option>
                        <option value="Férias Professor">Férias Professor</option>
                        <option value="Atestado Médico">Atestado Médico</option>
                        <option value="Manutenção Unidade">Manutenção Unidade</option>
                        <option value="Falta sem Justificativa">Falta sem Justificativa</option>
                        <option value="Chuva/Clima">Chuva/Clima</option>
                        <option value="Outros">Outros (Descrever)</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-4 w-4 h-4 text-slate-400 pointer-events-none"/>
                    </div>
                  </div>
                  
                  {inputValor === 'Outros' && (
                    <div className="animate-fade-in">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 ml-1">Descreva o motivo</label>
                        <textarea 
                            className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-rose-500 rounded-xl text-sm font-medium text-slate-700 outline-none resize-none"
                            rows="3"
                            value={inputObs}
                            onChange={e => setInputObs(e.target.value)}
                            placeholder="Digite aqui..."
                        />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={processando} className={`flex-[2] py-3.5 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all ${acaoAtual.tipo === 'validar' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'}`}>
                    {processando ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
