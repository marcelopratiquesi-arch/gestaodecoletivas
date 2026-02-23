import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp, setDoc, writeBatch, onSnapshot, getDocs
} from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApp, deleteApp } from "firebase/app"; 
import { db } from "../../../services/firebase";

// Adicionado o ícone "Check" para confirmar a edição inline do telefone
import { 
    Building2, MapPin, Edit2, Trash2, AlertTriangle, CheckCircle2, 
    Loader2, User, Search, Mail, Lock, Globe, Key, ChevronDown, ChevronUp, Ban, PowerOff, Plus, X, Phone, Check
} from "lucide-react";

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

// ==========================================
// MÁSCARA INTELIGENTE DE TELEFONE
// ==========================================
const formatarTelefone = (valor, pais) => {
    if (!valor) return "";
    let v = valor.replace(/\D/g, ''); // Remove tudo que não é número
    
    if (pais === 'Brasil') {
        if (v.startsWith('55')) v = v.slice(2);
        v = v.slice(0, 11); // Max 11 digitos
        if (v.length > 2) v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
        if (v.length > 7) v = v.replace(/(\d{5})(\d)/, '$1-$2');
        return v ? `+55 ${v}` : '';
    } 
    else if (pais === 'Estados Unidos') {
        if (v.startsWith('1')) v = v.slice(1);
        v = v.slice(0, 10);
        if (v.length > 3) v = v.replace(/^(\d{3})(\d)/g, '($1) $2');
        if (v.length > 6) v = v.replace(/(\d{3})(\d)/, '$1-$2');
        return v ? `+1 ${v}` : '';
    } 
    else if (pais === 'Argentina') {
        if (v.startsWith('54')) v = v.slice(2);
        if (v.startsWith('9')) v = v.slice(1);
        v = v.slice(0, 10);
        if (v.length > 2) v = v.replace(/^(\d{2})(\d)/g, '$1 $2');
        if (v.length > 6) v = v.replace(/(\d{4})(\d)/, '$1-$2');
        return v ? `+54 9 ${v}` : '';
    }
    return valor;
};

export function UnidadesTab() {
  const { userData } = useAuth();
  
  // Roles e IDs
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);
  const userName = useMemo(() => userData?.nome || "Mentor", [userData]);

  // Cadeado de Permissão
  const podeAcessar = role === "admin" || role === "mentor";

  // Dados em Tempo Real
  const [unidadesBase, setUnidadesBase] = useState([]);
  const [mentores, setMentores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UX: Busca, Filtros e Ordenação
  const [busca, setBusca] = useState("");
  const [sortConfig, setSortConfig] = useState({ field: 'nome', direction: 'asc' });
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
  const [telefone, setTelefone] = useState("");
  const [status, setStatus] = useState("ativa");

  // Edição Inline do Telefone na Tabela
  const [editandoTelefoneId, setEditandoTelefoneId] = useState(null);
  const [telefoneInline, setTelefoneInline] = useState("");

  // Forms Login
  const [emailLogin, setEmailLogin] = useState("");
  const [senhaLogin, setSenhaLogin] = useState("123456");

  const estadosDisponiveis = pais ? LOCATIONS[pais] || [] : [];

  // ==========================================
  // 1. MOTOR DE TEMPO REAL
  // ==========================================
  useEffect(() => { 
    if (!podeAcessar) return;

    setLoading(true);
    
    const ref = collection(db, "unidades");
    const qUnidades = role === "admin" ? ref : query(ref, where("mentorId", "==", userId));
    
    const unsubUnidades = onSnapshot(qUnidades, (snap) => {
        setUnidadesBase(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
    }, (error) => {
        console.error("Erro no tempo real de unidades:", error);
        setLoading(false);
    });

    let unsubMentores = () => {};
    if (role === "admin") {
        const qm = query(collection(db, "usuarios"), where("role", "==", "mentor"));
        unsubMentores = onSnapshot(qm, (snap) => {
            setMentores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }

    return () => {
        unsubUnidades();
        unsubMentores();
    };
  }, [role, userId, podeAcessar]);

  // Automação de E-mail
  useEffect(() => {
    if (!editando && modalUnidadeAberto && nome) {
      try {
        const slug = nome.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
          .replace(/[^a-z0-9]/g, ""); 
        
        if (slug.length > 0) setEmailLogin(`${slug}@pratique.com`);
        else setEmailLogin("");
      } catch (error) {
        console.log("Aguardando digitação...");
      }
    }
  }, [nome, editando, modalUnidadeAberto]);

  // ==========================================
  // 2. PROCESSADOR DE BUSCA E ORDENAÇÃO
  // ==========================================
  const unidadesProcessadas = useMemo(() => {
      let resultado = unidadesBase;

      if (busca.trim()) {
          const termo = busca.toLowerCase();
          resultado = resultado.filter(u => 
              (u.nome || "").toLowerCase().includes(termo) ||
              (u.email || "").toLowerCase().includes(termo) ||
              (u.estado || "").toLowerCase().includes(termo) ||
              (u.pais || "").toLowerCase().includes(termo) ||
              (u.telefone || "").toLowerCase().includes(termo)
          );
      }

      return resultado.sort((a, b) => {
          let valA = (a[sortConfig.field] || "").toLowerCase();
          let valB = (b[sortConfig.field] || "").toLowerCase();
          
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [unidadesBase, busca, sortConfig]);

  const handleSort = (field) => {
      setSortConfig(prev => ({
          field,
          direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const SortIcon = ({ field }) => {
      if (sortConfig.field !== field) return <div className="w-4 h-4 opacity-20"><ChevronDown className="w-3 h-3"/></div>;
      return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-red-500"/> : <ChevronDown className="w-3 h-3 text-red-500"/>;
  };

  const kpis = useMemo(() => {
      const ativas = unidadesBase.filter(u => u.status === 'ativa').length;
      const inativas = unidadesBase.filter(u => u.status !== 'ativa').length;
      return { total: unidadesBase.length, ativas, inativas };
  }, [unidadesBase]);

  // ==========================================
  // 4. AÇÕES DE BANCO DE DADOS (CRUD)
  // ==========================================
  function abrirNovaUnidade() {
    setEditando(null); 
    setPais("Brasil"); 
    setEstado(""); 
    setNome(""); 
    setTelefone(""); 
    setStatus("ativa");
    
    setEmailLogin("");
    setSenhaLogin("123456");

    if (role === 'mentor') setMentorId(userId);
    else setMentorId("");

    setErro(""); setSucesso("");
    setModalUnidadeAberto(true);
  }

  function abrirEditarUnidade(u) {
    setEditando(u);
    setPais(u.pais || "Brasil");
    setEstado(u.estado || "");
    setNome(u.nome || ""); 
    setTelefone(u.telefone || ""); 
    setStatus(u.status || "ativa");
    setMentorId(u.mentorId || "");
    
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
    if (!telefone.trim()) { setSalvando(false); return setErro("O Telefone (WhatsApp) é obrigatório."); }
    if (!estado) { setSalvando(false); return setErro("Selecione um estado."); }
    if (!mentorId) { setSalvando(false); return setErro("Mentor é obrigatório."); }

    if (!editando) {
      if (!emailLogin.includes("@")) { setSalvando(false); return setErro("E-mail inválido."); }
      if (senhaLogin.length < 6) { setSalvando(false); return setErro("Senha mín. 6 dígitos."); }
    }

    let secondaryApp = null;

    try {
      if (editando) {
        await updateDoc(doc(db, "unidades", editando.id), {
          pais, estado, nome: nome.trim(), telefone: telefone.trim(), status, mentorId, atualizadoEm: serverTimestamp()
        });
        if(editando.uidLogin) {
            try { await updateDoc(doc(db, "usuarios", editando.uidLogin), { telefone: telefone.trim() }); } catch(err){}
        }
        setSucesso("Unidade atualizada!");
      } else {
        secondaryApp = initializeApp(getApp().options, "SecondaryAppUnitCreate");
        const secondaryAuth = getAuth(secondaryApp);

        const userCred = await createUserWithEmailAndPassword(
          secondaryAuth, emailLogin.trim().toLowerCase(), senhaLogin
        );
        const newUid = userCred.user.uid;

        const unidadeRef = await addDoc(collection(db, "unidades"), {
          pais, estado, nome: nome.trim(), telefone: telefone.trim(), status, mentorId, 
          uidLogin: newUid, email: emailLogin.trim().toLowerCase(), 
          criadoPor: userId, criadoEm: serverTimestamp()
        });

        await setDoc(doc(db, "usuarios", newUid), {
          nome: nome.trim(), email: emailLogin.trim().toLowerCase(), telefone: telefone.trim(),
          role: "unidade", unidadeId: unidadeRef.id, status: "ativo",
          criadoPor: userId, criadoEm: serverTimestamp()
        });

        await signOut(secondaryAuth);
        setSucesso("Unidade e Acesso criados!");
      }
      
      setTimeout(() => { setModalUnidadeAberto(false); setSucesso(""); }, 1000);

    } catch (e) { 
      console.error(e);
      if (e.code === 'auth/email-already-in-use') setErro("Este e-mail de login já está em uso.");
      else if (e.code === 'permission-denied') setErro("Erro de permissão no banco de dados.");
      else setErro("Erro: " + e.message); 
    } finally { 
      if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
      setSalvando(false); 
    }
  }

  // FUNÇÃO DE SALVAMENTO RÁPIDO (INLINE)
  async function salvarTelefoneInline(unidade) {
      if (!telefoneInline.trim()) { alert("O telefone não pode ficar vazio!"); return; }
      try {
          await updateDoc(doc(db, "unidades", unidade.id), { telefone: telefoneInline.trim() });
          if(unidade.uidLogin) {
              await updateDoc(doc(db, "usuarios", unidade.uidLogin), { telefone: telefoneInline.trim() }).catch(()=>{});
          }
          setEditandoTelefoneId(null);
      } catch (error) { 
          alert("Erro ao salvar telefone rápido."); 
      }
  }

  async function alternarStatus(u) {
    const novoStatus = u.status === 'ativa' ? 'inativa' : 'ativa';
    try {
        await updateDoc(doc(db, "unidades", u.id), { status: novoStatus });
    } catch (e) { 
        alert("Erro ao mudar status"); 
    }
  }

  async function excluir(u) {
    if(!window.confirm(`ATENÇÃO: Excluir a unidade "${u.nome}" apagará permanentemente o painel e o login dela.\n\nConfirmar exclusão?`)) return;
    try {
        setSalvando(true);
        const qUsers = query(collection(db, "usuarios"), where("unidadeId", "==", u.id));
        const snapUsers = await getDocs(qUsers);
        
        const batch = writeBatch(db);
        batch.delete(doc(db, "unidades", u.id));
        snapUsers.forEach((userDoc) => batch.delete(userDoc.ref));
        
        await batch.commit();
    } catch (e) { 
        alert("Erro ao excluir: " + e.message); 
    } finally { 
        setSalvando(false); 
    }
  }

  if (!podeAcessar) return <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-bold">Acesso Restrito: Apenas Administradores e Mentores podem acessar esta área.</div>;

  return (
    <div className="p-6 animate-fade-in max-w-7xl mx-auto space-y-6">
      
      {/* HEADER E KPIS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <span className="p-2 bg-red-600 text-white rounded-lg shadow-md shadow-red-500/20">
                <Building2 className="w-6 h-6"/>
            </span>
            Gestão de Unidades
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
              Gerenciamento de filiais e logins regionais.
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
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ativas</p>
                    <p className="text-lg font-black text-green-600 leading-none">{kpis.ativas}</p>
                </div>
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inativas</p>
                    <p className="text-lg font-black text-red-500 leading-none">{kpis.inativas}</p>
                </div>
            </div>
            
            <button 
                onClick={abrirNovaUnidade} 
                className="px-5 py-2 h-full bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-red-700 shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 whitespace-nowrap"
            >
                <Plus className="w-4 h-4"/> Nova Unidade
            </button>
        </div>
      </div>

      {/* BARRA DE FERRAMENTAS (BUSCA) */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-red-500 transition-colors"/>
              <input 
                  type="text" 
                  placeholder="Buscar unidade, telefone ou local..." 
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 shadow-sm transition-all text-slate-700 dark:text-white"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
              />
          </div>
      </div>

      {/* === TABELA === */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-28" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-2">Status <SortIcon field="status"/></div>
                </th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('nome')}>
                    <div className="flex items-center gap-2">Unidade e Login <SortIcon field="nome"/></div>
                </th>
                
                {/* NOVA COLUNA DE TELEFONE */}
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('telefone')}>
                    <div className="flex items-center gap-2">WhatsApp <SortIcon field="telefone"/></div>
                </th>

                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('estado')}>
                    <div className="flex items-center gap-2">Localização <SortIcon field="estado"/></div>
                </th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('mentorId')}>
                    <div className="flex items-center gap-2">Responsável <SortIcon field="mentorId"/></div>
                </th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
              {loading ? (
                  <tr>
                      <td colSpan="6" className="p-10 text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-red-500 mx-auto mb-2"/>
                          <p className="text-slate-400 font-bold">Sincronizando banco de dados...</p>
                      </td>
                  </tr>
              ) : unidadesProcessadas.length === 0 ? (
                  <tr>
                      <td colSpan="6" className="p-10 text-center text-slate-400 font-bold">
                          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-20"/> Nenhuma unidade encontrada.
                      </td>
                  </tr>
              ) : (
                unidadesProcessadas.map(u => (
                  <tr key={u.id} className={`transition-colors group ${u.status === 'inativa' ? 'bg-slate-50 dark:bg-slate-900/30 opacity-75 grayscale-[0.5]' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
                    
                    {/* 1. STATUS */}
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border ${u.status === 'ativa' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                        {u.status === 'ativa' ? <CheckCircle2 className="w-3 h-3"/> : <Ban className="w-3 h-3"/>} {u.status}
                      </span>
                    </td>

                    {/* 2. NOME & LOGIN */}
                    <td className="p-4">
                      <div className="font-black text-slate-800 dark:text-white text-base uppercase">{u.nome}</div>
                      {u.email && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                            <Mail className="w-3 h-3"/> {u.email}
                        </div>
                      )}
                    </td>

                    {/* 3. COLUNA DE TELEFONE COM EDIÇÃO INLINE */}
                    <td className="p-4">
                        {editandoTelefoneId === u.id ? (
                            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                                <input 
                                    autoFocus
                                    className="px-3 py-1.5 border border-red-300 dark:border-red-500/50 bg-white dark:bg-slate-900 rounded-lg text-sm font-mono font-bold outline-none ring-2 ring-red-500/20 w-40 dark:text-white"
                                    value={telefoneInline}
                                    onChange={(e) => setTelefoneInline(formatarTelefone(e.target.value, u.pais))}
                                    onKeyDown={(e) => e.key === 'Enter' && salvarTelefoneInline(u)}
                                    placeholder="Número..."
                                />
                                <button onClick={() => salvarTelefoneInline(u)} className="p-1.5 bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-600 hover:text-white transition-colors" title="Salvar">
                                    <Check className="w-4 h-4"/>
                                </button>
                                <button onClick={() => setEditandoTelefoneId(null)} className="p-1.5 bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 rounded-lg hover:bg-slate-300 transition-colors" title="Cancelar">
                                    <X className="w-4 h-4"/>
                                </button>
                            </div>
                        ) : (
                            <div 
                                onClick={() => { setEditandoTelefoneId(u.id); setTelefoneInline(u.telefone || ""); }}
                                className="flex items-center gap-2 cursor-pointer p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group/edit w-fit"
                                title="Clique para editar rapidamente"
                            >
                                <Phone className={`w-3.5 h-3.5 ${u.telefone ? 'text-green-500 dark:text-green-400' : 'text-slate-300 dark:text-slate-600'}`}/>
                                <span className={`font-mono text-sm font-bold ${u.telefone ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 italic font-normal text-xs'}`}>
                                    {u.telefone || "Adicionar nº"}
                                </span>
                                <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover/edit:opacity-100 transition-opacity ml-1"/>
                            </div>
                        )}
                    </td>

                    {/* 4. LOCAL */}
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold text-sm">
                        <MapPin className="w-4 h-4 text-red-500"/> {u.estado}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-5.5 mt-0.5">
                          {u.pais}
                      </div>
                    </td>

                    {/* 5. RESPONSÁVEL */}
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-xs font-bold bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 px-3 py-1.5 rounded-lg w-fit">
                        <User className="w-3.5 h-3.5 text-blue-500"/>
                        {role === "admin" ? (mentores.find(m=>m.id===u.mentorId)?.nome || "Mentor Apagado") : "Você"}
                      </div>
                    </td>
                    
                    {/* 6. AÇÕES */}
                    <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => abrirEditarUnidade(u)} 
                                className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white transition-colors" 
                                title="Editar Unidade Completo"
                            >
                                <Edit2 className="w-4 h-4"/>
                            </button>
                            
                            <button 
                                onClick={() => alternarStatus(u)} 
                                className={`p-2 rounded-lg transition-colors ${u.status === "ativa" ? "bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white dark:bg-orange-900/30 dark:text-orange-400" : "bg-green-50 text-green-600 hover:bg-green-500 hover:text-white dark:bg-green-900/30 dark:text-green-400"}`} 
                                title={u.status === "ativa" ? "Suspender Login" : "Reativar Login"}
                            >
                                {u.status === "ativa" ? <PowerOff className="w-4 h-4"/> : <CheckCircle2 className="w-4 h-4"/>}
                            </button>
                            
                            <button 
                                onClick={() => excluir(u)} 
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

      {/* === MODAL CADASTRAR/EDITAR === */}
      {modalUnidadeAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-200">
          <div className={`bg-white dark:bg-slate-800 w-full rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col ${editando ? 'max-w-md' : 'max-w-3xl'}`}>
            
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
              <div>
                  <h3 className="font-black text-xl text-slate-800 dark:text-white flex items-center gap-2">
                    {editando ? <Edit2 className="w-5 h-5 text-blue-500"/> : <Building2 className="w-5 h-5 text-red-600"/>}
                    {editando ? "Editar Unidade" : "Nova Unidade"}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Preencha os dados e clique em salvar.</p>
              </div>
              <button onClick={() => setModalUnidadeAberto(false)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-red-500">
                  <X className="w-5 h-5"/>
              </button>
            </div>
            
            <form onSubmit={salvarUnidade} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              {erro && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-800 flex items-center gap-2"><AlertTriangle className="w-5 h-5 flex-shrink-0"/> {erro}</div>}
              {sucesso && <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 text-sm rounded-lg border border-green-100 dark:border-green-800 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 flex-shrink-0"/> {sucesso}</div>}

              <div className={`grid grid-cols-1 ${!editando ? 'md:grid-cols-2' : ''} gap-8`}>
                
                {/* BLOCO 1: DADOS DA UNIDADE */}
                <div className="space-y-5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2">
                      <Globe className="w-3 h-3"/> Dados Regionais
                    </h4>
                    
                    <div className={`grid ${!editando ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2'} gap-4`}>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 pl-1 block">País</label>
                            <div className="relative">
                                <select value={pais} onChange={e=>{setPais(e.target.value); setEstado(""); setTelefone("");}} className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-red-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white">
                                    {Object.keys(LOCATIONS).map(k=><option key={k}>{k}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 pl-1 block">Estado</label>
                            <div className="relative">
                                <select value={estado} onChange={e=>setEstado(e.target.value)} className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-red-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white">
                                    <option value="">Selecione...</option>
                                    {estadosDisponiveis.map(e=><option key={e}>{e}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                            </div>
                        </div>
                    </div>

                    <div className={`grid ${!editando ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 pl-1 block">Nome da Unidade</label>
                            <div className="relative">
                                <Building2 className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                                <input 
                                value={nome} 
                                onChange={e=>setNome(e.target.value)} 
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-red-500 rounded-xl text-sm font-bold outline-none transition-all dark:text-white" 
                                placeholder="Ex: Barreiro" 
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 pl-1 block">WhatsApp (Obrigatório)</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                                <input 
                                value={telefone} 
                                onChange={e=>setTelefone(formatarTelefone(e.target.value, pais))} 
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-red-500 rounded-xl text-sm font-bold outline-none transition-all dark:text-white" 
                                placeholder="Ex: Apenas números..." 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 pl-1 block">Mentor Responsável</label>
                            {role === 'admin' ? (
                                <div className="relative">
                                    <select value={mentorId} onChange={e=>setMentorId(e.target.value)} className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-red-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white">
                                        <option value="">Selecione...</option>
                                        {mentores.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                                </div>
                            ) : (
                                <div className="w-full py-3 px-4 border-2 border-transparent rounded-xl bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 flex items-center gap-2 font-bold text-sm cursor-not-allowed">
                                    <User className="w-4 h-4"/> {userName}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 pl-1 block">Status Inicial</label>
                            <div className="relative">
                                <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 rounded-xl text-sm font-bold outline-none appearance-none transition-all dark:text-white">
                                    <option value="ativa">✅ ATIVA</option>
                                    <option value="inativa">🚫 INATIVA</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BLOCO 2: DADOS DE ACESSO (SÓ APARECE AO CRIAR) */}
                {!editando && (
                    <div className="space-y-5 border-l-0 md:border-l border-slate-100 dark:border-slate-700 pt-6 md:pt-0 md:pl-8">
                        <h4 className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2">
                            <Key className="w-3 h-3"/> Geração de Acesso
                        </h4>
                        
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-800/50 space-y-4">
                            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                                Ao criar a unidade, o sistema gera automaticamente um painel de controle e login exclusivo para ela.
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1 pl-1"><Mail className="w-3 h-3"/> Login (E-mail)</label>
                                <input disabled value={emailLogin} className="w-full px-4 py-3 text-sm border-none bg-white dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 font-mono font-bold shadow-sm" placeholder="Aguardando nome..." />
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1 pl-1"><Lock className="w-3 h-3"/> Senha Padrão</label>
                                <input disabled value={senhaLogin} className="w-full px-4 py-3 text-sm border-none bg-white dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 font-mono font-bold shadow-sm" />
                            </div>
                        </div>
                    </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-700 shrink-0 mt-6">
                <button type="button" onClick={()=>setModalUnidadeAberto(false)} className="px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={salvando} className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-red-500/30 hover:bg-red-700 hover:shadow-red-500/50 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:transform-none">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : (editando ? "Salvar Alterações" : <><Plus className="w-4 h-4"/> Criar Unidade</>)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}