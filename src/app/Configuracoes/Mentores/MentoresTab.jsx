import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  collection, updateDoc, deleteDoc, doc, query, where, serverTimestamp, setDoc, onSnapshot, addDoc
} from "firebase/firestore";

// Auth imports (Instância secundária para não deslogar o admin)
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApp, deleteApp } from "firebase/app"; 
import { db } from "../../../services/firebase";

import { 
    ShieldCheck, Edit2, Trash2, AlertTriangle, CheckCircle2, 
    Loader2, User, Search, Mail, Lock, ChevronDown, ChevronUp, Ban, PowerOff, Plus, X, Phone, Check
} from "lucide-react";

// ==========================================
// MÁSCARA INTELIGENTE DE TELEFONE (Padrão BR)
// ==========================================
const formatarTelefone = (valor) => {
    if (!valor) return "";
    let v = valor.replace(/\D/g, ''); // Remove tudo que não é número
    
    if (v.startsWith('55')) v = v.slice(2);
    v = v.slice(0, 11); // Max 11 digitos
    
    if (v.length > 2) v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
    if (v.length > 7) v = v.replace(/(\d{5})(\d)/, '$1-$2');
    
    return v ? `+55 ${v}` : '';
};

export function MentoresTab() {
  const { userData } = useAuth();
  
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const userId = useMemo(() => userData?.id || userData?.uid, [userData]);

  // Cadeado de Permissão (Só Admin acessa Mentores)
  const podeAcessar = role === "admin";

  // Dados
  const [mentores, setMentores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UX
  const [busca, setBusca] = useState("");
  const [sortConfig, setSortConfig] = useState({ field: 'nome', direction: 'asc' });
  const [modalAberto, setModalAberto] = useState(false);
  
  // Feedback
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Forms Modal
  const [mentorEditando, setMentorEditando] = useState(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [status, setStatus] = useState("ativo");

  // Edição Inline do Telefone na Tabela
  const [editandoTelefoneId, setEditandoTelefoneId] = useState(null);
  const [telefoneInline, setTelefoneInline] = useState("");

  // ==========================================
  // 0. MOTOR DE AUDITORIA (CÂMERA INVISÍVEL)
  // ==========================================
  const registrarLogAuditoria = async (tipoAcao, descricao, nomeMentor, detalhes = "") => {
      try {
          const nomeUsuario = userData?.nome || userData?.email || 'Administrador do Sistema';
          await addDoc(collection(db, 'auditoria_cronograma'), {
              tipoAcao,
              descricao: `Mentor(a) ${nomeMentor}: ${descricao}`,
              diffExtras: detalhes,
              modulo: 'CONFIGURACOES',
              unidadeNome: 'Gestão/Diretoria', 
              professorNome: nomeMentor || '-', 
              modalidadeNome: '-', 
              usuarioAcaoNome: nomeUsuario,
              usuarioAcaoId: userId,
              dataAcao: serverTimestamp()
          });
      } catch (e) { console.error("Erro ao gerar log de auditoria", e); }
  };

  // ==========================================
  // 1. MOTOR DE TEMPO REAL
  // ==========================================
  useEffect(() => { 
    if (!podeAcessar) return;

    setLoading(true);
    
    const q = query(collection(db, "usuarios"), where("role", "==", "mentor"));
    const unsub = onSnapshot(q, (snap) => {
        setMentores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
    }, (error) => {
        console.error("Erro no tempo real de mentores:", error);
        setLoading(false);
    });

    return () => unsub();
  }, [podeAcessar]);

  // ==========================================
  // 2. PROCESSADOR DE BUSCA E ORDENAÇÃO
  // ==========================================
  const mentoresProcessados = useMemo(() => {
      let resultado = mentores;

      if (busca.trim()) {
          const termo = busca.toLowerCase();
          resultado = resultado.filter(m => 
              (m.nome || "").toLowerCase().includes(termo) ||
              (m.email || "").toLowerCase().includes(termo) ||
              (m.telefone || "").toLowerCase().includes(termo)
          );
      }

      return resultado.sort((a, b) => {
          let valA = (a[sortConfig.field] || "").toLowerCase();
          let valB = (b[sortConfig.field] || "").toLowerCase();
          
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [mentores, busca, sortConfig]);

  const handleSort = (field) => {
      setSortConfig(prev => ({ 
          field, 
          direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc' 
      }));
  };

  const SortIcon = ({ field }) => {
      if (sortConfig.field !== field) return <div className="w-4 h-4 opacity-20"><ChevronDown className="w-3 h-3"/></div>;
      return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-500"/> : <ChevronDown className="w-3 h-3 text-blue-500"/>;
  };

  const kpis = useMemo(() => {
      const ativos = mentores.filter(m => m.status === 'ativo').length;
      const inativos = mentores.filter(m => m.status !== 'ativo').length;
      return { total: mentores.length, ativos, inativos };
  }, [mentores]);

  // ==========================================
  // 3. AÇÕES (CRUD) COM AUDITORIA
  // ==========================================
  function abrirModalNovo() {
    setMentorEditando(null); 
    setNome(""); 
    setEmail(""); 
    setSenha(""); 
    setTelefone(""); 
    setStatus("ativo");
    setErro(""); 
    setSucesso(""); 
    setModalAberto(true);
  }

  function abrirModalEditar(m) {
    setMentorEditando(m); 
    setNome(m.nome || ""); 
    setEmail(m.email || ""); 
    setSenha(""); 
    setTelefone(m.telefone || ""); 
    setStatus(m.status || "ativo");
    setErro(""); 
    setSucesso(""); 
    setModalAberto(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setErro(""); 
    setSucesso(""); 
    setSalvando(true);

    if (!nome.trim()) { setSalvando(false); return setErro("Nome é obrigatório."); }
    if (!telefone.trim()) { setSalvando(false); return setErro("WhatsApp é obrigatório."); }
    if (!email.trim()) { setSalvando(false); return setErro("E-mail é obrigatório."); }
    if (!mentorEditando && senha.length < 6) { setSalvando(false); return setErro("Senha mín. 6 dígitos."); }

    let secondaryApp = null;

    try {
      if (mentorEditando) {
        // 🟢 AUDITORIA: Descobrir o que mudou na edição
        let mudancas = [];
        if (mentorEditando.nome !== nome.trim()) mudancas.push(`Nome: ${mentorEditando.nome} ➔ ${nome.trim()}`);
        if (mentorEditando.telefone !== telefone.trim()) mudancas.push(`WhatsApp: ${mentorEditando.telefone || 'Sem tel'} ➔ ${telefone.trim()}`);
        if (mentorEditando.status !== status) mudancas.push(`Status: ${mentorEditando.status} ➔ ${status}`);

        await updateDoc(doc(db, "usuarios", mentorEditando.id), {
          nome: nome.trim(), 
          telefone: telefone.trim(), 
          status, 
          atualizadoEm: serverTimestamp()
        });

        if (mudancas.length > 0) {
            await registrarLogAuditoria('ALTERADA', 'Dados cadastrais do Mentor atualizados.', nome.trim(), mudancas.join(' | '));
        }

        setSucesso("Mentor atualizado!");
      } else {
        // 🟢 AUDITORIA: Novo mentor criado
        secondaryApp = initializeApp(getApp().options, "SecondaryAppMentor");
        const secondaryAuth = getAuth(secondaryApp);

        const userCred = await createUserWithEmailAndPassword(secondaryAuth, email.trim().toLowerCase(), senha);
        const newUid = userCred.user.uid;

        await setDoc(doc(db, "usuarios", newUid), {
          nome: nome.trim(), 
          email: email.trim().toLowerCase(), 
          telefone: telefone.trim(),
          role: "mentor", 
          status: status,
          criadoPor: userId, 
          criadoEm: serverTimestamp()
        });

        await signOut(secondaryAuth);
        await registrarLogAuditoria('NOVA', 'Novo mentor e credenciais criadas no sistema.', nome.trim(), `Email: ${email.trim().toLowerCase()}`);
        
        setSucesso("Mentor criado com sucesso!");
      }
      
      setTimeout(() => { setModalAberto(false); setSucesso(""); }, 1000);

    } catch (e) { 
      if (e.code === 'auth/email-already-in-use') setErro("Este e-mail já está cadastrado.");
      else setErro("Erro: " + e.message); 
    } finally { 
      if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
      setSalvando(false); 
    }
  }

  // EDICAO INLINE DO TELEFONE COM AUDITORIA
  async function salvarTelefoneInline(mentor) {
      if (!telefoneInline.trim()) { alert("O telefone é obrigatório!"); return; }
      try {
          const telAntigo = mentor.telefone || "Sem telefone";
          await updateDoc(doc(db, "usuarios", mentor.id), { 
              telefone: telefoneInline.trim() 
          });

          if (telAntigo !== telefoneInline.trim()) {
              await registrarLogAuditoria('ALTERADA', 'Edição rápida do WhatsApp do Mentor.', mentor.nome, `Telefone: ${telAntigo} ➔ ${telefoneInline.trim()}`);
          }
          setEditandoTelefoneId(null);
      } catch (error) { 
          alert("Erro ao salvar telefone."); 
      }
  }

  // STATUS COM AUDITORIA
  async function alternarStatus(m) {
    const novoStatus = m.status === 'ativo' ? 'inativo' : 'ativo';
    try { 
        await updateDoc(doc(db, "usuarios", m.id), { status: novoStatus }); 
        await registrarLogAuditoria('ALTERADA', `Status modificado para ${novoStatus.toUpperCase()}`, m.nome, `Bloqueio/Desbloqueio de acesso rápido.`);
    } catch (e) { 
        alert("Erro ao mudar status"); 
    }
  }

  // EXCLUSÃO COM AUDITORIA
  async function excluir(m) {
    if(!window.confirm(`ATENÇÃO: Excluir o mentor "${m.nome}" apagará o login dele.\nConfirmar?`)) return;
    
    try {
        setSalvando(true);
        await deleteDoc(doc(db, "usuarios", m.id));
        await registrarLogAuditoria('EXCLUÍDA', 'Mentor e acessos excluídos do sistema.', m.nome, `Exclusão definitiva.`);
    } catch (e) { 
        alert("Erro ao excluir: " + e.message); 
    } finally { 
        setSalvando(false); 
    }
  }

  // Barreira de Segurança Final
  if (!podeAcessar) return <div className="p-8 text-center text-slate-500 font-bold">Acesso Restrito: Apenas Administradores.</div>;

  return (
    <div className="p-6 animate-fade-in max-w-7xl mx-auto space-y-6">
      
      {/* HEADER E KPIS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <span className="p-2 bg-blue-600 text-white rounded-lg shadow-md shadow-blue-500/20">
                <ShieldCheck className="w-6 h-6"/>
            </span>
            Gestão de Mentores
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
              Diretoria e Gestores Regionais.
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
                className="px-5 py-2 h-full bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 whitespace-nowrap"
            >
                <Plus className="w-4 h-4"/> Novo Mentor
            </button>
        </div>
      </div>

      {/* BUSCA */}
      <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors"/>
          <input 
              type="text" 
              placeholder="Buscar mentor, e-mail ou telefone..." 
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-all dark:text-white" 
              value={busca} 
              onChange={(e) => setBusca(e.target.value)} 
          />
      </div>

      {/* TABELA */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-28" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-2">Status <SortIcon field="status"/></div>
                </th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('nome')}>
                    <div className="flex items-center gap-2">Mentor <SortIcon field="nome"/></div>
                </th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('telefone')}>
                    <div className="flex items-center gap-2">WhatsApp <SortIcon field="telefone"/></div>
                </th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
              {loading ? (
                  <tr>
                      <td colSpan="4" className="p-10 text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2"/>
                          <p className="text-slate-400 font-bold">Sincronizando...</p>
                      </td>
                  </tr>
              ) : mentoresProcessados.map(m => (
                  <tr key={m.id} className={`transition-colors group ${m.status === 'inativo' ? 'bg-slate-50 dark:bg-slate-900/30 opacity-75 grayscale-[0.5]' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
                    
                    {/* STATUS */}
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border ${m.status === 'ativo' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                        {m.status === 'ativo' ? <CheckCircle2 className="w-3 h-3"/> : <Ban className="w-3 h-3"/>} {m.status}
                      </span>
                    </td>

                    {/* NOME E EMAIL */}
                    <td className="p-4">
                      <div className="font-black text-slate-800 dark:text-white text-base uppercase">{m.nome}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <Mail className="w-3 h-3"/> {m.email}
                      </div>
                    </td>

                    {/* EDIÇÃO INLINE DO TELEFONE */}
                    <td className="p-4">
                        {editandoTelefoneId === m.id ? (
                            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                                <input 
                                    autoFocus 
                                    className="px-3 py-1.5 border border-blue-300 dark:border-blue-500/50 bg-white dark:bg-slate-900 rounded-lg text-sm font-mono font-bold outline-none ring-2 ring-blue-500/20 w-40 dark:text-white" 
                                    value={telefoneInline} 
                                    onChange={(e) => setTelefoneInline(formatarTelefone(e.target.value))} 
                                    onKeyDown={(e) => e.key === 'Enter' && salvarTelefoneInline(m)} 
                                    placeholder="Número..." 
                                />
                                <button onClick={() => salvarTelefoneInline(m)} className="p-1.5 bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-600 hover:text-white transition-colors" title="Salvar">
                                    <Check className="w-4 h-4"/>
                                </button>
                                <button onClick={() => setEditandoTelefoneId(null)} className="p-1.5 bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 rounded-lg hover:bg-slate-300 transition-colors" title="Cancelar">
                                    <X className="w-4 h-4"/>
                                </button>
                            </div>
                        ) : (
                            <div 
                                onClick={() => { setEditandoTelefoneId(m.id); setTelefoneInline(m.telefone || ""); }} 
                                className="flex items-center gap-2 cursor-pointer p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group/edit w-fit" 
                                title="Clique para editar rapidamente"
                            >
                                <Phone className={`w-3.5 h-3.5 ${m.telefone ? 'text-green-500 dark:text-green-400' : 'text-slate-300 dark:text-slate-600'}`}/>
                                <span className={`font-mono text-sm font-bold ${m.telefone ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 italic font-normal text-xs'}`}>
                                    {m.telefone || "Adicionar nº"}
                                </span>
                                <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover/edit:opacity-100 transition-opacity ml-1"/>
                            </div>
                        )}
                    </td>
                    
                    {/* AÇÕES */}
                    <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => abrirModalEditar(m)} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white transition-colors" title="Editar Completo">
                                <Edit2 className="w-4 h-4"/>
                            </button>
                            <button onClick={() => alternarStatus(m)} className={`p-2 rounded-lg transition-colors ${m.status === "ativo" ? "bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white dark:bg-orange-900/30 dark:text-orange-400" : "bg-green-50 text-green-600 hover:bg-green-500 hover:text-white dark:bg-green-900/30 dark:text-green-400"}`} title="Alternar Status">
                                {m.status === "ativo" ? <PowerOff className="w-4 h-4"/> : <CheckCircle2 className="w-4 h-4"/>}
                            </button>
                            <button onClick={() => excluir(m)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white transition-colors" title="Excluir Definitivamente">
                                <Trash2 className="w-4 h-4"/>
                            </button>
                        </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
              <div>
                  <h3 className="font-black text-xl text-slate-800 dark:text-white flex items-center gap-2">
                      {mentorEditando ? <Edit2 className="w-5 h-5 text-blue-500"/> : <ShieldCheck className="w-5 h-5 text-blue-600"/>}
                      {mentorEditando ? "Editar Mentor" : "Novo Mentor"}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Preencha os dados abaixo.</p>
              </div>
              <button onClick={() => setModalAberto(false)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-red-500">
                  <X className="w-5 h-5"/>
              </button>
            </div>
            
            <form onSubmit={salvar} className="p-6 space-y-5">
              
              {erro && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2"><AlertTriangle className="w-5 h-5 flex-shrink-0"/> {erro}</div>}
              {sucesso && <div className="p-4 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 flex-shrink-0"/> {sucesso}</div>}

              <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 block">Nome do Mentor</label>
                  <div className="relative">
                      <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                      <input 
                          value={nome} 
                          onChange={e=>setNome(e.target.value)} 
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 rounded-xl text-sm font-bold outline-none dark:text-white" 
                          placeholder="Nome completo" 
                      />
                  </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 block">WhatsApp</label>
                    <div className="relative">
                        <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                        <input 
                            value={telefone} 
                            onChange={e=>setTelefone(formatarTelefone(e.target.value))} 
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 rounded-xl text-sm font-bold outline-none dark:text-white" 
                            placeholder="Apenas números..." 
                        />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 block">Status</label>
                    <div className="relative">
                        <select 
                            value={status} 
                            onChange={e=>setStatus(e.target.value)} 
                            className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 rounded-xl text-sm font-bold outline-none appearance-none dark:text-white"
                        >
                            <option value="ativo">✅ ATIVO</option>
                            <option value="inativo">🚫 INATIVO</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                    </div>
                </div>
              </div>

              <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 block">Login (E-mail)</label>
                  <div className="relative">
                      <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                      <input 
                          value={email} 
                          onChange={e=>setEmail(e.target.value)} 
                          disabled={!!mentorEditando} 
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 rounded-xl text-sm font-bold outline-none disabled:opacity-50 dark:text-white" 
                          placeholder="mentor@pratique.com" 
                      />
                  </div>
              </div>
              
              {!mentorEditando && (
                  <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1 block">Senha Inicial</label>
                      <div className="relative">
                          <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                          <input 
                              type="password" 
                              value={senha} 
                              onChange={e=>setSenha(e.target.value)} 
                              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 rounded-xl text-sm font-bold outline-none dark:text-white" 
                              placeholder="Mínimo 6 dígitos" 
                          />
                      </div>
                  </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700 mt-6">
                  <button 
                      type="button" 
                      onClick={()=>setModalAberto(false)} 
                      className="px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                      Cancelar
                  </button>
                  <button 
                      type="submit" 
                      disabled={salvando} 
                      className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-blue-700 flex items-center gap-2"
                  >
                      {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}