// "Meu cadastro" (professor): pede a mudança do contrato (CLT ou Saver, unidades e horários). O líder da unidade, o mentor
// dela ou o admin conferem; só depois de aprovado a mudança vale para o valor da aula (ver services/atualizacaoProfessorService.js).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Clock, Loader2, UserCog, XCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCatalogs } from "../contexts/CatalogContext";
import CampoContrato from "../components/acesso/CampoContrato";
import { contratoVazio, mesmoContrato, resumoContrato, validarContrato } from "../utils/contrato";
import { fichasDoLogin, opcoesDeUnidadeDoProfessor } from "../utils/unidadeDoProfessor";
import { desistirDaAtualizacao, enviarAtualizacao, lerMinhaAtualizacao } from "../services/atualizacaoProfessorService";

export default function MeuCadastro() {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const { catalogs } = useCatalogs();
  const uid = user?.uid;
  const unidades = catalogs?.unidades || [];
  const nomeDaUnidade = (id) => unidades.find((u) => String(u.id) === String(id))?.nome || id;

  const ficha = fichasDoLogin(catalogs, uid, userData)[0] || null;
  const atual = useMemo(() => (ficha?.tipoContrato === "saver" ? { tipoContrato: "saver", saverLocais: ficha.saverLocais || [] } : contratoVazio()), [ficha]);
  const destino = opcoesDeUnidadeDoProfessor({ userData, uid, catalogs })[0] || null;

  const [pedido, setPedido] = useState(undefined); // undefined = lendo; null = nunca pediu
  const [contrato, setContrato] = useState(contratoVazio());
  const [iniciado, setIniciado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!uid) return;
    try { setPedido(await lerMinhaAtualizacao(uid)); } catch (e) { console.error(e); setPedido(null); setErro(t("profileUpdate.errors.load")); }
  }, [uid, t]);
  useEffect(() => { carregar(); }, [carregar]);
  // O formulário começa com o contrato que vale hoje (o da ficha), sem refazer enquanto a pessoa mexe.
  useEffect(() => { if (!iniciado && catalogs) { setContrato(atual); setIniciado(true); } }, [atual, catalogs, iniciado]);

  const pendente = pedido?.status === "pendente";
  const semMudanca = mesmoContrato(contrato, atual);

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    const ok = validarContrato(contrato);
    if (!ok.ok) return setErro(t(`accessRequest.contract.errors.${ok.erro}`));
    if (semMudanca) return setErro(t("profileUpdate.errors.same"));
    if (!destino) return setErro(t("profileUpdate.errors.noUnit"));
    setEnviando(true);
    try {
      await enviarAtualizacao({ uid, nome: userData?.nome || user?.email || "-", unidadeId: destino.unidadeId, vinculoId: destino.vinculoId, contrato: ok.valor });
      await carregar();
    } catch (err) { console.error(err); setErro(t("profileUpdate.errors.send")); } finally { setEnviando(false); }
  }

  async function desistir() {
    setEnviando(true);
    try { await desistirDaAtualizacao(uid); await carregar(); } catch (err) { console.error(err); setErro(t("profileUpdate.errors.send")); } finally { setEnviando(false); }
  }

  const faixa = {
    pendente: { cor: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300", Icone: Clock },
    aprovado: { cor: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300", Icone: CheckCircle2 },
    recusado: { cor: "bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300", Icone: XCircle },
  }[pedido?.status] || null;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <span className="p-2 bg-red-600 text-white rounded-lg"><UserCog className="w-6 h-6" /></span>
          {t("profileUpdate.title")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t("profileUpdate.subtitle")}</p>
      </div>

      {!destino ? (
        <div className="flex gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {t("certificates.noUnit")}
        </div>
      ) : (
        <>
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t("profileUpdate.current")}</p>
            <p className="font-black text-slate-800 dark:text-white mt-1">{resumoContrato(atual, nomeDaUnidade)}</p>
            {!ficha && <p className="text-xs text-amber-600 mt-2">{t("profileUpdate.noFicha")}</p>}
          </div>

          {pedido === undefined ? (
            <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-red-500" /></div>
          ) : faixa && (
            <div className={`p-4 rounded-2xl border text-sm space-y-1 ${faixa.cor}`}>
              <p className="font-black flex items-center gap-2"><faixa.Icone className="w-4 h-4" /> {t(`profileUpdate.status.${pedido.status}`)}</p>
              <p className="font-bold">{resumoContrato(pedido, nomeDaUnidade)}</p>
              {pedido.status === "recusado" && pedido.motivo && <p>{t("profileUpdate.reason", { reason: pedido.motivo })}</p>}
              {pendente && <button type="button" onClick={desistir} disabled={enviando} className="text-xs font-black uppercase underline">{t("profileUpdate.cancelRequest")}</button>}
            </div>
          )}

          <form onSubmit={enviar} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-4">
            <h2 className="font-black text-slate-800 dark:text-white">{t("profileUpdate.change")}</h2>
            <CampoContrato claro id="meu-contrato" valor={contrato} onChange={setContrato} unidades={unidades} desabilitado={enviando} />
            {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3">{erro}</p>}
            <p className="text-[11px] text-slate-400">{t("profileUpdate.approvalHint")}</p>
            <div className="flex justify-end">
              <button type="submit" disabled={enviando} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50">
                {enviando && <Loader2 className="w-4 h-4 animate-spin" />} {pendente ? t("profileUpdate.resend") : t("profileUpdate.send")}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
