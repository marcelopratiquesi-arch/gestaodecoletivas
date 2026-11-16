// MEDIDOR DE LEITURAS — SÓ NO `npm run dev`. Nunca entra no build de produção
// (o plugin em vite.config.js só age no modo dev).
//
// Como funciona: o plugin troca, só no dev, o `firebase/firestore` por este arquivo. Ele devolve tudo
// igual ao original, mas "espia" getDocs, getDoc e onSnapshot e soma quantos documentos vieram do servidor
// (cada um = 1 leitura cobrada). Nenhuma tela precisou ser alterada.
//
// No console do navegador (F12):
//   leituras()          -> tabela com o total, por tela e por coleção
//   leituras.zerar()    -> zera os números
//   contarColecoes()    -> conta os documentos de cada coleção (custa ~1 leitura a cada 1.000 docs)
//
// Atenção: é uma estimativa. Escuta ao vivo cobra os documentos que chegam do servidor; se o cache do
// aparelho já tinha o documento, o Firebase pode cobrar menos do que o número mostrado aqui.
import {
  getDocs as _getDocs,
  getDoc as _getDoc,
  onSnapshot as _onSnapshot,
  getCountFromServer,
  collection,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../services/firebase'

export * from 'firebase/firestore'

const estado = { total: 0, porTela: {}, porColecao: {}, chamadas: 0 }

function nomeColecao(alvo) {
  try {
    if (alvo?.path) return alvo.path.split('/').slice(0, 1)[0] // CollectionReference / DocumentReference
    if (alvo?._query?.path) return alvo._query.path.canonicalString().split('/')[0]
    if (alvo?.query?._query?.path) return alvo.query._query.path.canonicalString().split('/')[0]
  } catch { /* nome é só informativo */ }
  return '?'
}

function somar(alvo, qtd, origem) {
  if (!qtd) return
  const tela = typeof location !== 'undefined' ? location.pathname : '?'
  const col = nomeColecao(alvo)
  estado.total += qtd
  estado.chamadas += 1
  estado.porTela[tela] = (estado.porTela[tela] || 0) + qtd
  estado.porColecao[col] = (estado.porColecao[col] || 0) + qtd
  console.debug(`[leituras] +${qtd} ${col} (${origem}) em ${tela} | total ${estado.total}`)
}

function qtdDoSnap(snap) {
  if (snap?.metadata?.fromCache) return 0
  if (typeof snap?.docChanges === 'function') return snap.docChanges().length || (snap.empty ? 1 : 0)
  return 1 // documento único (existindo ou não) = 1 leitura
}

export async function getDocs(q, ...resto) {
  const snap = await _getDocs(q, ...resto)
  somar(q, snap.metadata?.fromCache ? 0 : Math.max(snap.size, 1), 'getDocs')
  return snap
}

export async function getDoc(ref, ...resto) {
  const snap = await _getDoc(ref, ...resto)
  somar(ref, snap.metadata?.fromCache ? 0 : 1, 'getDoc')
  return snap
}

export function onSnapshot(alvo, ...args) {
  const espiar = (fn) => (typeof fn === 'function'
    ? (snap, ...r) => { somar(alvo, qtdDoSnap(snap), 'onSnapshot'); return fn(snap, ...r) }
    : fn)
  // Formas aceitas: (alvo, onNext, onError) | (alvo, opcoes, onNext, onError) | (alvo, observador)
  if (typeof args[0] === 'function') return _onSnapshot(alvo, espiar(args[0]), ...args.slice(1))
  if (args[0] && typeof args[0].next === 'function') {
    return _onSnapshot(alvo, { ...args[0], next: espiar(args[0].next) }, ...args.slice(1))
  }
  if (typeof args[1] === 'function') return _onSnapshot(alvo, args[0], espiar(args[1]), ...args.slice(2))
  if (args[1] && typeof args[1].next === 'function') {
    return _onSnapshot(alvo, args[0], { ...args[1], next: espiar(args[1].next) }, ...args.slice(2))
  }
  return _onSnapshot(alvo, ...args)
}

function mostrar() {
  console.log(`LEITURAS ESTIMADAS desde que a página abriu: ${estado.total} (em ${estado.chamadas} respostas)`)
  console.table(Object.entries(estado.porTela).map(([tela, n]) => ({ tela, leituras: n })).sort((a, b) => b.leituras - a.leituras))
  console.table(Object.entries(estado.porColecao).map(([colecao, n]) => ({ colecao, leituras: n })).sort((a, b) => b.leituras - a.leituras))
  return estado.total
}
mostrar.zerar = () => { estado.total = 0; estado.porTela = {}; estado.porColecao = {}; estado.chamadas = 0 }

// Conta documentos por coleção usando count() do servidor (não baixa os documentos).
// Precisa estar logado como admin. Validações também são contadas por mês do ano corrente.
async function contarColecoes() {
  const colecoes = [
    'aulas', 'vinculos', 'unidades', 'professores', 'modalidades', 'feriados', 'usuarios', 'validacoes',
    'auditoria_cronograma', 'auditoria_configuracoes', 'auditoria_financeiro',
    'unipower_workshops', 'unipower_transacoes', 'unipower_stock',
    'pratique_play_faixas', 'solicitacoes_acesso', 'saidas_acesso', 'pedidos_unidade',
    'indicadores_mensais', 'convites_acesso', 'resumos_mensais',
  ]
  const linhas = []
  for (const c of colecoes) {
    try {
      const r = await getCountFromServer(collection(db, c))
      linhas.push({ colecao: c, documentos: r.data().count })
    } catch (e) {
      linhas.push({ colecao: c, documentos: `erro: ${e.code || e.message}` })
    }
  }
  console.table(linhas)
  const ano = new Date().getFullYear()
  const meses = []
  for (let m = 1; m <= 12; m++) {
    const ini = `${ano}-${String(m).padStart(2, '0')}-01`
    const fim = m === 12 ? `${ano + 1}-01-01` : `${ano}-${String(m + 1).padStart(2, '0')}-01`
    try {
      const r = await getCountFromServer(query(collection(db, 'validacoes'), where('data', '>=', ini), where('data', '<', fim)))
      meses.push({ mes: ini.slice(0, 7), validacoes: r.data().count })
    } catch (e) {
      meses.push({ mes: ini.slice(0, 7), validacoes: `erro: ${e.code || e.message}` })
    }
  }
  console.table(meses)
  return 'ok'
}

if (typeof window !== 'undefined') {
  window.leituras = mostrar
  window.contarColecoes = contarColecoes
  console.info('[medidor] ligado. No console: leituras() | leituras.zerar() | contarColecoes()')
}
