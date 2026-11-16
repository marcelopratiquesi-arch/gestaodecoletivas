// Como abrir uma Central de qualquer tela.
//
// Cada função dispara um pedido (evento do navegador). A janela das Centrais fica montada uma vez só
// (CentraisHost, dentro do AppLayout), escuta o pedido, confere a permissão e abre a ficha por cima
// da tela atual. Fechar volta para a mesma tela, com os mesmos filtros.
//
//   abrirCentralUnidade(unidade)     -> aceita o cadastro da unidade, o id ou o nome
//   abrirCentralProfessor(professor) -> aceita o cadastro do professor, o id ou o nome
//   abrirCentralMentor(mentor)       -> aceita o cadastro do mentor, o id ou o nome
//   abrirCentralLider(unidade, vaga) -> o líder é o da unidade informada (cadastro, id ou nome da unidade);
//                                       vaga 2 = o 2º líder da unidade
//
// Em tabelas e listas, o jeito mais simples é usar <LinkCentral tipo="..." alvo={...}> (src/centrais/LinkCentral.jsx).
export const EVENTO_CENTRAL = 'centrais:abrir';

export const abrirCentral = (tipo, alvo) => {
  if (typeof window === 'undefined' || !alvo) return;
  window.dispatchEvent(new CustomEvent(EVENTO_CENTRAL, { detail: { tipo, alvo } }));
};

export const abrirCentralUnidade = (unidade) => abrirCentral('unidade', unidade);
export const abrirCentralProfessor = (professor) => abrirCentral('professor', professor);
export const abrirCentralMentor = (mentor) => abrirCentral('mentor', mentor);
export const abrirCentralLider = (unidade, vaga = 1) => abrirCentral(vaga === 2 ? 'lider2' : 'lider', unidade);
