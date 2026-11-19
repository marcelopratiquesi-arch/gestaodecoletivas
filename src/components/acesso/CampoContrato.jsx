// Pergunta "CLT ou Saver?" do cadastro do professor. Saver = trabalha no SALÃO DE MUSCULAÇÃO como acadêmico/estagiário:
// pergunta em quantas unidades e, em cada uma, os dias e horários. (Regras em src/utils/contrato.js.)
// Telas escuras de acesso (padrão) ou internas (`claro`).
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { MAX_HORARIOS, MAX_LOCAIS, horarioVazio, localVazio } from "../../utils/contrato";

const DIAS = [1, 2, 3, 4, 5, 6, 0]; // segunda a domingo

/**
 * @param valor { tipoContrato, saverLocais }
 * @param unidades [{ id, nome }]
 */
export default function CampoContrato({ valor, onChange, unidades, desabilitado = false, claro = false, id = "contrato" }) {
  const { t } = useTranslation();
  const saver = valor?.tipoContrato === "saver";
  const locais = valor?.saverLocais || [];

  const rotulo = claro ? "text-[10px] font-bold text-slate-500 uppercase ml-1" : "text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1";
  const campo = claro
    ? "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white font-bold px-3 py-2 rounded-xl outline-none focus:border-blue-500 text-sm"
    : "bg-zinc-900/50 border border-zinc-700 text-white font-bold px-3 py-2 rounded-xl outline-none focus:border-red-600 text-sm";
  const cartao = claro ? "border-slate-200 dark:border-slate-700" : "border-zinc-800";
  const botao = (ativo) => (claro
    ? `py-3 px-3 rounded-xl border text-sm font-black ${ativo ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-white" : "border-slate-300 dark:border-slate-700 text-slate-500"}`
    : `py-3 px-3 rounded-xl border text-sm font-black ${ativo ? "border-red-600 bg-red-600/10 text-white" : "border-zinc-700 bg-zinc-900 text-zinc-400"}`);
  const texto = claro ? "text-slate-600 dark:text-slate-300" : "text-zinc-300";

  const escolherTipo = (tipo) => {
    if (tipo === "clt") onChange({ tipoContrato: "clt", saverLocais: [] });
    else onChange({ tipoContrato: "saver", saverLocais: locais.length ? locais : [localVazio()] });
  };
  const definirQuantidade = (n) => {
    const atual = locais.slice(0, n);
    while (atual.length < n) atual.push(localVazio());
    onChange({ tipoContrato: "saver", saverLocais: atual });
  };
  const mudarLocal = (i, parte) => onChange({ tipoContrato: "saver", saverLocais: locais.map((l, k) => (k === i ? { ...l, ...parte } : l)) });
  const mudarHorario = (i, j, parte) => mudarLocal(i, { horarios: locais[i].horarios.map((h, k) => (k === j ? { ...h, ...parte } : h)) });

  return (
    <div className="space-y-3">
      <p id={id} className={rotulo}>{t("accessRequest.contract.title")}</p>
      <div role="group" aria-labelledby={id} className="grid grid-cols-2 gap-2">
        <button type="button" disabled={desabilitado} aria-pressed={!saver} onClick={() => escolherTipo("clt")} className={botao(!saver)}>{t("accessRequest.contract.clt")}</button>
        <button type="button" disabled={desabilitado} aria-pressed={saver} onClick={() => escolherTipo("saver")} className={botao(saver)}>{t("accessRequest.contract.saver")}</button>
      </div>
      <p className={`text-[11px] ml-1 ${claro ? "text-slate-500" : "text-zinc-500"}`}>{t(saver ? "accessRequest.contract.saverHint" : "accessRequest.contract.cltHint")}</p>

      {saver && (
        <div className="space-y-4">
          <p className={`text-base font-black uppercase leading-tight ${claro ? "text-slate-800 dark:text-white" : "text-white"}`}>{t("accessRequest.contract.howMany")}</p>
          <div className="flex gap-2">
            {Array.from({ length: MAX_LOCAIS }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" disabled={desabilitado} aria-pressed={locais.length === n} onClick={() => definirQuantidade(n)} className={`${botao(locais.length === n)} w-11 !px-0`}>{n}</button>
            ))}
          </div>

          {locais.map((l, i) => (
            <div key={i} className={`rounded-2xl border p-3 space-y-3 ${cartao}`}>
              <div className="space-y-1">
                <label htmlFor={`${id}-un-${i}`} className={rotulo}>{t("accessRequest.contract.unit", { n: i + 1 })}</label>
                <select id={`${id}-un-${i}`} value={l.unidadeId} disabled={desabilitado} onChange={(e) => mudarLocal(i, { unidadeId: e.target.value })} className={`${campo} w-full`}>
                  <option value="">{t("accessRequest.contract.unitPlaceholder")}</option>
                  {(unidades || []).map((u) => <option key={u.id} value={String(u.id)}>{u.nome}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <p className={rotulo}>{t("accessRequest.contract.hours")}</p>
                {l.horarios.map((h, j) => (
                  <div key={j} className="flex flex-wrap items-center gap-2">
                    <select aria-label={t("accessRequest.contract.day")} value={h.dia} disabled={desabilitado} onChange={(e) => mudarHorario(i, j, { dia: Number(e.target.value) })} className={campo}>
                      {DIAS.map((d) => <option key={d} value={d}>{t(`accessRequest.contract.days.${d}`)}</option>)}
                    </select>
                    <input type="time" aria-label={t("accessRequest.contract.from")} value={h.ini} disabled={desabilitado} onChange={(e) => mudarHorario(i, j, { ini: e.target.value })} className={campo} />
                    <span className={`text-xs ${texto}`}>{t("accessRequest.contract.to")}</span>
                    <input type="time" aria-label={t("accessRequest.contract.until")} value={h.fim} disabled={desabilitado} onChange={(e) => mudarHorario(i, j, { fim: e.target.value })} className={campo} />
                    {l.horarios.length > 1 && (
                      <button type="button" disabled={desabilitado} aria-label={t("accessRequest.contract.removeHour")} onClick={() => mudarLocal(i, { horarios: l.horarios.filter((_, k) => k !== j) })} className={`p-2 rounded-lg ${claro ? "text-slate-400 hover:text-red-600" : "text-zinc-500 hover:text-red-500"}`}><X className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
                {l.horarios.length < MAX_HORARIOS && (
                  <button type="button" disabled={desabilitado} onClick={() => mudarLocal(i, { horarios: [...l.horarios, horarioVazio()] })} className={`text-xs font-black uppercase flex items-center gap-1 ${claro ? "text-blue-600" : "text-red-500"}`}>
                    <Plus className="w-3.5 h-3.5" /> {t("accessRequest.contract.addHour")}
                  </button>
                )}
              </div>
            </div>
          ))}
          <p className={`text-[11px] ml-1 ${claro ? "text-slate-500" : "text-zinc-500"}`}>{t("accessRequest.contract.rule")}</p>
        </div>
      )}
    </div>
  );
}
