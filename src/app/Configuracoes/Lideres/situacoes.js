// Situação de cada unidade na aba Líderes ("central de pendências"). Cada unidade recebe UMA situação;
// se mais de uma se aplica, vale a primeira desta ordem (mais urgente primeiro):
//   1 semLider   — ninguém lidera a unidade
//   2 conferir   — o líder entrou pelo Google e ainda não foi confirmado (liderAConferir)
//   3 temporario — a unidade tem líder temporário com prazo valendo
//   4 semAcesso  — o líder principal não entra há DIAS_SEM_ACESSO dias ou mais (ou nunca entrou)
//   5 ok         — tudo certo
// Conta pura (sem banco): recebe o último acesso e os temporários já carregados.
import { paraData } from "../../../utils/ultimoAcesso";
import { diasRestantes, fimDoTemporario } from "../../../utils/temporario";

// Limite para "sem acesso". Para mudar, troque só aqui.
export const DIAS_SEM_ACESSO = 30;

export const ORDEM_SITUACOES = ["semLider", "conferir", "temporario", "semAcesso", "ok"];
export const PRECISA_DE_ACAO = new Set(["semLider", "conferir", "temporario", "semAcesso"]);

const MS_DIA = 86400000;

/**
 * @param {object} u unidade do catálogo
 * @param {{ultimoAcesso:any, carregandoAcesso:boolean, temporarios:object[], pedidos:number, agora?:number}} ctx
 * @returns {{id:string, prioridade:number, temporario?:object, diasTemporario?:number, diasSemAcesso?:number|null, nuncaEntrou?:boolean, pedidos:number, loginAntigo:boolean}}
 */
export function situacaoDaUnidade(u, { ultimoAcesso, carregandoAcesso, temporarios = [], pedidos = 0, agora = Date.now() }) {
  const base = { pedidos, loginAntigo: !!(u.uidLogin && !u.loginAntigoDesligado) };
  const comPrioridade = (id, extra = {}) => ({ id, prioridade: ORDEM_SITUACOES.indexOf(id), ...base, ...extra });

  if (!u.liderUid) return comPrioridade("semLider");
  if (u.liderAConferir === true) return comPrioridade("conferir");

  // Temporário que ainda vale (vencido não conta); o que vence primeiro é o que aparece.
  const ativos = temporarios
    .map((c) => ({ c, dias: diasRestantes(fimDoTemporario(c)) }))
    .filter((x) => x.dias !== null && x.dias >= 0)
    .sort((a, b) => a.dias - b.dias);
  if (ativos.length) return comPrioridade("temporario", { temporario: ativos[0].c, diasTemporario: ativos[0].dias });

  // Enquanto o último acesso ainda está chegando, não acusa "sem acesso" (evita piscar).
  if (!carregandoAcesso) {
    const data = paraData(ultimoAcesso);
    if (!data) return comPrioridade("semAcesso", { nuncaEntrou: true, diasSemAcesso: null });
    const dias = Math.floor((agora - data.getTime()) / MS_DIA);
    if (dias >= DIAS_SEM_ACESSO) return comPrioridade("semAcesso", { diasSemAcesso: dias, nuncaEntrou: false });
  }
  return comPrioridade("ok");
}

// Classes de cor de cada situação (só as cores do sistema: vermelho, preto, cinza e branco).
// ATENÇÃO: classes escritas por extenso de propósito (o Tailwind só enxerga texto inteiro).
export const COR_SITUACAO = {
  semLider: { barra: "bg-red-600", numero: "text-red-600", texto: "text-red-700 dark:text-red-400", botao: "bg-red-600 border-red-600 text-white hover:bg-red-700" },
  conferir: { barra: "bg-red-400", numero: "text-red-700 dark:text-red-400", texto: "text-red-700 dark:text-red-400", botao: "bg-white border-red-600 text-red-700 hover:bg-red-50 dark:bg-neutral-900 dark:text-red-400" },
  temporario: { barra: "bg-neutral-900 dark:bg-neutral-100", numero: "text-neutral-900 dark:text-neutral-100", texto: "text-neutral-600 dark:text-neutral-300", botao: "bg-neutral-900 border-neutral-900 text-white hover:bg-black dark:bg-neutral-100 dark:text-neutral-900" },
  semAcesso: { barra: "bg-neutral-500", numero: "text-neutral-600 dark:text-neutral-300", texto: "text-neutral-600 dark:text-neutral-300", botao: "bg-white border-neutral-400 text-neutral-800 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-200" },
  ok: { barra: "bg-neutral-300 dark:bg-neutral-600", numero: "text-neutral-500", texto: "text-neutral-600 dark:text-neutral-400", botao: "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300" },
};
