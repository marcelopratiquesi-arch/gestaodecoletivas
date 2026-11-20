// Pergunta "CLT ou SAVER?" do cadastro do professor. Saver = trabalha no SALÃO DE MUSCULAÇÃO como acadêmico/estagiário:
// pergunta em quantas unidades e, em cada uma, o horário (vale de segunda a sexta; pode ter mais de um horário na mesma unidade).
// (Regras em src/utils/contrato.js.) Telas escuras de acesso (padrão) ou internas (`claro`). Tudo em MAIÚSCULAS.
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { MAX_FAIXAS, MAX_LOCAIS, SEMANA, achatarFaixas, agruparFaixas, ehSemana, localVazio } from "../../utils/contrato";

const PROXIMOS = [["14:00", "18:00"], ["10:00", "14:00"], ["18:00", "22:00"], ["06:00", "10:00"], ["08:00", "12:00"]];

/**
 * @param valor { tipoContrato, saverLocais }
 * @param unidades [{ id, nome }]
 */
export default function CampoContrato({ valor, onChange, unidades, desabilitado = false, claro = false, id = "contrato" }) {
  const { t } = useTranslation();
  const saver = valor?.tipoContrato === "saver";
  const locais = valor?.saverLocais || [];

  const rotulo = claro ? "text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1" : "text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1";
  const campo = claro
    ? "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold uppercase px-3 py-2 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 text-sm"
    : "bg-zinc-900/50 border border-zinc-700 text-white font-bold uppercase px-3 py-2 rounded-xl outline-none focus:border-red-600 text-sm";
  const cartao = claro ? "border-slate-200 dark:border-slate-700" : "border-zinc-800";
  const botao = (ativo) => (claro
    ? `py-3 px-3 rounded-xl border text-sm font-black uppercase ${ativo ? "border-red-600 bg-red-600/10 text-red-700 dark:text-white" : "border-slate-300 dark:border-slate-700 text-slate-500"}`
    : `py-3 px-3 rounded-xl border text-sm font-black uppercase ${ativo ? "border-red-600 bg-red-600/10 text-white" : "border-zinc-700 bg-zinc-900 text-zinc-400"}`);
  const texto = claro ? "text-slate-600 dark:text-slate-300" : "text-zinc-300";
  const ajuda = `text-[11px] ml-1 ${claro ? "text-slate-500" : "text-zinc-500"}`;

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
  // O horário é mostrado como faixa (início e fim) que vale de segunda a sexta; no banco continua um item por dia.
  const mudarFaixas = (i, faixas) => mudarLocal(i, { horarios: achatarFaixas(faixas) });
  const mudarFaixa = (i, j, parte) => mudarFaixas(i, agruparFaixas(locais[i].horarios).map((f, k) => (k === j ? { ...f, ...parte } : f)));
  const adicionarFaixa = (i) => {
    const faixas = agruparFaixas(locais[i].horarios);
    const [ini, fim] = PROXIMOS.find(([a, b]) => !faixas.some((f) => f.ini === a && f.fim === b)) || PROXIMOS[0];
    mudarFaixas(i, [...faixas, { ini, fim, dias: SEMANA }]);
  };

  return (
    <div className="space-y-3">
      <p id={id} className={rotulo}>{t("accessRequest.contract.title")}</p>
      <div role="group" aria-labelledby={id} className="grid grid-cols-2 gap-2">
        <button type="button" disabled={desabilitado} aria-pressed={!saver} onClick={() => escolherTipo("clt")} className={botao(!saver)}>{t("accessRequest.contract.clt")}</button>
        <button type="button" disabled={desabilitado} aria-pressed={saver} onClick={() => escolherTipo("saver")} className={botao(saver)}>{t("accessRequest.contract.saver")}</button>
      </div>
      <p className={ajuda}>{t(saver ? "accessRequest.contract.saverHint" : "accessRequest.contract.cltHint")}</p>

      {saver && (
        <div className="space-y-4">
          <p className={`text-base font-black uppercase leading-tight ${claro ? "text-slate-800 dark:text-white" : "text-white"}`}>{t("accessRequest.contract.howMany")}</p>
          <div className="flex gap-2">
            {Array.from({ length: MAX_LOCAIS }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" disabled={desabilitado} aria-pressed={locais.length === n} onClick={() => definirQuantidade(n)} className={`${botao(locais.length === n)} w-11 !px-0`}>{n}</button>
            ))}
          </div>

          {locais.map((l, i) => {
            const faixas = agruparFaixas(l.horarios);
            return (
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
                  {faixas.map((f, j) => (
                    <div key={j} className="flex flex-wrap items-center gap-2">
                      <input type="time" aria-label={t("accessRequest.contract.from")} value={f.ini} disabled={desabilitado} onChange={(e) => mudarFaixa(i, j, { ini: e.target.value })} className={campo} />
                      <span className={`text-xs uppercase ${texto}`}>{t("accessRequest.contract.to")}</span>
                      <input type="time" aria-label={t("accessRequest.contract.until")} value={f.fim} disabled={desabilitado} onChange={(e) => mudarFaixa(i, j, { fim: e.target.value })} className={campo} />
                      {!ehSemana(f.dias) && <span className={`text-[11px] font-bold uppercase ${texto}`}>{f.dias.map((d) => t(`accessRequest.contract.daysShort.${d}`)).join(" / ")}</span>}
                      {faixas.length > 1 && (
                        <button type="button" disabled={desabilitado} aria-label={t("accessRequest.contract.removeHour")} onClick={() => mudarFaixas(i, faixas.filter((_, k) => k !== j))} className={`p-2 rounded-lg ${claro ? "text-slate-400 hover:text-red-600" : "text-zinc-500 hover:text-red-500"}`}><X className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                  {faixas.length < MAX_FAIXAS && (
                    <button type="button" disabled={desabilitado} onClick={() => adicionarFaixa(i)} className={`text-xs font-black uppercase flex items-center gap-1 ${claro ? "text-red-600" : "text-red-500"}`}>
                      <Plus className="w-3.5 h-3.5" /> {t("accessRequest.contract.addHour")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <p className={ajuda}>{t("accessRequest.contract.rule")}</p>
        </div>
      )}
    </div>
  );
}
