// Extrato "Ganhos por professor": agrupa as linhas já calculadas do Relatório (uma por aula/horário/substituição)
// em um bloco por professor, com o detalhe por unidade e modalidade. Pura: sem banco e sem tela.
// O dinheiro de países diferentes NUNCA se soma: cada professor tem um total por moeda.
import { moedaDoPais } from './moedas';

/**
 * linhas: linhas do Relatório { professorId, professorNome, unidadeId, unidadeNome, unidadePais, modalidadeNome,
 *         tipoLinha ('titular'|'substituto'|'aulao'), aulasRealizadas, aulasCanceladas, totalReceber, historicoSubstituido }.
 * Devolve, em ordem alfabética: [{ professorId, professorNome, realizadas, canceladas, substituicoesFeitas,
 *   substituidoEmAulas, totais: { BRL: 1200 }, detalhes: [{ chave, unidadeId, unidadeNome, moeda, modalidadeNome,
 *   realizadas, canceladas, valor }] }]. Professor sem nenhuma aula realizada ou cancelada no período não aparece.
 */
export function extratoPorProfessor(linhas = []) {
  const porProfessor = new Map();
  linhas.forEach((r) => {
    if (!r) return;
    const realizadas = Number(r.aulasRealizadas) || 0;
    const canceladas = Number(r.aulasCanceladas) || 0;
    const substituidoEmAulas = (r.historicoSubstituido || []).filter((v) => v.status === 'realizada').length;
    if (realizadas === 0 && canceladas === 0 && substituidoEmAulas === 0) return;

    const chaveProf = String(r.professorId ?? r.professorNome);
    if (!porProfessor.has(chaveProf)) {
      porProfessor.set(chaveProf, {
        professorId: r.professorId ?? null, professorNome: r.professorNome || '',
        realizadas: 0, canceladas: 0, substituicoesFeitas: 0, substituidoEmAulas: 0, totais: {}, detalhesMap: new Map(),
      });
    }
    const p = porProfessor.get(chaveProf);
    const moeda = moedaDoPais(r.unidadePais);
    const valor = Number(r.totalReceber) || 0;

    p.realizadas += realizadas;
    p.canceladas += canceladas;
    p.substituidoEmAulas += substituidoEmAulas;
    if (r.tipoLinha === 'substituto') p.substituicoesFeitas += realizadas;
    p.totais[moeda] = (p.totais[moeda] || 0) + valor;

    const chaveDet = `${r.unidadeId}|${r.modalidadeNome}`;
    if (!p.detalhesMap.has(chaveDet)) {
      p.detalhesMap.set(chaveDet, { chave: chaveDet, unidadeId: r.unidadeId, unidadeNome: r.unidadeNome, moeda, modalidadeNome: r.modalidadeNome, realizadas: 0, canceladas: 0, valor: 0 });
    }
    const d = p.detalhesMap.get(chaveDet);
    d.realizadas += realizadas;
    d.canceladas += canceladas;
    d.valor += valor;
  });

  return [...porProfessor.values()]
    .map(({ detalhesMap, ...p }) => ({
      ...p,
      detalhes: [...detalhesMap.values()].sort((a, b) => String(a.unidadeNome).localeCompare(String(b.unidadeNome)) || String(a.modalidadeNome).localeCompare(String(b.modalidadeNome))),
    }))
    .sort((a, b) => String(a.professorNome).localeCompare(String(b.professorNome)));
}

/** Linhas planas para planilha: uma por professor + unidade + modalidade. */
export function linhasDeExportacao(extrato = []) {
  return extrato.flatMap((p) => p.detalhes.map((d) => ({
    professor: p.professorNome, unidade: d.unidadeNome, modalidade: d.modalidadeNome, moeda: d.moeda,
    realizadas: d.realizadas, canceladas: d.canceladas, valor: d.valor,
  })));
}
