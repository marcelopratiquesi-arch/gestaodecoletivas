// Ajudantes de contato das Centrais.

const DDI = { BR: '55', AR: '54', US: '1' };

// Link do WhatsApp a partir do telefone como está no cadastro. Se o número veio sem o código do país,
// usa o do país da unidade. Sem número utilizável, devolve null.
export function linkWhatsApp(telefone, pais = 'BR') {
  let numeros = String(telefone || '').replace(/\D/g, '');
  if (numeros.length < 8) return null;
  const ddi = DDI[String(pais || 'BR').toUpperCase()] || DDI.BR;
  if (numeros.length <= 11 && !(ddi === '1' && numeros.length === 11)) numeros = `${ddi}${numeros}`;
  return `https://wa.me/${numeros}`;
}

// Iniciais para a bolinha do cabeçalho ("Savassi Centro" -> "SC").
export function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}
