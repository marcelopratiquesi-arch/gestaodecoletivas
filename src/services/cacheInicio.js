// Memória curta da Página de Início: guarda as validações já baixadas por alguns minutos,
// para não gastar a cota gratuita do Firebase cada vez que a pessoa volta para o Início.
//
// A chave inclui o usuário e o período: se outra pessoa entrar no mesmo computador, ela nunca vê os
// números de quem saiu. E qualquer validação feita no sistema apaga a memória (invalidarCacheInicio),
// então ao voltar para o Início os números já aparecem atualizados.
const TTL_MS = 5 * 60 * 1000;

let memoria = { chave: '', timestamp: 0, validacoes: [] };

export function lerCacheInicio(chave) {
  if (memoria.chave !== chave) return null;
  if (Date.now() - memoria.timestamp > TTL_MS) return null;
  return memoria.validacoes;
}

export function gravarCacheInicio(chave, validacoes) {
  memoria = { chave, timestamp: Date.now(), validacoes };
}

export function invalidarCacheInicio() {
  memoria = { chave: '', timestamp: 0, validacoes: [] };
}
