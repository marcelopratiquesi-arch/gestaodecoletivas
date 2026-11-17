// Cópia PÚBLICA da grade de aulas (coleção aulas_publicas), usada pela página de horários /horarios.
//
// Por quê: a página pública abre sem login e antes lia a coleção "aulas" inteira, que guarda o VALOR que cada
// professor recebe por aula. O Firestore não esconde campos, então a página passa a ler esta cópia, que tem
// exatamente os mesmos dados da aula (mesmo id) MENOS o valor e os carimbos internos.
//
// Quem grava aula (Cronograma, Radar, Juntar fichas) grava a cópia NA MESMA operação (lote), então as duas
// nunca ficam diferentes. Depois de restaurar um backup ou mexer direto no banco, o admin usa
// "Atualizar página pública" (reconstruirVitrine), que refaz a cópia inteira.
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export const COLECAO_AULAS_PUBLICAS = 'aulas_publicas';

// O que NUNCA vai para a cópia pública.
const CAMPOS_PRIVADOS = ['valor', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'dataCriacao'];

export function dadosPublicosAula(dados) {
  const publico = {};
  for (const [campo, valor] of Object.entries(dados || {})) {
    if (!CAMPOS_PRIVADOS.includes(campo) && valor !== undefined) publico[campo] = valor;
  }
  return publico;
}

export const refAulaPublica = (id) => doc(db, COLECAO_AULAS_PUBLICAS, String(id));

/** Aula criada ou reescrita por inteiro: a cópia é substituída. */
export const espelharAula = (lote, id, dados) => lote.set(refAulaPublica(id), dadosPublicosAula(dados));

/** Só alguns campos da aula mudaram (ex.: fim da vigência, troca de professor): mescla na cópia. */
export const espelharMudanca = (lote, id, campos) => lote.set(refAulaPublica(id), dadosPublicosAula(campos), { merge: true });

/** Aula enviada para a lixeira: sai da página pública. */
export const removerAulaPublica = (lote, id) => lote.delete(refAulaPublica(id));

const TAMANHO_LOTE = 450; // limite do Firestore: 500 operações por lote

/**
 * Refaz a cópia inteira (só admin): copia as aulas que não estão na lixeira e apaga da cópia o que não existe mais.
 * Custa 1 leitura por aula + 1 por item da cópia atual.
 */
export async function reconstruirAulasPublicas() {
  const [aulasSnap, copiaSnap] = await Promise.all([
    getDocs(collection(db, 'aulas')),
    getDocs(collection(db, COLECAO_AULAS_PUBLICAS)),
  ]);
  const vivas = aulasSnap.docs.filter(d => d.data().excluido !== true);
  const idsVivos = new Set(vivas.map(d => d.id));

  const ops = [
    ...vivas.map(d => (b) => espelharAula(b, d.id, d.data())),
    ...copiaSnap.docs.filter(d => !idsVivos.has(d.id)).map(d => (b) => removerAulaPublica(b, d.id)),
  ];
  for (let i = 0; i < ops.length; i += TAMANHO_LOTE) {
    const lote = writeBatch(db);
    ops.slice(i, i + TAMANHO_LOTE).forEach(op => op(lote));
    await lote.commit();
  }
  return { aulas: vivas.length, removidas: copiaSnap.size - copiaSnap.docs.filter(d => idsVivos.has(d.id)).length };
}
