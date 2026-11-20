// Dados e funções das telas de entrada (separados dos componentes por causa do recarregamento rápido do Vite).
import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
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

// Lista pública de unidades (só nome, cidade, estado, país, modalidades habilitadas e nome do mentor): 1 leitura.
export function useUnidadesPublicas(ativo = true) {
  const [unidades, setUnidades] = useState(null);
  useEffect(() => {
    if (!ativo || unidades) return;
    getDoc(doc(db, ...VITRINE_CAMINHO))
      .then((snap) => {
        const mapa = snap.exists() ? snap.data().unidades || {} : {};
        setUnidades(
          Object.entries(mapa)
            .map(([id, u]) => ({ id, nome: u?.nome || "", cidade: u?.cidade || "", estado: u?.estado || "", mentorNome: u?.mentorNome || "", pais: u?.pais || "", modalidadesIds: Array.isArray(u?.modalidadesIds) ? u.modalidadesIds.map(String) : null }))
            .filter((u) => u.nome)
            .sort((a, b) => a.nome.localeCompare(b.nome))
        );
      })
      .catch((e) => { console.error(e); setUnidades([]); });
  }, [ativo, unidades]);
  return unidades;
}

// Modalidades cadastradas em Configurações (só as ativas), para o professor escolher ao pedir acesso.
// A coleção é de leitura aberta (quem ainda não tem crachá também lê). Guarda na memória para ler uma vez só.
let cacheModalidades = null;
export function useModalidadesAtivas(ativo = true) {
  const [lista, setLista] = useState(cacheModalidades);
  useEffect(() => {
    if (!ativo || cacheModalidades) return;
    getDocs(query(collection(db, "modalidades"), where("status", "==", "ativa")))
      .then((snap) => {
        cacheModalidades = snap.docs
          .map((d) => ({ id: d.id, nome: String(d.data().nome || "").trim(), cor: d.data().cor || "" }))
          .filter((m) => m.nome)
          .sort((a, b) => a.nome.localeCompare(b.nome));
        setLista(cacheModalidades);
      })
      .catch((e) => { console.error(e); setLista([]); });
  }, [ativo]);
  return lista; // null = carregando
}

// Só as modalidades habilitadas na unidade escolhida. Unidade sem o campo (ainda não configurada, ou vitrine ainda não
// atualizada) = todas as ativas, como era antes. Sem unidade escolhida = lista vazia.
export function modalidadesDaUnidade(lista, unidade) {
  if (!lista || !unidade) return [];
  return Array.isArray(unidade.modalidadesIds) ? lista.filter((m) => unidade.modalidadesIds.includes(String(m.id))) : lista;
}

// As modalidades escolhidas ficam guardadas como texto "Zumba, Pilates" (mesmo formato de sempre).
export const LIMITE_MODALIDADES = 300;
export const modalidadesDoTexto = (texto) => String(texto || "").split(",").map((s) => s.trim()).filter(Boolean);
