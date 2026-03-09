import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore"; // 🟢 Importações do X-9
import { auth, db } from "../services/firebase"; // ✅ caminho correto

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);          // firebaseUser
  const [userData, setUserData] = useState(null);  // "crachá" (Firestore)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      try {
        if (!firebaseUser) {
          setUser(null);
          setUserData(null);
          setLoading(false);
          return;
        }

        setUser(firebaseUser);

        // coleção correta: "usuarios"
        const ref = doc(db, "usuarios", firebaseUser.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          // Sem crachá = sem acesso
          await signOut(auth);
          setUser(null);
          setUserData(null);
          setLoading(false);
          return;
        }

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
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // 🟢 FUNÇÃO DE LOGOUT BLINDADA COM O PONTO ELETRÔNICO
  async function logout() {
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
  }

  const value = useMemo(
    () => ({
      user,
      userData,
      loading,
      logout,
      role: userData?.role || null,
      isAdmin: userData?.role === "admin",
      isMentor: userData?.role === "mentor",
      isUnidade: userData?.role === "unidade",
      isProfessor: userData?.role === "professor",
    }),
    [user, userData, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}