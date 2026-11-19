// AUDITORIA DE VALORES (aba "Valores" do Relatório): cada aula realizada, o valor PAGO (o digitado no Cronograma, gravado
// na validação) contra o valor SUGERIDO pela tabela de preços. Só mostra; não altera nada e não recalcula o passado.
// Regras: src/utils/pulseira.js (pulseira por modalidade, vigência no mês seguinte, Saver, aulas seguidas, preta).
import { chaveDaTabela, compararValor, fimDaAula, grupoDaModalidade, marcarSeguidas, turnoDaHora, valorSugerido } from './pulseira.js';

const mesDe = (dataISO) => String(dataISO || '').slice(0, 7);

/** Último dia (AAAA-MM-DD) de um mês "AAAA-MM". */
export function ultimoDiaDoMes(mes) {
  const [a, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
}

/**
 * A média do mês só "vale" para confirmar a pulseira preta quando o mês JÁ FECHOU e o período da tela cobre o mês todo
 * (senão a média seria parcial).
 */
export function mesConfirmavel(mes, periodo, hojeISO) {
  const fim = ultimoDiaDoMes(mes);
  return fim < hojeISO && String(periodo?.start || '9999') <= `${mes}-01` && String(periodo?.end || '0000') >= fim;
}

/**
 * Médias de alunos por professor + modalidade (grupo) + turno + mês, só de aulas realizadas (aulão fora).
 * @returns Map "professorId|grupo|turno|AAAA-MM" -> { total, aulas, media }
 */
export function mediasDoMes(validacoes, aulaPorId, nomeDaModalidade) {
  const mapa = new Map();
  (validacoes || []).forEach((v) => {
    if (v.status !== 'realizada' || v.isAulao || !Number.isFinite(Number(v.alunos))) return;
    const aula = aulaPorId.get(String(v.aulaId));
    if (!aula) return;
    const grupo = grupoDaModalidade(nomeDaModalidade(aula.modalidadeId));
    const turno = turnoDaHora(aula.hora);
    const professorId = String(v.professorId || aula.professorId || '');
    if (!grupo || !turno || !professorId || !v.data) return;
    const chave = `${professorId}|${grupo}|${turno}|${mesDe(v.data)}`;
    const atual = mapa.get(chave) || { total: 0, aulas: 0, media: 0 };
    atual.total += Number(v.alunos);
    atual.aulas += 1;
    atual.media = atual.total / atual.aulas;
    mapa.set(chave, atual);
  });
  return mapa;
}

/** Aulas seguidas por validação: só as aulas REALIZADAS do mesmo professor no mesmo dia (Jump/Dance entre si). Map id -> boolean. */
export function seguidasDasValidacoes(validacoes, aulaPorId, nomeDaModalidade) {
  const porDia = new Map();
  (validacoes || []).forEach((v) => {
    if (v.status !== 'realizada' || v.isAulao) return;
    const aula = aulaPorId.get(String(v.aulaId));
    if (!aula || !v.data) return;
    const professorId = String(v.professorId || aula.professorId || '');
    const nome = nomeDaModalidade(aula.modalidadeId);
    const chave = `${professorId}|${v.data}`;
    if (!porDia.has(chave)) porDia.set(chave, []);
    porDia.get(chave).push({ id: String(v.id), modalidade: nome, unidadeId: aula.unidadeId, ini: aula.hora, fim: fimDaAula(aula.hora, nome) });
  });
  const resultado = new Map();
  porDia.forEach((lista) => marcarSeguidas(lista).forEach((r, id) => resultado.set(id, r.seguida)));
  return resultado;
}

/**
 * @param linhas              linhas do relatório (já com os filtros da tela): { tipoLinha, aulaBase, professorId, historico }
 * @param validacoesDoPeriodo TODAS as validações carregadas (sem filtro de tela), para a média do mês e as aulas seguidas
 * @returns { itens, porProfessor, resumo }
 */
export function auditarValores({ linhas, tabela, professorPorId, modalidadePorId, unidadePorId, aulaPorId, validacoesDoPeriodo, periodo, hojeISO, valorPago }) {
  const nomeDaModalidade = (id) => modalidadePorId.get(String(id))?.nome || '';
  const medias = mediasDoMes(validacoesDoPeriodo, aulaPorId, nomeDaModalidade);
  const seguidas = seguidasDasValidacoes(validacoesDoPeriodo, aulaPorId, nomeDaModalidade);
  const itens = [];

  (linhas || []).forEach((linha) => {
    if (linha.tipoLinha === 'aulao') return;
    const aula = linha.aulaBase;
    const unidade = unidadePorId.get(String(aula.unidadeId));
    const professor = professorPorId.get(String(linha.professorId));
    const modalidadeNome = nomeDaModalidade(aula.modalidadeId);
    (linha.historico || []).forEach((v) => {
      if (v.status !== 'realizada' || v.isFeriadoVirtual || !v.data) return;
      const pago = valorPago(v, aula);
      const base = {
        chave: `${linha.id}|${v.data}`, linhaId: linha.id, professorId: String(linha.professorId), professorNome: linha.professorNome,
        unidadeNome: linha.unidadeNome, modalidadeNome: linha.modalidadeNome, data: v.data, hora: aula.hora, alunos: Number(v.alunos) || 0,
        pago, substituto: linha.tipoLinha === 'substituto',
      };
      const brasil = !unidade?.pais || unidade.pais === 'BR';
      if (!brasil || !professor || !chaveDaTabela(modalidadeNome)) {
        itens.push({ ...base, situacao: 'sem-sugestao', sugerido: null, motivo: !brasil ? 'moeda' : !professor ? 'professor' : 'modalidade' });
        return;
      }
      const mes = mesDe(v.data);
      const grupo = grupoDaModalidade(modalidadeNome);
      const turno = turnoDaHora(aula.hora);
      const media = medias.get(`${linha.professorId}|${grupo}|${turno}|${mes}`);
      const confirmavel = mesConfirmavel(mes, periodo, hojeISO);
      const r = valorSugerido({
        tabela, professor,
        aula: { modalidade: modalidadeNome, unidadeId: aula.unidadeId, data: v.data, hora: aula.hora, seguida: seguidas.get(String(v.id)) === true },
        mediaMes: confirmavel && media ? media.media : null,
      });
      if (!r) { itens.push({ ...base, situacao: 'sem-sugestao', sugerido: null, motivo: 'modalidade' }); return; }
      itens.push({
        ...base, sugerido: r.valor, situacao: compararValor(pago, r.valor), nivel: r.nivel, saver: r.saver,
        seguida: seguidas.get(String(v.id)) === true, pretaPendente: r.candidataPreta && !confirmavel, extraPreta: confirmavel ? 0 : r.extraPreta,
        mediaMes: media ? media.media : null, motivo: '',
      });
    });
  });

  const porProfessorMapa = new Map();
  itens.forEach((i) => {
    const p = porProfessorMapa.get(i.professorId) || { professorId: i.professorId, professorNome: i.professorNome, aulas: 0, certas: 0, maiores: 0, menores: 0, semSugestao: 0, pago: 0, sugerido: 0, diferenca: 0 };
    p.aulas += 1;
    p.pago += i.pago;
    if (i.situacao === 'sem-sugestao') p.semSugestao += 1;
    else {
      p.sugerido += i.sugerido;
      p.diferenca += i.pago - i.sugerido;
      if (i.situacao === 'certo') p.certas += 1; else if (i.situacao === 'maior') p.maiores += 1; else p.menores += 1;
    }
    porProfessorMapa.set(i.professorId, p);
  });
  const porProfessor = [...porProfessorMapa.values()].sort((a, b) => (b.maiores + b.menores) - (a.maiores + a.menores) || a.professorNome.localeCompare(b.professorNome));
  const resumo = itens.reduce((r, i) => {
    r.aulas += 1;
    if (i.situacao === 'certo') r.certas += 1; else if (i.situacao === 'maior') { r.maiores += 1; r.diferenca += i.pago - i.sugerido; } else if (i.situacao === 'menor') { r.menores += 1; r.diferenca += i.pago - i.sugerido; } else r.semSugestao += 1;
    return r;
  }, { aulas: 0, certas: 0, maiores: 0, menores: 0, semSugestao: 0, diferenca: 0 });
  return { itens, porProfessor, resumo };
}
