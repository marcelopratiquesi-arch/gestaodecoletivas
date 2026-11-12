import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore"; // 🟢 Importações do X-9
import { auth, db } from "../services/firebase"; // ✅ caminho correto

const AuthContext = createContext(null);

// Entrou pelo Google (login pessoal)? Esse tipo de login qualquer pessoa consegue fazer,
// então sem crachá ele NÃO é derrubado: vai para a tela de pedido de acesso.
const entrouPeloGoogle = (firebaseUser) =>
  (firebaseUser?.providerData || []).some((p) => p.providerId === "google.com");

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);          // firebaseUser
  const [userData, setUserData] = useState(null);  // "crachá" (Firestore)
  const [loading, setLoading] = useState(true);
  // Entrou pelo Google mas ainda não tem crachá (pedido de acesso não feito ou aguardando aprovação).
  const [aguardandoAprovacao, setAguardandoAprovacao] = useState(false);

  const carregarCracha = useCallback(async (firebaseUser) => {
    setLoading(true);

    try {
      if (!firebaseUser) {
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

      setAguardandoAprovacao(false);
      setUserData({
        id: firebaseUser.uid,
        emailAuth: firebaseUser.email,
        ...snap.data(), // ✅ CORREÇÃO: spread correto
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

  // Chamado pela tela de pedido de acesso quando o pedido é aprovado (lê o crachá de novo).
  const recarregarCracha = useCallback(() => carregarCracha(auth.currentUser), [carregarCracha]);

  // 🟢 FUNÇÃO DE LOGOUT BLINDADA COM O PONTO ELETRÔNICO
  const logout = useCallback(async () => {
    try {
      // 1. Grava a saída ANTES de desconectar o Firebase (para ter os dados do usuário)
      if (user && userData) {
          try {
              await addDoc(collection(db, "auditoria_configuracoes"), {
                  tipoAcao: "LOGOUT",
                  descricao: "Usuário encerrou a sessão no sistema.",
                  modulo: "CONFIGURACOES",
                  diffExtras: "Desconexão manual (Botão Sair).",
                  usuarioAcaoNome: userData.nome || user.email,
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
  }, [user, userData]);

  const value = useMemo(
    () => ({
      user,
      userData,
      loading,
      logout,
      aguardandoAprovacao,
      recarregarCracha,
      role: userData?.role || null,
      isAdmin: userData?.role === "admin",
      isMentor: userData?.role === "mentor",
      isUnidade: ["lider", "unidade"].includes(String(userData?.role || "").toLowerCase()),
      isProfessor: userData?.role === "professor",
    }),
    [user, userData, loading, logout, aguardandoAprovacao, recarregarCracha]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
