// "Último acesso" de uma pessoa (crachá usuarios/{uid}.ultimoAcesso, carimbado no máximo 1x por hora pelo AuthContext).
// Conta pura: devolve o texto da data e hora (sempre visível), o "há X dias" e a cor do aviso.
const MS_DIA = 86400000;

export function paraData(carimbo) {
  if (!carimbo) return null;
  if (typeof carimbo.toDate === "function") return carimbo.toDate();
  if (typeof carimbo.toMillis === "function") return new Date(carimbo.toMillis());
  if (typeof carimbo.seconds === "number") return new Date(carimbo.seconds * 1000);
  const d = new Date(carimbo);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Até 7 dias: verde · até 30: âmbar · mais que isso: vermelho.
export function corDoAcesso(dias) {
  return dias <= 7 ? "emerald" : dias <= 30 ? "amber" : "red";
}

export function resumoDoAcesso(carimbo, idioma = "pt-BR", agora = Date.now()) {
  const data = paraData(carimbo);
  if (!data) return null;
  const dias = Math.max(0, Math.floor((agora - data.getTime()) / MS_DIA));
  return {
    data,
    dias,
    cor: corDoAcesso(dias),
    relativo: new Intl.RelativeTimeFormat(idioma, { numeric: "auto" }).format(-dias, "day"),
    dia: data.toLocaleDateString(idioma),
    hora: data.toLocaleTimeString(idioma, { hour: "2-digit", minute: "2-digit" }),
    dataHora: data.toLocaleString(idioma, { dateStyle: "short", timeStyle: "short" }),
  };
}
