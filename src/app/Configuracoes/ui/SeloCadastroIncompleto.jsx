// Etiqueta "Cadastro incompleto" das abas Mentores, Líderes e Professores (mesma etiqueta nas três). O que falta aparece ao
// passar o mouse. A lista vem de utils/cadastroCompleto (faltaNaLista / faltaDoCracha). Sem nada faltando, não mostra nada.
import { useTranslation } from "react-i18next";
import { UserX } from "lucide-react";
import { Selo } from "./Selo";

export default function SeloCadastroIncompleto({ falta = [] }) {
  const { t } = useTranslation();
  if (!falta.length) return null;
  const quais = falta.map((f) => t(`profileUpdate.incomplete.fields.${f}`)).join(", ");
  return <Selo tipo="aviso" icone={UserX} title={t("profileUpdate.incomplete.tip", { fields: quais })}>{t("profileUpdate.incomplete.badge")}</Selo>;
}
