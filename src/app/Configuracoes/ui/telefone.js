// Países (DDI) e máscara de telefone das tabelas de Configurações (BR / AR / US).
// Fonte única: as abas que ainda têm cópia própria (Mentores, Professores, Unidades) passam a usar esta nas próximas etapas.

export const PAIS_PADRAO = "BR";

// ATENÇÃO: classes escritas por extenso de propósito (o Tailwind só enxerga texto inteiro).
export const PAIS_CONFIG = {
  BR: { id: "BR", ddi: "+55", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" },
  AR: { id: "AR", ddi: "+54", badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800" },
  US: { id: "US", ddi: "+1", badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800" },
};

// Máscara do número (sem o DDI) por país.
export function formatarTelefone(valor, pais = PAIS_PADRAO) {
  if (!valor) return "";
  let v = String(valor).replace(/\D/g, "");
  if (pais === "BR") {
    if (v.startsWith("55") && v.length > 11) v = v.slice(2);
    v = v.slice(0, 11);
    if (v.length > 2) v = v.replace(/^(\d{2})(\d)/, "($1) $2");
    if (v.length > 7) v = v.replace(/(\d{5})(\d)/, "$1-$2");
    return v;
  }
  if (pais === "US") {
    if (v.startsWith("1") && v.length > 10) v = v.slice(1);
    v = v.slice(0, 10);
    if (v.length > 3) v = v.replace(/^(\d{3})(\d)/, "($1) $2");
    if (v.length > 6) v = v.replace(/^(\(\d{3}\)\s\d{3})(\d)/, "$1-$2");
    return v;
  }
  if (pais === "AR") {
    if (v.startsWith("54") && v.length > 11) v = v.slice(2);
    v = v.slice(0, 11);
    if (v.length > 1) v = v.replace(/^(\d{1})(\d)/, "$1 $2");
    if (v.length > 3) v = v.replace(/^(\d{1})\s(\d{2})(\d)/, "$1 $2 $3");
    if (v.length > 7) v = v.replace(/^(\d{1})\s(\d{2})\s(\d{4})(\d)/, "$1 $2 $3-$4");
    return v;
  }
  return v;
}

// Texto do telefone para mostrar: "+55 (31) 99434-9909". Número salvo já com "+" (dado antigo) aparece como está.
export function telefoneParaExibir(telefone, pais = PAIS_PADRAO) {
  if (!telefone) return "";
  const bruto = String(telefone).trim();
  if (bruto.startsWith("+")) return bruto;
  const ddi = PAIS_CONFIG[pais]?.ddi;
  return ddi ? `${ddi} ${formatarTelefone(bruto, pais)}` : bruto;
}
