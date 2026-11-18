// Conta ÚNICA de "o que cada aula realizada vale". Quem precisa de ganho (Centrais, Relatórios, extrato por
// professor) parte daqui, em vez de repetir a conta. Pura: sem banco e sem tela.
//
// O que conta: só validação REALIZADA, uma vez por aula/dia (deduplicarValidacoes), valendo o valor do dia
// (valorDaValidacao). Quem recebe é o professor da validação (na substituição, o substituto).
import { deduplicarValidacoes } from './validacoes';
import { valorDaValidacao } from './valores';

/**
 * Lista as validações realizadas do período, cada uma com o valor que vale.
 *  - aulaPorId: Map(id em texto -> aula). Pode incluir aulas excluídas (o passado continua valendo).
 *  - incluirSemAula: false = validação de aula que sumiu do cadastro fica de fora (Centrais);
 *                    true  = usa os dados gravados na própria validação (Relatórios).
 *  - jaDeduplicadas: true quando quem chama já tirou as repetidas.
 * Cada item: { v, aula (a do cadastro, ou null no aulão/sumida), aulaEfetiva (aula ou os dados da validação),
 *              valor, alunos, unidadeId, professorId }.
 */
export function ganhosDasValidacoes({ validacoes = [], aulaPorId, inicio = '', fim = '9999', incluirSemAula = false, jaDeduplicadas = false }) {
  const base = validacoes.filter((v) => v && v.data >= inicio && v.data <= fim);
  const unicas = jaDeduplicadas ? base : deduplicarValidacoes(base);
  const lista = [];
  unicas.forEach((v) => {
    if (v.status !== 'realizada') return;
    const aula = v.isAulao ? null : (aulaPorId.get(String(v.aulaId)) || null);
    if (!v.isAulao && !aula && !incluirSemAula) return;
    const aulaEfetiva = aula || { unidadeId: v.unidadeId, modalidadeId: v.modalidadeId, professorId: v.professorId, hora: v.hora };
    lista.push({
      v,
      aula,
      aulaEfetiva,
      valor: valorDaValidacao(v, aula),
      alunos: Number(v.alunos) || 0,
      unidadeId: String(v.unidadeId ?? aula?.unidadeId ?? ''),
      professorId: String(v.professorId || aula?.professorId || ''),
    });
  });
  return lista;
}
