// Aprovar o pedido de acesso de um professor LIGANDO à ficha dele na grade (F2 da chave CPF).
//  - achar: fichas parecidas com o pedido (documento, e-mail, telefone, nome). O documento só admin e mentor
//    conseguem comparar (o número do pedido é privado); o líder compara e-mail/telefone/nome.
//  - aprovar: cria o crachá (já com professorId), liga a ficha (uidLogin) e fecha o pedido, tudo num lote.
//    Se a ficha ainda não tem documento e quem aprova é admin/mentor, o documento do pedido passa para a ficha.
// O número do documento nunca vai para auditoria, tela ou lista.
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { lerDocumentoDoPedido } from './documentoService';
import { acharFichaPorDocumento, documentoDaFichaNoLote, lerDocumentoDaFicha } from './documentoFichaService';
import { fichasParecidas, forcaDosCampos } from '../utils/repetidos';

/**
 * @returns {{ candidatas: {ficha, campos: string[], bloqueada?: string}[], documento: {tipo, numero}|null }}
 *  `bloqueada` = 'outroDocumento' (a ficha tem documento diferente do pedido) | 'documentoNaoConferido' (líder não confere).
 */
export async function acharFichasDoPedido({ pedido, fichas, pais, podeVerDocumento }) {
  const porCampos = new Map(); // professorId -> Set(campos)
  fichasParecidas(fichas, { email: pedido.email, telefone: pedido.telefone, pais, nome: pedido.nome })
    .forEach(a => porCampos.set(String(a.ficha.id), new Set(a.campos)));

  let documento = null;
  let donaDoDocumento = null;
  if (podeVerDocumento) {
    documento = await lerDocumentoDoPedido(pedido.id);
    if (documento) {
      const dona = await acharFichaPorDocumento(documento.tipo, documento.numero);
      donaDoDocumento = dona?.professorId || null;
      if (donaDoDocumento && (fichas || []).some(f => String(f.id) === donaDoDocumento)) {
        if (!porCampos.has(donaDoDocumento)) porCampos.set(donaDoDocumento, new Set());
        porCampos.get(donaDoDocumento).add('documento');
      }
    }
  }

  const candidatas = [];
  for (const [id, campos] of porCampos) {
    const ficha = (fichas || []).find(f => String(f.id) === id);
    if (!ficha) continue;
    const lista = [...campos];
    let bloqueada;
    if (!lista.includes('documento') && ficha.documentoOk) {
      if (!podeVerDocumento) bloqueada = 'documentoNaoConferido';
      else {
        // A ficha já tem documento e ele não é o do pedido: é outra pessoa (ou documento digitado errado).
        const doFicha = await lerDocumentoDaFicha(id).catch(() => null);
        if (!doFicha || !documento || doFicha.numero !== documento.numero || doFicha.tipo !== documento.tipo) bloqueada = 'outroDocumento';
      }
    }
    candidatas.push({ ficha, campos: lista, ...(bloqueada ? { bloqueada } : {}) });
  }
  candidatas.sort((a, b) => forcaDosCampos(b.campos) - forcaDosCampos(a.campos) || String(a.ficha.nome).localeCompare(String(b.ficha.nome)));
  return { candidatas, documento };
}

export async function aprovarProfessorPedido({ pedido, unidade, ficha = null, documento = null, podeLevarDocumento = false, quem }) {
  const batch = writeBatch(db);
  const idFicha = ficha ? String(ficha.id) : '';
  batch.set(doc(db, 'usuarios', pedido.id), {
    nome: pedido.nome, email: pedido.email, telefone: pedido.telefone,
    role: 'professor', unidadeId: String(unidade.id), status: 'ativo', loginGoogle: true,
    ...(pedido.modalidades ? { modalidades: pedido.modalidades } : {}),
    ...(idFicha ? { professorId: idFicha } : {}),
    criadoPor: quem.id, criadoEm: serverTimestamp(),
  });
  let levouDocumento = false;
  if (ficha) {
    const levar = podeLevarDocumento && documento && !ficha.documentoOk;
    batch.update(doc(db, 'professores', idFicha), {
      uidLogin: pedido.id, updatedAt: serverTimestamp(), ...(levar ? { documentoOk: true } : {}),
    });
    if (levar) {
      documentoDaFichaNoLote(batch, { professorId: idFicha, tipo: documento.tipo, numero: documento.numero, marcarFicha: false });
      levouDocumento = true;
    }
  }
  batch.update(doc(db, 'solicitacoes_acesso', pedido.id), {
    status: 'aprovado', analisadoPor: quem.id, analisadoPorNome: quem.nome, analisadoEm: serverTimestamp(),
  });
  await batch.commit();
  return { levouDocumento };
}
