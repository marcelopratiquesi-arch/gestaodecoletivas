/// <reference types="vite/client" />
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Cada idioma é uma pasta em src/locales/<idioma>/ e cada tela um arquivo <seção>.json.
// O nome do arquivo vira a primeira parte da chave: publicSchedule.json -> chave "publicSchedule.xxx".
// Para criar uma seção nova basta adicionar o JSON nas 3 pastas (rode `npm run i18n:check`).
const arquivos = import.meta.glob('./locales/*/*.json', { eager: true, import: 'default' });

const resources: Record<string, { translation: Record<string, unknown> }> = {};
for (const [caminho, conteudo] of Object.entries(arquivos)) {
  const [, idioma, secao] = caminho.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/) || [];
  if (!idioma) continue;
  resources[idioma] ??= { translation: {} };
  resources[idioma].translation[secao] = conteudo;
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('idioma_pratique') || 'pt-BR',
    fallbackLng: 'pt-BR',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
