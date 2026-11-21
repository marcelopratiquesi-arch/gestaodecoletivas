// Aviso OBRIGATÓRIO de cadastro incompleto (admin, mentor, líder e professor). Aparece por cima do sistema quando falta
// nome, WhatsApp, país ou data de nascimento (o documento tem a própria tela obrigatória).
//  - Mostra SÓ o que falta; a pessoa preenche ali mesmo, salva e vai para "Meu cadastro" conferir.
//  - "Lembrar depois": 1 vez por dia. No 3º dia trava (só sai completando ou saindo do sistema).
//  - A contagem fica no crachá (vale no celular e no computador). Regras e conta: utils/cadastroCompleto.js.
//  - Sempre olha o crachá de VERDADE (no "Ver como" do admin, é o cadastro do próprio admin).
//  - A data de nascimento fica numa gaveta à parte: quem ainda não tem a marca "nascimentoOk" faz UMA leitura por entrada.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, LogOut } from "lucide-react";
import PopupFlutuante from "./PopupFlutuante";
import { useAuth } from "../contexts/AuthContext";
import { useCatalogs } from "../contexts/CatalogContext";
import { camposFaltando, entraNaRegraDoCadastro, proximoAdiamento, situacaoDoAdiamento } from "../utils/cadastroCompleto";
import { PAISES, DDI_MAP, formatarTelefone, exemploDeTelefone } from "../app/Configuracoes/ui/telefone";
import { normalizarPais } from "../utils/feriados";
import { fichasDoLogin } from "../utils/unidadeDoProfessor";
import { vagasDeLiderDaPessoa } from "../utils/lideranca";
import { adiarAvisoDoCadastro, lerNascimento, marcarNascimentoOk, nascimentoValido, salvarMeuCadastro } from "../services/meuCadastroService";
import { CAMPO, ROTULO } from "../pages/meuCadastro/estilos";

export default function CadastroObrigatorio() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, crachaReal, recarregarCracha, logout } = useAuth();
  const { catalogs, loadingCatalogs } = useCatalogs();
  const uid = user?.uid;
  const regra = !!uid && entraNaRegraDoCadastro(crachaReal);

  // Quem ainda não tem a marca faz UMA leitura da gaveta de nascimento; se a data já existe, coloca a marca (sem incomodar).
  const precisaLer = regra && crachaReal?.nascimentoOk !== true;
  const [lido, setLido] = useState(null); // { uid, tem }
  useEffect(() => {
    if (!precisaLer) return undefined;
    let vivo = true;
    lerNascimento(uid)
      .then((n) => {
        if (!vivo) return;
        setLido({ uid, tem: !!n });
        if (n) marcarNascimentoOk(uid).catch((e) => console.warn("Marca de nascimento não gravada:", e?.code));
      })
      // Não conseguiu ler: não incomoda (melhor não cobrar do que cobrar o que já foi informado).
      .catch((e) => { console.error(e); if (vivo) setLido({ uid, tem: true }); });
    return () => { vivo = false; };
  }, [precisaLer, uid]);

  const unidades = catalogs?.unidades;
  const paisDaUnidade = (unidades || []).find((u) => String(u.id) === String(crachaReal?.unidadeId))?.pais || "";
  const esperando = !regra || (precisaLer && lido?.uid !== uid) || (!!crachaReal?.unidadeId && !crachaReal?.pais && loadingCatalogs);
  const falta = esperando ? [] : camposFaltando({ cracha: crachaReal, paisDaUnidade, temNascimento: lido?.uid === uid && lido.tem });
  const sit = situacaoDoAdiamento(crachaReal);
  const [adiadoAgora, setAdiadoAgora] = useState(false);

  // Formulário (começa com o que já existe).
  const paisInicial = normalizarPais(crachaReal?.pais || paisDaUnidade);
  const [nome, setNome] = useState(String(crachaReal?.nome || ""));
  const [pais, setPais] = useState(paisInicial);
  const [telefone, setTelefone] = useState(formatarTelefone(String(crachaReal?.telefone || ""), paisInicial));
  const [nascimento, setNascimento] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  const naPaginaDoCadastro = pathname.startsWith("/app/meu-cadastro");
  const mostrar = falta.length > 0 && !adiadoAgora && !sit.adiadoHoje && !(naPaginaDoCadastro && !sit.travado);
  if (!mostrar) return null;

  const faltaNome = falta.includes("nome");
  const faltaTelefone = falta.includes("telefone");
  const faltaPais = falta.includes("pais");
  const faltaNascimento = falta.includes("nascimento");

  function trocarPais(p) {
    setPais(p);
    setTelefone((v) => formatarTelefone(v, p));
  }

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    const nomeLimpo = (faltaNome ? nome : String(crachaReal.nome || "")).trim().replace(/\s+/g, " ").toUpperCase();
    const telefoneFinal = (faltaTelefone ? telefone : String(crachaReal.telefone || "")).trim();
    if (nomeLimpo.length < 3) return setErro(t("profileUpdate.me.errors.name"));
    if (telefoneFinal.replace(/\D/g, "").length < 8) return setErro(t("profileUpdate.me.errors.phone"));
    if (faltaNascimento && (!nascimento || !nascimentoValido(nascimento))) return setErro(t("profileUpdate.me.errors.birth"));
    const paisAntes = normalizarPais(crachaReal.pais || paisDaUnidade);
    const mail = String(crachaReal.emailContato || crachaReal.email || user?.email || "");
    const ficha = fichasDoLogin(catalogs, uid, crachaReal)[0] || null;
    setOcupado(true);
    try {
      const r = await salvarMeuCadastro({
        uid, fichaId: ficha?.id || "", unidadesDoLider: vagasDeLiderDaPessoa(unidades, crachaReal, uid), nomeParaAuditoria: nomeLimpo,
        antes: { nome: String(crachaReal.nome || ""), telefone: String(crachaReal.telefone || ""), pais: paisAntes, emailContato: mail, emailLogin: user?.email || "", documento: null, nascimento: "" },
        depois: { nome: nomeLimpo, telefone: telefoneFinal, pais: faltaPais ? pais : paisAntes, emailContato: mail, documento: null, nascimento: faltaNascimento ? nascimento : "" },
      }, t);
      if (!r.ok) return setErro(r.mensagem);
      await recarregarCracha();
      navigate("/app/meu-cadastro");
    } catch (err) {
      console.error(err);
      setErro(t("profileUpdate.me.errors.save"));
    } finally { setOcupado(false); }
  }

  async function adiar() {
    setAdiadoAgora(true); // some já; a contagem vai para o crachá (se falhar, vale só até recarregar)
    try { await adiarAvisoDoCadastro(uid, proximoAdiamento(crachaReal)); } catch (e) { console.warn("Adiamento não gravado:", e?.code); }
  }

  const nomesDosCampos = falta.map((c) => t(`profileUpdate.gate.fields.${c}`)).join(", ");

  const rodape = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={logout} disabled={ocupado} className="px-3 py-2 rounded-xl text-xs font-black uppercase bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-100 flex items-center gap-1.5 disabled:opacity-50">
        <LogOut className="w-3.5 h-3.5" /> {t("profileUpdate.gate.logout")}
      </button>
      <div className="flex items-center gap-2">
        {sit.podeAdiar && (
          <button type="button" onClick={adiar} disabled={ocupado} className="px-3 py-2 rounded-xl text-xs font-black uppercase bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-100 disabled:opacity-50">
            {t("profileUpdate.gate.later")}
          </button>
        )}
        <button type="submit" form="form-cadastro-obrigatorio" disabled={ocupado} className="px-4 py-2 rounded-xl text-xs font-black uppercase bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50">
          {ocupado && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t("profileUpdate.gate.save")}
        </button>
      </div>
    </div>
  );

  return (
    <PopupFlutuante titulo={t("profileUpdate.gate.title")} onFechar={() => {}} obrigatorio chaveMemoria="cadastro.obrigatorio.v1" largura={460} altura={560} rodape={rodape}>
      <form id="form-cadastro-obrigatorio" onSubmit={salvar} className="p-5 space-y-4">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 normal-case">{t("profileUpdate.gate.intro", { fields: nomesDosCampos })}</p>
        <p className={`text-xs font-bold normal-case ${sit.travado ? "text-red-600" : "text-slate-500 dark:text-slate-400"}`}>
          {sit.travado ? t("profileUpdate.gate.locked") : t("profileUpdate.gate.postponeHint", { count: sit.restantes })}
        </p>

        {faltaNome && (
          <div>
            <label htmlFor="co-nome" className={ROTULO}>{t("profileUpdate.me.name")} *</label>
            <input id="co-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} disabled={ocupado} className={CAMPO} />
          </div>
        )}
        {faltaPais && (
          <div>
            <label htmlFor="co-pais" className={ROTULO}>{t("profileUpdate.me.country")} *</label>
            <select id="co-pais" value={pais} onChange={(e) => trocarPais(e.target.value)} disabled={ocupado} className={CAMPO}>
              {PAISES.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        )}
        {faltaTelefone && (
          <div>
            <label htmlFor="co-tel" className={ROTULO}>{t("profileUpdate.me.phone")} *</label>
            <div className="flex gap-2">
              <span className="px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-sm font-black">{DDI_MAP[faltaPais ? pais : paisInicial]}</span>
              <input id="co-tel" value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value, faltaPais ? pais : paisInicial))} inputMode="tel" placeholder={exemploDeTelefone(faltaPais ? pais : paisInicial)} disabled={ocupado} className={CAMPO} />
            </div>
          </div>
        )}
        {faltaNascimento && (
          <div>
            <label htmlFor="co-nasc" className={ROTULO}>{t("profileUpdate.me.birth")} *</label>
            <input id="co-nasc" type="date" value={nascimento} min="1920-01-01" max={new Date().toISOString().slice(0, 10)} onChange={(e) => setNascimento(e.target.value)} disabled={ocupado} className={CAMPO} />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 normal-case mt-1">{t("profileUpdate.me.birthHint")}</p>
          </div>
        )}
        {erro && <p role="alert" className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 normal-case">{erro}</p>}
      </form>
    </PopupFlutuante>
  );
}
