// Reservas de e-mail e telefone: contatos_unicos/{email_x | tel_BR:xx} = { tipo, uid?, professorId? }.
// Mesmo modelo do documento (documentos_unicos): a reserva de OUTRA pessoa não pode ser tomada (o banco recusa).
// PARTE B da F3: as telas conferem ANTES de salvar (conferirContatos) e não salvam e-mail/telefone novo que já é
// de outra pessoa. Depois de salvar, sincronizarContatos acerta as reservas (e ainda avisa se alguém tomou a chave no meio).
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, where, writeBatch } from 'firebase/firestore';
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

// O crachá do professor nem sempre guarda o id da ficha. Procura a ficha ligada a este login (1 consulta).
async function fichaDoLogin(uid) {
  try {
    const snap = await getDocs(query(collection(db, 'professores'), where('uidLogin', '==', String(uid)), limit(1)));
    return snap.empty ? '' : snap.docs[0].id;
  } catch {
    return '';
  }
}

/**
 * Acerta as reservas de uma pessoa depois de salvar o cadastro: libera as chaves que saíram, cria as que entraram.
 * dono: { uid?, professorId? } (crachá e/ou ficha ligada). antes/depois: { email, telefone, pais }.
 * Nunca lança erro, e o problema de UMA chave não impede as outras: devolve { conflitos: [{ id, tipo }] }
 * com os dados que já são de outra pessoa. As chaves são tratadas ao mesmo tempo (menos espera na tela).
 */
export async function sincronizarContatos({ dono, antes = null, depois = null }) {
  if (!dono?.uid && !dono?.professorId) return { conflitos: [] };
  const novas = chavesDeContato(depois || {});
  const idsNovos = new Set(novas.map(c => c.id));

  // Quem não tem o id da ficha no crachá: descobre uma vez só, se for preciso.
  let buscaFicha = null;
  const descobrirFicha = () => (buscaFicha ||= (dono.uid ? fichaDoLogin(dono.uid) : Promise.resolve('')));

  const soltar = async ({ id }) => {
    try {
      const { dados } = await lerReserva(id);
      if (dados && mesmoDono(dados, dono)) await deleteDoc(refReserva(id));
    } catch (e) {
      // Sem permissão para apagar a antiga (ex.: líder): ela fica de sobra; o admin limpa depois. Não trava as outras.
      console.error('Não consegui soltar a reserva antiga', id, e);
    }
  };

  const reservar = async ({ id, tipo }) => {
    try {
      const { lida, dados } = await lerReserva(id);
      let eu = dono;
      const minha = dados && (mesmoDono(dados, eu) || await fichaLigadaAoDono(dados, eu));
      if (lida && dados && !minha) return { id, tipo };
      // Não consegui ler: pode ser de outra pessoa OU só da minha ficha (o crachá não guardava o id dela).
      if (!lida && !eu.professorId) {
        const professorId = await descobrirFicha();
        if (professorId) eu = { ...eu, professorId };
      }
      const alvo = dadosDaReserva(tipo, {
        uid: eu.uid || dados?.uid,
        professorId: eu.professorId || dados?.professorId,
      });
      if (dados && dados.uid === alvo.uid && dados.professorId === alvo.professorId) return null; // já está certa
      try {
        await setDoc(refReserva(id), alvo);
      } catch (e) {
        if (e?.code === 'permission-denied') return { id, tipo };
        throw e;
      }
      return null;
    } catch (e) {
      console.error('Não consegui acertar a reserva de e-mail/telefone', id, e);
      return null;
    }
  };

  await Promise.all(chavesDeContato(antes || {}).filter(c => !idsNovos.has(c.id)).map(soltar));
  const resultados = await Promise.all(novas.map(reservar));
  return { conflitos: resultados.filter(Boolean) };
}

/**
 * PARTE B: confere ANTES de salvar se o e-mail/telefone NOVO já é de outra pessoa (só as chaves que mudaram:
 * quem já tinha o dado continua podendo editar o resto do cadastro). dono: { uid?, professorId? } ou {} (cadastro novo).
 * Devolve { conflitos: [{ id, tipo }] }. Sem permissão para ler = reserva de outra pessoa (a regra deixa ler a
 * própria e a que não existe). Erro de conexão não bloqueia (a sincronização depois ainda avisa).
 */
export async function conferirContatos({ dono = {}, antes = null, depois = null }) {
  const velhas = new Set(chavesDeContato(antes || {}).map(c => c.id));
  const novas = chavesDeContato(depois || {}).filter(c => !velhas.has(c.id));
  const resultados = await Promise.all(novas.map(async ({ id, tipo }) => {
    try {
      const { lida, dados } = await lerReserva(id);
      if (!lida) return { id, tipo };
      if (!dados) return null;
      if (mesmoDono(dados, dono) || await fichaLigadaAoDono(dados, dono)) return null;
      return { id, tipo, dono: dados };
    } catch (e) {
      console.error('Não consegui conferir a reserva de e-mail/telefone', id, e);
      return null;
    }
  }));
  return { conflitos: resultados.filter(Boolean) };
}

/** Mensagem de bloqueio "não salvo: já é de outra pessoa" (ou '' se está livre). */
export function bloqueioDeContato(conflitos, t) {
  const tipos = new Set((conflitos || []).map(c => c.tipo));
  if (!tipos.size) return '';
  const campos = tipos.size === 2 ? t('contacts.fields.both') : t(`contacts.fields.${[...tipos][0]}`);
  return t('contacts.blocked', { fields: campos });
}

/** Atalho: confere e devolve a mensagem de bloqueio ('' = pode salvar). */
export async function mensagemSeContatoEmUso(params, t) {
  const { conflitos } = await conferirContatos(params);
  return bloqueioDeContato(conflitos, t);
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
 * Se a reserva também é da outra parte da pessoa (login + ficha ligada), só tira a parte excluída.
 * soltarTudo (juntar fichas): apaga a reserva inteira — a ficha que fica grava a dela em seguida; sem isso o login
 * da ficha apagada ficaria como dono solto e a ficha principal veria o próprio contato como "de outra pessoa".
 * Nunca lança erro; cada chave é tratada separada.
 */
export async function liberarContatos(sai, dados, { soltarTudo = false } = {}) {
  await Promise.all(chavesDeContato(dados || {}).map(async ({ id, tipo }) => {
    try {
      const { dados: r } = await lerReserva(id);
      if (!r || !mesmoDono(r, sai)) return;
      const fica = soltarTudo ? { tipo } : dadosDaReserva(tipo, {
        uid: r.uid && r.uid !== sai.uid ? r.uid : '',
        professorId: r.professorId && String(r.professorId) !== String(sai.professorId ?? '') ? r.professorId : '',
      });
      if (fica.uid || fica.professorId) await setDoc(refReserva(id), fica);
      else await deleteDoc(refReserva(id));
    } catch (e) {
      console.error('Não consegui liberar a reserva de e-mail/telefone', id, e);
    }
  }));
}

/** Todas as reservas (só o admin lista). Map(id → dados). */
export async function lerTodasAsReservas() {
  const snap = await getDocs(collection(db, 'contatos_unicos'));
  return new Map(snap.docs.map(d => [d.id, d.data()]));
}

// A regra confere a ficha de cada reserva, e o banco limita as consultas por gravação
// (no emulador 12 passou e 15 não): lotes de 10, com folga.
const LOTE_RESERVAS = 10;

/**
 * Grava as reservas que faltam, em lotes pequenos. reservas: [[id, dados]].
 * Se um lote é recusado (ex.: alguém tomou a chave nesse meio-tempo), grava uma a uma para isolar a ruim.
 * Devolve os ids que NÃO foram gravados.
 */
export async function gravarReservas(reservas) {
  const falhas = [];
  for (let i = 0; i < reservas.length; i += LOTE_RESERVAS) {
    const lote = reservas.slice(i, i + LOTE_RESERVAS);
    try {
      const batch = writeBatch(db);
      for (const [id, dados] of lote) batch.set(refReserva(id), dados);
      await batch.commit();
    } catch {
      for (const [id, dados] of lote) {
        try { await setDoc(refReserva(id), dados); } catch { falhas.push(id); }
      }
    }
  }
  return falhas;
}

/**
 * Aprovação de pedido: se o e-mail/telefone do pedido já é de outra pessoa, pergunta antes de aprovar
 * (pode ser o líder que também dá aula, com a ficha ainda não ligada). Devolve true = pode seguir.
 */
export async function confirmarSeContatoEmUso(params, t) {
  const { conflitos } = await conferirContatos(params);
  const tipos = new Set(conflitos.map(c => c.tipo));
  if (!tipos.size) return true;
  const campos = tipos.size === 2 ? t('contacts.fields.both') : t(`contacts.fields.${[...tipos][0]}`);
  return window.confirm(t('contacts.approveConfirm', { fields: campos }));
}
