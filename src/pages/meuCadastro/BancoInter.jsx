// Banco Inter (agência e conta) no Meu cadastro do professor do Brasil. Não é obrigatório por enquanto: é um campo a
// preencher (mais adiante entra na regra que trava, junto com os outros). Quem vê: a própria pessoa, o admin, o mentor e o
// líder da unidade (quem paga). Guardado numa gaveta privada (services/dadosBancariosService.js).
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Landmark, Loader2 } from "lucide-react";
import { formatarAgencia, formatarConta, NOME_BANCO, validarDadosBancarios } from "../../utils/dadosBancarios";
import { lerDadosBancarios, removerDadosBancarios, salvarDadosBancarios } from "../../services/dadosBancariosService";
import { CAMPO, CARTAO, ROTULO, SECAO } from "./estilos";

export default function BancoInter({ uid, nome }) {
  const { t } = useTranslation();
  const [guardado, setGuardado] = useState(undefined); // undefined = lendo; null = nada guardado
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [salvoOk, setSalvoOk] = useState(false);

  useEffect(() => {
    let vivo = true;
    lerDadosBancarios(uid)
      .then((d) => { if (!vivo) return; setGuardado(d); setAgencia(d ? formatarAgencia(d.agencia) : ""); setConta(d ? formatarConta(d.conta) : ""); })
      .catch((e) => { console.error(e); if (vivo) { setGuardado(null); setErro(t("profileUpdate.bank.errors.load")); } });
    return () => { vivo = false; };
  }, [uid, t]);

  async function salvar(e) {
    e.preventDefault();
    setErro(""); setSalvoOk(false);
    const r = validarDadosBancarios({ agencia, conta });
    if (!r.ok) return setErro(t(`profileUpdate.bank.errors.${r.erro}`));
    setOcupado(true);
    try {
      await salvarDadosBancarios({ uid, nome, valor: r.valor, tinhaAntes: !!guardado });
      setGuardado(r.valor);
      setSalvoOk(true);
    } catch (err) { console.error(err); setErro(t("profileUpdate.bank.errors.save")); } finally { setOcupado(false); }
  }

  async function remover() {
    if (!window.confirm(t("profileUpdate.bank.removeConfirm"))) return;
    setErro(""); setSalvoOk(false); setOcupado(true);
    try {
      await removerDadosBancarios({ uid, nome });
      setGuardado(null); setAgencia(""); setConta("");
    } catch (err) { console.error(err); setErro(t("profileUpdate.bank.errors.save")); } finally { setOcupado(false); }
  }

  return (
    <section className="space-y-3">
      <h2 className={SECAO}>{t("profileUpdate.bank.title")}</h2>
      <form onSubmit={salvar} className={CARTAO}>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 normal-case flex items-start gap-2"><Landmark className="w-4 h-4 shrink-0" /> {t("profileUpdate.bank.hint", { bank: NOME_BANCO })}</p>
        {guardado === undefined ? (
          <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-red-500" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="mc-agencia" className={ROTULO}>{t("profileUpdate.bank.agency")}</label>
                <input id="mc-agencia" value={agencia} onChange={(e) => setAgencia(formatarAgencia(e.target.value))} inputMode="numeric" placeholder="0001" disabled={ocupado} className={CAMPO} />
              </div>
              <div>
                <label htmlFor="mc-conta" className={ROTULO}>{t("profileUpdate.bank.account")}</label>
                <input id="mc-conta" value={conta} onChange={(e) => setConta(formatarConta(e.target.value))} inputMode="numeric" placeholder="1234567-8" disabled={ocupado} className={CAMPO} />
              </div>
            </div>
            {erro && <p role="alert" className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 normal-case">{erro}</p>}
            {salvoOk && <p role="status" className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {t("profileUpdate.bank.saved")}</p>}
            <div className="flex justify-end gap-3 items-center">
              {guardado && <button type="button" onClick={remover} disabled={ocupado} className="text-xs font-black uppercase underline text-slate-500 dark:text-slate-400">{t("profileUpdate.bank.remove")}</button>}
              <button type="submit" disabled={ocupado} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50">
                {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} {t("profileUpdate.bank.save")}
              </button>
            </div>
          </>
        )}
      </form>
    </section>
  );
}
