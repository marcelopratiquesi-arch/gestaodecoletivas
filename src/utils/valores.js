// Regra única do valor de uma aula realizada.
//
// Cada aula realizada vale o valor que estava em vigor NO DIA em que aconteceu. A validação grava esse valor
// em "valorEfetivo" no momento em que é feita, então mudar o valor da aula (ou excluí-la) depois não altera
// o passado. Ex.: R$ 50 em setembro e R$ 60 a partir de outubro -> setembro continua somando R$ 50.
//
//   1. aulão (isAulao)               -> valorPago
//   2. validação com valorEfetivo    -> valorEfetivo
//   3. validações antigas, de antes do valorEfetivo existir -> valor atual da aula (melhor estimativa possível;
//      por isso quem chama deve procurar a aula mesmo que esteja excluída)
// Cancelada, feriado ou qualquer status diferente de "realizada" = 0.

const temValor = (valor) => valor !== undefined && valor !== null && valor !== '';

export function valorDaValidacao(validacao, aula) {
  if (!validacao || validacao.status !== 'realizada') return 0;
  if (validacao.isAulao) return Number(validacao.valorPago) || 0;
  if (temValor(validacao.valorEfetivo)) return Number(validacao.valorEfetivo) || 0;
  return parseFloat(aula?.valor) || 0;
}
