import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  plugins: [react(), gerarArquivoDeVersao()],
  define: {
    __ID_DA_VERSAO__: JSON.stringify(ID_DA_VERSAO),
  },
})
