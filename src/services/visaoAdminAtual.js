// Quem o administrador está "vendo como" neste momento (ou null). Vive fora do React para o medidor do Firestore
// (firestoreMedido.js) carimbar os registros de auditoria sem que nenhuma tela precise ser alterada.
let visaoAtual = null;

export function definirVisaoAtual(visao) {
  visaoAtual = visao?.tipo ? { tipo: visao.tipo, nome: visao.nome || "" } : null;
}

export function lerVisaoAtual() {
  return visaoAtual;
}
