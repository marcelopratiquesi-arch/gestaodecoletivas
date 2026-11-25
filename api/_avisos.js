// Regras puras do envio de avisos (sem Firebase): quem recebe, validação e formato da mensagem. Testável.
const PAPEL_ADMIN = ['admin', 'administrador', 'master'];
export const ehAdmin = (cracha) => PAPEL_ADMIN.includes(String(cracha?.role || '').trim().toLowerCase())
  && String(cracha?.status || '').toLowerCase() !== 'inativo';

// "unidade" é o nome antigo de "lider".
export const papelDe = (cracha) => {
  const r = String(cracha?.role || '').trim().toLowerCase();
  if (r === 'unidade') return 'lider';
  return PAPEL_ADMIN.includes(r) ? 'admin' : r;
};
const semAcesso = (c) => String(c?.role || '').toLowerCase() === 'bloqueado' || String(c?.status || '').toLowerCase() === 'inativo';

export function validarAviso(c) {
  const titulo = String(c?.titulo || '').trim();
  const texto = String(c?.texto || '').trim();
  if (titulo.length < 2 || titulo.length > 60) return 'O título precisa ter de 2 a 60 letras.';
  if (texto.length < 2 || texto.length > 300) return 'O texto precisa ter de 2 a 300 letras.';
  if (c.link && !/^\/(?!\/)[\w\-./?=&#%]*$/.test(String(c.link))) return 'O link precisa ser uma tela do sistema (ex.: /app/meu-cadastro).';
  const d = c.destino;
  if (!d || !['filtro', 'pessoas'].includes(d.tipo)) return 'Escolha para quem vai o aviso.';
  if (d.tipo === 'pessoas' && (!Array.isArray(d.uids) || !d.uids.length || d.uids.length > 500)) return 'Escolha ao menos uma pessoa.';
  return '';
}

// Unidades em que a pessoa atua: líder/mentor pelo crachá; professor pelo crachá + vínculos ativos da ficha.
function unidadesDaPessoa(u, professores, vinculos) {
  const ids = new Set([u.unidadeId, ...(Array.isArray(u.unidadeIds) ? u.unidadeIds : [])].filter(Boolean).map(String));
  if (papelDe(u) === 'professor') {
    const ficha = professores.find((p) => (p.uidLogin && p.uidLogin === u.id) || (u.professorId && String(p.id) === String(u.professorId)));
    if (ficha) vinculos.forEach((v) => { if (String(v.professorId) === String(ficha.id) && v.unidadeId && v.status !== 'inativo') ids.add(String(v.unidadeId)); });
  }
  return ids;
}

export function escolherDestinatarios({ usuarios, professores = [], vinculos = [], destino }) {
  const ativos = usuarios.filter((u) => !semAcesso(u));
  if (destino.tipo === 'pessoas') {
    const quer = new Set(destino.uids.map(String));
    return ativos.filter((u) => quer.has(String(u.id)));
  }
  const papeis = (destino.papeis || []).map((p) => (p === 'unidade' ? 'lider' : p));
  const unidades = (destino.unidadeIds || []).map(String);
  return ativos.filter((u) => {
    if (papeis.length && !papeis.includes(papelDe(u))) return false;
    if (unidades.length) {
      const dela = unidadesDaPessoa(u, professores, vinculos);
      if (!unidades.some((x) => dela.has(x))) return false;
    }
    return true;
  });
}

// Só "data" (sem "notification"): quem mostra o aviso é o nosso sw.js, igual no Android, computador e iPhone instalado.
export function montarMensagem(c) {
  return {
    data: { titulo: c.titulo.trim(), texto: c.texto.trim(), link: c.link || '/app' },
    webpush: { headers: { Urgency: 'high', TTL: '86400' } },
    android: { priority: 'high' },
  };
}
