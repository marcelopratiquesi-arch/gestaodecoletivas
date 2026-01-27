import { useEffect, useMemo, useState } from "react";
// Importações de contexto e serviços
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../services/firebase";
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, orderBy, limit, setDoc
} from "firebase/firestore";
// Auth Imports
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApp, deleteApp } from "firebase/app"; 
// Ícones (ADICIONADO AlertTriangle QUE FALTAVA)
import { 
  UserPlus, Edit2, Trash2, Link as LinkIcon, Loader2, Search, CheckCircle2, 
  X, Mail, Phone, PlusCircle, Key, Lock, User, ArrowRight, AlertTriangle 
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

  // ===== STATES =====
  const [professores, setProfessores] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [vinculos, setVinculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

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

  useEffect(() => { if (podeVer) carregarTudo(); }, [podeVer, role, userId, userUnidadeId]);

  // --- CARREGAMENTO ---
  async function carregarTudo() {
    try {
      setLoading(true);
      
      // 1. Unidades
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

      // 2. Vínculos e Professores
      const [snapProf, snapVinculos] = await Promise.all([
        getDocs(query(collection(db, "professores"), orderBy("nome"))),
        getDocs(collection(db, "vinculos"))
      ]);

      setProfessores(snapProf.docs.map(d => ({ id: d.id, ...d.data() })));
      setVinculos(snapVinculos.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (e) { console.error(e); setErro("Erro ao carregar dados."); } finally { setLoading(false); }
  }

  // --- FILTRO DE VISIBILIDADE ---
  const professoresVisiveis = useMemo(() => {
    const termo = busca.toLowerCase();
    
    // Se Admin, vê tudo
    if (role === "admin") {
        return professores.filter(p => p.nome.toLowerCase().includes(termo) || p.email.toLowerCase().includes(termo));
    }
    
    // Se Mentor/Unidade, vê apenas professores vinculados às suas unidades
    const minhasUnidadesIds = unidades.map(u => String(u.id));
    const meusVinculos = vinculos.filter(v => minhasUnidadesIds.includes(String(v.unidadeId)));
    const idsMeusProfs = meusVinculos.map(v => v.professorId);
    
    return professores.filter(p => {
        const vinculadoAComigo = idsMeusProfs.includes(p.id);
        const matchBusca = p.nome.toLowerCase().includes(termo) || p.email.toLowerCase().includes(termo);
        return vinculadoAComigo && matchBusca;
    });
  }, [professores, vinculos, unidades, role, busca]);

  // --- PASSO 1: INÍCIO DO FLUXO (VERIFICAÇÃO) ---
  function abrirFluxoNovo() {
      setEmailVerificacao("");
      setProfessorEncontrado(null);
      setErro("");
      // Se tiver só uma unidade (ex: logado como unidade), já seleciona ela
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
          // Busca GLOBAL para evitar duplicidade
          const q = query(collection(db, "professores"), where("email", "==", emailVerificacao.trim().toLowerCase()));
          const snap = await getDocs(q);

          if (!snap.empty) {
              const prof = { id: snap.docs[0].id, ...snap.docs[0].data() };
              setProfessorEncontrado(prof);
          } else {
              // Não existe, liberar cadastro
              abrirCadastroCompleto(emailVerificacao);
          }
      } catch (err) {
          setErro("Erro na verificação.");
      } finally {
          setBuscandoEmail(false);
      }
  }

  // --- PASSO 2A: VINCULAR EXISTENTE ---
  async function vincularExistente() {
      if (!unidadeSelecionadaId) return setErro("Selecione uma unidade.");
      
      setSalvando(true);
      try {
          // Checa duplicidade de vínculo
          const jaVinculado = vinculos.some(v => 
              String(v.professorId) === String(professorEncontrado.id) && 
              String(v.unidadeId) === String(unidadeSelecionadaId)
          );

          if (jaVinculado) {
              setSalvando(false);
              return setErro("Este professor já está vinculado a esta unidade.");
          }

          await addDoc(collection(db, "vinculos"), {
              professorId: professorEncontrado.id,
              unidadeId: String(unidadeSelecionadaId),
              status: "ativo",
              createdAt: serverTimestamp()
          });

          setSucesso("Vinculado com sucesso!");
          await carregarTudo();
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

  // --- PASSO 2B: CADASTRAR NOVO ---
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
          // --- MODO EDIÇÃO ---
          await updateDoc(doc(db, "professores", profEditando.id), { 
            nome, telefone, status, updatedAt: serverTimestamp() 
          });
          
          if (profEditando.uidLogin) {
             try { await updateDoc(doc(db, "usuarios", profEditando.uidLogin), { nome }); } catch(err) {}
          }

          setModalFormAberto(false);
          await carregarTudo();

      } else { 
        // --- MODO CRIAÇÃO ---
        
        // 1. Auth
        secondaryApp = initializeApp(getApp().options, "SecondaryAppProfCreate");
        const secondaryAuth = getAuth(secondaryApp);
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, senhaPadrao);
        const newUid = userCred.user.uid;

        // 2. Doc Professor
        const docRef = await addDoc(collection(db, "professores"), { 
            nome, email, telefone, status, uidLogin: newUid, 
            createdAt: serverTimestamp(), createdBy: userId, roleCreator: role 
        });

        // 3. Doc Usuário
        await setDoc(doc(db, "usuarios", newUid), {
          nome: nome, email: email, role: "professor", professorId: docRef.id,
          status: "ativo", criadoPor: userId
        });

        await signOut(secondaryAuth);

        // 4. Vínculo Automático (Se tiver unidade selecionada no passo anterior)
        if (unidadeSelecionadaId) {
            await addDoc(collection(db, "vinculos"), {
                professorId: docRef.id,
                unidadeId: String(unidadeSelecionadaId),
                status: "ativo",
                createdAt: serverTimestamp()
            });
        }

        setModalFormAberto(false);
        await carregarTudo();
      }
    } catch (e) { 
        console.error(e);
        if (e.code === 'auth/email-already-in-use') setErro("E-mail já cadastrado no Auth.");
        else setErro("Erro: " + e.message); 
    } finally { 
        if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
        setSalvando(false); 
    }
  }

  // --- REMOÇÃO ---
  async function removerVinculo(idVinculo) {
      if (!confirm("Remover o professor desta unidade?")) return;
      try {
          await deleteDoc(doc(db, "vinculos", idVinculo));
          await carregarTudo();
      } catch (e) { alert("Erro ao remover vínculo"); }
  }

  async function excluirProfessorTotal(p) {
      if (!confirm(`ATENÇÃO: Excluir ${p.nome}?\nIsso removerá ele de TODAS as unidades.\n\nConfirmar?`)) return;
      try {
          await deleteDoc(doc(db, "professores", p.id));
          // Remove Vínculos Órfãos
          const vins = vinculos.filter(v => v.professorId === p.id);
          for (const v of vins) await deleteDoc(doc(db, "vinculos", v.id));
          
          await carregarTudo();
      } catch (e) { alert("Erro ao excluir"); }
  }

  // Helper de Exibição
  function getUnidadesVinculadas(profId) {
      const links = vinculos.filter(v => v.professorId === profId);
      return links.map(v => {
          const u = unidades.find(uni => String(uni.id) === String(v.unidadeId));
          // Só mostra se eu tiver permissão de ver a unidade (ou se for admin)
          return u ? { id: v.id, nome: u.nome } : null;
      }).filter(Boolean);
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
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {professoresVisiveis.length} professores na sua visão
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Buscar..." className="w-full pl-9 p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-600 outline-none shadow-sm" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            {podeEditar && (
                <button onClick={abrirFluxoNovo} className="px-4 py-2.5 bg-red-600 text-white rounded-lg font-bold shadow hover:bg-red-700 text-sm whitespace-nowrap transition-colors flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" /> Novo / Vincular
                </button>
            )}
        </div>
      </div>

      {/* TABELA */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs border-b border-slate-200 dark:border-slate-700">
                <tr>
                    <th className="p-4 w-24">Status</th>
                    <th className="p-4">Professor</th>
                    <th className="p-4">Contato</th>
                    <th className="p-4">Unidades (Vínculos)</th>
                    <th className="p-4 text-right">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {professoresVisiveis.map(p => {
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
                                    <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {p.telefone || "-"}</span>
                                </div>
                            </td>
                            <td className="p-4">
                                <div className="flex flex-wrap gap-2">
                                    {units.map(u => (
                                        <span key={u.id} className="pl-2 pr-1 py-1 border dark:border-slate-600 rounded-md text-xs font-medium flex items-center gap-1 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                            {u.nome}
                                            {podeEditar && (
                                                <button onClick={() => removerVinculo(u.id)} className="p-0.5 hover:bg-red-200 rounded-full text-slate-400 hover:text-red-600 transition-colors">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                    {/* Botão rápido para adicionar vínculo */}
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
                                        <button onClick={() => excluirProfessorTotal(p)} className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                                            Excluir
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )
                })}
                {professoresVisiveis.length === 0 && !loading && (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-400">Nenhum professor encontrado.</td></tr>
                )}
            </tbody>
        </table>
      </div>

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
            <div className="p-5 border-b bg-slate-50">
                <h3 className="font-bold text-slate-800 text-lg">{profEditando ? "Editar Dados" : "Novo Cadastro"}</h3>
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