// Regra única de validações de aula.
//
// Cada aula da grade tem no máximo UMA validação por dia. O documento no Firestore usa um ID fixo
// "<aulaId>_<data>", então duas pessoas validando ao mesmo tempo atualizam o mesmo registro em vez de
// criar dois (o que contava a aula e o pagamento em dobro).
//
// Validações antigas foram gravadas com ID aleatório e podem estar duplicadas no banco; quem lê deve
// passar a lista por deduplicarValidacoes() antes de contar aulas, alunos ou valores.

export const idValidacao = (aulaId, data) => `${aulaId}_${data}`;

const SISTEMA_FERIADO = 'SISTEMA_FERIADO';

const segundos = (v) => {
  const ts = v?.timestamp;
  if (!ts) return 0;
  if (typeof ts.seconds === 'number') return ts.seconds;
  if (typeof ts.toMillis === 'function') return ts.toMillis() / 1000;
  return 0;
};

// Entre duas validações da mesma aula/dia: a feita por uma pessoa vence a automática de feriado;
// empatando nisso, vence a mais recente.
const vence = (nova, atual) => {
  const novaHumana = nova.validadoPor !== SISTEMA_FERIADO;
  const atualHumana = atual.validadoPor !== SISTEMA_FERIADO;
  if (novaHumana !== atualHumana) return novaHumana;
  return segundos(nova) >= segundos(atual);
};

// Aulões (isAulao) não pertencem à grade e não têm aulaId: passam direto, sem deduplicar.
export function deduplicarValidacoes(lista = []) {
  const porAulaDia = new Map();
  const avulsas = [];
  for (const v of lista) {
    if (!v || v.isAulao || !v.aulaId || !v.data) { avulsas.push(v); continue; }
    const chave = idValidacao(v.aulaId, v.data);
    const atual = porAulaDia.get(chave);
    if (!atual || vence(v, atual)) porAulaDia.set(chave, v);
  }
  return [...porAulaDia.values(), ...avulsas];
}
