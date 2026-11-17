// Filtro padrão em cascata das Configurações: País → Estado → Mentor → Líder.
// Roda só no navegador, sobre a lista que a aba já carregou (nenhuma leitura nova no Firestore).
// Cada seletor só mostra o que existe depois da escolha anterior.
//
// Como usar: a aba diz, para cada item da lista, onde estão o país, os estados, os mentores e os líderes:
//   const f = useFiltroCascata(lista, {
//     getPais: (m) => m.pais, getEstados: (m) => [...], getMentorIds: (u) => [u.mentorId], getLiderIds: (u) => [...],
//     textoBusca: (m) => [m.nome, m.email], nomeMentor: (id) => "...", nomeLider: (id) => "..." });
//   f.resultado  → a lista já filtrada;   f.opcoes → o que cada seletor deve listar;   <FiltroPadrao filtro={f} .../>
import { useCallback, useMemo, useState } from "react";

export const SEM_MENTOR = "-";
const normEstado = (e) => String(e || "").trim().toUpperCase();
const semAcento = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const unicos = (lista) => [...new Set(lista.filter(Boolean))];

export function useFiltroCascata(itens, cfg) {
  const { getPais, getEstados, getMentorIds, getLiderIds, textoBusca, nomeMentor, nomeLider, extra } = cfg;
  const [busca, setBusca] = useState("");
  const [pais, setPais] = useState("");
  const [estado, setEstado] = useState("");
  const [mentor, setMentor] = useState("");
  const [lider, setLider] = useState("");

  const lista = itens || [];
  const doPais = (it) => !pais || getPais?.(it) === pais;
  const doEstado = (it) => !estado || (getEstados?.(it) || []).map(normEstado).includes(estado);
  // "-" = unidade/professor sem mentor
  const doMentor = (it) => !mentor || (mentor === SEM_MENTOR ? !(getMentorIds?.(it) || []).some(Boolean) : (getMentorIds?.(it) || []).includes(mentor));
  const doLider = (it) => !lider || (getLiderIds?.(it) || []).includes(lider);

  // Opções: cada nível olha só os itens que passam pelos níveis anteriores.
  const opcoes = useMemo(() => {
    const p = lista.filter(doPais);
    const e = p.filter(doEstado);
    const m = e.filter(doMentor);
    const nome = (fn, id) => (fn ? fn(id) : id) || id;
    return {
      paises: unicos(lista.map((it) => getPais?.(it))).sort(),
      estados: unicos(p.flatMap((it) => (getEstados?.(it) || []).map(normEstado))).sort(),
      mentores: unicos(e.flatMap((it) => getMentorIds?.(it) || []))
        .map((id) => ({ id, nome: nome(nomeMentor, id) })).sort((a, b) => a.nome.localeCompare(b.nome)),
      temSemMentor: e.some((it) => !(getMentorIds?.(it) || []).some(Boolean)),
      lideres: unicos(m.flatMap((it) => getLiderIds?.(it) || []))
        .map((id) => ({ id, nome: nome(nomeLider, id) })).sort((a, b) => a.nome.localeCompare(b.nome)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, pais, estado, mentor, nomeMentor, nomeLider]);

  const resultado = useMemo(() => {
    const termo = semAcento(busca.trim());
    return lista
      .filter(doPais).filter(doEstado).filter(doMentor).filter(doLider)
      .filter((it) => !extra || extra(it))
      .filter((it) => !termo || (textoBusca?.(it) || []).some((v) => semAcento(v).includes(termo)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, busca, pais, estado, mentor, lider, extra]);

  const ativo = !!(busca || pais || estado || mentor || lider);
  const limpar = useCallback(() => { setBusca(""); setPais(""); setEstado(""); setMentor(""); setLider(""); }, []);

  // Trocar um nível zera os de baixo (a escolha antiga pode nem existir mais).
  const mudar = {
    busca: setBusca,
    pais: (v) => { setPais(v); setEstado(""); setMentor(""); setLider(""); },
    estado: (v) => { setEstado(v); setMentor(""); setLider(""); },
    mentor: (v) => { setMentor(v); setLider(""); },
    lider: setLider,
  };

  return { valores: { busca, pais, estado, mentor, lider }, mudar, opcoes, resultado, total: lista.length, ativo, limpar };
}
