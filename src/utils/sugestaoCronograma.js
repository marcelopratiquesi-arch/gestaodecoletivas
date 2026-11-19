// VALOR SUGERIDO na tela de aula do Cronograma (src/app/Cronograma). Só sugere: o valor continua digitado à mão.
// A aula do Cronograma é semanal (vários dias), então o horário de Saver é conferido dia a dia.
// Sem a média do mês: a pulseira preta aparece como "extra a confirmar no fim do mês" (valor da vermelha por enquanto).
import { valorSugerido } from './pulseira.js';

const DIA_POR_NOME = { Domingo: 0, Segunda: 1, Terça: 2, Quarta: 3, Quinta: 4, Sexta: 5, Sábado: 6 };

/**
 * @returns {null | { nivel, quantidade, valores: number[], mista: boolean, valorNormal, valorAcademico, seguidas, extraPreta, candidataPreta }}
 *  null = sem sugestão (modalidade fora da tabela, professor não escolhido, etc.)
 */
export function sugestaoDoCronograma({ tabela, professor, modalidadeNome, unidadeId, hora, dias, hojeISO }) {
  if (!tabela || !professor || !modalidadeNome || !hora) return null;
  const idx = (dias || []).map((d) => DIA_POR_NOME[d]).filter((d) => Number.isInteger(d));
  const base = { tabela, professor, aula: { modalidade: modalidadeNome, unidadeId, data: hojeISO, hora } };
  const porDia = (idx.length ? idx : [null]).map((dia) => valorSugerido({ ...base, aula: { ...base.aula, ...(dia === null ? {} : { dia }) } }));
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
    candidataPreta: primeira.candidataPreta,
    extraPreta: primeira.candidataPreta ? primeira.extraPreta : 0,
  };
}
