// Confere os dicionários em src/locales:
// 1) todos os idiomas têm exatamente as mesmas chaves que o pt-BR;
// 2) toda chave usada no código com t('...') existe nos 3 idiomas.
// Uso: npm run i18n:check  (sai com código 1 se encontrar problema)
import fs from 'fs';
import path from 'path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const pastaLocales = path.join(raiz, 'src', 'locales');
const BASE = 'pt-BR';

const achatar = (obj, prefixo = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? achatar(v, `${prefixo}${k}.`) : [`${prefixo}${k}`]);

const idiomas = {};
for (const idioma of fs.readdirSync(pastaLocales)) {
  const chaves = new Set();
  for (const arquivo of fs.readdirSync(path.join(pastaLocales, idioma)).filter(f => f.endsWith('.json'))) {
    const secao = arquivo.replace(/\.json$/, '');
    const conteudo = JSON.parse(fs.readFileSync(path.join(pastaLocales, idioma, arquivo), 'utf8'));
    achatar(conteudo, `${secao}.`).forEach(k => chaves.add(k));
  }
  idiomas[idioma] = chaves;
}

let problemas = 0;
const base = idiomas[BASE];
for (const [idioma, chaves] of Object.entries(idiomas)) {
  if (idioma === BASE) continue;
  const faltando = [...base].filter(k => !chaves.has(k));
  const sobrando = [...chaves].filter(k => !base.has(k));
  if (faltando.length) { problemas += faltando.length; console.log(`\n❌ ${idioma}: ${faltando.length} chave(s) que existem no ${BASE} e faltam aqui:\n  ${faltando.join('\n  ')}`); }
  if (sobrando.length) { problemas += sobrando.length; console.log(`\n❌ ${idioma}: ${sobrando.length} chave(s) que não existem no ${BASE}:\n  ${sobrando.join('\n  ')}`); }
}

const arquivosCodigo = [];
const varrer = (dir) => {
  for (const nome of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, nome.name);
    if (nome.isDirectory()) { if (nome.name !== 'locales') varrer(p); }
    else if (/\.(jsx?|tsx?)$/.test(nome.name)) arquivosCodigo.push(p);
  }
};
varrer(path.join(raiz, 'src'));

// Só chaves literais; chaves dinâmicas (ex: t('publicSchedule.days.' + dia)) ficam de fora.
const regexChave = /\bt\(\s*['"]([\w.]+)['"]/g;
const usadasSemTraducao = new Map();
for (const arquivo of arquivosCodigo) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  for (const [, chave] of texto.matchAll(regexChave)) {
    if (chave.endsWith('.')) continue;
    // Plural do i18next: t('x', { count }) procura x_one / x_other.
    const existe = (ch) => ch.has(chave) || ch.has(`${chave}_one`) || ch.has(`${chave}_other`);
    const ausente = Object.entries(idiomas).filter(([, ch]) => !existe(ch)).map(([i]) => i);
    if (ausente.length) usadasSemTraducao.set(chave, `${path.relative(raiz, arquivo)} (falta em: ${ausente.join(', ')})`);
  }
}
if (usadasSemTraducao.size) {
  problemas += usadasSemTraducao.size;
  console.log(`\n❌ ${usadasSemTraducao.size} chave(s) usadas no código sem tradução:`);
  for (const [k, onde] of usadasSemTraducao) console.log(`  ${k}  ←  ${onde}`);
}

const resumo = Object.entries(idiomas).map(([i, c]) => `${i}: ${c.size}`).join(' | ');
if (problemas) { console.log(`\n${resumo}\n`); process.exit(1); }
console.log(`✅ Dicionários consistentes. ${resumo}`);
