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

// Nomes parecidos (para quem tem o MESMO telefone): um nome cabe dentro do outro, ignorando de/da/dos/e.
// Ex.: "Aline Rodrigues Oliveira dos Anjos" ~ "Aline Rodrigues Oliveira Anjos"; "Rayane Vitória Mendes Paranhos" ~
// "Rayane Vitória Mendes"; "Carlos Alexandre Dias Silva" ~ "Alexandre Dias". Precisa de 2+ palavras em comum.
const LIGACOES = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'Y', 'DEL', 'LA']);
const palavrasDoNome = (nome) => normalizarNome(nome).replace(/[^A-Z ]/g, ' ').split(' ').filter(p => p.length > 1 && !LIGACOES.has(p));
export function nomesParecidos(a, b) {
  const pa = new Set(palavrasDoNome(a));
  const pb = new Set(palavrasDoNome(b));
  const [menor, maior] = pa.size <= pb.size ? [pa, pb] : [pb, pa];
  if (menor.size < 2) return menor.size === 1 && maior.size === 1 && [...menor][0] === [...maior][0];
  return [...menor].every(p => maior.has(p));
}

// ---------------- Cadastro: fichas com o mesmo e-mail/telefone/nome ----------------
// Devolve [{ ficha, campos: ['email'|'telefone'|'nome'] }] das fichas (menos `ignorarId`, a própria ao editar)
// que batem com os dados digitados. E-mail de mentira e telefone inválido não contam.
export function fichasParecidas(fichas, { email, telefone, pais = 'BR', nome } = {}, ignorarId = null) {
  const e = normalizarEmail(email);
  const emailOk = e && emailFormatoValido(e) && !emailDeMentira(e);
  const tel = telefone ? chaveTelefone(telefone, pais) : null;
  const n = nome ? normalizarNome(nome) : '';
  const achados = [];
  for (const f of fichas || []) {
    if (ignorarId && String(f.id) === String(ignorarId)) continue;
    const campos = [];
    if (emailOk && normalizarEmail(f.email) === e) campos.push('email');
    if (tel && chaveTelefone(f.telefone, f.pais || 'BR') === tel) campos.push('telefone');
    if (n && normalizarNome(f.nome) === n) campos.push('nome');
    if (campos.length) achados.push({ ficha: f, campos });
  }
  return achados;
}

/**
 * Documento achado no LOGIN (crachá) de alguém: qual ficha da grade é dessa pessoa?
 *  - ligada: a ficha que já aponta para esse login (uidLogin) ou que o crachá aponta (professorId);
 *  - parecidas: fichas SEM documento com o mesmo e-mail, telefone ou nome do login. Fichas ligadas a OUTRO login
 *    (quase sempre o login antigo da senha 123456) ENTRAM: ao confirmar, passam a usar este login.
 *    Fichas com documento ficam de fora (já são de alguém, com outro documento).
 */
export function fichasDoLogin(fichas, uid, cracha = {}, pais = 'BR') {
  const ligada = (fichas || []).find(p => p.uidLogin && p.uidLogin === uid)
    || (cracha.professorId ? (fichas || []).find(p => String(p.id) === String(cracha.professorId)) : null)
    || null;
  if (ligada) return { ligada, parecidas: [] };
  const parecidas = fichasParecidas(fichas, { email: cracha.email, telefone: cracha.telefone, pais, nome: cracha.nome })
    .filter(a => !a.ficha.documentoOk);
  return { ligada: null, parecidas };
}

// Nome como o cadastro guarda: sem espaços sobrando e em MAIÚSCULAS (acentos mantidos).
export const limparNome = (nome) => String(nome ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

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

// ---------------- Análise inteligente (relatório e selos nas abas) ----------------
// Mesma pessoa x pessoas diferentes:
//  - "mesma pessoa": mesmo e-mail, ou mesmo telefone COM o mesmo nome (maiúscula/acento não contam). Várias fichas
//    em unidades diferentes caem aqui: não é alarme, só sugestão de juntar.
//  - "outra pessoa": mesmo telefone, mas nome e e-mail diferentes (digitação/família): o único alarme forte.
//  - "só nome": mesmo nome sem nenhum outro dado igual (homônimo): lista discreta, sem selo.
// Aceita os mesmos registros de acharRepetidos. Cada item sai com `chave` = `${origem}:${id}`.
export const chaveRegistro = (r) => `${r.origem}:${r.id}`;

export function analisarRepetidos(registros) {
  const lista = registros || [];
  const pai = new Map();
  const achar = (k) => { while (pai.get(k) !== k) { pai.set(k, pai.get(pai.get(k))); k = pai.get(k); } return k; };
  const unir = (a, b) => { const ra = achar(a), rb = achar(b); if (ra !== rb) pai.set(ra, rb); };
  const garantir = (k) => { if (!pai.has(k)) pai.set(k, k); return k; };
  const pessoaDe = (r) => (r.origem === 'professor' ? `p:${r.id}` : `u:${r.id}`);
  for (const r of lista) garantir(pessoaDe(r));
  // Ficha ligada ao crachá, e pedido do mesmo login, são a mesma pessoa.
  for (const r of lista) {
    if (r.origem === 'professor' && r.uidLogin) unir(pessoaDe(r), garantir(`u:${r.uidLogin}`));
    if (r.origem !== 'professor' && r.professorId) unir(pessoaDe(r), garantir(`p:${r.professorId}`));
  }

  // Quem é "a mesma identidade" só pelas ligações ficha↔login (antes de comparar e-mail/telefone).
  const identidade = new Map(lista.map(r => [pessoaDe(r), achar(pessoaDe(r))]));

  const dados = lista.map(r => {
    const email = normalizarEmail(r.email);
    const emailBom = email && emailFormatoValido(email) && !emailDeMentira(email) ? email : '';
    const tel = soNumeros(r.telefone) ? chaveTelefone(r.telefone, r.pais) : null;
    return { r, email: emailBom, tel, nome: normalizarNome(r.nome) };
  });
  const porChave = (campo, extra = () => '') => {
    const m = new Map();
    for (const d of dados) {
      if (!d[campo]) continue;
      const k = `${d[campo]}|${extra(d)}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(d);
    }
    return m;
  };
  // Une: mesmo e-mail; mesmo telefone + nome parecido (um cabe no outro).
  for (const itens of porChave('email').values()) for (let i = 1; i < itens.length; i++) unir(pessoaDe(itens[0].r), pessoaDe(itens[i].r));
  for (const itens of porChave('tel').values()) {
    for (let i = 0; i < itens.length; i++) for (let j = i + 1; j < itens.length; j++) {
      if (nomesParecidos(itens[i].r.nome, itens[j].r.nome)) unir(pessoaDe(itens[i].r), pessoaDe(itens[j].r));
    }
  }

  const clusterDe = (d) => achar(pessoaDe(d.r));
  const agrupar = (itens) => {
    const porCluster = new Map();
    for (const d of itens) {
      const c = clusterDe(d);
      if (!porCluster.has(c)) porCluster.set(c, []);
      porCluster.get(c).push(d.r);
    }
    return [...porCluster.values()];
  };

  // Mesma pessoa: clusters com 2+ registros em fichas/crachás diferentes.
  const clusters = new Map();
  for (const d of dados) {
    const c = clusterDe(d);
    if (!clusters.has(c)) clusters.set(c, new Map());
    clusters.get(c).set(chaveRegistro(d.r), d.r);
  }
  const mesmaPessoa = [...clusters.values()]
    .map(m => [...m.values()])
    .filter(itens => new Set(itens.map(i => identidade.get(pessoaDe(i)))).size >= 2)
    .map(itens => ({ itens, nome: itens[0].nome }))
    .sort((a, b) => b.itens.length - a.itens.length || String(a.nome).localeCompare(String(b.nome)));

  // Outra pessoa: mesmo telefone em 2+ clusters.
  const outraPessoa = [];
  for (const [valor, itens] of porChave('tel')) {
    const grupos = agrupar(itens);
    if (grupos.length >= 2) outraPessoa.push({ valor: valor.slice(0, -1), grupos, itens: grupos.flat() });
  }
  outraPessoa.sort((a, b) => b.grupos.length - a.grupos.length || a.valor.localeCompare(b.valor));

  // Só nome: mesmo nome em 2+ clusters e nenhum telefone/e-mail igual entre eles.
  const emOutra = new Set(outraPessoa.flatMap(g => g.itens.map(chaveRegistro)));
  const soNome = [];
  for (const [valor, itens] of porChave('nome')) {
    const grupos = agrupar(itens);
    if (grupos.length >= 2) {
      const semAlarme = grupos.filter(g => !g.some(i => emOutra.has(chaveRegistro(i))));
      if (semAlarme.length >= 2) soNome.push({ valor: valor.slice(0, -1), grupos: semAlarme, itens: semAlarme.flat() });
    }
  }
  soNome.sort((a, b) => b.grupos.length - a.grupos.length || a.valor.localeCompare(b.valor));

  // Selos por registro (para as abas).
  const selos = new Map();
  const selo = (r) => { const k = chaveRegistro(r); if (!selos.has(k)) selos.set(k, { mesma: [], outra: [] }); return selos.get(k); };
  for (const g of mesmaPessoa) for (const r of g.itens) selo(r).mesma = g.itens.filter(x => chaveRegistro(x) !== chaveRegistro(r));
  for (const g of outraPessoa) {
    for (const grupo of g.grupos) {
      const outros = g.itens.filter(x => !grupo.includes(x));
      for (const r of grupo) selo(r).outra.push(...outros.filter(o => !selo(r).outra.includes(o)));
    }
  }
  return { mesmaPessoa, outraPessoa, soNome, selos };
}

// ---------------- Aprovação de professor: qual ficha da grade é a pessoa do pedido ----------------
// Força do motivo, para ordenar e pré-selecionar (documento > e-mail > telefone > nome).
const FORCA = { documento: 3, email: 2, telefone: 1, nome: 0 };
export const forcaDosCampos = (campos) => Math.max(...campos.map(c => FORCA[c] ?? 0));

/** Escolha inicial: a ficha do documento; ou a única ficha com o mesmo e-mail/telefone. Só nome não pré-seleciona. */
export function escolhaInicial(candidatas) {
  const livres = candidatas.filter(c => !c.bloqueada);
  const porDoc = livres.find(c => c.campos.includes('documento'));
  if (porDoc) return String(porDoc.ficha.id);
  const fortes = livres.filter(c => c.campos.includes('email') || c.campos.includes('telefone'));
  return fortes.length === 1 ? String(fortes[0].ficha.id) : '';
}

