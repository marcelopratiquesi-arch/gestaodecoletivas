// TELEMETRIA DE LEITURAS (produção).
//
// Para quê: a cota gratuita do Firestore (50 mil leituras/dia) estoura de manhã e o Console só mostra o total.
// Aqui cada pessoa soma, no próprio aparelho, quantos documentos o servidor mandou, separados por tela e por
// coleção, e de vez em quando grava um resumo pequeno em telemetria_leituras/{AAAA-MM-DD}_{uid}.
// O admin lê esses resumos no Console do Firebase e descobre qual perfil e qual tela gastam mais.
//
// Custo: no máximo ~1 gravação a cada 15 minutos por pessoa com o sistema aberto (e uma ao fechar/ocultar a aba),
// só se houve leitura nova. Este arquivo não lê nada do banco.
// Quem alimenta os números é src/services/firestoreMedido.js (ver vite.config.js).
//
// Se a gravação falhar 3 vezes seguidas (por exemplo, regra ainda não publicada), a telemetria se desliga sozinha
// até a página ser recarregada: nunca atrapalha o sistema.
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const INTERVALO_MS = 15 * 60 * 1000
const MAX_CHAVES = 100 // a regra do banco aceita até 120 chaves por dia
const MAX_FALHAS = 3

let usuario = { uid: null, papel: '' }
let pendente = {}
let total = 0
let falhas = 0
let gravando = false

const seguro = (texto) => String(texto).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)

function telaAtual() {
  if (typeof location === 'undefined') return '?'
  // Só as 2 primeiras partes do caminho (/app/relatorios): sem ids de documentos, para não criar chaves sem fim.
  return location.pathname.split('/').filter(Boolean).slice(0, 2).join('/') || 'raiz'
}

function diaLocal() {
  // AAAA-MM-DD no horário do aparelho (Brasil).
  const d = new Date()
  const dois = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

export function registrarLeituras(colecao, qtd) {
  if (!qtd || falhas >= MAX_FALHAS) return
  let chave = `${seguro(telaAtual())}~${seguro(colecao)}`
  if (!(chave in pendente) && Object.keys(pendente).length >= MAX_CHAVES) chave = 'outras'
  pendente[chave] = (pendente[chave] || 0) + qtd
  total += qtd
}

export async function gravarTelemetria() {
  const { uid, papel } = usuario
  if (!uid || total < 1 || gravando || falhas >= MAX_FALHAS) return
  const itens = pendente
  const quantidade = total
  pendente = {}
  total = 0
  gravando = true
  try {
    const somas = {}
    Object.entries(itens).forEach(([chave, n]) => { somas[chave] = increment(n) })
    const dia = diaLocal()
    await setDoc(doc(db, 'telemetria_leituras', `${dia}_${uid}`), {
      dia,
      uid,
      papel,
      atualizadoEm: serverTimestamp(),
      total: increment(quantidade),
      itens: somas,
    }, { merge: true })
    falhas = 0
  } catch {
    falhas += 1
    // Devolve os números para a próxima tentativa.
    Object.entries(itens).forEach(([chave, n]) => { pendente[chave] = (pendente[chave] || 0) + n })
    total += quantidade
  } finally {
    gravando = false
  }
}

// Chamado pelo CatalogProvider quando a pessoa entra/sai. Se mudou de pessoa, grava antes o que era da anterior.
export function definirUsuarioTelemetria(uid, papel) {
  if (usuario.uid && usuario.uid !== uid) gravarTelemetria()
  usuario = { uid: uid || null, papel: String(papel || '') }
}

if (typeof window !== 'undefined') {
  setInterval(() => { gravarTelemetria() }, INTERVALO_MS)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') gravarTelemetria() })
  window.addEventListener('pagehide', () => { gravarTelemetria() })
}
