// (Também: pedidos de OUTRA unidade de líderes, coleção pedidos_unidade; ver Lideres/pedidoOutraUnidade.js.)
// Pedidos de acesso (login pelo Google) aguardando aprovação + avisos de saída ("não sou mais da unidade /
// mentor", coleção saidas_acesso) ainda não tratados.
// Admin vê todos; mentor vê só os das unidades dele (aviso de saída de mentor é só do admin). Listas pequenas: escuta ao vivo.
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";

// Unidades do pedido (pedido antigo só tem unidadeId; o novo tem até 5 em unidadeIds).
export const idsDoPedido = (p) =>
  (Array.isArray(p?.unidadeIds) && p.unidadeIds.length ? p.unidadeIds : p?.unidadeId ? [p.unidadeId] : []).map(String);

export function usePedidosPendentes() {
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();
  const role = String(userData?.role || "").trim().toLowerCase();
  const userId = userData?.id || userData?.uid;
  const podeVer = role === "admin" || role === "mentor";

  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [saidasTodas, setSaidasTodas] = useState([]);

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

  useEffect(() => {
    if (!podeVer) return;
    const q = query(collection(db, "saidas_acesso"), where("status", "==", "pendente"));
    return onSnapshot(
      q,
      (snap) => setSaidasTodas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error("Erro ao ler avisos de saída", e)
    );
  }, [podeVer]);

  // Pedidos de outra unidade feitos por líderes (um por unidade; ver Lideres/pedidoOutraUnidade.js).
  const [extrasTodos, setExtrasTodos] = useState([]);
  useEffect(() => {
    if (!podeVer) return;
    const q = query(collection(db, "pedidos_unidade"), where("status", "==", "pendente"));
    return onSnapshot(
      q,
      (snap) => setExtrasTodos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error("Erro ao ler pedidos de outra unidade", e)
    );
  }, [podeVer]);

  const extras = useMemo(() => {
    if (!podeVer) return [];
    if (role === "admin") return extrasTodos;
    const minhas = new Set((catalogs?.unidades || []).filter((u) => u.mentorId === userId).map((u) => u.id));
    return extrasTodos.filter((x) => minhas.has(String(x.unidadeId)));
  }, [podeVer, extrasTodos, role, catalogs?.unidades, userId]);

  const visiveis = useMemo(() => {
    if (!podeVer) return [];
    if (role === "admin") return pedidos;
    // Mentor: só pedidos de LÍDER que tenham alguma unidade dele (pedido de mentor é só do admin).
    const minhas = new Set((catalogs?.unidades || []).filter((u) => u.mentorId === userId).map((u) => u.id));
    return pedidos.filter((p) => (p.papel || "lider") === "lider" && idsDoPedido(p).some((id) => minhas.has(id)));
  }, [podeVer, pedidos, role, catalogs?.unidades, userId]);

  const saidas = useMemo(() => {
    if (!podeVer) return [];
    if (role === "admin") return saidasTodas;
    const minhas = new Set((catalogs?.unidades || []).filter((u) => u.mentorId === userId).map((u) => u.id));
    return saidasTodas.filter((a) => a.papel !== "mentor" && (a.unidadeIds || []).some((id) => minhas.has(String(id))));
  }, [podeVer, saidasTodas, role, catalogs?.unidades, userId]);

  return { pedidos: visiveis, saidas, extras, total: visiveis.length + saidas.length + extras.length, carregando: podeVer && carregando };
}
