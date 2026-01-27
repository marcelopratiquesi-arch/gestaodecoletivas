import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp, setDoc, writeBatch
} from "firebase/firestore";
// Auth imports (Instância secundária para não deslogar o admin)
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApp, deleteApp } from "firebase/app"; 
import { db } from "../../../services/firebase";
// ✅ CORREÇÃO AQUI: Adicionei 'Key' que estava faltando e causando a tela branca
import { Building2, MapPin, Edit2, Trash2, AlertTriangle, CheckCircle2, Loader2, User, Search, Mail, Lock, Globe, Key } from "lucide-react";

/* ================= LOCALIZAÇÕES ================= */
const LOCATIONS = {
  Brasil: [
    "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal",
    "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul",
    "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí",
    "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia",
    "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins"
  ],
  Argentina: [
    "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
    "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza",
    "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
    "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
  ],
  "Estados Unidos": [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
    "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
    "Wisconsin", "Wyoming"
  ]
};

export function UnidadesTab() {
  const { userData } = useAuth();
  
  // Roles e IDs
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);
  const userName = useMemo(() => userData?.nome || "Mentor", [userData]);

  // Dados
  const [unidades, setUnidades] = useState([]);
  const [mentores, setMentores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UX: Busca e Modais
  const [busca, setBusca] = useState("");
  const [modalUnidadeAberto, setModalUnidadeAberto] = useState(false);
  
  // Feedback
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Forms Unidade
  const [editando, setEditando] = useState(null);
  const [pais, setPais] = useState("Brasil");
  const [estado, setEstado] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [nome, setNome] = useState("");
  const [status, setStatus] = useState("ativa");

  // Forms Login
  const [emailLogin, setEmailLogin] = useState("");
  const [senhaLogin, setSenhaLogin] = useState("123456");

  const estadosDisponiveis = pais ? LOCATIONS[pais] || [] : [];

  // ================= EFEITOS =================

  useEffect(() => { if(role) carregarDados(); }, [role]);

  // Automação de E-mail (Blindada contra erros)
  useEffect(() => {
    // Só roda se NÃO estiver editando, se o modal estiver aberto e se tiver nome digitado
    if (!editando && modalUnidadeAberto && nome) {
      try {
        const slug = nome.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
          .replace(/[^a-z0-9]/g, ""); // Remove espaços e simbolos
        
        if (slug.length > 0) {
          setEmailLogin(`${slug}@pratique.com`);
        } else {
          setEmailLogin("");
        }
      } catch (error) {
        console.log("Aguardando digitação...");
      }
    }
  }, [nome, editando, modalUnidadeAberto]);

  async function carregarDados() {
    try {
      setLoading(true);
      const ref = collection(db, "unidades");
      // Mentor vê apenas as suas
      const q = role === "admin" ? ref : query(ref, where("mentorId", "==", userId));
      const snap = await getDocs(q);
      setUnidades(snap.docs.map(d => ({ id: d.id, ...d.data() })));

      if (role === "admin") {
        const qm = query(collection(db, "usuarios"), where("role", "==", "mentor"));
        const sm = await getDocs(qm);
        setMentores(sm.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  // ================= FILTRAGEM (BUSCA) =================
  const unidadesFiltradas = useMemo(() => {
    const termo = busca.toLowerCase();
    return unidades.filter(u => 
      (u.nome && u.nome.toLowerCase().includes(termo)) ||
      (u.estado && u.estado.toLowerCase().includes(termo)) ||
      (u.pais && u.pais.toLowerCase().includes(termo))
    );
  }, [unidades, busca]);

  // ================= AÇÕES DO CRUD =================

  function abrirNovaUnidade() {
    setEditando(null); 
    setPais("Brasil"); 
    setEstado(""); 
    setNome(""); 
    setStatus("ativa");
    
    // Configura Login Padrão
    setEmailLogin("");
    setSenhaLogin("123456");

    // Preencher automaticamente se for Mentor
    if (role === 'mentor') {
      setMentorId(userId);
    } else {
      setMentorId("");
    }

    setErro(""); setSucesso("");
    setModalUnidadeAberto(true);
  }

  function abrirEditarUnidade(u) {
    setEditando(u);
    // Garante que não é null para não quebrar
    setPais(u.pais || "Brasil");
    setEstado(u.estado || "");
    setNome(u.nome || ""); 
    setStatus(u.status || "ativa");
    setMentorId(u.mentorId || "");
    
    // Na edição, ocultamos login
    setEmailLogin(""); 
    setSenhaLogin("");

    setErro(""); setSucesso("");
    setModalUnidadeAberto(true);
  }

  async function salvarUnidade(e) {
    e.preventDefault();
    setErro(""); setSucesso("");
    setSalvando(true);

    if (!nome.trim()) { setSalvando(false); return setErro("Nome da unidade é obrigatório."); }
    if (!estado) { setSalvando(false); return setErro("Selecione um estado."); }
    if (!mentorId) { setSalvando(false); return setErro("Mentor é obrigatório."); }

    if (!editando) {
      if (!emailLogin.includes("@")) { setSalvando(false); return setErro("E-mail inválido."); }
      if (senhaLogin.length < 6) { setSalvando(false); return setErro("Senha mín. 6 dígitos."); }
    }

    let secondaryApp = null;

    try {
      if (editando) {
        // === MODO EDIÇÃO ===
        await updateDoc(doc(db, "unidades", editando.id), {
          pais, estado, nome: nome.trim(), status, mentorId, atualizadoEm: serverTimestamp()
        });
        setSucesso("Unidade atualizada!");
      } else {
        // === MODO CRIAÇÃO (Unidade + Login) ===
        // 1. Robô cria Auth
        secondaryApp = initializeApp(getApp().options, "SecondaryAppUnitCreate");
        const secondaryAuth = getAuth(secondaryApp);

        const userCred = await createUserWithEmailAndPassword(
          secondaryAuth, 
          emailLogin.trim().toLowerCase(), 
          senhaLogin
        );
        const newUid = userCred.user.uid;

        // 2. Admin cria Unidade
        const unidadeRef = await addDoc(collection(db, "unidades"), {
          pais, 
          estado, 
          nome: nome.trim(), 
          status, 
          mentorId, 
          uidLogin: newUid,
          email: emailLogin.trim().toLowerCase(), // Salva email na unidade para referência
          criadoPor: userId,
          criadoEm: serverTimestamp()
        });

        // 3. Admin cria Perfil de Usuário
        await setDoc(doc(db, "usuarios", newUid), {
          nome: nome.trim(),
          email: emailLogin.trim().toLowerCase(),
          role: "unidade",
          unidadeId: unidadeRef.id,
          status: "ativo",
          criadoPor: userId,
          criadoEm: serverTimestamp()
        });

        await signOut(secondaryAuth);
        setSucesso("Unidade e Acesso criados!");
      }
      
      await carregarDados();
      setTimeout(() => { setModalUnidadeAberto(false); setSucesso(""); }, 1000);

    } catch (e) { 
      console.error(e);
      if (e.code === 'auth/email-already-in-use') setErro("E-mail já existe.");
      else if (e.code === 'permission-denied') setErro("Erro de permissão.");
      else setErro("Erro: " + e.message); 
    } finally { 
      if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
      setSalvando(false); 
    }
  }

  async function excluir(u) {
    if(!window.confirm(`ATENÇÃO: Excluir a unidade "${u.nome}" apagará também o login.\n\nConfirmar exclusão?`)) return;
    try {
        setLoading(true);
        const qUsers = query(collection(db, "usuarios"), where("unidadeId", "==", u.id));
        const snapUsers = await getDocs(qUsers);
        
        const batch = writeBatch(db);
        batch.delete(doc(db, "unidades", u.id));
        snapUsers.forEach((userDoc) => batch.delete(userDoc.ref));
        
        await batch.commit();
        setUnidades(prev => prev.filter(unit => unit.id !== u.id));
    } catch (e) { alert("Erro ao excluir: " + e.message); } finally { setLoading(false); }
  }

  return (
    <div className="p-6 animate-fade-in">
      
      {/* === HEADER COM BUSCA === */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-red-600"/> Gestão de Unidades
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {unidadesFiltradas.length} unidades cadastradas
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* BARRA DE BUSCA */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar unidade, estado..." 
              className="w-full pl-9 p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-600 outline-none shadow-sm"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          <button onClick={abrirNovaUnidade} className="px-4 py-2.5 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-md whitespace-nowrap transition-colors">
            + Nova Unidade
          </button>
        </div>
      </div>

      {/* === TABELA === */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="p-4 w-24">Status</th>
              <th className="p-4">Unidade</th>
              <th className="p-4">Local</th>
              <th className="p-4">Responsável</th>
              <th className="p-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {unidadesFiltradas.map(u => (
              <tr key={u.id} className={`transition-colors ${u.status === 'inativa' ? 'bg-slate-50 dark:bg-slate-900/30 opacity-75 grayscale-[0.5]' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                
                {/* 1. STATUS */}
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${u.status === 'ativa' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {u.status}
                  </span>
                </td>

                {/* 2. UNIDADE */}
                <td className="p-4">
                  <div className="font-bold text-slate-800 dark:text-white text-base">{u.nome}</div>
                  {u.email && (
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{u.email}</div>
                  )}
                </td>

                {/* 3. LOCAL */}
                <td className="p-4">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-red-500"/> {u.estado}
                  </div>
                  <div className="text-xs text-slate-400 pl-5">{u.pais}</div>
                </td>

                {/* 4. RESPONSÁVEL */}
                <td className="p-4">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs font-medium bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg w-fit">
                    <User className="w-3 h-3"/>
                    {role === "admin" ? (mentores.find(m=>m.id===u.mentorId)?.nome || "Mentor") : "Você"}
                  </div>
                </td>
                
                {/* 5. AÇÕES */}
                <td className="p-4 text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => abrirEditarUnidade(u)}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => excluir(u)}
                      className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {unidadesFiltradas.length === 0 && !loading && (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center">
              <Search className="w-12 h-12 mb-3 opacity-20"/>
              <p>Nenhuma unidade encontrada.</p>
            </div>
        )}
      </div>

      {/* === MODAL UNIFICADO === */}
      {modalUnidadeAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-700 animate-fade-in max-h-[90vh] overflow-y-auto ${editando ? 'max-w-md' : 'max-w-2xl'}`}>
            
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg">
                {editando ? <Edit2 className="w-5 h-5 text-blue-500"/> : <Building2 className="w-5 h-5 text-red-600"/>}
                {editando ? "Editar Unidade" : "Nova Unidade"}
              </h3>
            </div>
            
            <form onSubmit={salvarUnidade} className="p-6 space-y-6">
              
              {erro && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-800 flex items-center gap-2"><AlertTriangle className="w-5 h-5 flex-shrink-0"/> {erro}</div>}
              {sucesso && <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 text-sm rounded-lg border border-green-100 dark:border-green-800 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 flex-shrink-0"/> {sucesso}</div>}

              {/* Layout Dinâmico: 1 Coluna se Editar, 2 Colunas se Criar */}
              <div className={`grid grid-cols-1 ${!editando ? 'md:grid-cols-2' : ''} gap-6`}>
                
                {/* BLOCO 1: DADOS DA UNIDADE */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-1 mb-2 flex items-center gap-2">
                      <Globe className="w-3 h-3"/> Localização
                    </h4>
                    <div className={`grid ${!editando ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2'} gap-4`}>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">País</label>
                            <select value={pais} onChange={e=>{setPais(e.target.value); setEstado("")}} className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none">
                                {Object.keys(LOCATIONS).map(k=><option key={k}>{k}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Estado</label>
                            <select value={estado} onChange={e=>setEstado(e.target.value)} className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none">
                                <option value="">Selecione...</option>
                                {estadosDisponiveis.map(e=><option key={e}>{e}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="pt-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Nome da Unidade</label>
                        <input 
                          value={nome} 
                          onChange={e=>setNome(e.target.value)} 
                          className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none" 
                          placeholder="Ex: Barreiro" 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Mentor</label>
                            {role === 'admin' ? (
                            <select value={mentorId} onChange={e=>setMentorId(e.target.value)} className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none">
                                    <option value="">Selecione...</option>
                                    {mentores.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                                </select>
                            ) : (
                            <div className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 flex items-center gap-2 font-medium text-sm">
                                <User className="w-4 h-4"/> {userName}
                            </div>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Status</label>
                            <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none">
                                <option value="ativa">Ativa</option>
                                <option value="inativa">Inativa</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* BLOCO 2: DADOS DE ACESSO (SÓ APARECE AO CRIAR) */}
                {/* ✅ Key já importado lá em cima */}
                {!editando && (
                    <div className="space-y-4 border-l border-slate-100 dark:border-slate-700 pl-0 md:pl-6 md:border-l">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-1 mb-2 flex items-center gap-2">
                        <Key className="w-3 h-3"/> Acesso Automático
                        </h4>
                        
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                Credenciais geradas:
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Mail className="w-3 h-3"/> Login</label>
                                <input disabled value={emailLogin} className="w-full p-2 text-sm border-none bg-white dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300 font-mono shadow-sm" placeholder="Aguardando nome..." />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Lock className="w-3 h-3"/> Senha Padrão</label>
                                <input disabled value={senhaLogin} className="w-full p-2 text-sm border-none bg-white dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300 font-mono shadow-sm" />
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">
                            * O login é criado automaticamente. A senha pode ser alterada depois.
                        </p>
                    </div>
                )}

              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={()=>setModalUnidadeAberto(false)} className="px-6 py-2.5 border dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-sm transition-colors">Cancelar</button>
                <button type="submit" disabled={salvando} className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-lg shadow-red-900/20 flex items-center gap-2 text-sm transition-transform active:scale-95">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : (editando ? "Salvar Alterações" : "Criar Unidade")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}