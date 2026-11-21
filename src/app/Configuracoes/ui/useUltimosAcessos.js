// Último acesso de várias pessoas (crachá usuarios/{uid}.ultimoAcesso), para a coluna "Acesso" das tabelas.
// Economia de leituras: cada crachá é lido UMA vez por sessão (guardado aqui na memória do navegador);
// abrir a aba de novo não lê de novo. Lê em grupos de 30 (limite do "in" do Firestore).
import { useEffect, useMemo, useState } from "react";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../services/firebase";

const guardados = new Map(); // uid -> carimbo do último acesso (ou null = nunca entrou / sem crachá)
const cadastros = new Map(); // uid -> o que o selo "cadastro incompleto" precisa (vem do MESMO crachá lido: 0 leituras a mais)
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
      snap.docs.forEach((d) => {
        const x = d.data();
        cadastros.set(d.id, { nome: x.nome, telefone: x.telefone, documentoOk: x.documentoOk, nascimentoOk: x.nascimentoOk, loginGoogle: x.loginGoogle });
      });
      for (const uid of grupo) guardados.set(uid, achados.get(uid) ?? null);
    } catch (e) {
      console.warn("Último acesso não carregado:", e?.code || e);
      for (const uid of grupo) falharam.add(uid);
    }
  }
}

/**
 * @param {(string|null|undefined)[]} uids
 * @returns {{acessoDe:(uid:string)=>any, cadastroDe:(uid:string)=>object|null, carregando:boolean}}
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
  const { acessoDe, cadastroDe, carregando } = useMemo(() => {
    void versao;
    return {
      acessoDe: (uid) => (uid ? guardados.get(String(uid)) ?? null : null),
      cadastroDe: (uid) => (uid ? cadastros.get(String(uid)) ?? null : null),
      carregando: chave ? chave.split("|").some(pendente) : false,
    };
  }, [versao, chave]);

  return { acessoDe, cadastroDe, carregando };
}
