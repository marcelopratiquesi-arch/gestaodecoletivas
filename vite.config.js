import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const medidor = path.resolve(aqui, 'src/services/firestoreMedido.js').replace(/\\/g, '/')

// Medidor de leituras do Firestore (dev e produção). Troca o `firebase/firestore` do código do app pelo arquivo
// que conta as leituras (src/services/firestoreMedido.js); a telemetria grava o resumo (telemetriaLeituras.js).
function medidorDeLeituras() {
  return {
    name: 'medidor-de-leituras',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id !== 'firebase/firestore' || !importer) return null
      const origem = importer.split('?')[0].replace(/\\/g, '/')
      // O próprio medidor, a telemetria, a configuração do banco (evitam ciclo) e os pacotes do Firebase usam o
      // original; só o código do app é trocado.
      if (origem === medidor
        || origem.endsWith('/src/services/telemetriaLeituras.js')
        || origem.endsWith('/src/services/firebase.js')
        || origem.includes('/node_modules/')) return null
      return medidor
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), medidorDeLeituras()],
})
