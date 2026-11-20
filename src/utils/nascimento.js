// Data de nascimento guardada como "AAAA-MM-DD". Funções puras (sem Firebase).

/** "1990-05-17" -> "17/05/1990". Valor vazio ou fora do formato volta como veio (ou ""). */
export function formatarNascimento(valor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valor || '');
}
