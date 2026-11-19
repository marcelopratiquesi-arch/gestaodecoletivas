// PULSEIRA E VALOR SUGERIDO DA AULA (cálculo puro, sem banco e sem tela). Regras do dono, 2026-11-19
// (ver tabela em src/utils/tabelaPrecos.js). O valor da aula continua digitado à mão: isto só SUGERE e COMPARA.
//
// Pulseira = em quantas modalidades diferentes o professor tem workshop (dois certificados da mesma modalidade
// contam UM), mas SÓ vale na modalidade da aula se ele tiver o workshop dela:
//   sem o workshop da modalidade da aula = cinza · 1 modalidade = verde · 2 = vermelha · 3 ou mais = preta*.
//   * A preta só se confirma depois que o mês fecha, com a média de alunos DO PRÓPRIO MÊS acima de 15 (aulas
//     das 6h às 16h59) ou de 25 (a partir das 17h). Enquanto isso o valor sugerido é o da vermelha, e o que a preta
//     acrescenta aparece como "extra" a ajustar no fim do mês.
// O workshop vale a partir do MÊS SEGUINTE à data dele (feito em 10/11, vale desde 01/12).
// Acadêmico (Saver): vale só na unidade do Saver e dentro do horário dele; fora disso, o valor normal.
// Jump/Energy Jump e Dance: aula seguida (uma logo depois da outra, intervalo de até 20 min) paga o valor de "2 a 3 aulas".
import { MODALIDADES_TABELA } from './tabelaPrecos.js';

const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Grupo de workshop (o que o professor "tem"): Jump e Energy Jump são o mesmo; Power Core vale para Core 20 e Core 40.
export function grupoDaModalidade(nome) {
  const n = semAcento(nome);
  if (!n) return null;
  if (n.includes('jump')) return 'jump';
  if (n.includes('dance')) return 'dance';
  if (n.includes('training')) return 'training';
  if (n.includes('core')) return 'core';
  if (n.includes('bumbum') || n.includes('boom')) return 'bumbum';
  if (n.includes('fight')) return 'fight';
  return null;
}

// Linha da tabela de preços para a modalidade da aula (null = sem preço, como Power Fight por enquanto).
export function chaveDaTabela(nome) {
  const g = grupoDaModalidade(nome);
  if (g === 'core') return /40/.test(String(nome)) ? 'core40' : 'core20';
  if (g === 'jump' || g === 'dance' || g === 'training' || g === 'bumbum') return g;
  return null;
}

// "AAAA-MM" do mês em que o workshop passa a valer (o mês seguinte à data dele).
export function mesDoBeneficio(dataISO) {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(String(dataISO || ''));
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  return mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`;
}

/** Grupos (modalidades) com workshop já em vigor no mês "AAAA-MM". `modalidadePorWorkshopId` completa itens antigos sem modalidade. */
export function gruposVigentes(workshops, mes, modalidadePorWorkshopId = {}) {
  const grupos = new Set();
  (Array.isArray(workshops) ? workshops : []).forEach((w) => {
    const inicio = mesDoBeneficio(w?.data);
    const g = grupoDaModalidade(w?.modalidade || modalidadePorWorkshopId[w?.workshopId]);
    if (g && inicio && inicio <= mes) grupos.add(g);
  });
  return grupos;
}

const NIVEL_POR_QUANTIDADE = ['cinza', 'verde', 'vermelha'];

/** Pulseira do professor numa modalidade, num mês. Preta só vira "candidata": a média do mês confirma depois. */
export function pulseiraDoProfessor(workshops, grupoDaAula, mes, modalidadePorWorkshopId = {}) {
  const grupos = gruposVigentes(workshops, mes, modalidadePorWorkshopId);
  if (!grupoDaAula || !grupos.has(grupoDaAula)) return { nivel: 'cinza', quantidade: grupos.size, candidataPreta: false };
  const q = grupos.size;
  if (q >= 3) return { nivel: 'vermelha', quantidade: q, candidataPreta: true };
  return { nivel: NIVEL_POR_QUANTIDADE[q], quantidade: q, candidataPreta: false };
}

const minutos = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Turno da aula: das 6h às 16h59 é manhã; a partir das 17h (e de madrugada) é noite. */
export function turnoDaHora(hhmm) {
  const m = minutos(hhmm);
  if (m === null) return null;
  return m >= 6 * 60 && m < 17 * 60 ? 'manha' : 'noite';
}

export const limiteDaPreta = (tabela, turno) => Number(tabela?.frequenciaPreta?.[turno === 'manha' ? 'manha' : 'noite']);

/**
 * O professor é Saver (acadêmico) nesta aula? Professor: { tipoContrato: 'saver', saverLocais: [{ unidadeId, horarios: [{ dia, ini, fim }] }] }
 * (dia 0 = domingo ... 6 = sábado; "ini" vale, "fim" não: 08:00-10:00 cobre uma aula às 09:59, não às 10:00).
 */
export function ehHorarioSaver(professor, unidadeId, dataISO, hhmm) {
  if (String(professor?.tipoContrato || '').toLowerCase() !== 'saver') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dataISO || ''));
  const hora = minutos(hhmm);
  if (!m || hora === null) return false;
  const dia = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
  return (professor.saverLocais || []).some((l) => String(l.unidadeId) === String(unidadeId)
    && (l.horarios || []).some((h) => Number(h.dia) === dia && hora >= minutos(h.ini) && hora < minutos(h.fim)));
}

const INTERVALO_SEGUIDAS_MIN = 20;

/**
 * Aulas seguidas de um professor NO MESMO DIA: só Jump/Energy Jump e Dance entre si (Training, Core e Bumbum não têm
 * valor de aulas seguidas). Cada aula: { id, modalidade, unidadeId, ini: 'HH:MM', fim: 'HH:MM' }.
 * Devolve Map id -> { seguida, posicao, tamanho }. Intervalo de até 20 minutos entre o fim de uma e o início da outra.
 */
export function marcarSeguidas(aulasDoDia) {
  const resultado = new Map();
  const elegiveis = (aulasDoDia || [])
    .filter((a) => ['jump', 'dance'].includes(grupoDaModalidade(a.modalidade)) && minutos(a.ini) !== null && minutos(a.fim) !== null)
    .sort((a, b) => minutos(a.ini) - minutos(b.ini));
  (aulasDoDia || []).forEach((a) => resultado.set(a.id, { seguida: false, posicao: 1, tamanho: 1 }));
  let cadeia = [];
  const fechar = () => {
    if (cadeia.length >= 2) cadeia.forEach((a, i) => resultado.set(a.id, { seguida: true, posicao: i + 1, tamanho: cadeia.length }));
    cadeia = [];
  };
  elegiveis.forEach((a) => {
    const anterior = cadeia[cadeia.length - 1];
    const folga = anterior ? minutos(a.ini) - minutos(anterior.fim) : null;
    if (anterior && String(anterior.unidadeId) === String(a.unidadeId) && folga >= 0 && folga <= INTERVALO_SEGUIDAS_MIN) cadeia.push(a);
    else { fechar(); cadeia = [a]; }
  });
  fechar();
  return resultado;
}

/**
 * Valor SUGERIDO para uma aula. Devolve null se não há preço (modalidade fora da tabela, como Power Fight, ou escondida).
 *   aula: { modalidade (nome), unidadeId, data 'AAAA-MM-DD', hora 'HH:MM', seguida }
 *   mediaMes: média de alunos do mês fechado (do professor naquela modalidade e turno); sem ela a preta fica pendente.
 * Resultado: { chave, nivel, campo, valor, candidataPreta, pretaPendente, valorPreta, extraPreta, saver, quantidade }
 */
export function valorSugerido({ tabela, professor, aula, mediaMes = null, modalidadePorWorkshopId = {} }) {
  const chave = chaveDaTabela(aula?.modalidade);
  if (!chave || !tabela?.precos?.[chave] || tabela.modalidades?.[chave]?.visivel === false) return null;
  const mes = String(aula.data || '').slice(0, 7);
  const grupo = grupoDaModalidade(aula.modalidade);
  const { nivel: base, quantidade, candidataPreta } = pulseiraDoProfessor(professor?.workshops, grupo, mes, modalidadePorWorkshopId);

  const turno = turnoDaHora(aula.hora);
  const pretaConfirmada = candidataPreta && mediaMes !== null && turno && Number(mediaMes) > limiteDaPreta(tabela, turno);
  const nivel = pretaConfirmada ? 'preta' : base;

  const saver = ehHorarioSaver(professor, aula.unidadeId, aula.data, aula.hora);
  const tipo = MODALIDADES_TABELA[chave].tipo;
  const campo = saver ? 'academico' : tipo === 'seguidas' ? (aula.seguida ? 'seguidas' : 'umaAula') : 'qualquer';
  const valor = tabela.precos[chave][nivel][campo];
  const valorPreta = candidataPreta ? tabela.precos[chave].preta[campo] : null;
  return {
    chave, nivel, campo, valor, quantidade, saver,
    candidataPreta,
    pretaPendente: candidataPreta && mediaMes === null,
    valorPreta,
    extraPreta: candidataPreta && mediaMes === null ? valorPreta - tabela.precos[chave].vermelha[campo] : 0,
  };
}

/** Compara o valor pago com o sugerido: 'sem-sugestao' | 'certo' | 'maior' (pago a mais) | 'menor' (pago a menos). */
export function compararValor(pago, sugerido) {
  if (sugerido === null || sugerido === undefined || !Number.isFinite(Number(sugerido))) return 'sem-sugestao';
  const diferenca = Number(pago) - Number(sugerido);
  if (Math.abs(diferenca) < 0.005) return 'certo';
  return diferenca > 0 ? 'maior' : 'menor';
}
