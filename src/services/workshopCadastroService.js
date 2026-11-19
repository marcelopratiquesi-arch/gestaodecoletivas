// Cadastro de workshops: leitura ao vivo e gravações (coleção workshops_cadastro; só admin e mentor, pelas regras).
import { collection, doc, addDoc, updateDoc, deleteDoc, deleteField, onSnapshot, query, orderBy, serverTimestamp, writeBatch, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { montarWorkshop, chaveWorkshop } from '../utils/workshopCadastro';

import { acharFichaPorDocumento } from './documentoFichaService';
import { idDocumentoUnico } from '../utils/documento';

const COL = 'workshops_cadastro';

/**
 * Acha o professor pelo documento (CPF/DNI/SSN). 1º a ficha da grade (documentos_professor); 2º o login
 * (documentos_unicos -> uid -> ficha ligada ao login, ou o nome do crachá). Devolve
 * { professorId, nome } | { semNome: true } | null (não achou) | 'sem-permissao'.
 */
export async function buscarTitularPorDocumento(tipo, numero, professores) {
  try {
    const ficha = await acharFichaPorDocumento(tipo, numero);
    if (ficha) {
      const p = professores.find((x) => String(x.id) === ficha.professorId);
      return p ? { professorId: String(p.id), nome: p.nome } : { semNome: true };
    }
    const reserva = await getDoc(doc(db, 'documentos_unicos', idDocumentoUnico(tipo, numero)));
    if (!reserva.exists()) return null;
    const uid = reserva.data().uid;
    const p = professores.find((x) => x.uidLogin && x.uidLogin === uid);
    if (p) return { professorId: String(p.id), nome: p.nome };
    const crachá = await getDoc(doc(db, 'usuarios', uid));
    const nome = crachá.exists() ? crachá.data().nome : '';
    return nome ? { professorId: null, nome } : { semNome: true };
  } catch (e) {
    if (e?.code === 'permission-denied') return 'sem-permissao';
    throw e;
  }
}

/** Lista ao vivo (data mais nova primeiro). Devolve a função para parar de ouvir. */
export function ouvirWorkshops(aoMudar, aoErro) {
  return onSnapshot(
    query(collection(db, COL), orderBy('data', 'desc')),
    (snap) => aoMudar(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    aoErro,
  );
}

const quem = () => auth.currentUser?.uid || '-';

export async function criarWorkshop(dados, extra = {}) {
  return addDoc(collection(db, COL), {
    ...montarWorkshop(dados), totalParticipantes: 0, ...extra, criadoEm: serverTimestamp(), criadoPor: quem(),
  });
}

export async function atualizarWorkshop(id, dados) {
  const base = montarWorkshop(dados);
  // Titular apagado na tela: tira também do documento.
  await updateDoc(doc(db, COL, id), {
    ...base,
    titularNome: base.titularNome ?? deleteField(),
    titularProfessorId: base.titularProfessorId ?? deleteField(),
    atualizadoEm: serverTimestamp(), atualizadoPor: quem(),
  });
}

/** Cópia com outra data (e situação) para um workshop que se repete. Guarda de qual veio. */
export async function duplicarWorkshop(original, { nome, data, status }) {
  return criarWorkshop(
    { ...original, nome, data, status },
    { duplicadoDe: original.id },
  );
}

export async function excluirWorkshop(id) {
  // Confere de novo no servidor: a regra também barra, mas a mensagem fica clara.
  const atual = await getDoc(doc(db, COL, id));
  if (atual.exists() && Number(atual.data().totalParticipantes || 0) > 0) {
    const e = new Error('tem-participantes');
    e.code = 'tem-participantes';
    throw e;
  }
  await deleteDoc(doc(db, COL, id));
}

/**
 * Cadastro rápido: grava várias linhas de uma vez, pulando as que já existem (mesmo nome + mesma data),
 * para clicar duas vezes ou colar de novo não duplicar. Devolve { criados, jaExistiam }.
 */
export async function criarWorkshopsEmLote(linhas, existentes) {
  const jaTem = new Set(existentes.map((w) => chaveWorkshop(w.nome, w.data)));
  const novos = [];
  let jaExistiam = 0;
  for (const l of linhas) {
    const chave = chaveWorkshop(l.nome, l.data);
    if (jaTem.has(chave)) { jaExistiam += 1; continue; }
    jaTem.add(chave);
    novos.push(l);
  }
  for (let i = 0; i < novos.length; i += 400) {
    const batch = writeBatch(db);
    novos.slice(i, i + 400).forEach((l) => {
      batch.set(doc(collection(db, COL)), { ...montarWorkshop(l), totalParticipantes: 0, criadoEm: serverTimestamp(), criadoPor: quem() });
    });
    await batch.commit();
  }
  return { criados: novos.length, jaExistiam };
}
