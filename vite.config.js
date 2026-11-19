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
    // Nos testes automáticos (vitest, modo "test") o medidor fica desligado: os testes usam o Firebase original.
    apply: (_config, { mode }) => mode !== 'test',
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

// Identificador único de cada publicação (muda a cada build).
// Fica gravado no código do site e também no arquivo /versao.json;
// o aviso "Nova versão disponível" compara os dois.
const ID_DA_VERSAO = String(Date.now())

// Gera dist/versao.json no build (no npm run dev o arquivo não existe e o aviso fica quieto).
const gerarArquivoDeVersao = () => ({
  name: 'gerar-arquivo-de-versao',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'versao.json',
      source: JSON.stringify({ versao: ID_DA_VERSAO }),
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), medidorDeLeituras(), gerarArquivoDeVersao()],
  define: {
    __ID_DA_VERSAO__: JSON.stringify(ID_DA_VERSAO),
  },
})
