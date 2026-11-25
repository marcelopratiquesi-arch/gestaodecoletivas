// Etiqueta "Cadastro incompleto" das abas Mentores, Líderes e Professores (mesma etiqueta nas três). O que falta aparece ao
// passar o mouse. A lista vem de utils/cadastroCompleto (faltaNaLista / faltaDoCracha). Sem nada faltando, não mostra nada.
// Com `onClick`, a etiqueta vira botão: abre o Editar da pessoa já no primeiro campo que falta (recebe a lista do que falta).
import { useTranslation } from "react-i18next";
import { UserX } from "lucide-react";
import { Selo } from "./Selo";

export default function SeloCadastroIncompleto({ falta = [], onClick }) {
  const { t } = useTranslation();
  if (!falta.length) return null;
  const quais = falta.map((f) => t(`profileUpdate.incomplete.fields.${f}`)).join(", ");
  return <Selo tipo="aviso" icone={UserX} onClick={onClick ? () => onClick(falta) : undefined} title={t("profileUpdate.incomplete.tip", { fields: quais })}>{t("profileUpdate.incomplete.badge")}</Selo>;
}
