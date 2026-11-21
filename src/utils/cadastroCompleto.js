// "Cadastro completo": o que cada pessoa precisa ter preenchido e a regra de adiar o aviso. Funções puras, com teste
// (tests/unit/cadastroCompleto.test.js).
//
// Obrigatórios (decisão do dono): nome, WhatsApp, país, documento (CPF/DNI/SSN) e data de nascimento. O DOCUMENTO trava na hora
// (sem adiar, como era a antiga tela "Informar documento"); os outros têm as chances de adiar. E-mail de contato e Banco Inter são opcionais.
//
// Aviso de cadastro incompleto: a pessoa pode ADIAR 1 vez por dia; no 3º dia o aviso trava (só sai completando ou saindo do
// sistema). A contagem fica no crachá (cadastroAdiamentos / cadastroAdiadoEm), então vale no celular e no computador.

export const MAX_ADIAMENTOS = 2;
export const PAISES_VALIDOS = ["BR", "AR", "US"];

const digitos = (v) => String(v ?? "").replace(/\D/g, "");

/** Data de hoje no relógio do aparelho, "AAAA-MM-DD". */
export function hojeLocal(agora = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

/**
 * Lista do que falta: "nome" | "telefone" | "pais" | "documento" | "nascimento".
 * `paisDaUnidade` = país da unidade do crachá (crachá antigo sem "pais" usa o da unidade).
 * `temNascimento` = a data já está guardada (a marca "nascimentoOk" do crachá também vale).
 */
export function camposFaltando({ cracha, paisDaUnidade = "", temNascimento = false }) {
  const falta = [];
  if (String(cracha?.nome || "").trim().length < 3) falta.push("nome");
  if (digitos(cracha?.telefone).length < 8) falta.push("telefone");
  const pais = String(cracha?.pais || paisDaUnidade || "").toUpperCase();
  if (!PAISES_VALIDOS.includes(pais)) falta.push("pais");
  if (cracha?.documentoOk !== true) falta.push("documento");
  if (!(cracha?.nascimentoOk === true || temNascimento)) falta.push("nascimento");
  return falta;
}

/** Em que pé está o adiamento: já adiou hoje? ainda pode adiar? travou? `travaNaHora` = falta o documento (não adia). */
export function situacaoDoAdiamento(cracha, hoje = hojeLocal(), travaNaHora = false) {
  const usados = Math.max(0, Number(cracha?.cadastroAdiamentos) || 0);
  if (travaNaHora) return { usados, adiadoHoje: false, travado: true, podeAdiar: false, restantes: 0 };
  const adiadoHoje = usados > 0 && cracha?.cadastroAdiadoEm === hoje;
  const travado = !adiadoHoje && usados >= MAX_ADIAMENTOS;
  return { usados, adiadoHoje, travado, podeAdiar: !adiadoHoje && !travado, restantes: Math.max(0, MAX_ADIAMENTOS - usados) };
}

/** O que gravar no crachá quando a pessoa clica em "Lembrar depois". */
export function proximoAdiamento(cracha, hoje = hojeLocal()) {
  const { usados } = situacaoDoAdiamento(cracha, hoje);
  return { cadastroAdiamentos: usados + 1, cadastroAdiadoEm: hoje };
}

/**
 * O que falta para a PESSOA SER LISTADA como "cadastro incompleto" nas abas (Mentores, Líderes, Professores) e nas Centrais.
 * Usa só o que a lista já tem (zero leituras novas): nome, telefone, documento ("documentoOk") e nascimento ("nascimentoOk").
 * O nascimento só conta de quem tem login (sem login a pessoa não tem como preencher; o gestor cuida do resto).
 * Devolve "nome" | "telefone" | "documento" | "nascimento".
 */
export function faltaNaLista({ nome, telefone, documentoOk, nascimentoOk, temLogin = true }) {
  const falta = [];
  if (String(nome || "").trim().length < 3) falta.push("nome");
  if (digitos(telefone).length < 8) falta.push("telefone");
  if (documentoOk !== true) falta.push("documento");
  if (temLogin && nascimentoOk !== true) falta.push("nascimento");
  return falta;
}

/** Igual a faltaNaLista, a partir do crachá (usuarios/{uid}). Crachá desconhecido = não aponta nada. */
export const faltaDoCracha = (c) => (c ? faltaNaLista({ nome: c.nome, telefone: c.telefone, documentoOk: c.documentoOk, nascimentoOk: c.nascimentoOk, temLogin: c.loginGoogle === true }) : []);

/** Papéis que entram na regra (quem tem acesso de verdade ao sistema). */
export const PAPEIS_DO_CADASTRO = ["admin", "administrador", "master", "mentor", "lider", "unidade", "professor"];
export const entraNaRegraDoCadastro = (cracha) => PAPEIS_DO_CADASTRO.includes(String(cracha?.role || "").trim().toLowerCase());
