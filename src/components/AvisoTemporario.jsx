import { useState } from "react";
import { Timer, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { diaDoFim, diasRestantes, fimDoTemporario, nivelDoAviso } from "../utils/temporario";

// Aviso para o LÍDER TEMPORÁRIO: faltando 7 dias (e depois 3, 1 e no último dia) o cartão fica cada vez mais forte.
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

  const fim = fimDoTemporario(userData);
  if (!fim || fechado) return null;
  const dias = diasRestantes(fim);
  const nivel = nivelDoAviso(dias);
  if (!nivel || nivel === "vencido") return null;

  const texto = dias === 0
    ? t("tempLeader.banner.today")
    : t("tempLeader.banner.days", { count: dias, date: diaDoFim(fim, i18n.language) });

  return (
    <div role="alert" className={`fixed bottom-4 left-4 z-[9990] max-w-sm flex items-start gap-3 rounded-xl border px-4 py-3 text-white shadow-2xl ${COR[nivel]}`}>
      <Timer className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="text-sm font-semibold">
        <p>{texto}</p>
        <p className="text-xs font-medium opacity-90 mt-0.5">{t("tempLeader.banner.help")}</p>
      </div>
      <button type="button" onClick={() => setFechado(true)} aria-label={t("tempLeader.cancel")} className="shrink-0 p-1 rounded-md hover:bg-white/20">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
