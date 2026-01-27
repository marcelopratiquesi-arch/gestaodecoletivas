import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "../services/firebase";

export function MentoresTab() {
  const { userData } = useAuth();

  const [mentores, setMentores] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [showPopup, setShowPopup] = useState(false);

  // Form
  const [mentorEditando, setMentorEditando] = useState(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [status, setStatus] = useState("ativo");

  // Apenas admin pode acessar
  const podeAcessar = userData?.role === "admin";
  const criadoPor = userData?.id || userData?.uid || null;

  useEffect(() => {
    if (podeAcessar) carregarMentores();
    // se não puder acessar, não faz nada
  }, [podeAcessar]);

  async function carregarMentores() {
    try {
      setLoading(true);
      setErro("");

      const q = query(collection(db, "usuarios"), where("role", "==", "mentor"));
      const snapshot = await getDocs(q);

      const lista = [];
      snapshot.forEach((d) => {
        // ✅ CORRETO: spread do data()
        lista.push({ id: d.id, ...d.data() });
      });

      setMentores(lista);
    } catch (e) {
      console.error("Erro ao carregar mentores:", e);
      setErro("Erro ao carregar mentores.");
    } finally {
      setLoading(false);
    }
  }

  function abrirModalNovo() {
    setMentorEditando(null);
    setNome("");
    setEmail("");
    setSenha("");
    setStatus("ativo");
    setErro("");
    setSucesso("");
    setShowPopup(false);
    setModalAberto(true);
  }

  function abrirModalEditar(mentor) {
    setMentorEditando(mentor);
    setNome(mentor?.nome || "");
    setEmail(mentor?.email || "");
    setSenha(""); // não exibe senha
    setStatus(mentor?.status || "ativo");
    setErro("");
    setSucesso("");
    setShowPopup(false);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setMentorEditando(null);
  }

  function validarFormulario() {
    if (!nome.trim()) {
      setErro("Nome é obrigatório.");
      return false;
    }
    if (!email.trim()) {
      setErro("Email é obrigatório.");
      return false;
    }
    if (!mentorEditando && !senha) {
      setErro("Senha é obrigatória para novo mentor.");
      return false;
    }
    if (senha && senha.length < 6) {
      setErro("Senha deve ter no mínimo 6 caracteres.");
      return false;
    }
    return true;
  }

  async function salvar(e) {
    e.preventDefault();
    if (!validarFormulario()) return;

    try {
      setSalvando(true);
      setErro("");
      setSucesso("");

      if (mentorEditando) {
        // EDITAR (nome/status)
        await updateDoc(doc(db, "usuarios", mentorEditando.id), {
          nome: nome.trim(),
          status,
        });

        setShowPopup(true);
        setSucesso("Mentor atualizado com sucesso!");
      } else {
        // NOVO: cria no Auth e grava no Firestore com ID = uid
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          senha
        );

        const uid = userCredential.user.uid;

        await setDoc(doc(db, "usuarios", uid), {
          nome: nome.trim(),
          email: email.trim(),
          role: "mentor",
          status,
          criadoPor,
          criadoEm: serverTimestamp(),
        });

        setShowPopup(true);
        setSucesso("Mentor criado com sucesso!");
      }

      await carregarMentores();

      setTimeout(() => {
        fecharModal();
        setSucesso("");
        setShowPopup(false);
      }, 1800);
    } catch (error) {
      console.error("Erro ao salvar:", error);

      let mensagemErro = "Erro ao salvar mentor.";
      if (error?.code === "auth/email-already-in-use") {
        mensagemErro = "Este email já está cadastrado.";
      } else if (error?.code === "auth/invalid-email") {
        mensagemErro = "Email inválido.";
      } else if (error?.code === "auth/weak-password") {
        mensagemErro = "Senha muito fraca (mínimo 6 caracteres).";
      }

      setErro(mensagemErro);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(mentor) {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir o mentor "${mentor?.nome}"?\n\nEsta ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    try {
      setErro("");
      setSucesso("");

      await deleteDoc(doc(db, "usuarios", mentor.id));

      setSucesso("Mentor excluído com sucesso!");
      await carregarMentores();
      setTimeout(() => setSucesso(""), 2500);
    } catch (e) {
      console.error("Erro ao excluir:", e);
      setErro("Erro ao excluir mentor.");
    }
  }

  async function alternarStatus(mentor) {
    try {
      setErro("");
      setSucesso("");

      const novoStatus = mentor.status === "ativo" ? "inativo" : "ativo";
      await updateDoc(doc(db, "usuarios", mentor.id), { status: novoStatus });

      setSucesso(
        `Mentor ${
          novoStatus === "ativo" ? "ativado" : "desativado"
        } com sucesso!`
      );
      await carregarMentores();
      setTimeout(() => setSucesso(""), 2500);
    } catch (e) {
      console.error("Erro ao alterar status:", e);
      setErro("Erro ao alterar status.");
    }
  }

  // Bloqueio de acesso
  if (!podeAcessar) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-600 font-semibold">
          Apenas administradores podem gerenciar mentores.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Mentores</h2>
          <p className="text-sm text-slate-500 mt-1">
            Gestão de mentores responsáveis pelas unidades
          </p>
        </div>

        <button
          onClick={abrirModalNovo}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-sm"
        >
          + Novo Mentor
        </button>
      </div>

      {/* MENSAGENS */}
      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {sucesso}
        </div>
      )}

      {/* LISTAGEM */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 uppercase">
            Mentores cadastrados ({mentores.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : mentores.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Nenhum mentor encontrado.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
              <tr>
                <th className="p-4">Nome</th>
                <th className="p-4">Email</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mentores.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="p-4 font-semibold text-slate-700">
                    {m.nome || "-"}
                  </td>
                  <td className="p-4 text-slate-600">{m.email || "-"}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        m.status === "ativo"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-slate-50 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {m.status === "ativo" ? "ATIVO" : "INATIVO"}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => abrirModalEditar(m)}
                      className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => alternarStatus(m)}
                      className="px-3 py-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold"
                    >
                      {m.status === "ativo" ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => excluir(m)}
                      className="px-3 py-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800">
                {mentorEditando ? "Editar Mentor" : "Novo Mentor"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Preencha os dados e clique em salvar.
              </p>
            </div>

            <form onSubmit={salvar} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Nome
                </label>
                <input
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!mentorEditando} // não muda email em edição
                />
                {mentorEditando && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Email não é editável.
                  </p>
                )}
              </div>

              {!mentorEditando && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Senha
                  </label>
                  <input
                    type="password"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Status
                </label>
                <select
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>

              {erro && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {erro}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP */}
      {showPopup && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm">
          {sucesso || "Concluído."}
        </div>
      )}
    </div>
  );
}
