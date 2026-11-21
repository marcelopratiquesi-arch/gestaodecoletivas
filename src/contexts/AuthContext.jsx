import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, unlink } from "firebase/auth";
import { doc, getDoc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp } from "firebase/firestore"; // 🟢 Importações do X-9
import { auth, db } from "../services/firebase"; // ✅ caminho correto
import { crachaSemAcesso, professorDeLoginAntigo, papelEfetivo, coberturaAtiva, AVISO_SEM_ACESSO, AVISO_PROFESSOR_LOGIN_ANTIGO } from "../permissions";
import { temporarioVencido } from "../utils/temporario";
import { definirVisaoAtual } from "../services/visaoAdminAtual";

const AuthContext = createContext(null);

// Entrou pelo Google (login pessoal)? Esse tipo de login qualquer pessoa consegue fazer,
// então sem crachá ele NÃO é derrubado: vai para a tela de pedido de acesso.
const temProvedor = (firebaseUser, id) =>
  (firebaseUser?.providerData || []).some((p) => p.providerId === id);
const entrouPeloGoogle = (firebaseUser) => temProvedor(firebaseUser, "google.com");

// Perfis que já são obrigados a trocar o login antigo (e-mail e senha) pelo login pessoal do Google.
// Admin fica para uma próxima etapa.
// Professor NÃO migra: o login antigo dele deixa de valer e ele pede acesso (ver professorDeLoginAntigo).
const PAPEIS_QUE_MIGRAM = ["lider", "unidade", "mentor"];

const CHAVE_VISAO = "pratique_visao_admin";
const lerVisaoGuardada = () => {
  try { return JSON.parse(sessionStorage.getItem(CHAVE_VISAO) || "null"); } catch { return null; }
};

// Monta o "crachá de mentira" que as telas usam enquanto o admin está vendo como outra pessoa.
// Mantém o que é do admin (e-mail do login, documento já informado) e troca só o que define o escopo.
function crachaDaVisao(real, visao) {
  if (!visao?.tipo) return real;
  // "id" e "nome" continuam sendo os do admin (o login real): é quem fica como autor de tudo que for gravado.
  // O escopo da pessoa vista vai em campos próprios (escopoMentorId, unidadeIds, professorId).
  const base = { ...real, visaoAdmin: { tipo: visao.tipo, nome: visao.nome || "" } };
  if (visao.tipo === "mentor" && visao.id) {
    return { ...base, role: "mentor", roleBase: "mentor", escopoMentorId: String(visao.mentorPrincipalId || visao.id), mentorPrincipalId: visao.mentorPrincipalId || null, unidadeId: null, unidadeIds: [], coberturaMentorId: null, coberturaAte: null };
  }
  if (visao.tipo === "lider" && visao.unidadeId) {
    return { ...base, role: "lider", roleBase: "lider", unidadeId: String(visao.unidadeId), unidadeIds: [String(visao.unidadeId)], mentorPrincipalId: null, coberturaMentorId: null, coberturaAte: null };
  }
  if (visao.tipo === "professor" && visao.professorId) {
    return { ...base, role: "professor", roleBase: "professor", professorId: String(visao.professorId), unidadeId: null, unidadeIds: [], mentorPrincipalId: null, coberturaMentorId: null, coberturaAte: null };
  }
  return real;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);          // firebaseUser
  const [crachaReal, setUserData] = useState(null);  // "crachá" de verdade (Firestore). Quem é o admin de fato.
  // VISÃO DO ADMINISTRADOR: só o admin pode "ver o sistema como" mentor, líder/unidade ou professor.
  // É só a aparência (menu, telas, filtros): o banco continua enxergando o admin, com todas as permissões dele.
  const [visaoAdmin, setVisaoAdminEstado] = useState(lerVisaoGuardada);
  const [loading, setLoading] = useState(true);
  // Entrou pelo Google mas ainda não tem crachá (pedido de acesso não feito ou aguardando aprovação).
  const [aguardandoAprovacao, setAguardandoAprovacao] = useState(false);

  const carregarCracha = useCallback(async (firebaseUser) => {
    setLoading(true);

    try {
      if (!firebaseUser) {
        setVisaoAdminEstado(null); // saiu: a visão de admin não sobrevive ao logout
        try { sessionStorage.removeItem(CHAVE_VISAO); } catch { /* sem storage, segue */ }
        setUser(null);
        setUserData(null);
        setAguardandoAprovacao(false);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      // coleção correta: "usuarios"
      const ref = doc(db, "usuarios", firebaseUser.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        if (entrouPeloGoogle(firebaseUser)) {
          // Login pessoal ainda não aprovado: fica logado só para pedir acesso / acompanhar o pedido.
          setUserData(null);
          setAguardandoAprovacao(true);
          setLoading(false);
          return;
        }
        // Login antigo sem crachá = sem acesso
        await signOut(auth);
        setUser(null);
        setUserData(null);
        setAguardandoAprovacao(false);
        setLoading(false);
        return;
      }

      // Professor com o login antigo (e-mail e senha): não entra mais. Se chegou pelo Google, o crachá antigo
      // é apagado (o banco só deixa a própria pessoa apagar este tipo de crachá) e ela cai na tela de pedido
      // de acesso; se chegou por senha, sai e a tela de entrada explica o que fazer.
      if (professorDeLoginAntigo(snap.data())) {
        if (entrouPeloGoogle(firebaseUser)) {
          try {
            await deleteDoc(ref);
            setUserData(null);
            setAguardandoAprovacao(true);
            setLoading(false);
            return;
          } catch (e) {
            console.error("Não foi possível limpar o crachá antigo do professor:", e);
          }
        }
        try { sessionStorage.setItem(AVISO_PROFESSOR_LOGIN_ANTIGO, "1"); } catch { /* sem aviso, mas sai igual */ }
        await signOut(auth);
        setUser(null);
        setUserData(null);
        setAguardandoAprovacao(false);
        setLoading(false);
        return;
      }

      // Crachá sem acesso (mentor inativo ou papel "bloqueado"): sai e avisa na tela de entrada.
      // O banco já recusa tudo para esses crachás (firestore.rules, logado()).
      if (crachaSemAcesso(snap.data())) {
        try { sessionStorage.setItem(AVISO_SEM_ACESSO, "1"); } catch { /* sem aviso, mas sai igual */ }
        await signOut(auth);
        setUser(null);
        setUserData(null);
        setAguardandoAprovacao(false);
        setLoading(false);
        return;
      }

      // Quem já trocou para o login pessoal não entra mais com a senha antiga: se ela ainda estiver
      // presa à conta (a remoção falhou na hora da troca), tira agora. Não trava o acesso se falhar.
      if (snap.data().loginGoogle === true && temProvedor(firebaseUser, "google.com") && temProvedor(firebaseUser, "password")) {
        unlink(firebaseUser, "password").catch((e) => console.error("Não foi possível remover a senha antiga:", e));
      }

      // Carimba o último acesso (no máximo 1 vez por hora, para não gravar a cada recarga). Não trava a entrada se falhar.
      const ultimo = snap.data().ultimoAcesso?.toMillis?.() || 0;
      if (Date.now() - ultimo > 60 * 60 * 1000) {
        updateDoc(ref, { ultimoAcesso: serverTimestamp() }).catch((e) => console.warn("Último acesso não registrado:", e?.code));
      }

      setAguardandoAprovacao(false);
      // Mentor temporário (cobertura): enquanto o prazo vale, o papel que o sistema usa é "mentor";
      // o papel de verdade fica em "roleBase" e volta sozinho quando a cobertura acaba (ver o efeito abaixo).
      const dadosDoCracha = snap.data();
      setUserData({
        id: firebaseUser.uid,
        emailAuth: firebaseUser.email,
        ...dadosDoCracha, // ✅ CORREÇÃO: spread correto
        role: papelEfetivo(dadosDoCracha) || dadosDoCracha.role,
        roleBase: dadosDoCracha.role,
      });

      setLoading(false);
    } catch (err) {
      console.error("AuthContext error:", err);
      await signOut(auth);
      setUser(null);
      setUserData(null);
      setAguardandoAprovacao(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, carregarCracha);
    return () => unsub();
  }, [carregarCracha]);

  // Líder temporário: quando o prazo acaba com o sistema aberto, sai sozinho (o banco já recusa tudo depois do prazo).
  useEffect(() => {
    if (!crachaReal?.temporarioAte) return undefined;
    const conferir = () => {
      if (!temporarioVencido(crachaReal)) return;
      try { sessionStorage.setItem(AVISO_SEM_ACESSO, "1"); } catch { /* sem aviso, mas sai igual */ }
      signOut(auth).catch((e) => console.error(e));
    };
    const timer = setInterval(conferir, 60 * 1000);
    document.addEventListener("visibilitychange", conferir);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", conferir); };
  }, [crachaReal]);

  // Cobertura de mentor: quando o prazo acaba com o sistema aberto, lê o crachá de novo e a pessoa volta ao que era.
  useEffect(() => {
    if (!crachaReal?.coberturaAte || !coberturaAtiva(crachaReal)) return undefined;
    const conferir = () => { if (!coberturaAtiva(crachaReal)) carregarCracha(auth.currentUser); };
    const timer = setInterval(conferir, 60 * 1000);
    document.addEventListener("visibilitychange", conferir);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", conferir); };
  }, [crachaReal, carregarCracha]);

  // Só admin de verdade tem visão; para qualquer outra pessoa o estado guardado é ignorado.
  const ehAdminReal = ["admin", "administrador", "master"].includes(String(crachaReal?.role || "").trim().toLowerCase());
  const userData = useMemo(
    () => (crachaReal && ehAdminReal ? crachaDaVisao(crachaReal, visaoAdmin) : crachaReal),
    [crachaReal, ehAdminReal, visaoAdmin]
  );

  // Avisa o carimbo de auditoria (ver services/firestoreMedido.js) de quem o admin está vendo agora.
  useEffect(() => {
    definirVisaoAtual(crachaReal && ehAdminReal ? visaoAdmin : null);
  }, [crachaReal, ehAdminReal, visaoAdmin]);

  const definirVisaoAdmin = useCallback((visao) => {
    setVisaoAdminEstado(visao || null);
    try {
      if (visao) sessionStorage.setItem(CHAVE_VISAO, JSON.stringify(visao));
      else sessionStorage.removeItem(CHAVE_VISAO);
    } catch { /* sem guardar, mas a visão vale até recarregar */ }
  }, []);

  // Chamado pela tela de pedido de acesso quando o pedido é aprovado (lê o crachá de novo).
  const recarregarCracha = useCallback(() => carregarCracha(auth.currentUser), [carregarCracha]);

  // 🟢 FUNÇÃO DE LOGOUT BLINDADA COM O PONTO ELETRÔNICO
  const logout = useCallback(async () => {
    try {
      // 1. Grava a saída ANTES de desconectar o Firebase (para ter os dados do usuário)
      if (user && crachaReal) {
          try {
              await addDoc(collection(db, "auditoria_configuracoes"), {
                  tipoAcao: "LOGOUT",
                  descricao: "Usuário encerrou a sessão no sistema.",
                  modulo: "CONFIGURACOES",
                  diffExtras: "Desconexão manual (Botão Sair).",
                  usuarioAcaoNome: crachaReal.nome || user.email,
                  usuarioAcaoId: user.uid,
                  dataAcao: serverTimestamp()
              });
          } catch (logError) {
              console.error("Aviso: Falha ao gravar log de logout", logError);
          }
      }

      // 2. Executa a desconexão real do sistema
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  }, [user, crachaReal]);

  const value = useMemo(
    () => ({
      user,
      userData,
      crachaReal,
      visaoAdmin,
      definirVisaoAdmin,
      ehAdminReal,
      loading,
      logout,
      aguardandoAprovacao,
      recarregarCracha,
      // Líder (ou login antigo de unidade) e mentor que ainda não conectaram o Google: tela obrigatória
      // de atualização de cadastro antes de qualquer outra (ver PrivateRoute e pages/AtualizarCadastro).
      precisaAtualizarCadastro: !!crachaReal
        && PAPEIS_QUE_MIGRAM.includes(String(crachaReal.role || "").trim().toLowerCase())
        && crachaReal.loginGoogle !== true,
      role: userData?.role || null,
      isAdmin: userData?.role === "admin",
      isMentor: userData?.role === "mentor",
      isUnidade: ["lider", "unidade"].includes(String(userData?.role || "").toLowerCase()),
      isProfessor: userData?.role === "professor",
    }),
    [user, userData, crachaReal, visaoAdmin, definirVisaoAdmin, ehAdminReal, loading, logout, aguardandoAprovacao, recarregarCracha]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
