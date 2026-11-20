import { Eye, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";

// Faixa fina no topo do conteúdo enquanto o administrador está "vendo como" outra pessoa,
// para ninguém (nem o próprio admin) esquecer que a tela não é a dele.
export default function FaixaVisaoAdmin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ehAdminReal, visaoAdmin, definirVisaoAdmin } = useAuth();
  if (!ehAdminReal || !visaoAdmin?.tipo) return null;

  const tipo = t(`sidebar.viewAs.types.${visaoAdmin.tipo}`);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-amber-300 bg-amber-100 px-4 py-1.5 text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200">
      <p className="flex min-w-0 items-center gap-2 text-[11px] font-black uppercase tracking-wider">
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{t("sidebar.viewAs.banner", { tipo, nome: visaoAdmin.nome })}</span>
        <span className="hidden font-bold normal-case tracking-normal opacity-80 lg:inline">· {t("sidebar.viewAs.bannerHint")}</span>
      </p>
      <button
        type="button"
        onClick={() => { definirVisaoAdmin(null); navigate("/app"); }}
        className="flex items-center gap-1 rounded-md border border-amber-400 bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition-colors hover:bg-white dark:border-amber-600 dark:bg-amber-950/40 dark:hover:bg-amber-950/70"
      >
        <X className="h-3 w-3" /> {t("sidebar.viewAs.backToAdmin")}
      </button>
    </div>
  );
}
