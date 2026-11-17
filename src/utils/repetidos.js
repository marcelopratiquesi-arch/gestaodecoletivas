// Comparação de e-mail, telefone e nome para achar a mesma pessoa cadastrada mais de uma vez.
// Base do relatório de repetidos (F0) e das travas de cadastro único (F1–F3). Nunca lida com documento.

const soNumeros = (v) => String(v ?? '').replace(/\D/g, '');

// ---------------- E-mail ----------------
// Igual = mesmo texto em minúsculas, sem espaços (pontos e "+" continuam contando).
export const normalizarEmail = (email) => String(email ?? '').replace(/\s+/g, '').toLowerCase();

const FORMATO_EMAIL = /^[^@]+@[^@]+\.[a-z]{2,}$/;
export const emailFormatoValido = (email) => FORMATO_EMAIL.test(normalizarEmail(email));

// "E-mail de mentira": preenchido só para passar pelo campo.
const INICIOS_DE_MENTIRA = new Set([
  'naoinformou', 'naoinformado', 'naoinformada', 'naotem', 'naopossui', 'nao', 'nenhum', 'nada',
  'sememail', 'semmail', 'sem', 'teste', 'test', 'testes', 'email', 'mail', 'xxx', 'xx', 'x', 'aaa', 'a',
  'asd', 'asdf', 'abc', '123', '1234', '12345', 'none', 'noemail', 'nomail', 'sinmail', 'sincorreo',
  'notiene', 'ninguno', 'exemplo', 'example', 'fulano', 'ciclano'
]);
const DOMINIOS_DE_MENTIRA = new Set([
  'teste.com', 'teste.com.br', 'test.com', 'email.com', 'exemplo.com', 'exemplo.com.br', 'example.com',
  'naotem.com', 'sememail.com', 'xxx.com', 'a.com', 'abc.com'
]);
export function emailDeMentira(email) {
  const e = normalizarEmail(email);
  const [inicio, dominio] = e.split('@');
  if (!inicio || !dominio) return false;
  const inicioLimpo = inicio.replace(/[._-]/g, '');
  return INICIOS_DE_MENTIRA.has(inicioLimpo) || DOMINIOS_DE_MENTIRA.has(dominio) || /^(.)\1+$/.test(inicioLimpo);
}

// ---------------- Telefone (por país) ----------------
const DDDS_BR = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99
]);

// Devolve a "chave" de comparação do telefone, ou null se não der para usar (vazio ou inválido).
//  BR: tira 55 e 0 da frente; DDD válido; compara sem o 9 da frente (DDD + 8 últimos).
//  AR: tira 54, o 9 de celular e o 0; compara os 8 últimos (aproximado: o "15" local some).
//  US: tira o 1; 10 dígitos.
export function chaveTelefone(telefone, pais = 'BR') {
  let d = soNumeros(telefone);
  if (d.length < 8 || /^(\d)\1+$/.test(d)) return null;
  const p = String(pais || 'BR').toUpperCase();
  if (p === 'BR') {
    if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
    if (d.startsWith('0')) d = d.replace(/^0+/, '');
    if (d.length === 12 || d.length === 13) d = d.slice(2); // código de operadora (0 XX DDD ...)
    if (d.length !== 10 && d.length !== 11) return null;
    if (!DDDS_BR.has(Number(d.slice(0, 2)))) return null;
    if (d.length === 11 && d[2] !== '9') return null;
    const numero = d.slice(-8);
    if (/^(\d)\1+$/.test(numero)) return null;
    return `BR:${d.slice(0, 2)}${numero}`;
  }
  if (p === 'AR') {
    if (d.startsWith('54')) d = d.slice(2);
    if (d.startsWith('9')) d = d.slice(1);
    d = d.replace(/^0+/, '');
    if (d.length < 8) return null;
    return `AR:${d.slice(-8)}`;
  }
  if (p === 'US') {
    if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
    if (d.length !== 10) return null;
    return `US:${d}`;
  }
  return `${p}:${d.slice(-10)}`;
}

// ---------------- Nome ----------------
export const normalizarNome = (nome) =>
  String(nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

// ---------------- Relatório ----------------
// registros: [{ origem: 'professor'|'cracha'|'pedido', id, nome, email, telefone, pais, uidLogin?, professorId? , ...extras }]
// A mesma pessoa (professor ligado ao crachá; pedido e crachá do mesmo login) não conta como repetida.
export function acharRepetidos(registros) {
  const pai = new Map();
  const achar = (k) => { while (pai.get(k) !== k) { pai.set(k, pai.get(pai.get(k))); k = pai.get(k); } return k; };
  const unir = (a, b) => { const ra = achar(a), rb = achar(b); if (ra !== rb) pai.set(ra, rb); };
  const chavePessoa = (r) => (r.origem === 'professor' ? `p:${r.id}` : `u:${r.id}`);
  for (const r of registros) {
    const k = chavePessoa(r);
    if (!pai.has(k)) pai.set(k, k);
  }
  const garantir = (k) => { if (!pai.has(k)) pai.set(k, k); return k; };
  for (const r of registros) {
    if (r.origem === 'professor' && r.uidLogin) unir(chavePessoa(r), garantir(`u:${r.uidLogin}`));
    if (r.origem !== 'professor' && r.professorId) unir(chavePessoa(r), garantir(`p:${r.professorId}`));
  }

  const grupos = { email: new Map(), telefone: new Map(), nome: new Map() };
  const problemas = { emailDeMentira: [], emailInvalido: [], telefoneInvalido: [] };
  const juntar = (mapa, chave, r) => { if (!mapa.has(chave)) mapa.set(chave, []); mapa.get(chave).push(r); };

  for (const r of registros) {
    const email = normalizarEmail(r.email);
    if (email) {
      if (emailDeMentira(email)) problemas.emailDeMentira.push(r);
      else if (!emailFormatoValido(email)) problemas.emailInvalido.push(r);
      else juntar(grupos.email, email, r);
    }
    if (soNumeros(r.telefone)) {
      const tel = chaveTelefone(r.telefone, r.pais);
      if (tel) juntar(grupos.telefone, tel, r);
      else problemas.telefoneInvalido.push(r);
    }
    const nome = normalizarNome(r.nome);
    if (nome) juntar(grupos.nome, nome, r);
  }

  const soRepetidos = (mapa) => [...mapa.entries()]
    .map(([valor, itens]) => ({ valor, itens, pessoas: new Set(itens.map(r => achar(chavePessoa(r)))).size }))
    .filter(g => g.pessoas >= 2)
    .sort((a, b) => b.pessoas - a.pessoas || a.valor.localeCompare(b.valor));

  return {
    email: soRepetidos(grupos.email),
    telefone: soRepetidos(grupos.telefone),
    nome: soRepetidos(grupos.nome),
    problemas,
  };
}
