// "Fechamento do mês": resumo pronto das validações de cada mês que já passou.
//
// POR QUE: o plano gratuito do Firestore dá 50 mil leituras por dia. Telas como Relatórios (gráfico do ano),
// Performance Financeira e Radar de Grade liam dezenas de milhares de validações a cada abertura.
// Mês que já passou quase não muda; então guardamos um documento por mês (resumos_mensais/AAAA-MM) com
// os totais por aula, e as telas leem 1 documento em vez de milhares de validações.
//
// QUEM MONTA: não existe "robô" no servidor no plano gratuito. O próprio sistema monta o resumo na primeira
// vez que um ADMIN precisa de um mês fechado (custo único: as validações daquele mês). Mentores só leem;
// se o resumo não existir ou estiver velho, a tela deles faz a conta do jeito antigo (filtrada pelas
// unidades deles).
//
// QUANDO FICA VELHO (e é refeito): a cada leitura, o Firebase CONTA e SOMA as validações do mês sem baixá-las
// (custa ~1 leitura a cada 1.000 documentos): total de documentos, total de realizadas e soma de alunos.
// Se algum desses números mudou desde o fechamento, alguém criou, apagou ou corrigiu uma validação daquele
// mês, e o resumo é refeito. (O valor de uma validação não muda na edição: fica o valor da época.)
//
// FORMATO (resumos_mensais/AAAA-MM):
//   porAula: { [aulaId]: { u: unidadeId, r: realizadas, c: canceladas, a: alunos (das realizadas), v: valor } }
//   auloes:  { [chave]: { u, m: modalidadeId, p: professorId, h: hora, r, c, a, v } }
//   conferencia: { total, realizadas, alunos } dos documentos crus do mês (antes de deduplicar), versao, geradoEm
import {
    collection, doc, getDoc, getDocs, setDoc, query, where, getAggregateFromServer, count, sum, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { deduplicarValidacoes } from '../utils/validacoes';
import { valorDaValidacao } from '../utils/valores';

export const VERSAO_RESUMO = 1;
const COLECAO = 'resumos_mensais';
const LIMITE_BYTES = 900 * 1024;   // documento do Firestore tem limite de 1 MiB

const refResumo = (mes) => doc(db, COLECAO, mes);

const hojeLocal = () => new Date().toLocaleDateString('en-CA');
export const mesAtual = () => hojeLocal().slice(0, 7);
export const mesDaData = (dataStr) => String(dataStr || '').slice(0, 7);
export const mesFechado = (mes) => /^\d{4}-\d{2}$/.test(mes) && mes < mesAtual();

export function limitesDoMes(mes) {
    const [ano, m] = mes.split('-').map(Number);
    const ultimoDia = new Date(ano, m, 0).getDate();
    return [`${mes}-01`, `${mes}-${String(ultimoDia).padStart(2, '0')}`];
}

/** "AAAA-MM" de n meses antes de `mes`. */
export function mesAnterior(mes, n = 1) {
    const [ano, m] = mes.split('-').map(Number);
    const d = new Date(ano, m - 1 - n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const consultaDoMes = (mes) => {
    const [ini, fim] = limitesDoMes(mes);
    return query(collection(db, 'validacoes'), where('data', '>=', ini), where('data', '<=', fim));
};

const somar = (alvo, v, valor) => {
    if (v.status === 'realizada') {
        alvo.r += 1;
        alvo.a += Number(v.alunos) || 0;
        alvo.v += valor;
    } else if (v.status === 'cancelada') {
        alvo.c += 1;
    }
};

/** Monta o resumo de um mês a partir das validações. `aulasPorId`: Map com TODAS as aulas (inclusive excluídas). */
export function calcularResumo(validacoesDoMes, aulasPorId) {
    const porAula = {};
    const auloes = {};
    deduplicarValidacoes(validacoesDoMes).forEach(v => {
        if (!v) return;
        if (v.isAulao) {
            const chave = [v.unidadeId, v.modalidadeId, v.professorId, v.hora || ''].join('|');
            if (!auloes[chave]) auloes[chave] = { u: v.unidadeId ?? null, m: v.modalidadeId ?? null, p: v.professorId ?? null, h: v.hora || '', r: 0, c: 0, a: 0, v: 0 };
            somar(auloes[chave], v, valorDaValidacao(v, null));
            return;
        }
        if (!v.aulaId) return;
        const aula = aulasPorId.get(String(v.aulaId));
        if (!porAula[v.aulaId]) porAula[v.aulaId] = { u: v.unidadeId ?? aula?.unidadeId ?? null, r: 0, c: 0, a: 0, v: 0 };
        somar(porAula[v.aulaId], v, valorDaValidacao(v, aula));
    });
    return { porAula, auloes };
}

// Os mesmos 3 números calculados pelo Firebase (conferirNoServidor) e na hora de montar (conferirNaLista).
async function conferirNoServidor(mes) {
    const [tudo, realizadas] = await Promise.all([
        getAggregateFromServer(consultaDoMes(mes), { total: count(), alunos: sum('alunos') }),
        getAggregateFromServer(query(consultaDoMes(mes), where('status', '==', 'realizada')), { total: count() }),
    ]);
    return { total: tudo.data().total, realizadas: realizadas.data().total, alunos: Number(tudo.data().alunos) || 0 };
}
const conferirNaLista = (lista) => ({
    total: lista.length,
    realizadas: lista.filter(v => v.status === 'realizada').length,
    alunos: lista.reduce((acc, v) => acc + (typeof v.alunos === 'number' ? v.alunos : 0), 0),
});
const mesmaConferencia = (a, b) => !!a && !!b && a.total === b.total && a.realizadas === b.realizadas && a.alunos === b.alunos;

async function montarEGravar(mes, aulasPorId) {
    const snap = await getDocs(consultaDoMes(mes));
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const { porAula, auloes } = calcularResumo(lista, aulasPorId);
    const resumo = { mes, versao: VERSAO_RESUMO, conferencia: conferirNaLista(lista), porAula, auloes };
    const tamanho = new Blob([JSON.stringify(resumo)]).size;
    if (tamanho > LIMITE_BYTES) throw new Error(`Resumo de ${mes} grande demais (${Math.round(tamanho / 1024)} KB).`);
    await setDoc(refResumo(mes), { ...resumo, geradoEm: serverTimestamp() });
    return resumo;
}

/**
 * Devolve { [mes]: resumo | null } para os meses pedidos (só meses fechados; os outros voltam null).
 * - podeMontar (admin): monta/refaz o que faltar ou estiver velho.
 * - sem podeMontar (mentor): devolve null para o que faltar ou estiver velho -> a tela calcula do jeito antigo.
 */
export async function lerResumos(meses, { podeMontar = false, aulasPorId = new Map() } = {}) {
    const pares = await Promise.all([...new Set(meses)].map(async (mes) => {
        if (!mesFechado(mes)) return [mes, null];
        try {
            const snap = await getDoc(refResumo(mes));
            const resumo = snap.exists() ? snap.data() : null;
            let valido = !!resumo && resumo.versao === VERSAO_RESUMO;
            if (valido) valido = mesmaConferencia(resumo.conferencia, await conferirNoServidor(mes));
            if (valido) return [mes, resumo];
            if (podeMontar) return [mes, await montarEGravar(mes, aulasPorId)];
            return [mes, null];
        } catch (e) {
            console.warn(`[fechamento] não foi possível usar o resumo de ${mes}; calculando do jeito antigo.`, e);
            return [mes, null];
        }
    }));
    return Object.fromEntries(pares);
}

// ---------- Ajudantes para as telas ----------

/** Lista de unidadeIds em blocos de 30 (limite do filtro "in" do Firestore). */
export const emBlocos = (lista, tamanho = 30) =>
    Array.from({ length: Math.ceil(lista.length / tamanho) }, (_, i) => lista.slice(i * tamanho, i * tamanho + tamanho));

/**
 * Busca validações de um intervalo de datas. Com `unidadeIds` (lista), busca só dessas unidades
 * (várias consultas de até 30); com null, busca da rede inteira.
 */
export async function buscarValidacoes(inicio, fim, unidadeIds = null) {
    const base = [where('data', '>=', inicio), where('data', '<=', fim)];
    if (unidadeIds !== null && unidadeIds.length === 0) return [];
    const consultas = unidadeIds === null
        ? [query(collection(db, 'validacoes'), ...base)]
        : emBlocos(unidadeIds).map(bloco => query(collection(db, 'validacoes'), ...base, where('unidadeId', 'in', bloco)));
    const snaps = await Promise.all(consultas.map(q => getDocs(q)));
    return snaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() })));
}
