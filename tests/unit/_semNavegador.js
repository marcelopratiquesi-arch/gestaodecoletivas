// Fora do navegador não existe localStorage; o i18n (carregado pelos formatters) lê o idioma salvo nele.
if (!globalThis.localStorage) {
  const dados = new Map();
  globalThis.localStorage = {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
  };
}
