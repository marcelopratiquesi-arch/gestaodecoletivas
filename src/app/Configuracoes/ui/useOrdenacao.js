// Ordenação das tabelas de Configurações: clicar no título da coluna ordena de A a Z; clicar de novo, de Z a A.
// `colunas` = { campo: (item) => valor }. Texto compara sem acento/maiúscula; número compara como número.
// Enquanto ninguém clicou (campo null), a lista fica na ordem "padrão" (`padrao`, opcional) que a aba quiser.
import { useMemo, useState } from "react";

const comparadorTexto = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

function comparar(a, b) {
  const vazioA = a === null || a === undefined || a === "";
  const vazioB = b === null || b === undefined || b === "";
  if (vazioA && vazioB) return 0;
  if (typeof a === "number" || typeof b === "number") return (Number(a) || 0) - (Number(b) || 0);
  if (vazioA) return 1; // texto vazio vai para o fim na ordem A→Z
  if (vazioB) return -1;
  return comparadorTexto.compare(String(a), String(b));
}

/**
 * @template T
 * @param {T[]} lista
 * @param {Record<string,(item:T)=>any>} colunas
 * @param {{padrao?:(a:T,b:T)=>number, inicial?:{campo:string,direcao:"asc"|"desc"}}} [opcoes]
 */
export function useOrdenacao(lista, colunas, opcoes = {}) {
  const [estado, setEstado] = useState(opcoes.inicial || { campo: null, direcao: "asc" });
  const { padrao } = opcoes;

  const ordenada = useMemo(() => {
    const copia = [...(lista || [])];
    const valor = estado.campo && colunas[estado.campo];
    if (!valor) return padrao ? copia.sort(padrao) : copia;
    const sinal = estado.direcao === "desc" ? -1 : 1;
    return copia.sort((a, b) => sinal * comparar(valor(a), valor(b)));
  }, [lista, colunas, estado, padrao]);

  const ordenarPor = (campo) => setEstado((e) => ({ campo, direcao: e.campo === campo && e.direcao === "asc" ? "desc" : "asc" }));

  return { ordenada, campo: estado.campo, direcao: estado.direcao, ordenarPor };
}
