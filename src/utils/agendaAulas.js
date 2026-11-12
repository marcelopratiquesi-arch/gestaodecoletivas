// Regra única de "quais aulas acontecem num dia" e "em que situação cada uma está".
// Usada pela Página de Início e pela Validação Diária, para que as duas telas nunca mostrem números diferentes.
//
//   - Uma aula está na grade do dia quando cai naquele dia da semana E está dentro da vigência
//     (dataInicio/dataFim cadastradas no Cronograma).
//   - Feriado (src/utils/feriados.js) não é pendência: a aula é cancelada automaticamente.
//   - Aula que já começou (ou de dia passado) e não tem validação = precisa validar.
//   - Aula de hoje que ainda não começou = ainda vai acontecer (não é atraso).
import { getDiaSemana } from './formatters';
import { feriadoNoDia, ehCancelamentoAutomaticoDeFeriado } from './feriados';

// "AAAA-MM-DD" no fuso de quem está usando.
export const dataLocalStr = (d = new Date()) => d.toLocaleDateString('en-CA');

export const somarDias = (dataStr, dias) => {
  const d = new Date(`${dataStr}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return dataLocalStr(d);
};

// Datas de dataInicio a dataFim (inclusive), em ordem.
export const datasEntre = (inicio, fim) => {
  const datas = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) datas.push(d);
  return datas;
};

// Vigência gravada como "AAAA-MM-DD" (ou Timestamp antigo). Qualquer outra coisa ("", null, "N/A") = sem limite.
const dataDaVigencia = (valor) => {
  if (!valor) return null;
  if (typeof valor.seconds === 'number') return dataLocalStr(new Date(valor.seconds * 1000));
  const texto = String(valor).substring(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null;
};

// diaSemana é opcional: quem percorre muitas aulas do mesmo dia pode calcular uma vez só.
export function aulaNaGradeDoDia(aula, dataStr, diaSemana = getDiaSemana(dataStr)) {
  if (!aula?.dias?.includes(diaSemana)) return false;
  const inicio = dataDaVigencia(aula.dataInicio);
  const fim = dataDaVigencia(aula.dataFim);
  if (inicio && dataStr < inicio) return false;
  if (fim && dataStr > fim) return false;
  return true;
}

export const SITUACAO = {
  RESOLVIDA: 'resolvida',   // validada como realizada ou cancelada por alguém
  FERIADO: 'feriado',       // não conta como aula esperada
  A_VALIDAR: 'a_validar',   // já começou (ou é de dia passado) e ninguém validou
  MAIS_TARDE: 'mais_tarde', // hoje, mas ainda não começou
};

// agoraHHMM: "HH:MM" de agora; hoje: "AAAA-MM-DD" de hoje.
export function situacaoDaAula({ aula, unidade, dataStr, validacao, feriados, hoje, agoraHHMM }) {
  if (validacao && !ehCancelamentoAutomaticoDeFeriado(validacao)) return SITUACAO.RESOLVIDA;
  if (validacao || feriadoNoDia(dataStr, unidade, feriados)) return SITUACAO.FERIADO;
  if (dataStr < hoje) return SITUACAO.A_VALIDAR;
  if (dataStr === hoje && String(aula?.hora || '') <= agoraHHMM) return SITUACAO.A_VALIDAR;
  return SITUACAO.MAIS_TARDE;
}
