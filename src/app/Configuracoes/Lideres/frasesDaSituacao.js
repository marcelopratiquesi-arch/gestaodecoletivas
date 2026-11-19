// Textos da "central de pendências" da aba Líderes: a frase curta da lista, o aviso "O que falta" da ficha,
// o nome do botão de próximo passo e a mensagem pronta do WhatsApp. Conta pura: recebe o `t` do i18n.
import { linkWhatsApp } from "../../../centrais/contato";
import { diaDoFim } from "../../../utils/temporario";

const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";

// Frase curta "o que falta" (lista do computador e do celular).
export function fraseCurta(sit, u, t) {
  switch (sit.id) {
    case "semLider":
      if (sit.pedidos > 0) return t("leadersTab.central.short.requests", { count: sit.pedidos });
      if (sit.loginAntigo) return t("leadersTab.central.short.legacy");
      return t("leadersTab.central.short.noLeader");
    case "conferir":
      return t("leadersTab.central.short.check");
    case "temporario":
      return sit.diasTemporario === 0
        ? t("leadersTab.central.short.tempToday", { name: primeiroNome(sit.temporario?.nome) })
        : t("leadersTab.central.short.temp", { name: primeiroNome(sit.temporario?.nome), count: sit.diasTemporario });
    case "semAcesso":
      return sit.nuncaEntrou ? t("leadersTab.central.short.never") : t("leadersTab.central.short.stale", { count: sit.diasSemAcesso });
    default:
      return u.lider2Uid ? t("leadersTab.central.short.two") : t("leadersTab.central.short.ok");
  }
}

// Texto do aviso "O que falta" da ficha.
export function fraseLonga(sit, u, t, idioma) {
  const nome = primeiroNome(u.liderNome) || u.liderEmail || "";
  switch (sit.id) {
    case "semLider":
      return sit.pedidos > 0 ? t("leadersTab.central.long.requests", { count: sit.pedidos }) : t("leadersTab.central.long.noLeader");
    case "conferir":
      return t("leadersTab.central.long.check", { name: nome });
    case "temporario":
      return t("leadersTab.central.long.temp", {
        name: sit.temporario?.nome || "-", count: sit.diasTemporario,
        date: diaDoFim(sit.temporario?.temporarioAte, idioma),
      });
    case "semAcesso":
      return sit.nuncaEntrou ? t("leadersTab.central.long.never", { name: nome }) : t("leadersTab.central.long.stale", { name: nome, count: sit.diasSemAcesso });
    default:
      return "";
  }
}

// Nome do botão de próximo passo (lista) e do botão principal do aviso (ficha).
export function rotuloDoPasso(sit, u, t, { naFicha = false } = {}) {
  switch (sit.id) {
    case "semLider": return t("leadersTab.central.step.pick");
    case "conferir": return naFicha ? t("leadersTab.central.step.confirmLong") : t("leadersTab.central.step.confirm");
    case "temporario": return t("leadersTab.central.step.extend");
    case "semAcesso": return u.liderTelefone ? t("leadersTab.central.step.whatsapp") : t("leadersTab.central.step.open");
    default: return t("leadersTab.central.step.open");
  }
}

// WhatsApp do líder com a mensagem pronta: quem nunca entrou recebe o caminho de entrada;
// quem sumiu recebe um lembrete. Sem telefone utilizável, devolve null.
export function whatsAppComMensagem(sit, u, t, pais) {
  const base = linkWhatsApp(u.liderTelefone, pais);
  if (!base) return null;
  const endereco = typeof window !== "undefined" ? window.location.origin : "";
  const texto = sit.id === "semAcesso" && sit.nuncaEntrou
    ? t("leadersTab.central.message.never", { name: primeiroNome(u.liderNome), link: endereco, email: u.liderEmail || "" })
    : sit.id === "semAcesso"
      ? t("leadersTab.central.message.stale", { name: primeiroNome(u.liderNome), link: endereco, count: sit.diasSemAcesso })
      : "";
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
