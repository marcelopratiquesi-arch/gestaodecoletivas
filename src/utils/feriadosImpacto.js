// Avisos do cadastro de feriado: quantas aulas e unidades ele afeta, se a data já passou e se já existe outro igual.
import { feriadoAplicaNaUnidade } from './feriados';
import { aulaNaGradeDoDia, datasEntre, dataLocalStr } from './agendaAulas';
import { getDiaSemana } from './formatters';

const LIMITE_DIAS = 400; // evita conta enorme se alguém digitar o ano errado

/**
 * Quantas unidades o feriado alcança e quantas aulas da grade caem no período (ocorrências, não aulas distintas).
 * @param {{feriado: object, unidades: object[], aulas: object[]}} p
 */
export function impactoDoFeriado({ feriado, unidades = [], aulas = [] }) {
  const afetadas = new Set(unidades.filter(u => feriadoAplicaNaUnidade(feriado, u)).map(u => String(u.id)));
  const dias = datasEntre(feriado.dataInicio, feriado.dataFim).slice(0, LIMITE_DIAS)
    .map(d => ({ d, semana: getDiaSemana(new Date(`${d}T12:00:00`)) }));
  let ocorrencias = 0;
  for (const aula of aulas) {
    if (aula.excluido === true || !afetadas.has(String(aula.unidadeId))) continue;
    for (const { d, semana } of dias) if (aulaNaGradeDoDia(aula, d, semana)) ocorrencias += 1;
  }
  return { unidades: afetadas.size, aulas: ocorrencias };
}

// A data inicial já passou? (aulas não validadas desse período passam a "feriado" e as pendências somem)
export const comecaNoPassado = (feriado, hoje = dataLocalStr()) => Boolean(feriado.dataInicio) && feriado.dataInicio < hoje;

/**
 * Feriados já cadastrados que se sobrepõem no período e alcançam alguma unidade em comum com o novo.
 * @param {object[]} lista  feriados cadastrados
 * @param {object} novo     feriado em montagem
 * @param {object[]} unidades
 * @param {string} [ignorarId] o próprio feriado, quando está sendo editado
 */
export function feriadosParecidos(lista, novo, unidades = [], ignorarId = null) {
  const alcance = (f) => new Set(unidades.filter(u => feriadoAplicaNaUnidade(f, u)).map(u => String(u.id)));
  const meu = alcance(novo);
  return (lista || []).filter(f => {
    if (ignorarId && String(f.id) === String(ignorarId)) return false;
    const inicio = f.dataInicio || f.inicio || f.data;
    const fim = f.dataFim || f.fim || f.data || inicio;
    if (!inicio || !(inicio <= novo.dataFim && novo.dataInicio <= fim)) return false;
    for (const id of alcance(f)) if (meu.has(id)) return true;
    return false;
  });
}
