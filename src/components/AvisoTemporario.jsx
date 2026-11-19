import { useState } from "react";
import { Timer, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { coberturaAtiva } from "../permissions";
import { diaDoFim, diasRestantes, fimDoTemporario, nivelDoAviso } from "../utils/temporario";
import { paraData } from "../utils/ultimoAcesso";

// Aviso para o LÍDER TEMPORÁRIO e para quem tem COBERTURA de mentor (mentor temporário): faltando 7 dias
// (e depois 3, 1 e no último dia) o cartão fica cada vez mais forte.
// Não manda e-mail nem WhatsApp (isso exigiria servidor pago); aparece sempre que a pessoa entra no sistema.
const COR = {
  atencao: "bg-amber-500 border-amber-300",
  alto: "bg-orange-500 border-orange-300",
  urgente: "bg-red-600 border-red-300",
};

export default function AvisoTemporario() {
  const { t, i18n } = useTranslation();
  const { userData } = useAuth();
  const [fechado, setFechado] = useState(false);

  const emCobertura = !fimDoTemporario(userData) && !!coberturaAtiva(userData);
  const fim = fimDoTemporario(userData) || (emCobertura ? paraData(userData?.coberturaAte) : null);
  if (!fim || fechado) return null;
  const dias = diasRestantes(fim);
  const nivel = nivelDoAviso(dias);
  if (!nivel || nivel === "vencido") return null;

  const data = diaDoFim(fim, i18n.language);
  const texto = emCobertura
    ? (dias === 0 ? t("tempLeader.mentor.bannerTitleToday") : t("tempLeader.mentor.bannerTitleDays", { count: dias, date: data }))
    : (dias === 0 ? t("tempLeader.banner.today") : t("tempLeader.banner.days", { count: dias, date: data }));

  return (
    <div role="alert" className={`fixed bottom-4 left-4 z-[9990] max-w-sm flex items-start gap-3 rounded-xl border px-4 py-3 text-white shadow-2xl ${COR[nivel]}`}>
      <Timer className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="text-sm font-semibold">
        <p>{texto}</p>
        <p className="text-xs font-medium opacity-90 mt-0.5">{emCobertura ? t("tempLeader.mentor.bannerHelp") : t("tempLeader.banner.help")}</p>
      </div>
      <button type="button" onClick={() => setFechado(true)} aria-label={t("tempLeader.cancel")} className="shrink-0 p-1 rounded-md hover:bg-white/20">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
