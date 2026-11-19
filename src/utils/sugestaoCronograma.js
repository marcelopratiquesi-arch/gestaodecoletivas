// VALOR SUGERIDO na tela de aula do Cronograma (src/app/Cronograma). Só sugere: o valor continua digitado à mão.
// A aula do Cronograma é semanal (vários dias), então o horário de Saver é conferido dia a dia.
// Sem a média do mês: a pulseira preta aparece como "extra a confirmar no fim do mês" (valor da vermelha por enquanto).
import { valorSugerido, marcarSeguidas, fimDaAula } from './pulseira.js';

const DIA_POR_NOME = { Domingo: 0, Segunda: 1, Terça: 2, Quarta: 3, Quinta: 4, Sexta: 5, Sábado: 6 };

/**
 * @returns {null | { nivel, quantidade, valores: number[], mista: boolean, valorNormal, valorAcademico, seguidas, extraPreta, candidataPreta }}
 *  null = sem sugestão (modalidade fora da tabela, professor não escolhido, etc.)
 */
export function sugestaoDoCronograma({ tabela, professor, modalidadeNome, unidadeId, hora, dias, hojeISO, outrasAulas = [] }) {
  if (!tabela || !professor || !modalidadeNome || !hora) return null;
  const idx = (dias || []).map((d) => DIA_POR_NOME[d]).filter((d) => Number.isInteger(d));
  const base = { tabela, professor, aula: { modalidade: modalidadeNome, unidadeId, data: hojeISO, hora } };
  // outrasAulas: as outras aulas deste professor [{ id, modalidade, unidadeId, hora, dias: ['Terça', ...] }] (já sem a aula em edição).
  const seguidaNoDia = (dia) => {
    if (dia === null) return false;
    const nomeDoDia = Object.keys(DIA_POR_NOME).find((n) => DIA_POR_NOME[n] === dia);
    const doDia = outrasAulas
      .filter((a) => (a.dias || []).includes(nomeDoDia))
      .map((a) => ({ id: a.id, modalidade: a.modalidade, unidadeId: a.unidadeId, ini: a.hora, fim: fimDaAula(a.hora, a.modalidade) }));
    doDia.push({ id: '__nova__', modalidade: modalidadeNome, unidadeId, ini: hora, fim: fimDaAula(hora, modalidadeNome) });
    return marcarSeguidas(doDia).get('__nova__')?.seguida === true;
  };
  const porDia = (idx.length ? idx : [null]).map((dia) => {
    const r = valorSugerido({ ...base, aula: { ...base.aula, ...(dia === null ? {} : { dia }), seguida: seguidaNoDia(dia) } });
    return r === null ? null : { ...r, dia, seguida: seguidaNoDia(dia) };
  });
  if (porDia.some((r) => r === null)) return null;
  const ehSaver = (r) => r.saver;
  const academicos = porDia.filter(ehSaver);
  const normais = porDia.filter((r) => !ehSaver(r));
  const primeira = porDia[0];
  const valores = [...new Set(porDia.map((r) => r.valor))].sort((a, b) => a - b);
  const seguidas = tabela.precos?.[primeira.chave]?.[primeira.nivel]?.seguidas ?? null;
  return {
    nivel: primeira.nivel,
    quantidade: primeira.quantidade,
    valores,
    mista: academicos.length > 0 && normais.length > 0,
    soAcademico: academicos.length > 0 && normais.length === 0,
    valorNormal: normais[0]?.valor ?? null,
    valorAcademico: academicos[0]?.valor ?? null,
    seguidas,
    porDia: porDia.map((r) => ({ dia: r.dia, valor: r.valor, saver: r.saver, seguida: r.seguida })),
    temSeguida: porDia.some((r) => r.seguida),
    candidataPreta: primeira.candidataPreta,
    extraPreta: primeira.candidataPreta ? primeira.extraPreta : 0,
  };
}
