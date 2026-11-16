// Validações (presença) que as Centrais precisam ler do banco.
//
// Econômico para a cota gratuita do Firebase: busca só o que a ficha aberta precisa (uma unidade, as
// unidades de um mentor ou um professor) e só o período pedido; o resultado fica na memória por
// 5 minutos (fechar e reabrir a ficha, ou trocar de aba, não lê de novo).
// Passe o alvo = null para não buscar nada.
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { buscarValidacoes, lerResumos } from '../services/resumosMensais';

const VALIDADE_MS = 5 * 60 * 1000;
const memoria = new Map(); // chave -> { em, lista }

const lerDaMemoria = (chave) => {
  const guardado = memoria.get(chave);
  return guardado && Date.now() - guardado.em < VALIDADE_MS ? guardado.lista : null;
};

// Aulas que o professor deu (no nome dele) + as aulas DELE que um substituto deu (professorOriginalId).
// Mesmas duas consultas de src/hooks/useValidacoesDoProfessor.js, só que lidas uma vez (sem ficar escutando).
async function buscarValidacoesDoProfessor(professorId, inicio, fim) {
  const ref = collection(db, 'validacoes');
  const [proprias, substituidas] = await Promise.all([
    getDocs(query(ref, where('data', '>=', inicio), where('data', '<=', fim), where('professorId', '==', String(professorId)))),
    getDocs(query(ref, where('professorOriginalId', '==', String(professorId)))),
  ]);
  const porId = new Map();
  proprias.docs.forEach((d) => porId.set(d.id, { id: d.id, ...d.data() }));
  substituidas.docs.forEach((d) => {
    const v = { id: d.id, ...d.data() };
    if (v.data >= inicio && v.data <= fim) porId.set(d.id, v);
  });
  return [...porId.values()];
}

const BUSCAS = {
  unidades: (alvo, inicio, fim) => buscarValidacoes(inicio, fim, alvo.split(',').filter(Boolean)),
  professor: (alvo, inicio, fim) => buscarValidacoesDoProfessor(alvo, inicio, fim),
  // "Fechamento do mês" (resumos_mensais): 1 documento por mês já fechado, em vez de milhares de validações.
  // Só LÊ (podeMontar: false): se o fechamento não existir ou estiver velho, volta null para aquele mês.
  fechamentos: (alvo) => lerResumos(alvo.split(',').filter(Boolean), { podeMontar: false }),
};

// tipo: 'unidades' (alvo = ids separados por vírgula) | 'professor' (alvo = id do professor)
function useValidacoes(tipo, alvo, inicio, fim) {
  const chave = alvo && inicio && fim ? `${tipo}|${alvo}|${inicio}|${fim}` : null;
  const [estado, setEstado] = useState({ chave: null, lista: null, erro: false });

  useEffect(() => {
    if (!chave) return undefined;
    let cancelado = false;
    const guardada = lerDaMemoria(chave);
    const busca = guardada
      ? Promise.resolve(guardada)
      : BUSCAS[tipo](alvo, inicio, fim).then((lista) => {
        memoria.set(chave, { em: Date.now(), lista });
        return lista;
      });
    busca
      .then((lista) => { if (!cancelado) setEstado({ chave, lista, erro: false }); })
      .catch((e) => {
        console.error('Central: não foi possível ler as validações.', e);
        if (!cancelado) setEstado({ chave, lista: [], erro: true });
      });
    return () => { cancelado = true; };
  }, [chave, tipo, alvo, inicio, fim]);

  const atual = !!chave && estado.chave === chave;
  return {
    validacoes: atual ? estado.lista : null, // null = ainda carregando (ou nada pedido)
    carregando: !!chave && !atual,
    erro: atual && estado.erro,
  };
}

export const useValidacoesDaUnidade = (unidadeId, inicio, fim) =>
  useValidacoes('unidades', unidadeId ? String(unidadeId) : null, inicio, fim);

// ids: lista de unidades (ex.: as do mentor). Lista vazia ou null = não busca.
export const useValidacoesDasUnidades = (ids, inicio, fim) =>
  useValidacoes('unidades', ids && ids.length ? [...ids].map(String).sort().join(',') : null, inicio, fim);

export const useValidacoesDoProfessor = (professorId, inicio, fim) =>
  useValidacoes('professor', professorId ? String(professorId) : null, inicio, fim);

// Fechamentos dos meses pedidos: { 'AAAA-MM': resumo | null } (null = ainda não montado ou desatualizado).
// Lista vazia = não busca. Devolve fechamentos = null enquanto carrega.
export function useFechamentosMensais(meses) {
  const r = useValidacoes('fechamentos', meses && meses.length ? [...meses].sort().join(',') : null, '-', '-');
  return { fechamentos: r.validacoes, carregando: r.carregando, erro: r.erro };
}
