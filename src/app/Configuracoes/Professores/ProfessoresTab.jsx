import { useEffect, useMemo, useState } from "react";
// Importações de contexto e serviços
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../services/firebase";
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, orderBy, limit, startAfter, documentId, setDoc
} from "firebase/firestore";
// Auth Imports
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApp, deleteApp } from "firebase/app"; 
// Ícones
import { 
  UserPlus, Edit2, Trash2, Link as LinkIcon, Loader2, Search, CheckCircle2, 
  X, Mail, Phone, PlusCircle, Key, Lock, User, ArrowRight, AlertTriangle,
  ArrowUpDown, ArrowUp, ArrowDown, DownloadCloud, Layers
} from "lucide-react";

export function ProfessoresTab() {
  const { userData } = useAuth();
  
  // ===== PERMISSÕES E ESCOPO =====
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);
  const userUnidadeId = useMemo(() => userData?.unidadeId, [userData]);

  const podeVer = ["admin", "mentor", "unidade"].includes(role);
  const podeEditar = ["admin", "mentor", "unidade"].includes(role);
  const podeExcluir = role === "admin"; 

  // ===== STATES DE DADOS =====
  const [professores, setProfessores] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [vinculos, setVinculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMais, setLoadingMais] = useState(false); // Estado para o botão "Carregar Mais"
  
  // PAGINAÇÃO
  const [ultimoDoc, setUltimoDoc] = useState(null); // Cursor para Admin
  const [todosIdsMentor, setTodosIdsMentor] = useState([]); // Lista total de IDs para Mentor/Unidade
  const [indicePaginacao, setIndicePaginacao] = useState(0); 
  const [temMais, setTemMais] = useState(true);

  // Filtros e Ordenação
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState({ campo: 'nome', direcao: 'asc' });

  // Modais de Fluxo
  const [modalVerificacaoAberto, setModalVerificacaoAberto] = useState(false);
  const [modalFormAberto, setModalFormAberto] = useState(false);
  
  // Estado para Verificação
  const [emailVerificacao, setEmailVerificacao] = useState("");
  const [buscandoEmail, setBuscandoEmail] = useState(false);
  const [professorEncontrado, setProfessorEncontrado] = useState(null);

  // Edição
  const [profEditando, setProfEditando] = useState(null);
  
  // Forms Dados
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [status, setStatus] = useState("ativo");

  // Vínculo
  const [unidadeSelecionadaId, setUnidadeSelecionadaId] = useState("");
  
  // Feedback
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const senhaPadrao = "123456";

  // --- INICIALIZAÇÃO OTIMIZADA ---
  useEffect(() => { 
      if (podeVer) {
          carregarUnidadesBase(); // Carrega unidades (leve)
          iniciarCarregamentoGrade(10); // Carrega primeiros 10 professores
      }
  }, [podeVer, role, userId, userUnidadeId]);

  // 1. Carrega apenas a lista de Unidades (necessário para os selects e tags)
  async function carregarUnidadesBase() {
      try {
          let listaUnidades = [];
          const refUnidades = collection(db, "unidades");
          
          if (role === "admin") {
            const snap = await getDocs(query(refUnidades, orderBy("nome")));
            listaUnidades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          } else if (role === "mentor") {
            const snap = await getDocs(query(refUnidades, where("mentorId", "==", userId)));
            listaUnidades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          } else if (role === "unidade") {
            if (userUnidadeId) {
              const snap = await getDocs(refUnidades); 
              listaUnidades = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => String(u.id) === String(userUnidadeId));
            }
          }
          setUnidades(listaUnidades);
      } catch (e) { console.error(e); }
  }

  // 2. Inicia o carregamento da tabela (Reset)
  async function iniciarCarregamentoGrade(qtdInicial = 10) {
      setLoading(true);
      setProfessores([]);
      setVinculos([]);
      setUltimoDoc(null);
      setIndicePaginacao(0);
      setTemMais(true);

      try {
          if (role === "admin") {
              await carregarLoteAdmin(qtdInicial, null);
          } else {
              await prepararListaMentor(qtdInicial);
          }
      } catch (e) {
          console.error(e);
          setErro("Erro ao carregar dados.");
      } finally {
          setLoading(false);
      }
  }

  // --- LÓGICA DE PAGINAÇÃO: ADMIN ---
  async function carregarLoteAdmin(qtd, ultimo) {
      const refProfs = collection(db, "professores");
      // Se qtd for muito grande (ex: 1000 - botão Todos), fazemos sem limite ou com limite alto
      let q = qtd > 500 ? query(refProfs, orderBy("nome")) : query(refProfs, orderBy("nome"), limit(qtd));
      
      if (ultimo && qtd <= 500) {
          q = query(refProfs, orderBy("nome"), startAfter(ultimo), limit(qtd));
      }

      const snap = await getDocs(q);
      const novosProfs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (novosProfs.length < qtd) setTemMais(false);
      if (snap.docs.length > 0) setUltimoDoc(snap.docs[snap.docs.length - 1]);

      // Carregar vínculos apenas destes professores
      await carregarVinculosLote(novosProfs);

      setProfessores(prev => {
          // Previne duplicidade usando Set
          const idsExistentes = new Set(prev.map(p => p.id));
          const filtrados = novosProfs.filter(p => !idsExistentes.has(p.id));
          return [...prev, ...filtrados];
      });
  }

  // --- LÓGICA DE PAGINAÇÃO: MENTOR/UNIDADE ---
  async function prepararListaMentor(qtdInicial) {
      // 1. Identificar unidades do escopo
      let minhasUnidadesIds = [];
      if (role === "unidade") minhasUnidadesIds = [userUnidadeId];
      else if (role === "mentor") {
          const snapUni = await getDocs(query(collection(db, "unidades"), where("mentorId", "==", userId)));
          minhasUnidadesIds = snapUni.docs.map(d => d.id);
      }

      if (minhasUnidadesIds.length === 0) { setTemMais(false); return; }

      // 2. Buscar TODOS os vínculos dessas unidades para saber QUAIS professores listar
      let todosLinks = [];
      for (let i = 0; i < minhasUnidadesIds.length; i += 10) {
          const chunk = minhasUnidadesIds.slice(i, i + 10);
          const s = await getDocs(query(collection(db, "vinculos"), where("unidadeId", "in", chunk)));
          todosLinks = [...todosLinks, ...s.docs.map(d => ({id:d.id, ...d.data()}))];
      }

      // Extrai IDs únicos de professores
      const idsProfsUnicos = [...new Set(todosLinks.map(v => v.professorId))];
      setTodosIdsMentor(idsProfsUnicos);
      
      // Carrega o primeiro lote
      await carregarLoteMentor(idsProfsUnicos, 0, qtdInicial);
  }

  async function carregarLoteMentor(todosIds, indice, qtd) {
      const idsParaCarregar = todosIds.slice(indice, indice + qtd);
      if (idsParaCarregar.length === 0) { setTemMais(false); return; }

      // Se o usuário pediu "Todos" (qtd > 500), carrega o restante da lista
      const idsFinais = qtd > 500 ? todosIds.slice(indice) : idsParaCarregar;

      // Buscar detalhes dos professores
      const novosProfs = [];
      for (let i = 0; i < idsFinais.length; i += 10) {
          const chunk = idsFinais.slice(i, i + 10);
          if (chunk.length === 0) continue;
          const s = await getDocs(query(collection(db, "professores"), where(documentId(), "in", chunk)));
          novosProfs.push(...s.docs.map(d => ({id:d.id, ...d.data()})));
      }

      // Ordenar localmente por nome (já que buscamos por ID)
      novosProfs.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

      await carregarVinculosLote(novosProfs);

      setProfessores(prev => {
          const idsExistentes = new Set(prev.map(p => p.id));
          const filtrados = novosProfs.filter(p => !idsExistentes.has(p.id));
          return [...prev, ...filtrados];
      });
      
      const novoIndice = indice + idsFinais.length;
      setIndicePaginacao(novoIndice);
      if (novoIndice >= todosIds.length) setTemMais(false);
  }

  // --- CARREGAR VÍNCULOS DOS PROFESSORES VISÍVEIS ---
  async function carregarVinculosLote(profs) {
      if (profs.length === 0) return;
      const ids = profs.map(p => p.id);
      
      const novosVinculos = [];
      for (let i = 0; i < ids.length; i += 10) {
          const chunk = ids.slice(i, i + 10);
          const s = await getDocs(query(collection(db, "vinculos"), where("professorId", "in", chunk)));
          novosVinculos.push(...s.docs.map(d => ({id:d.id, ...d.data()})));
      }

      setVinculos(prev => {
          const idsExistentes = new Set(prev.map(v => v.id));
          const filtrados = novosVinculos.filter(v => !idsExistentes.has(v.id));
          return [...prev, ...filtrados];
      });
  }

  // --- FUNÇÃO DO BOTÃO "CARREGAR MAIS" ---
  const carregarMais = async (qtd) => {
      setLoadingMais(true);
      try {
          if (role === "admin") await carregarLoteAdmin(qtd, ultimoDoc);
          else await carregarLoteMentor(todosIdsMentor, indicePaginacao, qtd);
      } catch (e) { console.error(e); } finally { setLoadingMais(false); }
  };

  // --- LÓGICA DE ORDENAÇÃO E FILTRO VISUAL ---
  const handleOrdenar = (campo) => {
      setOrdenacao(prev => ({
          campo,
          direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
      }));
  };

  const SortIcon = ({ campo }) => {
      if (ordenacao.campo !== campo) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 opacity-50" />;
      return ordenacao.direcao === 'asc' 
          ? <ArrowUp className="w-3 h-3 text-red-600 ml-1" /> 
          : <ArrowDown className="w-3 h-3 text-red-600 ml-1" />;
  };

  // Helper ORIGINAL para exibir as tags corretamente
  const getUnidadesVinculadas = (profId) => {
      const links = vinculos.filter(v => v.professorId === profId);
      return links.map(v => {
          const u = unidades.find(uni => String(uni.id) === String(v.unidadeId));
          return u ? { id: v.id, nome: u.nome, vinculoId: v.id } : null; // Importante: vinculoId
      }).filter(Boolean);
  };

  const professoresProcessados = useMemo(() => {
    const termo = busca.toLowerCase();
    
    // Filtra apenas o que já foi carregado
    let lista = professores.filter(p => (p.nome || "").toLowerCase().includes(termo) || (p.email || "").toLowerCase().includes(termo));

    // Ordenação no cliente
    return lista.sort((a, b) => {
        let valA, valB;
        if (ordenacao.campo === 'unidades') {
            valA = vinculos.filter(v => v.professorId === a.id).length;
            valB = vinculos.filter(v => v.professorId === b.id).length;
        } else {
            valA = (a[ordenacao.campo] || "").toString().toLowerCase();
            valB = (b[ordenacao.campo] || "").toString().toLowerCase();
        }

        if (valA < valB) return ordenacao.direcao === 'asc' ? -1 : 1;
        if (valA > valB) return ordenacao.direcao === 'asc' ? 1 : -1;
        return 0;
    });
  }, [professores, vinculos, busca, ordenacao]);

  // --- AÇÕES DO FORMULÁRIO (MANTIDAS DO ORIGINAL) ---
  function abrirFluxoNovo() {
      setEmailVerificacao("");
      setProfessorEncontrado(null);
      setErro("");
      setUnidadeSelecionadaId(unidades.length === 1 ? unidades[0].id : "");
      setModalVerificacaoAberto(true);
  }

  async function verificarEmail(e) {
      e.preventDefault();
      if (!emailVerificacao.includes("@")) return setErro("E-mail inválido.");
      
      setBuscandoEmail(true);
      setErro("");
      setProfessorEncontrado(null);

      try {
          const q = query(collection(db, "professores"), where("email", "==", emailVerificacao.trim().toLowerCase()));
          const snap = await getDocs(q);

          if (!snap.empty) {
              const prof = { id: snap.docs[0].id, ...snap.docs[0].data() };
              setProfessorEncontrado(prof);
          } else {
              abrirCadastroCompleto(emailVerificacao);
          }
      } catch (err) {
          setErro("Erro na verificação.");
      } finally {
          setBuscandoEmail(false);
      }
  }

  async function vincularExistente() {
      if (!unidadeSelecionadaId) return setErro("Selecione uma unidade.");
      
      setSalvando(true);
      try {
          const jaVinculado = vinculos.some(v => 
              String(v.professorId) === String(professorEncontrado.id) && 
              String(v.unidadeId) === String(unidadeSelecionadaId)
          );

          if (jaVinculado) {
              setSalvando(false);
              return setErro("Este professor já está vinculado a esta unidade.");
          }

          const docRef = await addDoc(collection(db, "vinculos"), {
              professorId: professorEncontrado.id,
              unidadeId: String(unidadeSelecionadaId),
              status: "ativo",
              createdAt: serverTimestamp()
          });

          // Atualiza localmente
          setVinculos(prev => [...prev, { id: docRef.id, professorId: professorEncontrado.id, unidadeId: String(unidadeSelecionadaId) }]);
          
          // Se o professor ainda não estava na lista (estava em outra página), adiciona ele
          setProfessores(prev => {
              if (prev.some(p => p.id === professorEncontrado.id)) return prev;
              return [professorEncontrado, ...prev];
          });

          setSucesso("Vinculado com sucesso!");
          setTimeout(() => {
              setModalVerificacaoAberto(false);
              setSucesso("");
          }, 1000);

      } catch (err) {
          setErro("Erro ao vincular.");
      } finally {
          setSalvando(false);
      }
  }

  function abrirCadastroCompleto(emailPreenchido) {
      setModalVerificacaoAberto(false);
      setProfEditando(null);
      setNome("");
      setEmail(emailPreenchido || "");
      setTelefone("");
      setStatus("ativo");
      setErro("");
      setModalFormAberto(true);
  }

  function abrirEdicao(p) {
      setProfEditando(p);
      setNome(p.nome);
      setEmail(p.email);
      setTelefone(p.telefone || "");
      setStatus(p.status || "ativo");
      setErro("");
      setModalFormAberto(true);
  }

  async function salvarProfessor(e) {
    e.preventDefault(); 
    setSalvando(true);
    setErro("");
    
    if (!nome.trim()) { setSalvando(false); return setErro("Nome obrigatório"); }

    let secondaryApp = null;

    try {
      if (profEditando) { 
          await updateDoc(doc(db, "professores", profEditando.id), { 
            nome, telefone, status, updatedAt: serverTimestamp() 
          });
          
          if (profEditando.uidLogin) {
             try { await updateDoc(doc(db, "usuarios", profEditando.uidLogin), { nome }); } catch(err) {}
          }

          // Atualiza lista local
          setProfessores(prev => prev.map(p => p.id === profEditando.id ? { ...p, nome, telefone, status } : p));
          setModalFormAberto(false);

      } else { 
        secondaryApp = initializeApp(getApp().options, "SecondaryAppProfCreate");
        const secondaryAuth = getAuth(secondaryApp);
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, senhaPadrao);
        const newUid = userCred.user.uid;

        const docRef = await addDoc(collection(db, "professores"), { 
            nome, email, telefone, status, uidLogin: newUid, 
            createdAt: serverTimestamp(), createdBy: userId, roleCreator: role 
        });

        await setDoc(doc(db, "usuarios", newUid), {
          nome: nome, email: email, role: "professor", professorId: docRef.id,
          status: "ativo", criadoPor: userId
        });

        await signOut(secondaryAuth);

        const novoProf = { id: docRef.id, nome, email, telefone, status };
        setProfessores(prev => [novoProf, ...prev]);

        if (unidadeSelecionadaId) {
            const vincRef = await addDoc(collection(db, "vinculos"), {
                professorId: docRef.id,
                unidadeId: String(unidadeSelecionadaId),
                status: "ativo",
                createdAt: serverTimestamp()
            });
            setVinculos(prev => [...prev, { id: vincRef.id, professorId: docRef.id, unidadeId: String(unidadeSelecionadaId) }]);
        }

        setModalFormAberto(false);
      }
    } catch (e) { 
        if (e.code === 'auth/email-already-in-use') setErro("E-mail já cadastrado no Auth.");
        else setErro("Erro: " + e.message); 
    } finally { 
        if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
        setSalvando(false); 
    }
  }

  async function removerVinculo(idVinculo) {
      if (!confirm("Remover o professor desta unidade?")) return;
      try {
          await deleteDoc(doc(db, "vinculos", idVinculo));
          setVinculos(prev => prev.filter(v => v.id !== idVinculo));
      } catch (e) { alert("Erro ao remover vínculo"); }
  }

  async function excluirProfessorTotal(p) {
      if (!confirm(`ATENÇÃO: Excluir ${p.nome}?\nIsso removerá ele de TODAS as unidades.\n\nConfirmar?`)) return;
      try {
          await deleteDoc(doc(db, "professores", p.id));
          
          // Limpeza local
          setProfessores(prev => prev.filter(pf => pf.id !== p.id));
          setVinculos(prev => prev.filter(v => v.professorId !== p.id));

          // Limpeza remota
          const qV = query(collection(db, "vinculos"), where("professorId", "==", p.id));
          const snaps = await getDocs(qV);
          snaps.forEach(doc => deleteDoc(doc.ref));
      } catch (e) { alert("Erro ao excluir"); }
  }

  if (!podeVer) return null;

  return (
    <div className="p-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-red-600"/> Gestão de Professores
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
            Exibindo {professoresProcessados.length} professores carregados
            {loadingMais && <Loader2 className="w-3 h-3 animate-spin text-blue-500"/>}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Buscar nos carregados..." className="w-full pl-9 p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-600 outline-none shadow-sm" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            {podeEditar && (
                <button onClick={abrirFluxoNovo} className="px-4 py-2.5 bg-red-600 text-white rounded-lg font-bold shadow hover:bg-red-700 text-sm whitespace-nowrap transition-colors flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" /> Novo / Vincular
                </button>
            )}
        </div>
      </div>

      {/* TABELA - VISUAL ORIGINAL RESTAURADO */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm relative">
        {loading && <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-red-600"/></div>}
        
        <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs border-b border-slate-200 dark:border-slate-700">
                <tr>
                    <th className="p-4 w-24 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleOrdenar('status')}>
                        <div className="flex items-center gap-1">Status <SortIcon campo="status" /></div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleOrdenar('nome')}>
                        <div className="flex items-center gap-1">Professor <SortIcon campo="nome" /></div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleOrdenar('email')}>
                        <div className="flex items-center gap-1">Contato <SortIcon campo="email" /></div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => handleOrdenar('unidades')}>
                        <div className="flex items-center gap-1">Unidades (Vínculos) <SortIcon campo="unidades" /></div>
                    </th>
                    <th className="p-4 text-right">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {professoresProcessados.map(p => {
                    const units = getUnidadesVinculadas(p.id);
                    return (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="p-4">
                                <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase ${p.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {p.status}
                                </span>
                            </td>
                            <td className="p-4 font-bold text-slate-700 dark:text-slate-200">
                                {p.nome}
                            </td>
                            <td className="p-4">
                                <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> {p.email}</span>
                                    {p.telefone && <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {p.telefone}</span>}
                                </div>
                            </td>
                            <td className="p-4">
                                <div className="flex flex-wrap gap-2">
                                    {units.length > 0 ? units.map(u => (
                                        <span key={u.vinculoId} className="pl-2 pr-1 py-1 border dark:border-slate-600 rounded-md text-xs font-medium flex items-center gap-1 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                            {u.nome}
                                            {podeEditar && (
                                                <button onClick={() => removerVinculo(u.vinculoId)} className="p-0.5 hover:bg-red-200 rounded-full text-slate-400 hover:text-red-600 transition-colors" title="Remover da unidade">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </span>
                                    )) : <span className="text-slate-400 text-xs italic">Sem vínculos</span>}
                                    
                                    {podeEditar && (
                                        <button onClick={() => { setEmailVerificacao(p.email); setProfessorEncontrado(p); setUnidadeSelecionadaId(""); setModalVerificacaoAberto(true); }} className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="Vincular a outra unidade">
                                            <PlusCircle className="w-4 h-4"/>
                                        </button>
                                    )}
                                </div>
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => abrirEdicao(p)} className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                                        Editar
                                    </button>
                                    {podeExcluir && (
                                        <button onClick={() => excluirProfessorTotal(p)} className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center gap-1">
                                            <Trash2 className="w-3 h-3"/> Excluir
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )
                })}
                {professoresProcessados.length === 0 && !loading && (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-400">Nenhum professor encontrado.</td></tr>
                )}
            </tbody>
        </table>
      </div>

      {/* RODAPÉ DE PAGINAÇÃO (Economia de Leitura) */}
      {temMais && !busca && (
          <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-xs text-slate-400 mb-1">Carregando dados consome leituras. Use com sabedoria.</p>
              <div className="flex gap-2">
                  <button onClick={() => carregarMais(10)} disabled={loadingMais} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 shadow-sm flex items-center gap-2">
                      {loadingMais ? <Loader2 className="w-3 h-3 animate-spin"/> : <ArrowDown className="w-3 h-3"/>}
                      Carregar +10
                  </button>
                  <button onClick={() => carregarMais(50)} disabled={loadingMais} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 shadow-sm">
                      Carregar +50
                  </button>
                  <button onClick={() => carregarMais(1000)} disabled={loadingMais} className="px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 shadow-sm flex items-center gap-2 text-slate-600">
                      <DownloadCloud className="w-3 h-3"/> Carregar Todos
                  </button>
              </div>
          </div>
      )}

      {/* MODAL 1: FLUXO DE VERIFICAÇÃO */}
      {modalVerificacaoAberto && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <h3 className="font-bold text-slate-800 dark:text-white text-lg">Adicionar Professor</h3>
                      <p className="text-xs text-slate-500 mt-1">Verifique se o professor já existe na rede.</p>
                  </div>
                  
                  <div className="p-6 space-y-4">
                      {!professorEncontrado ? (
                          <form onSubmit={verificarEmail} className="space-y-4">
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">E-mail do Professor</label>
                                  <div className="flex gap-2">
                                      <input 
                                          type="email" 
                                          className="flex-1 p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500" 
                                          placeholder="professor@email.com"
                                          value={emailVerificacao}
                                          onChange={e => setEmailVerificacao(e.target.value)}
                                          autoFocus
                                      />
                                      <button type="submit" disabled={buscandoEmail} className="bg-blue-600 text-white px-4 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
                                          {buscandoEmail ? <Loader2 className="w-5 h-5 animate-spin"/> : <Search className="w-5 h-5"/>}
                                      </button>
                                  </div>
                              </div>
                              {erro && <p className="text-red-500 text-xs font-bold bg-red-50 p-2 rounded flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> {erro}</p>}
                          </form>
                      ) : (
                          <div className="space-y-4">
                              <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-start gap-3">
                                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                                  <div>
                                      <h4 className="font-bold text-green-800">Professor Encontrado!</h4>
                                      <p className="text-sm text-green-700 mt-1">{professorEncontrado.nome}</p>
                                      <p className="text-xs text-green-600">{professorEncontrado.email}</p>
                                  </div>
                              </div>
                              
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Vincular a qual unidade?</label>
                                  <select 
                                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-blue-500"
                                      value={unidadeSelecionadaId}
                                      onChange={e => setUnidadeSelecionadaId(e.target.value)}
                                      disabled={unidades.length === 1}
                                  >
                                      {unidades.length > 1 && <option value="">Selecione...</option>}
                                      {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                                  </select>
                              </div>

                              {erro && <p className="text-red-500 text-xs font-bold">{erro}</p>}
                              {sucesso && <p className="text-green-600 text-xs font-bold">{sucesso}</p>}

                              <button 
                                  onClick={vincularExistente} 
                                  disabled={salvando || !unidadeSelecionadaId}
                                  className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex justify-center items-center gap-2"
                              >
                                  {salvando ? <Loader2 className="w-5 h-5 animate-spin"/> : <> <LinkIcon className="w-5 h-5"/> Confirmar Vínculo </>}
                              </button>
                          </div>
                      )}
                  </div>

                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                      <button onClick={() => setModalVerificacaoAberto(false)} className="text-slate-500 font-bold text-xs uppercase hover:text-slate-700">Cancelar</button>
                      {!professorEncontrado && emailVerificacao && !buscandoEmail && (
                          <button onClick={() => abrirCadastroCompleto(emailVerificacao)} className="text-blue-600 font-bold text-xs uppercase hover:text-blue-800 flex items-center gap-1">
                              Não encontrado? Cadastrar Novo <ArrowRight className="w-3 h-3"/>
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* MODAL 2: FORMULÁRIO COMPLETO */}
      {modalFormAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="p-5 border-b bg-slate-50 dark:bg-slate-800">
                <h3 className="font-bold text-slate-800 dark:text-white text-lg">{profEditando ? "Editar Dados" : "Novo Cadastro"}</h3>
            </div>
            <form onSubmit={salvarProfessor} className="p-6 space-y-4">
                {erro && <div className="text-red-500 text-sm font-bold bg-red-50 p-2 rounded flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> {erro}</div>}
                
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail (Login)</label>
                    <input className="w-full p-2 border rounded bg-slate-100 text-slate-500" value={email} disabled={true} />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                    <input className="w-full p-2 border rounded" value={nome} onChange={e => setNome(e.target.value)} autoFocus placeholder="Nome do Professor" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
                        <input className="w-full p-2 border rounded" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                        <select className="w-full p-2 border rounded" value={status} onChange={e => setStatus(e.target.value)}>
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                        </select>
                    </div>
                </div>

                {!profEditando && (
                    <>
                        <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">
                            <strong>Nota:</strong> Senha padrão será <code>123456</code>.
                        </div>
                        {unidades.length > 0 && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vincular Automaticamente a:</label>
                                <select 
                                    className="w-full p-2 border rounded bg-white" 
                                    value={unidadeSelecionadaId} 
                                    onChange={e => setUnidadeSelecionadaId(e.target.value)}
                                >
                                    {unidades.length > 1 && <option value="">Selecione...</option>}
                                    {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                                </select>
                            </div>
                        )}
                    </>
                )}

                <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={() => setModalFormAberto(false)} className="px-4 py-2 border rounded text-slate-600 font-bold text-xs uppercase">Cancelar</button>
                    <button type="submit" disabled={salvando} className="px-6 py-2 bg-blue-600 text-white rounded font-bold text-xs uppercase hover:bg-blue-700">
                        {salvando ? <Loader2 className="w-4 h-4 animate-spin"/> : (profEditando ? "Salvar Alterações" : "Concluir Cadastro")}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}