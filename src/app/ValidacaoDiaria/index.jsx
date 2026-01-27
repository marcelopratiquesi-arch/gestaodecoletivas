import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { 
  collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc 
} from 'firebase/firestore';
import { 
  Calendar, CheckCircle2, XCircle, Users, MapPin, 
  Filter, Search, Clock, AlertTriangle, Loader2, Lock, LayoutDashboard 
} from 'lucide-react';

// --- HELPERS DE DATA ---
const getTodayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

const getMonthDates = (year, month) => {
  const date = new Date(year, month, 1);
  const dates = [];
  while (date.getMonth() === month) {
    dates.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
};

const diasSemanaMap = {
  0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado'
};

const formatDateBr = (dateStr) => {
  if(!dateStr) return "-";
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
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

  // --- DADOS ---
  const [catalogs, setCatalogs] = useState({ unidades: [], modalidades: [], professores: [] });
  const [gradeGerada, setGradeGerada] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);

  // --- MODAL ---
  const [modalOpen, setModalOpen] = useState(false);
  const [acaoAtual, setAcaoAtual] = useState(null); 
  const [inputValor, setInputValor] = useState(""); 
  const [inputObs, setInputObs] = useState(""); // Novo: Para "Outros"

  // 1. CARREGAMENTO INICIAL (COM REGRA DE VÍNCULO)
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        setLoading(true);
        
        // Busca Dados Principais + Vínculos (Para filtrar unidades do professor)
        const [unitsSnap, modsSnap, profsSnap, linksSnap] = await Promise.all([
          getDocs(collection(db, 'unidades')),
          getDocs(collection(db, 'modalidades')),
          getDocs(collection(db, 'professores')),
          getDocs(collection(db, 'vinculos')) // Alterado de 'professorVinculos' para 'vinculos' se for o padrão
        ]);

        let unitsData = unitsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const modsData = modsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const profsData = profsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const linksData = linksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // === FILTRO DE UNIDADES (O PULO DO GATO) ===
        if (role === 'mentor') {
          unitsData = unitsData.filter(u => u.mentorId === userId);
        } else if (role === 'unidade') {
          unitsData = unitsData.filter(u => u.id === userUnidadeId);
          setFiltroUnidade(userUnidadeId);
        } else if (role === 'professor') {
          // 1. Acha o perfil do professor logado
          const meuPerfil = profsData.find(p => p.uidLogin === userId);
          if (meuPerfil) {
             // 2. Acha os vínculos dele
             const meusLinks = linksData.filter(l => String(l.professorId) === String(meuPerfil.id));
             const minhasUnidadesIds = meusLinks.map(l => String(l.unidadeId));
             // 3. Filtra as unidades do catálogo para mostrar SÓ as vinculadas
             unitsData = unitsData.filter(u => minhasUnidadesIds.includes(String(u.id)));
          } else {
             unitsData = []; // Se não tiver perfil, não vê nada
          }
        }

        setCatalogs({ unidades: unitsData, modalidades: modsData, professores: profsData });
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
        // A. Datas
        let datasParaVerificar = [];
        if (modoFiltro === 'dia') {
          datasParaVerificar = [new Date(dataFiltro + 'T12:00:00')]; 
        } else {
          const [ano, mes] = mesFiltro.split('-');
          datasParaVerificar = getMonthDates(parseInt(ano), parseInt(mes) - 1);
        }

        // B. Templates de Aulas
        const aulasRef = collection(db, 'aulas');
        const aulasSnap = await getDocs(query(aulasRef));
        let aulasBase = aulasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // C. Validações Existentes
        // Idealmente filtrar por data no banco, mas para manter compatibilidade com sua lógica atual:
        const validacoesRef = collection(db, 'validacoes');
        const validacoesSnap = await getDocs(validacoesRef); 
        const validacoesExistentes = validacoesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // D. Identifica Professor
        let meuProfessorId = null;
        if (role === 'professor') {
            const meuPerfil = catalogs.professores.find(p => p.uidLogin === userId);
            if (meuPerfil) meuProfessorId = meuPerfil.id;
        }

        // E. Cruzamento
        let gradeFinal = [];

        datasParaVerificar.forEach(dataObj => {
          const dataString = dataObj.toISOString().split('T')[0];
          const diaSemanaNome = diasSemanaMap[dataObj.getDay()];

          const aulasDoDia = aulasBase.filter(aula => aula.dias && aula.dias.includes(diaSemanaNome));

          aulasDoDia.forEach(aula => {
            // Filtros Visuais
            if (filtroUnidade && String(aula.unidadeId) !== String(filtroUnidade)) return;
            if (filtroModalidade && String(aula.modalidadeId) !== String(filtroModalidade)) return;
            
            // Segurança: Se a unidade não está na lista permitida do usuário, ignora
            const unidadeValida = catalogs.unidades.find(u => String(u.id) === String(aula.unidadeId));
            if (!unidadeValida) return; 

            // Segurança: Professor só vê suas aulas
            if (role === 'professor') {
                if (String(aula.professorId) !== String(meuProfessorId)) return;
            }

            // Busca Texto (Professor)
            const prof = catalogs.professores.find(p => String(p.id) === String(aula.professorId));
            if (filtroProfessor && prof) {
                const termo = filtroProfessor.toLowerCase();
                if (!prof.nome.toLowerCase().includes(termo)) return;
            }

            const validacao = validacoesExistentes.find(v => String(v.aulaId) === String(aula.id) && v.data === dataString);

            gradeFinal.push({
              key: `${aula.id}-${dataString}`,
              data: dataString,
              diaSemana: diaSemanaNome,
              aulaBase: aula,
              professor: prof,
              unidade: unidadeValida,
              modalidade: catalogs.modalidades.find(m => String(m.id) === String(aula.modalidadeId)),
              validacao: validacao || null, 
              status: validacao ? validacao.status : 'pendente'
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
    setInputObs(""); // Limpa obs
    setModalOpen(true);
  };

  const confirmarAcao = async (e) => {
    e.preventDefault();
    if (!inputValor) return alert("Preencha o campo obrigatório.");
    if (acaoAtual.tipo === 'cancelar' && inputValor === 'Outros' && !inputObs.trim()) {
        return alert("Descreva o motivo em 'Outros'.");
    }
    
    setProcessando(true);
    try {
      const { tipo, item } = acaoAtual;
      
      const payload = {
        aulaId: item.aulaBase.id,
        unidadeId: item.aulaBase.unidadeId,
        professorId: item.aulaBase.professorId,
        data: item.data,
        validadoPor: userId,
        
        // 🟢 CORREÇÃO CRÍTICA: timestamp do servidor para hora exata
        timestamp: serverTimestamp(), 
        
        status: tipo === 'validar' ? 'realizada' : 'cancelada'
      };

      if (tipo === 'validar') {
        payload.alunos = parseInt(inputValor);
      } else {
        // Se for "Outros", salva o texto digitado. Se não, salva a opção do select.
        payload.motivoCancelamento = inputValor === 'Outros' ? inputObs : inputValor;
      }

      if (item.validacao?.id) {
        await updateDoc(doc(db, 'validacoes', item.validacao.id), payload);
      } else {
        await addDoc(collection(db, 'validacoes'), payload);
      }

      // Força recarregamento simples (pode ser otimizado depois)
      window.location.reload(); 
      
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar.");
    } finally {
      setProcessando(false);
      setModalOpen(false);
    }
  };

  return (
    <div className="p-6 animate-fade-in max-w-[1600px] mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            Validação Diária
          </h1>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 uppercase font-bold text-xs">{role}</span>
            <span>Painel Operacional</span>
          </div>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button onClick={() => setModoFiltro('dia')} className={`px-6 py-2 text-sm font-bold rounded-md transition-all ${modoFiltro === 'dia' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Dia</button>
          <button onClick={() => setModoFiltro('mes')} className={`px-6 py-2 text-sm font-bold rounded-md transition-all ${modoFiltro === 'mes' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Mês</button>
        </div>
      </div>

      {/* FILTROS (DARK MODE APPLIED) */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 flex flex-col lg:flex-row gap-4 items-end">
        
        <div className="w-full lg:w-auto">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">{modoFiltro === 'dia' ? 'Data' : 'Mês'}</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
            {modoFiltro === 'dia' ? (
              <input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} className="pl-10 p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-lg text-sm w-full lg:w-48 font-bold focus:ring-2 focus:ring-green-500 outline-none" />
            ) : (
              <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="pl-10 p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-lg text-sm w-full lg:w-48 font-bold focus:ring-2 focus:ring-green-500 outline-none" />
            )}
          </div>
        </div>

        {/* Unidade (Filtrada para Professor) */}
        {role !== 'unidade' && (
          <div className="w-full lg:w-64">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Unidade</label>
            <select value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)} className="w-full p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
              <option value="">Todas as Unidades</option>
              {catalogs.unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        )}

        <div className="w-full lg:w-48">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Modalidade</label>
          <select value={filtroModalidade} onChange={e => setFiltroModalidade(e.target.value)} className="w-full p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
            <option value="">Todas</option>
            {catalogs.modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>

        {(role === 'admin' || role === 'mentor') && (
          <div className="w-full lg:flex-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Professor</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
              <input type="text" placeholder="Nome ou E-mail..." value={filtroProfessor} onChange={e => setFiltroProfessor(e.target.value)} className="w-full pl-10 p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
          </div>
        )}
      </div>

      {/* GRID */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-green-600"/>
          <p>Carregando...</p>
        </div>
      ) : gradeGerada.length === 0 ? (
        <div className="py-20 text-center bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400">
          <LayoutDashboard className="w-12 h-12 mx-auto mb-3 opacity-20"/>
          <p className="font-medium">Nenhuma aula encontrada com os filtros atuais.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {gradeGerada.map((item) => {
            const isFuture = verificarFuturo(item.data);
            const status = item.status; 
            
            let statusColor = "border-l-4 border-l-slate-300 dark:border-l-slate-600 bg-white dark:bg-slate-800";
            if (status === 'realizada') statusColor = "border-l-4 border-l-green-500 bg-green-50/20 dark:bg-green-900/10";
            if (status === 'cancelada') statusColor = "border-l-4 border-l-red-500 bg-red-50/20 dark:bg-red-900/10";

            return (
              <div key={item.key} className={`rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition-all hover:shadow-md ${statusColor}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                      <Calendar className="w-3 h-3"/> {formatDateBr(item.data)} ({item.diaSemana})
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">{item.modalidade?.nome}</h3>
                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium text-sm">
                      <Clock className="w-3.5 h-3.5 text-green-600"/> {item.aulaBase.hora}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${status === 'pendente' ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300' : ''} ${status === 'realizada' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : ''} ${status === 'cancelada' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' : ''}`}>
                    {status}
                  </div>
                </div>

                <div className="space-y-2 mb-4 border-t border-b border-slate-100 dark:border-slate-700 py-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <MapPin className="w-4 h-4 text-slate-400"/> <span className="truncate">{item.unidade?.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Users className="w-4 h-4 text-slate-400"/> <span className="truncate font-semibold">{item.professor?.nome || "Sem Professor"}</span>
                  </div>
                </div>

                {status === 'realizada' && <div className="mb-4 text-sm text-green-800 dark:text-green-300 font-bold flex items-center gap-2 bg-green-100 dark:bg-green-900/30 p-2 rounded"><CheckCircle2 className="w-4 h-4"/> {item.validacao.alunos} Alunos</div>}
                {status === 'cancelada' && <div className="mb-4 text-xs text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/30 p-2 rounded"><strong>Motivo:</strong> {item.validacao.motivoCancelamento}</div>}

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => abrirModal('validar', item)} disabled={isFuture} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${status === 'realizada' ? 'bg-green-600 text-white' : isFuture ? 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500 cursor-not-allowed' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 border border-green-200 dark:border-green-800'}`}>
                    <CheckCircle2 className="w-4 h-4"/> {status === 'realizada' ? 'Editar' : 'Validar'}
                  </button>
                  <button onClick={() => abrirModal('cancelar', item)} disabled={isFuture} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${status === 'cancelada' ? 'bg-red-600 text-white' : isFuture ? 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500 cursor-not-allowed' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-800'}`}>
                    <XCircle className="w-4 h-4"/> {status === 'cancelada' ? 'Ver' : 'Cancelar'}
                  </button>
                </div>
                {isFuture && <div className="text-[10px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1"><Lock className="w-3 h-3"/> Aguarde a data</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL */}
      {modalOpen && acaoAtual && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className={`p-4 border-b flex justify-between items-center ${acaoAtual.tipo === 'validar' ? 'bg-green-50 dark:bg-green-900/30 border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800'}`}>
              <h3 className={`font-bold text-lg ${acaoAtual.tipo === 'validar' ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>{acaoAtual.tipo === 'validar' ? 'Confirmar Presença' : 'Cancelar Aula'}</h3>
              <button onClick={() => setModalOpen(false)}><XCircle className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button>
            </div>
            <form onSubmit={confirmarAcao} className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-1 font-bold">{acaoAtual.item.modalidade?.nome}</p>
                <p className="text-xs text-slate-400">{formatDateBr(acaoAtual.item.data)} • {acaoAtual.item.professor?.nome}</p>
              </div>

              {acaoAtual.tipo === 'validar' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Número de Alunos</label>
                  <input type="number" min="0" autoFocus className="w-full p-4 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg text-2xl font-bold text-center focus:ring-2 focus:ring-green-500 outline-none text-slate-800 dark:text-white" value={inputValor} onChange={e => setInputValor(e.target.value)} placeholder="0"/>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Motivo</label>
                    <select className="w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none text-slate-700 dark:text-white" value={inputValor} onChange={e => setInputValor(e.target.value)}>
                      <option value="">Selecione...</option>
                      <option value="Feriado">Feriado</option>
                      <option value="Férias Professor">Férias Professor</option>
                      <option value="Atestado Médico">Atestado Médico</option>
                      <option value="Manutenção Unidade">Manutenção Unidade</option>
                      <option value="Falta sem Justificativa">Falta sem Justificativa</option>
                      <option value="Chuva/Clima">Chuva/Clima</option>
                      <option value="Outros">Outros (Descrever)</option>
                    </select>
                  </div>
                  
                  {/* CAMPO EXTRA PARA OUTROS */}
                  {inputValor === 'Outros' && (
                    <div className="animate-fade-in">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Descreva o motivo</label>
                        <textarea 
                            className="w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none text-slate-700 dark:text-white"
                            rows="3"
                            value={inputObs}
                            onChange={e => setInputObs(e.target.value)}
                            placeholder="Informe o motivo do cancelamento..."
                        />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-3 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700">Voltar</button>
                <button type="submit" disabled={processando} className={`flex-1 py-3 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 ${acaoAtual.tipo === 'validar' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>{processando ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Confirmar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}