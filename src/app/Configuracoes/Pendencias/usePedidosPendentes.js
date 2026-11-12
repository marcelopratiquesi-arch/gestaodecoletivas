// Pedidos de acesso (login pelo Google) aguardando aprovação.
// Admin vê todos; mentor vê só os das unidades dele. Lista pequena: escuta ao vivo.
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";

export function usePedidosPendentes() {
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();
  const role = String(userData?.role || "").trim().toLowerCase();
  const userId = userData?.id || userData?.uid;
  const podeVer = role === "admin" || role === "mentor";

  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!podeVer) return;
    const q = query(collection(db, "solicitacoes_acesso"), where("status", "==", "pendente"));
    return onSnapshot(
      q,
      (snap) => {
        setPedidos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCarregando(false);
      },
      (e) => { console.error("Erro ao ler pedidos de acesso", e); setCarregando(false); }
    );
  }, [podeVer]);

  const visiveis = useMemo(() => {
    if (!podeVer) return [];
    if (role === "admin") return pedidos;
    const minhas = new Set((catalogs?.unidades || []).filter((u) => u.mentorId === userId).map((u) => u.id));
    return pedidos.filter((p) => minhas.has(p.unidadeId));
  }, [podeVer, pedidos, role, catalogs?.unidades, userId]);

  return { pedidos: visiveis, carregando: podeVer && carregando };
}
