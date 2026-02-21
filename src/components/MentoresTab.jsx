import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where
} from "firebase/firestore";

// Importações para o truque da Instância Secundária (Vital para não deslogar o Admin)
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApp, deleteApp } from "firebase/app"; 
import { db } from "../services/firebase";

// TODOS OS ÍCONES IMPORTADOS CORRETAMENTE AQUI (INCLUINDO O 'X' E O 'User')
import { 
    ShieldCheck, UserPlus, Edit2, Trash2, CheckCircle2, Ban, 
    Loader2, AlertTriangle, Search, ChevronDown, ChevronUp, Users, X, User 
} from "lucide-react"; 

export function MentoresTab() {
  const { userData } = useAuth();
  
  // Blindagem de role
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const podeAcessar = role === "admin"; // Apenas Admin mexe em Mentores
  const criadoPor = userData?.id || userData?.uid;

  // Estados de Dados em Tempo Real
  const [mentoresBase, setMentoresBase] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Filtro e Ordenação
  const [busca, setBusca] = useState("");
  const [sortConfig, setSortConfig] = useState({ field: 'nome', direction: 'asc' });

  // Modais e Estados
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Form
  const [mentorEditando, setMentorEditando] = useState(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [status, setStatus] = useState("ativo");

  // ==========================================
  // 1. MOTOR DE TEMPO REAL (Velocidade da Luz)
  // ==========================================
  useEffect(() => { 
    if (!podeAcessar) return;
    
    setLoading(true);
    const q = query(collection(db, "usuarios"), where("role", "==", "mentor"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setMentoresBase(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
    }, (error) => {
        console.error("Erro no tempo real:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [podeAcessar]);

  // ==========================================
  // 2. PROCESSADOR DE BUSCA E ORDENAÇÃO
  // ==========================================
  const mentoresProcessados = useMemo(() => {
      let resultado = mentoresBase;

      // Filtro de Busca
      if (busca.trim()) {
          const termo = busca.toLowerCase();
          resultado = resultado.filter(m => 
              (m.nome || "").toLowerCase().includes(termo) || 
              (m.email || "").toLowerCase().includes(termo)
          );
      }

      // Ordenação
      return resultado.sort((a, b) => {
          let valA = (a[sortConfig.field] || "").toLowerCase();
          let valB = (b[sortConfig.field] || "").toLowerCase();
          
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [mentoresBase, busca, sortConfig]);

  const handleSort = (field) => {
      setSortConfig(prev => ({
          field,
          direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  // ==========================================
  // 3. KPIs E MÉTRICAS
  // ==========================================
  const kpis = useMemo(() => {
      const ativos = mentoresBase.filter(m => m.status === 'ativo').length;
      const inativos = mentoresBase.filter(m => m.status !== 'ativo').length;
      return { total: mentoresBase.length, ativos, inativos };
  }, [mentoresBase]);

  // ==========================================
  // 4. AÇÕES DE BANCO DE DADOS
  // ==========================================
  async function alternarStatus(m) {
    const novoStatus = m.status === 'ativo' ? 'inativo' : 'ativo';
    try {
        await updateDoc(doc(db, "usuarios", m.id), { status: novoStatus });
    } catch (e) { 
        alert("Erro ao mudar status"); 
    }
  }

  async function excluir(m) {
      if(!window.confirm(`Tem certeza que deseja excluir permanentemente o mentor ${m.nome}?`)) return;
      try {
          await deleteDoc(doc(db, "usuarios", m.id));
      } catch (e) { 
          alert("Erro ao excluir"); 
      }
  }

  // --- MODAIS ---
  function abrirModalNovo() {
    setMentorEditando(null); 
    setNome(""); 
    setEmail(""); 
    setSenha("123456"); 
    setStatus("ativo");
    setErro(""); 
    setSucesso("");
    setModalAberto(true);
  }

  function abrirModalEditar(m) {
    setMentorEditando(m); 
    setNome(m.nome); 
    setEmail(m.email); 
    setSenha(""); 
    setStatus(m.status || "ativo");
    setErro(""); 
    setSucesso("");
    setModalAberto(true);
  }

  // --- SALVAR SEM DESLOGAR ---
  async function salvar(e) {
    e.preventDefault();
    setSalvando(true); 
    setErro("");
    setSucesso("");

    if (!email.includes("@") || !nome.trim()) {
        setSalvando(false);
        return setErro("Preencha nome e email corretamente.");
    }

    let secondaryApp = null;

    try {
      if (mentorEditando) {
        await updateDoc(doc(db, "usuarios", mentorEditando.id), { 
            nome: nome.trim(), 
            status 
        });
        setSucesso("Mentor atualizado!");
      } else {
        if (senha.length < 6) throw new Error("Senha deve ter no mínimo 6 caracteres.");

        secondaryApp = initializeApp(getApp().options, "SecondaryAppMentor");
        const secondaryAuth = getAuth(secondaryApp);

        const userCred = await createUserWithEmailAndPassword(secondaryAuth, email.trim().toLowerCase(), senha);
        
        await setDoc(doc(db, "usuarios", userCred.user.uid), {
          nome: nome.trim(), 
          email: email.trim().toLowerCase(), 
          role: "mentor", 
          status, 
          criadoPor, 
          criadoEm: serverTimestamp()
        });

        await signOut(secondaryAuth);
        setSucesso("Mentor criado com sucesso!");
      }

      setTimeout(() => {
          setModalAberto(false);
          setSucesso("");
      }, 1500);

    } catch (e) { 
        console.error(e);
        if (e.code === 'auth/email-already-in-use') setErro("Este email já está cadastrado.");
        else setErro("Erro: " + e.message); 
    } finally { 
        if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
        setSalvando(false); 
    }
  }

  const SortIcon = ({ field }) => {
      if (sortConfig.field !== field) return <div className="w-4 h-4 opacity-20"><ChevronDown className="w-3 h-3"/></div>;
      return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-red-500"/> : <ChevronDown className="w-3 h-3 text-red-500"/>;
  };

  if (!podeAcessar) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Acesso Restrito</div>;

  return (
    <div className="p-6 animate-fade-in max-w-7xl mx-auto space-y-6">
      
      {/* HEADER E KPIS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <span className="p-2 bg-red-600 text-white rounded-lg shadow-md shadow-red-500/20">
                <ShieldCheck className="w-6 h-6"/>
            </span>
            Gestão de Mentores
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
              Controle de acesso e status dos administradores regionais.
          </p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                    <p className="text-lg font-black text-slate-700 dark:text-white leading-none">{kpis.total}</p>
                </div>
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ativos</p>
                    <p className="text-lg font-black text-green-600 leading-none">{kpis.ativos}</p>
                </div>
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inativos</p>
                    <p className="text-lg font-black text-red-500 leading-none">{kpis.inativos}</p>
                </div>
            </div>
            
            <button 
                onClick={abrirModalNovo} 
                className="px-5 py-2 h-full bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-red-700 shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
                <UserPlus className="w-4 h-4"/> Novo Mentor
            </button>
        </div>
      </div>

      {/* BARRA DE FERRAMENTAS (BUSCA) */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-red-500 transition-colors"/>
              <input 
                  type="text" 
                  placeholder="Buscar por nome ou e-mail..." 
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 shadow-sm transition-all text-slate-700 dark:text-white"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
              />
          </div>
      </div>

      {/* MENSAGENS DE SISTEMA */}
      {erro && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <AlertTriangle className="w-5 h-5"/> {erro}
          </div>
      )}
      {sucesso && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-700 text-sm font-bold rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5"/> {sucesso}
          </div>
      )}

      {/* TABELA DE MENTORES */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <tr>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-24" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-2">Status <SortIcon field="status"/></div>
                </th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('nome')}>
                    <div className="flex items-center gap-2">Nome Completo <SortIcon field="nome"/></div>
                </th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('email')}>
                    <div className="flex items-center gap-2">Email de Acesso <SortIcon field="email"/></div>
                </th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
                {loading ? (
                    <tr>
                        <td colSpan="4" className="p-10 text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-red-500 mx-auto mb-2"/>
                            <p className="text-slate-400 font-bold">Carregando mentores...</p>
                        </td>
                    </tr>
                ) : mentoresProcessados.length === 0 ? (
                    <tr>
                        <td colSpan="4" className="p-10 text-center text-slate-400 font-bold">
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-20"/> Nenhum mentor encontrado.
                        </td>
                    </tr>
                ) : (
                    mentoresProcessados.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                        <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border ${m.status === 'ativo' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                            {m.status === 'ativo' ? <CheckCircle2 className="w-3 h-3"/> : <Ban className="w-3 h-3"/>} {m.status}
                        </span>
                        </td>
                        <td className="p-4 font-bold text-slate-700 dark:text-slate-200 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-[10px] font-black text-slate-500 dark:text-slate-400">
                                {m.nome ? (m.nome[0] + (m.nome.split(' ').pop()?.[0] || '')).toUpperCase() : '??'}
                            </div>
                            {m.nome || "-"}
                        </td>
                        <td className="p-4 text-slate-500 dark:text-slate-400 font-medium">{m.email || "-"}</td>
                        
                        <td className="p-4">
                            <div className="flex gap-2 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => abrirModalEditar(m)} 
                                    className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white transition-colors" 
                                    title="Editar Mentor"
                                >
                                    <Edit2 className="w-4 h-4"/>
                                </button>
                                
                                <button 
                                    onClick={() => alternarStatus(m)} 
                                    className={`p-2 rounded-lg transition-colors ${m.status === "ativo" ? "bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white dark:bg-orange-900/30 dark:text-orange-400" : "bg-green-50 text-green-600 hover:bg-green-500 hover:text-white dark:bg-green-900/30 dark:text-green-400"}`} 
                                    title={m.status === "ativo" ? "Desativar" : "Ativar"}
                                >
                                    {m.status === "ativo" ? <Ban className="w-4 h-4"/> : <CheckCircle2 className="w-4 h-4"/>}
                                </button>
                                
                                <button 
                                    onClick={() => excluir(m)} 
                                    className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white transition-colors" 
                                    title="Excluir Definitivamente"
                                >
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            </div>
                        </td>
                    </tr>
                    ))
                )}
            </tbody>
            </table>
        </div>
      </div>

      {/* MODAL CADASTRAR/EDITAR */}
      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
              <div>
                  <h3 className="font-black text-xl text-slate-800 dark:text-white">{mentorEditando ? "Editar Mentor" : "Novo Mentor"}</h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Preencha os dados e clique em salvar.</p>
              </div>
              <button onClick={() => setModalAberto(false)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-red-500">
                  <X className="w-5 h-5"/>
              </button>
            </div>

            <form onSubmit={salvar} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Nome Completo</label>
                <div className="relative">
                    <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                    <input 
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-red-500 rounded-xl text-sm font-semibold outline-none transition-all dark:text-white" 
                        value={nome} 
                        onChange={(e) => setNome(e.target.value)} 
                        placeholder="Ex: João da Silva"
                    />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Email de Acesso</label>
                <input 
                    type="email" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-red-500 rounded-xl text-sm font-semibold outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed dark:text-white" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    disabled={!!mentorEditando} 
                    placeholder="mentor@pratique.com" 
                />
                {mentorEditando && (
                    <p className="text-[10px] font-bold text-slate-400 mt-1.5 pl-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3"/> O email de login não pode ser alterado.
                    </p>
                )}
              </div>

              {!mentorEditando && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Senha Inicial</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-red-500 rounded-xl text-sm font-semibold outline-none transition-all dark:text-white" 
                    value={senha} 
                    onChange={(e) => setSenha(e.target.value)} 
                    placeholder="Mínimo de 6 caracteres"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Status da Conta</label>
                <div className="relative">
                    <select 
                        className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white" 
                        value={status} 
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="ativo">✅ CONTA ATIVA</option>
                        <option value="inativo">🚫 CONTA INATIVA</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 shrink-0 mt-6">
                <button 
                    type="button" 
                    onClick={() => setModalAberto(false)} 
                    className="px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                    Cancelar
                </button>
                <button 
                    type="submit" 
                    disabled={salvando} 
                    className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-red-500/30 hover:bg-red-700 hover:shadow-red-500/50 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:transform-none"
                >
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4" />} Salvar Mentor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}