// Dados e funções das telas de entrada (separados dos componentes por causa do recarregamento rápido do Vite).
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Building2, ShieldCheck, Dumbbell } from "lucide-react";
import { db } from "../../services/firebase";
import { VITRINE_CAMINHO } from "../../services/vitrinePublica";

// Ícone de cada função.
export const ICONE_FUNCAO = { lider: Building2, mentor: ShieldCheck, professor: Dumbbell };

// Função escolhida antes do Google ("Primeiro acesso" no login); a tela de pedido de acesso lê daqui.
export const CHAVE_PAPEL_PEDIDO = "pratique_papel_pedido";
export const FUNCOES_PEDIDO = ["lider", "mentor", "professor"];

export function lerPapelPedido() {
  try {
    const p = sessionStorage.getItem(CHAVE_PAPEL_PEDIDO);
    return FUNCOES_PEDIDO.includes(p) ? p : "";
  } catch { return ""; }
}
export function guardarPapelPedido(papel) {
  try { sessionStorage.setItem(CHAVE_PAPEL_PEDIDO, papel); } catch { /* segue sem guardar */ }
}

// Lista pública de unidades (só nome, cidade, estado e nome do mentor): 1 leitura.
export function useUnidadesPublicas(ativo = true) {
  const [unidades, setUnidades] = useState(null);
  useEffect(() => {
    if (!ativo || unidades) return;
    getDoc(doc(db, ...VITRINE_CAMINHO))
      .then((snap) => {
        const mapa = snap.exists() ? snap.data().unidades || {} : {};
        setUnidades(
          Object.entries(mapa)
            .map(([id, u]) => ({ id, nome: u?.nome || "", cidade: u?.cidade || "", estado: u?.estado || "", mentorNome: u?.mentorNome || "" }))
            .filter((u) => u.nome)
            .sort((a, b) => a.nome.localeCompare(b.nome))
        );
      })
      .catch((e) => { console.error(e); setUnidades([]); });
  }, [ativo, unidades]);
  return unidades;
}
