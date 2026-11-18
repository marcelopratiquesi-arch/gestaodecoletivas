// Reservas de e-mail e telefone: contatos_unicos/{email_x | tel_BR:xx} = { tipo, uid?, professorId? }.
// Mesmo modelo do documento (documentos_unicos): a reserva de OUTRA pessoa não pode ser tomada (o banco recusa).
// PARTE A da F3 (agora): a reserva é gravada DEPOIS do salvamento normal e nunca o desfaz — se o dado já é de
// outra pessoa, a tela só avisa. A Parte B (depois da limpeza dos repetidos) passa a bloquear.
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { chavesDeContato, dadosDaReserva, mesmoDono } from '../utils/contatos';

const refReserva = (id) => doc(db, 'contatos_unicos', id);

async function lerReserva(id) {
  try {
    const snap = await getDoc(refReserva(id));
    return { lida: true, dados: snap.exists() ? snap.data() : null };
  } catch (e) {
    if (e?.code === 'permission-denied') return { lida: false, dados: null }; // reserva de outro: não pode ver
    throw e;
  }
}

// Reserva só da ficha (sem login) cuja ficha está ligada ao login de `dono`: também é a mesma pessoa.
async function fichaLigadaAoDono(r, dono) {
  if (!r?.professorId || r.uid || !dono?.uid) return false;
  try {
    const snap = await getDoc(doc(db, 'professores', String(r.professorId)));
    return snap.exists() && String(snap.data().uidLogin || '') === String(dono.uid);
  } catch {
    return false;
  }
}

/**
 * Acerta as reservas de uma pessoa depois de salvar o cadastro: libera as chaves que saíram, cria as que entraram.
 * dono: { uid?, professorId? } (crachá e/ou ficha ligada). antes/depois: { email, telefone, pais }.
 * Nunca lança erro: devolve { conflitos: [{ id, tipo }] } com os dados que já são de outra pessoa.
 */
export async function sincronizarContatos({ dono, antes = null, depois = null }) {
  const conflitos = [];
  if (!dono?.uid && !dono?.professorId) return { conflitos };
  const novas = chavesDeContato(depois || {});
  const idsNovos = new Set(novas.map(c => c.id));
  try {
    for (const { id } of chavesDeContato(antes || {})) {
      if (idsNovos.has(id)) continue;
      const { dados } = await lerReserva(id);
      if (dados && mesmoDono(dados, dono)) await deleteDoc(refReserva(id));
    }
    for (const { id, tipo } of novas) {
      const { lida, dados } = await lerReserva(id);
      const minha = dados && (mesmoDono(dados, dono) || await fichaLigadaAoDono(dados, dono));
      if (lida && dados && !minha) { conflitos.push({ id, tipo }); continue; }
      const alvo = dadosDaReserva(tipo, {
        uid: dono.uid || dados?.uid,
        professorId: dono.professorId || dados?.professorId,
      });
      if (dados && dados.uid === alvo.uid && dados.professorId === alvo.professorId) continue; // já está certa
      try {
        await setDoc(refReserva(id), alvo);
      } catch (e) {
        if (e?.code === 'permission-denied') conflitos.push({ id, tipo });
        else throw e;
      }
    }
  } catch (e) {
    console.error('Não consegui acertar as reservas de e-mail/telefone', e);
  }
  return { conflitos };
}

/** Texto do aviso "salvo, mas o e-mail/telefone também é de outra pessoa" (ou '' se não houve conflito). */
export function avisoDeConflito(conflitos, t) {
  const tipos = new Set((conflitos || []).map(c => c.tipo));
  if (!tipos.size) return '';
  const campos = tipos.size === 2 ? t('contacts.fields.both') : t(`contacts.fields.${[...tipos][0]}`);
  return t('contacts.inUse', { fields: campos });
}

/** Acerta as reservas e, se houver conflito, mostra o aviso. Para chamar logo depois de salvar. */
export async function sincronizarEAvisar(params, t) {
  const { conflitos } = await sincronizarContatos(params);
  const aviso = avisoDeConflito(conflitos, t);
  if (aviso) alert(aviso);
  return { conflitos };
}

/**
 * Libera as reservas de e-mail/telefone ao excluir o crachá ({ uid }) ou a ficha ({ professorId }).
 * Se a reserva também é da outra parte da pessoa (login + ficha ligada), só tira a parte excluída. Nunca lança erro.
 */
export async function liberarContatos(sai, dados) {
  try {
    for (const { id, tipo } of chavesDeContato(dados || {})) {
      const { dados: r } = await lerReserva(id);
      if (!r || !mesmoDono(r, sai)) continue;
      const fica = dadosDaReserva(tipo, {
        uid: r.uid && r.uid !== sai.uid ? r.uid : '',
        professorId: r.professorId && String(r.professorId) !== String(sai.professorId ?? '') ? r.professorId : '',
      });
      if (fica.uid || fica.professorId) await setDoc(refReserva(id), fica);
      else await deleteDoc(refReserva(id));
    }
  } catch (e) {
    console.error('Não consegui liberar as reservas de e-mail/telefone', e);
  }
}

/** Todas as reservas (só o admin lista). Map(id → dados). */
export async function lerTodasAsReservas() {
  const snap = await getDocs(collection(db, 'contatos_unicos'));
  return new Map(snap.docs.map(d => [d.id, d.data()]));
}

// A regra confere a ficha de cada reserva, e o banco limita as consultas por gravação
// (no emulador 12 passou e 15 não): lotes de 10, com folga.
const LOTE_RESERVAS = 10;

/** Grava as reservas que faltam, em lotes pequenos. reservas: [[id, dados]]. */
export async function gravarReservas(reservas) {
  for (let i = 0; i < reservas.length; i += LOTE_RESERVAS) {
    const batch = writeBatch(db);
    for (const [id, dados] of reservas.slice(i, i + LOTE_RESERVAS)) batch.set(refReserva(id), dados);
    await batch.commit();
  }
}
