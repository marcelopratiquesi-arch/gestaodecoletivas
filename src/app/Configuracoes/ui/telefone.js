// Países (DDI) e máscara de telefone das tabelas de Configurações (BR / AR / US).
// Fonte única: as abas que ainda têm cópia própria (Mentores, Professores, Unidades) passam a usar esta nas próximas etapas.

export const PAIS_PADRAO = "BR";

// ATENÇÃO: classes escritas por extenso de propósito (o Tailwind só enxerga texto inteiro).
export const PAIS_CONFIG = {
  BR: { id: "BR", nome: "Brasil", ddi: "+55", badgeClass: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600" },
  AR: { id: "AR", nome: "Argentina", ddi: "+54", badgeClass: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600" },
  US: { id: "US", nome: "Estados Unidos", ddi: "+1", badgeClass: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600" },
};
export const PAISES = Object.values(PAIS_CONFIG);
export const DDI_MAP = Object.fromEntries(PAISES.map((p) => [p.id, p.ddi]));

// Exemplo do formato, para o campo vazio.
export function exemploDeTelefone(pais = PAIS_PADRAO) {
  if (pais === "US") return "(000) 000-0000";
  if (pais === "AR") return "9 11 0000-0000";
  return "(00) 00000-0000";
}

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
