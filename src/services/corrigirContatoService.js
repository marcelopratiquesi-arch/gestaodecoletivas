// "Corrigir" do relatório de repetidos (só admin): troca o e-mail/telefone de UMA ficha ou UM crachá,
// direto da lista de conflitos. Confere antes se o dado novo já é de outra pessoa (Parte B), grava,
// acerta as reservas e deixa registro na auditoria (com o valor antigo, para desfazer à mão se precisar).
import { addDoc, collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { conferirContatos, sincronizarContatos } from './contatoService';

/**
 * item: registro do relatório ({ origem: 'professor'|'cracha', id, nome, email, telefone, pais, uidLogin?, professorId?, unidadeIds? }).
 * novo: { email?, telefone } — telefone '' apaga o telefone. O e-mail do crachá é o do login do Google e não muda aqui.
 * unidades: catálogo (para o líder: o telefone da unidade acompanha o do crachá).
 * Devolve { conflitos } — se não vazio, NADA foi gravado.
 */
export async function corrigirContato({ item, novo, unidades = [], quem }) {
  const ehFicha = item.origem === 'professor';
  const dono = ehFicha
    ? { professorId: String(item.id), uid: item.uidLogin || undefined }
    : { uid: String(item.id), professorId: item.professorId || undefined };
  const antes = { email: item.email, telefone: item.telefone, pais: item.pais };
  const depois = { email: ehFicha ? novo.email : item.email, telefone: novo.telefone, pais: item.pais };

  const { conflitos } = await conferirContatos({ dono, antes, depois });
  if (conflitos.length) return { conflitos };

  const batch = writeBatch(db);
  if (ehFicha) {
    batch.update(doc(db, 'professores', String(item.id)), {
      telefone: novo.telefone, updatedAt: serverTimestamp(),
      ...(novo.email !== item.email ? { email: novo.email } : {}),
    });
  } else {
    batch.update(doc(db, 'usuarios', String(item.id)), { telefone: novo.telefone });
    // Líder: a unidade guarda uma cópia do telefone (vaga 1 e vaga 2).
    for (const u of unidades) {
      if (u.liderUid === item.id) batch.update(doc(db, 'unidades', String(u.id)), { liderTelefone: novo.telefone });
      if (u.lider2Uid === item.id) batch.update(doc(db, 'unidades', String(u.id)), { lider2Telefone: novo.telefone });
    }
  }
  await batch.commit();
  await sincronizarContatos({ dono, antes, depois });

  try {
    await addDoc(collection(db, 'auditoria_cronograma'), {
      tipoAcao: 'ALTERADA',
      descricao: ehFicha ? 'Contato da ficha corrigido no relatório de repetidos.' : 'Telefone do crachá corrigido no relatório de repetidos.',
      diffExtras: `${item.nome || '-'} [${item.id}]: `
        + (ehFicha && novo.email !== item.email ? `E-mail: ${item.email || '-'} ➔ ${novo.email || '-'} | ` : '')
        + `Telefone: ${item.telefone || '-'} ➔ ${novo.telefone || '(apagado)'}`,
      modulo: 'CONFIGURACOES',
      professorNome: item.nome || '-',
      unidadeNome: item.unidade || '-',
      modalidadeNome: '-',
      usuarioAcaoNome: quem?.nome || quem?.email || 'Administrador',
      usuarioAcaoId: quem?.id || null,
      dataAcao: serverTimestamp(),
    });
  } catch (e) { console.error('Falha ao gravar auditoria da correção', e); }
  return { conflitos: [] };
}
