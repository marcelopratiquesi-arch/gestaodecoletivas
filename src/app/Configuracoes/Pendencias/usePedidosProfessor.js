// Pedidos de acesso de PROFESSORES aguardando, já filtrados para o que esta pessoa pode aprovar
// (admin: todos; mentor: das unidades dele; líder: das unidades dele). Lista pequena: escuta ao vivo.
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { unidadesDoLider } from "../../../permissions";

export function usePedidosProfessor() {
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();
  const role = String(userData?.role || "").trim().toLowerCase();
  const userId = userData?.id || userData?.uid;
  const podeVer = ["admin", "mentor", "lider", "unidade"].includes(role);
  const [todos, setTodos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!podeVer) return;
    // Os dois filtros são exigidos pelas regras do banco para o líder (só lê pedidos de professor).
    const q = query(collection(db, "solicitacoes_acesso"), where("papel", "==", "professor"), where("status", "==", "pendente"));
    return onSnapshot(
      q,
      (snap) => { setTodos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setCarregando(false); },
      (e) => { console.error("Erro ao ler pedidos de professor", e); setCarregando(false); }
    );
  }, [podeVer]);

  const pedidos = useMemo(() => {
    if (!podeVer) return [];
    if (role === "admin") return todos;
    const unidades = catalogs?.unidades || [];
    const minhas = role === "mentor"
      ? new Set(unidades.filter((u) => u.mentorId === userId).map((u) => String(u.id)))
      : new Set(unidadesDoLider(userData).map(String));
    return todos.filter((p) => minhas.has(String(p.unidadeId)));
  }, [podeVer, todos, role, catalogs?.unidades, userId, userData]);

  return { pedidos, carregando: podeVer && carregando };
}

