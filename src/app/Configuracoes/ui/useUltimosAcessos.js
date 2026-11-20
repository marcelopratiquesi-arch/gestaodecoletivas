// Último acesso de várias pessoas (crachá usuarios/{uid}.ultimoAcesso), para a coluna "Acesso" das tabelas.
// Economia de leituras: cada crachá é lido UMA vez por sessão (guardado aqui na memória do navegador);
// abrir a aba de novo não lê de novo. Lê em grupos de 30 (limite do "in" do Firestore).
import { useEffect, useMemo, useState } from "react";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../services/firebase";

const guardados = new Map(); // uid -> carimbo do último acesso (ou null = nunca entrou / sem crachá)
const extras = new Map(); // uid -> { documentoOk, criadoEm } (vem junto, sem leitura a mais)
const falharam = new Set(); // uids que não deu para ler nesta sessão (não fica "carregando" para sempre)
const GRUPO = 30;
const pendente = (uid) => !guardados.has(uid) && !falharam.has(uid);

async function buscarFaltando(uids) {
  const faltando = uids.filter(pendente);
  for (let i = 0; i < faltando.length; i += GRUPO) {
    const grupo = faltando.slice(i, i + GRUPO);
    try {
      const snap = await getDocs(query(collection(db, "usuarios"), where(documentId(), "in", grupo)));
      const achados = new Map(snap.docs.map((d) => [d.id, d.data().ultimoAcesso || null]));
      for (const uid of grupo) guardados.set(uid, achados.get(uid) ?? null);
      // Aproveita a MESMA leitura: documento conferido e data de cadastro (ficha da aba Líderes no computador).
      for (const d of snap.docs) { const x = d.data(); extras.set(d.id, { documentoOk: x.documentoOk === true, criadoEm: x.criadoEm || null }); }
    } catch (e) {
      console.warn("Último acesso não carregado:", e?.code || e);
      for (const uid of grupo) falharam.add(uid);
    }
  }
}

/**
 * @param {(string|null|undefined)[]} uids
 * @returns {{acessoDe:(uid:string)=>any, crachaDe:(uid:string)=>({documentoOk:boolean,criadoEm:any}|null), carregando:boolean}}
 */
export function useUltimosAcessos(uids) {
  const chave = useMemo(() => [...new Set((uids || []).filter(Boolean).map(String))].sort().join("|"), [uids]);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    const lista = chave ? chave.split("|") : [];
    if (!lista.some(pendente)) return undefined;
    let vivo = true;
    buscarFaltando(lista).finally(() => { if (vivo) setVersao((v) => v + 1); });
    return () => { vivo = false; };
  }, [chave]);

  // `versao` só força a tela a redesenhar depois que os carimbos chegam.
  const { acessoDe, crachaDe, carregando } = useMemo(() => {
    void versao;
    return {
      acessoDe: (uid) => (uid ? guardados.get(String(uid)) ?? null : null),
      crachaDe: (uid) => (uid ? extras.get(String(uid)) ?? null : null),
      carregando: chave ? chave.split("|").some(pendente) : false,
    };
  }, [versao, chave]);

  return { acessoDe, crachaDe, carregando };
}
