// Aviso "Copiado" no rodapé da tela (usar junto com useAvisoCopiado).
import { useTranslation } from "react-i18next";

export function AvisoCopiado({ visivel }) {
  const { t } = useTranslation();
  if (!visivel) return null;
  return <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold shadow-lg">{t("centrais.copiado")}</div>;
}
