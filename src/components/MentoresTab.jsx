import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where
} from "firebase/firestore";
// Importações para o truque da Instância Secundária (Vital para não deslogar o Admin)
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApp, deleteApp } from "firebase/app"; 
import { db, auth } from "../services/firebase";
import { ShieldCheck, UserPlus, Edit2, Trash2, CheckCircle2, Ban, Loader2, AlertTriangle } from "lucide-react";

export function MentoresTab() {
  const { userData } = useAuth();
  
  // Blindagem de role
  const role = useMemo(() => String(userData?.role || "").trim().toLowerCase(), [userData?.role]);
  const podeAcessar = role === "admin"; // Apenas Admin mexe em Mentores
  const criadoPor = userData?.id || userData?.uid;

  const [mentores, setMentores] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { 
    if (podeAcessar) carregarMentores(); 
  }, [podeAcessar]);

  async function carregarMentores() {
    try {
      setLoading(true);
      const q = query(collection(db, "usuarios"), where("role", "==", "mentor"));
      const snapshot = await getDocs(q);
      setMentores(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  }

  // --- FUNÇÕES DE AÇÃO ---
  async function alternarStatus(m) {
    const novoStatus = m.status === 'ativo' ? 'inativo' : 'ativo';
    try {
        await updateDoc(doc(db, "usuarios", m.id), { status: novoStatus });
        setMentores(prev => prev.map(u => u.id === m.id ? {...u, status: novoStatus} : u));
    } catch (e) { alert("Erro ao mudar status"); }
  }

  async function excluir(m) {
      if(!window.confirm(`Excluir mentor ${m.nome}?`)) return;
      try {
          await deleteDoc(doc(db, "usuarios", m.id));
          setMentores(prev => prev.filter(u => u.id !== m.id));
      } catch (e) { alert("Erro ao excluir"); }
  }

  // --- MODAIS ---
  function abrirModalNovo() {
    setMentorEditando(null); setNome(""); setEmail(""); setSenha("123456"); setStatus("ativo");
    setErro(""); setSucesso("");
    setModalAberto(true);
  }

  function abrirModalEditar(m) {
    setMentorEditando(m); setNome(m.nome); setEmail(m.email); setSenha(""); setStatus(m.status || "ativo");
    setErro(""); setSucesso("");
    setModalAberto(true);
  }

  // --- O CORAÇÃO DA CORREÇÃO: SALVAR SEM DESLOGAR ---
  async function salvar(e) {
    e.preventDefault();
    setSalvando(true); 
    setErro("");
    setSucesso("");

    // Validação básica
    if (!email.includes("@") || !nome.trim()) {
        setSalvando(false);
        return setErro("Preencha nome e email corretamente.");
    }

    // Instância Secundária (O Robô)
    let secondaryApp = null;

    try {
      if (mentorEditando) {
        // EDIÇÃO: Apenas update no banco (Simples)
        await updateDoc(doc(db, "usuarios", mentorEditando.id), { 
            nome: nome.trim(), 
            status 
        });
        setSucesso("Mentor atualizado!");
      } else {
        // CRIAÇÃO: Precisa do Robô para criar Auth sem deslogar Admin
        if (senha.length < 6) throw new Error("Senha deve ter no mínimo 6 caracteres.");

        // 1. Cria App Secundário
        secondaryApp = initializeApp(getApp().options, "SecondaryAppMentor");
        const secondaryAuth = getAuth(secondaryApp);

        // 2. Cria usuário no Auth (usando o robô)
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, email.trim().toLowerCase(), senha);
        
        // 3. Admin (ainda logado) salva no Firestore
        await setDoc(doc(db, "usuarios", userCred.user.uid), {
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          role: "mentor",
          status,
          criadoPor,
          criadoEm: serverTimestamp()
        });

        // 4. Desliga o robô
        await signOut(secondaryAuth);
        setSucesso("Mentor criado com sucesso!");
      }

      await carregarMentores();
      setTimeout(() => {
          setModalAberto(false);
          setSucesso("");
      }, 1500);

    } catch (e) { 
        console.error(e);
        if (e.code === 'auth/email-already-in-use') {
            setErro("Este email já está cadastrado.");
        } else {
            setErro("Erro: " + e.message); 
        }
    } finally { 
        // Limpeza de memória
        if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
        setSalvando(false); 
    }
  }

  if (!podeAcessar) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Acesso Restrito</div>;

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-red-600"/> Gestão de Mentores
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Administradores Regionais</p>
        </div>
        <button onClick={abrirModalNovo} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-md flex items-center gap-2">
          <UserPlus className="w-4 h-4"/> Novo Mentor
        </button>
      </div>

      {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> {erro}</div>}
      {sucesso && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> {sucesso}</div>}

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="p-4">Status</th>
              <th className="p-4">Nome</th>
              <th className="p-4">Email</th>
              <th className="p-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {mentores.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td className="p-4">
                   <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase ${m.status === 'ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {m.status === 'ativo' ? <CheckCircle2 className="w-3 h-3"/> : <Ban className="w-3 h-3"/>} {m.status}
                   </span>
                </td>
                <td className="p-4 font-bold text-slate-700 dark:text-slate-200">{m.nome}</td>
                <td className="p-4 text-slate-600 dark:text-slate-400">{m.email}</td>
                
                <td className="p-4 text-center">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => abrirModalEditar(m)}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => alternarStatus(m)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        m.status === "ativo"
                          ? "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                          : "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40"
                      }`}
                    >
                      {m.status === "ativo" ? "Inativar" : "Ativar"}
                    </button>

                    <button
                      onClick={() => excluir(m)}
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
        {mentores.length === 0 && !loading && (
            <div className="p-8 text-center text-slate-400">Nenhum mentor encontrado.</div>
        )}
      </div>

      {/* MODAL */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 animate-fade-in">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-4">{mentorEditando ? "Editar" : "Novo"} Mentor</h3>
            <form onSubmit={salvar} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Nome</label>
                <input value={nome} onChange={e => setNome(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} disabled={!!mentorEditando} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50" />
              </div>
              {!mentorEditando && (
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Senha</label>
                  <input type="text" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  <option value="ativo">Ativo</option>
                  <option value="inativa">Inativo</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalAberto(false)} className="px-4 py-2 border dark:border-slate-600 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                <button type="submit" disabled={salvando} className="px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 flex items-center gap-2">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin"/> : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}