// Participantes de um workshop (workshops_cadastro/{id}/participantes/{codigo}); só o admin lê e grava.
//  - ligado: a pessoa foi achada no cadastro de professores (professorIds = as fichas dela);
//  - sem-cadastro: fica guardada (nome, e-mail, telefone) para ligar depois, se virar professor.
// Quem está ligado também recebe o workshop em professores/{id}.workshops (mesmo formato dos certificados:
// { id, nome, data, por, em }), com id "wk_{workshopId}" para importar de novo não repetir.
import { collection, doc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { fichasEscolhidas, idParticipante, lerLista } from '../utils/importarParticipantes';

const COL = 'workshops_cadastro';
const TAMANHO_LOTE = 10; // a regra de professores confere a gaveta do documento: poucas gravações por lote
const refParticipantes = (workshopId) => collection(db, COL, workshopId, 'participantes');
const refParticipante = (workshopId, id) => doc(db, COL, workshopId, 'participantes', id);
const quem = () => auth.currentUser?.uid || '-';
export const idItemWorkshop = (workshopId) => `wk_${workshopId}`;

/** Lê o .xlsx na máquina (nada é enviado) e devolve { dataIso, local, linhas } ou { erro }. */
export async function lerArquivoXlsx(arquivo) {
  const X = await import('xlsx');
  const wb = X.read(await arquivo.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { erro: 'vazio', linhas: [] };
  // A plataforma declara o tamanho da planilha errado (A1:A70): recalcula pelo que existe de verdade.
  let maxR = 0; let maxC = 0;
  Object.keys(ws).forEach((k) => {
    if (k[0] === '!') return;
    const a = X.utils.decode_cell(k);
    maxR = Math.max(maxR, a.r); maxC = Math.max(maxC, a.c);
  });
  ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  return lerLista(X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }));
}

export async function lerParticipantes(workshopId) {
  const snap = await getDocs(refParticipantes(workshopId));
  return snap.docs.map((d) => ({ id: d.id, professorIds: [], ...d.data() }));
}

const itemDoWorkshop = (workshop, por) => ({
  id: idItemWorkshop(workshop.id), workshopId: workshop.id, ...(workshop.modalidade ? { modalidade: workshop.modalidade } : {}), nome: workshop.nome, data: workshop.data, por, em: new Date().toISOString(),
});

/** Lista de gravações em lotes pequenos. */
async function gravarEmLotes(operacoes) {
  const lotes = [];
  for (let i = 0; i < operacoes.length; i += TAMANHO_LOTE) lotes.push(operacoes.slice(i, i + TAMANHO_LOTE));
  // Vários lotes ao mesmo tempo (4 por vez): bem mais rápido que um por um, e cada lote continua independente.
  for (let i = 0; i < lotes.length; i += 4) {
    await Promise.all(lotes.slice(i, i + 4).map((ops) => {
      const batch = writeBatch(db);
      ops.forEach((op) => op(batch));
      return batch.commit();
    }));
  }
}

/** Coloca (ou tira) o workshop da lista do professor, sem repetir. `fichasPorId` = id -> ficha com o campo workshops. */
function espelhoNoProfessor(workshop, professorId, fichasPorId, { tirar = false, por = 'importação' } = {}) {
  const ficha = fichasPorId.get(String(professorId));
  const sem = (ficha?.workshops || []).filter((w) => w.id !== idItemWorkshop(workshop.id));
  const novos = tirar ? sem : [...sem, itemDoWorkshop(workshop, por)];
  return (batch) => batch.update(doc(db, 'professores', String(professorId)), { workshops: novos });
}

const contador = (workshop, total) => (batch) => batch.update(doc(db, COL, workshop.id), {
  totalParticipantes: total, atualizadoEm: serverTimestamp(), atualizadoPor: quem(),
});

/**
 * Grava a importação conferida. `linhas` = só as marcadas (já com o grupo escolhido). Importar o mesmo arquivo de novo
 * atualiza as mesmas pessoas (mesmo código), sem repetir. Devolve { gravados, ligados, semCadastro, total }.
 */
export async function gravarImportacao({ workshop, linhas, existentes, fichas }) {
  const fichasPorId = new Map((fichas || []).map((f) => [String(f.id), f]));
  const porId = new Map((existentes || []).map((p) => [p.id, p]));
  const ops = []; const espelhados = new Set();
  let ligados = 0; let semCadastro = 0;

  for (const l of linhas) {
    const id = idParticipante(l);
    const antes = porId.get(id);
    const ids = [...new Set([...(antes?.professorIds || []), ...fichasEscolhidas(l)])];
    const dados = {
      nome: l.nome, email: l.email || '', telefone: l.telefones[0] || '', ...(l.telefones[1] ? { telefone2: l.telefones[1] } : {}),
      professorIds: ids, status: ids.length ? 'ligado' : 'sem-cadastro', origem: antes?.origem || 'importacao',
      ...(antes ? {} : { criadoEm: serverTimestamp(), criadoPor: quem() }), atualizadoEm: serverTimestamp(), atualizadoPor: quem(),
    };
    ops.push((batch) => batch.set(refParticipante(workshop.id, id), dados, { merge: true }));
    porId.set(id, { ...(antes || {}), id, professorIds: ids });
    if (ids.length) ligados += 1; else semCadastro += 1;
    ids.forEach((pid) => {
      if (espelhados.has(pid) || !fichasPorId.has(pid)) return;
      espelhados.add(pid);
      ops.push(espelhoNoProfessor(workshop, pid, fichasPorId));
    });
  }
  const total = porId.size;
  ops.push(contador(workshop, total));
  await gravarEmLotes(ops);
  return { gravados: linhas.length, ligados, semCadastro, total };
}

/** Liga um participante "sem cadastro" a uma ou mais fichas de professor (e coloca o workshop no perfil). */
export async function ligarParticipante({ workshop, participante, professorIds, fichas }) {
  const fichasPorId = new Map((fichas || []).map((f) => [String(f.id), f]));
  const ids = [...new Set([...(participante.professorIds || []), ...professorIds.map(String)])];
  const ops = [(batch) => batch.set(refParticipante(workshop.id, participante.id),
    { professorIds: ids, status: 'ligado', atualizadoEm: serverTimestamp(), atualizadoPor: quem() }, { merge: true })];
  ids.filter((pid) => fichasPorId.has(pid)).forEach((pid) => ops.push(espelhoNoProfessor(workshop, pid, fichasPorId, { por: 'ligado pelo admin' })));
  await gravarEmLotes(ops);
}

/** Tira o participante; o workshop sai do perfil dos professores dele (se nenhum outro participante os usa). */
export async function removerParticipante({ workshop, participante, todos, fichas }) {
  const fichasPorId = new Map((fichas || []).map((f) => [String(f.id), f]));
  const outros = todos.filter((p) => p.id !== participante.id);
  const emUso = new Set(outros.flatMap((p) => p.professorIds || []));
  const ops = [(batch) => batch.delete(refParticipante(workshop.id, participante.id))];
  (participante.professorIds || []).filter((pid) => !emUso.has(pid) && fichasPorId.has(pid))
    .forEach((pid) => ops.push(espelhoNoProfessor(workshop, pid, fichasPorId, { tirar: true })));
  ops.push(contador(workshop, outros.length));
  await gravarEmLotes(ops);
}

/** Acerta o contador do workshop se ficou diferente da lista (ex.: uma gravação em lotes falhou no meio). */
export async function acertarContador(workshop, total) {
  if (Number(workshop.totalParticipantes || 0) === total) return;
  await gravarEmLotes([contador(workshop, total)]);
}
