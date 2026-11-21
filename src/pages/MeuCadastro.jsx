// "Meu cadastro" de TODOS os papéis (admin, mentor, líder e professor):
//  0) Só a PRÓPRIA pessoa (crachá de verdade: no "Ver como" do admin continua sendo o do admin).
//  1) DADOS PESSOAIS (nome, WhatsApp, país, e-mail de contato, documento, nascimento): salvam NA HORA, sem aprovação,
//     no crachá, na ficha da grade e nas gavetas privadas (ver services/meuCadastroService.js). O e-mail de login é só leitura.
//  2) CONTRATO (CLT ou SAVER, unidades e horários): pede a mudança; o líder da unidade, o mentor dela ou o admin conferem, e só
//     depois de aprovado vale para o valor da aula (ver services/atualizacaoProfessorService.js). Só professor.
//     O contrato leva junto as MODALIDADES (texto na ficha) e também precisa de aprovação.
//  2b) UNIDADE NOVA (professor): pedido à parte, aprovado pelo líder/mentor da unidade pedida (meuCadastro/UnidadesDoProfessor).
//  3) MINHAS UNIDADES (mentor e líder): lista; o líder também pode pedir outra unidade (pasta meuCadastro/).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Clock, Loader2, UserCog, XCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCatalogs } from "../contexts/CatalogContext";
import CampoContrato from "../components/acesso/CampoContrato";
import CampoDocumento from "../components/acesso/CampoDocumento";
import { contratoVazio, mesmoContrato, resumoContrato, validarContrato } from "../utils/contrato";
import { documentoValido, formatarDocumento, limparDocumento, tipoDocumentoDoPais } from "../utils/documento";
import { normalizarPais } from "../utils/feriados";
import { ehLider } from "../permissions";
import { vagasDeLiderDaPessoa } from "../utils/lideranca";
import MinhasUnidades from "./meuCadastro/MinhasUnidades";
import UnidadesDoProfessor from "./meuCadastro/UnidadesDoProfessor";
import BancoInter from "./meuCadastro/BancoInter";
import { professorTemBancoInter } from "../utils/dadosBancarios";
import SeletorModalidades from "../components/acesso/SeletorModalidades";
import { modalidadesDoTexto } from "../components/acesso/acessoDados";
import { CAMPO, CAMPO_LEITURA, CARTAO, ROTULO, SECAO } from "./meuCadastro/estilos";
import { PAISES, DDI_MAP, formatarTelefone, exemploDeTelefone } from "../app/Configuracoes/ui/telefone";
import { fichasDoLogin, idsDasUnidadesDoProfessor, opcoesDeUnidadeDoProfessor } from "../utils/unidadeDoProfessor";
import { desistirDaAtualizacao, enviarAtualizacao, lerMinhaAtualizacao } from "../services/atualizacaoProfessorService";
import { ERRO_DOCUMENTO_EM_USO } from "../services/documentoService";
import { lerMeuDocumento, lerNascimento, nascimentoValido, salvarMeuCadastro } from "../services/meuCadastroService";

export default function MeuCadastro() {
  const { t } = useTranslation();
  // Sempre o crachá de VERDADE de quem entrou: no "Ver como" do admin, o Meu cadastro continua sendo o do próprio admin.
  const { user, crachaReal, recarregarCracha } = useAuth();
  const userData = crachaReal;
  const papel = String(userData?.role || "").trim().toLowerCase();
  const souProfessor = papel === "professor";
  const souLider = ehLider(papel);
  const souMentor = papel === "mentor";
  const { catalogs } = useCatalogs();
  const uid = user?.uid;
  const unidades = useMemo(() => catalogs?.unidades || [], [catalogs?.unidades]);
  const nomeDaUnidade = (id) => unidades.find((u) => String(u.id) === String(id))?.nome || id;

  const ficha = fichasDoLogin(catalogs, uid, userData)[0] || null;
  // Unidades em que sou líder (1º ou 2º): nome e telefone novos também vão para elas.
  const unidadesDoLiderPessoa = useMemo(() => vagasDeLiderDaPessoa(unidades, userData, uid), [userData, unidades, uid]);

  const atual = useMemo(() => (ficha?.tipoContrato === "saver" ? { tipoContrato: "saver", saverLocais: ficha.saverLocais || [] } : contratoVazio()), [ficha]);
  const destino = opcoesDeUnidadeDoProfessor({ userData, uid, catalogs })[0] || null;

  // ===== 1) DADOS PESSOAIS =====
  const paisInicial = normalizarPais(userData?.pais || ficha?.pais || unidades.find((u) => String(u.id) === String(userData?.unidadeId))?.pais);
  const [nome, setNome] = useState("");
  const [pais, setPais] = useState(paisInicial);
  const [telefone, setTelefone] = useState("");
  const [emailContato, setEmailContato] = useState("");
  const [docTipo, setDocTipo] = useState(tipoDocumentoDoPais(paisInicial));
  const [docNumero, setDocNumero] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [guardado, setGuardado] = useState(null); // o que está salvo hoje (para a auditoria e para saber o que mudou)
  const [salvandoDados, setSalvandoDados] = useState(false);
  const [erroDados, setErroDados] = useState("");
  const [salvoOk, setSalvoOk] = useState(false);

  useEffect(() => {
    if (!uid || !userData || !catalogs || guardado) return undefined;
    let vivo = true;
    (async () => {
      let documento = null; let nasc = "";
      try { documento = await lerMeuDocumento(uid); } catch (e) { console.error(e); }
      try { nasc = await lerNascimento(uid); } catch (e) { console.error(e); }
      if (!vivo) return;
      const p = normalizarPais(userData.pais || ficha?.pais || paisInicial);
      const tel = formatarTelefone(userData.telefone || ficha?.telefone || "", p);
      const mail = userData.emailContato || ficha?.email || userData.email || user?.email || "";
      const tipo = documento?.tipo || tipoDocumentoDoPais(p);
      setNome(userData.nome || ficha?.nome || "");
      setPais(p); setTelefone(tel); setEmailContato(mail);
      setDocTipo(tipo); setDocNumero(documento ? formatarDocumento(tipo, documento.numero) : "");
      setNascimento(nasc);
      setGuardado({ nome: userData.nome || "", telefone: userData.telefone || "", pais: p, emailContato: userData.emailContato || ficha?.email || "", documento, nascimento: nasc });
    })();
    return () => { vivo = false; };
  }, [uid, userData, catalogs, ficha, guardado, paisInicial, user?.email]);

  function trocarPais(p) {
    setPais(p);
    setTelefone((v) => formatarTelefone(v, p));
    const tipo = tipoDocumentoDoPais(p);
    setDocTipo(tipo);
    setDocNumero((v) => formatarDocumento(tipo, limparDocumento(v)));
  }

  async function salvarDados(e) {
    e.preventDefault();
    setErroDados(""); setSalvoOk(false);
    const nomeLimpo = nome.trim().replace(/\s+/g, " ").toUpperCase();
    const mail = emailContato.trim().toLowerCase();
    if (nomeLimpo.length < 3) return setErroDados(t("profileUpdate.me.errors.name"));
    if (telefone.replace(/\D/g, "").length < 8) return setErroDados(t("profileUpdate.me.errors.phone"));
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return setErroDados(t("profileUpdate.me.errors.email"));
    if (!documentoValido(docTipo, docNumero)) return setErroDados(t("document.errors.invalid"));
    if (!nascimento || !nascimentoValido(nascimento)) return setErroDados(t("profileUpdate.me.errors.birth"));
    setSalvandoDados(true);
    try {
      const documento = { tipo: docTipo, numero: limparDocumento(docNumero) };
      const r = await salvarMeuCadastro({
        uid, fichaId: ficha?.id || "", unidadesDoLider: unidadesDoLiderPessoa, precisaMarcarDocumento: userData?.documentoOk !== true, nomeParaAuditoria: nomeLimpo,
        antes: { ...guardado, emailLogin: user?.email || "" },
        depois: { nome: nomeLimpo, telefone: telefone.trim(), pais, emailContato: mail, documento, nascimento },
      }, t);
      if (!r.ok) return setErroDados(r.mensagem);
      setNome(nomeLimpo);
      setGuardado({ nome: nomeLimpo, telefone: telefone.trim(), pais, emailContato: mail, documento, nascimento });
      setSalvoOk(true);
      recarregarCracha(); // o aviso de cadastro incompleto lê o crachá: tem de ver o que acabou de ser salvo
    } catch (err) {
      console.error(err);
      setErroDados(err?.message === ERRO_DOCUMENTO_EM_USO ? t("document.errors.inUse") : t("profileUpdate.me.errors.save"));
    } finally { setSalvandoDados(false); }
  }

  // ===== 2) CONTRATO =====
  const [pedido, setPedido] = useState(undefined); // undefined = lendo; null = nunca pediu
  const [contrato, setContrato] = useState(contratoVazio());
  const modalidadesAtuais = typeof ficha?.modalidades === "string" ? ficha.modalidades : String(userData?.modalidades || "");
  const [modalidades, setModalidades] = useState("");
  const idsDasUnidades = useMemo(() => idsDasUnidadesDoProfessor({ userData, ficha, vinculos: catalogs?.vinculos || [] }), [userData, ficha, catalogs?.vinculos]);
  // Modalidades que a pessoa pode escolher: as habilitadas nas unidades dela (se alguma unidade ainda não foi configurada, todas).
  const unidadeParaModalidades = useMemo(() => {
    const dela = unidades.filter((u) => idsDasUnidades.includes(String(u.id)));
    if (!dela.length) return undefined;
    if (dela.some((u) => !Array.isArray(u.modalidadesIds))) return undefined;
    return { modalidadesIds: [...new Set(dela.flatMap((u) => u.modalidadesIds.map(String)))] };
  }, [unidades, idsDasUnidades]);
  const [iniciado, setIniciado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!uid) return;
    try { setPedido(await lerMinhaAtualizacao(uid)); } catch (e) { console.error(e); setPedido(null); setErro(t("profileUpdate.errors.load")); }
  }, [uid, t]);
  useEffect(() => { if (souProfessor) carregar(); }, [carregar, souProfessor]);
  // O formulário começa com o contrato que vale hoje (o da ficha), sem refazer enquanto a pessoa mexe.
  useEffect(() => { if (!iniciado && catalogs) { setContrato(atual); setModalidades(modalidadesAtuais); setIniciado(true); } }, [atual, modalidadesAtuais, catalogs, iniciado]);

  const pendente = pedido?.status === "pendente";
  const mesmasModalidades = modalidadesDoTexto(modalidades).join(",") === modalidadesDoTexto(modalidadesAtuais).join(",");
  const semMudanca = mesmoContrato(contrato, atual) && mesmasModalidades;

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    const ok = validarContrato(contrato);
    if (!ok.ok) return setErro(t(`accessRequest.contract.errors.${ok.erro}`));
    if (semMudanca) return setErro(t("profileUpdate.errors.same"));
    if (!destino) return setErro(t("profileUpdate.errors.noUnit"));
    setEnviando(true);
    try {
      await enviarAtualizacao({ uid, nome: userData?.nome || user?.email || "-", unidadeId: destino.unidadeId, vinculoId: destino.vinculoId, contrato: ok.valor, modalidades });
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

  const cartao = CARTAO;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3 uppercase">
          <span className="p-2 bg-red-600 text-white rounded-lg"><UserCog className="w-6 h-6" /></span>
          {t("profileUpdate.title")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t(souProfessor ? "profileUpdate.subtitle" : "profileUpdate.subtitleAll")}</p>
      </div>

      {/* ===== DADOS PESSOAIS (salvam na hora) ===== */}
      <form onSubmit={salvarDados} className={cartao}>
        <h2 className={SECAO}>{t("profileUpdate.me.title")}</h2>
        {!guardado ? (
          <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-red-500" /></div>
        ) : (
          <>
            <div>
              <label htmlFor="mc-nome" className={ROTULO}>{t("profileUpdate.me.name")}</label>
              <input id="mc-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} disabled={salvandoDados} className={CAMPO} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="mc-pais" className={ROTULO}>{t("profileUpdate.me.country")}</label>
                <select id="mc-pais" value={pais} onChange={(e) => trocarPais(e.target.value)} disabled={salvandoDados} className={CAMPO}>
                  {PAISES.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="mc-nasc" className={ROTULO}>{t("profileUpdate.me.birth")} *</label>
                <input id="mc-nasc" type="date" value={nascimento} min="1920-01-01" max={new Date().toISOString().slice(0, 10)} onChange={(e) => setNascimento(e.target.value)} disabled={salvandoDados} className={CAMPO} />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 normal-case -mt-2">{t("profileUpdate.me.birthHint")}</p>

            <div>
              <label htmlFor="mc-tel" className={ROTULO}>{t("profileUpdate.me.phone")}</label>
              <div className="flex gap-2">
                <span className="px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-sm font-black">{DDI_MAP[pais]}</span>
                <input id="mc-tel" value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value, pais))} inputMode="tel" placeholder={exemploDeTelefone(pais)} disabled={salvandoDados} className={CAMPO} />
              </div>
            </div>

            <div>
              <span className={ROTULO}>{t("profileUpdate.me.document")}</span>
              <CampoDocumento claro id="mc-doc" key={pais} tipoDoPais={tipoDocumentoDoPais(pais)} tipo={docTipo} onTipo={setDocTipo} valor={docNumero} onValor={setDocNumero} desabilitado={salvandoDados} />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
              <div>
                <label htmlFor="mc-mail" className={ROTULO}>{t("profileUpdate.me.contactEmail")}</label>
                <input id="mc-mail" type="email" value={emailContato} onChange={(e) => setEmailContato(e.target.value)} maxLength={120} disabled={salvandoDados} className={`${CAMPO} normal-case`} />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 normal-case mt-1">{t("profileUpdate.me.contactEmailHint")}</p>
              </div>
              <div>
                <label htmlFor="mc-login" className={ROTULO}>{t("profileUpdate.me.loginEmail")}</label>
                <input id="mc-login" value={user?.email || ""} readOnly className={`${CAMPO_LEITURA} normal-case`} />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 normal-case mt-1">{t("profileUpdate.me.loginEmailHint")}</p>
              </div>
            </div>

            {erroDados && <p role="alert" className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 normal-case">{erroDados}</p>}
            {salvoOk && <p role="status" className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {t("profileUpdate.me.saved")}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={salvandoDados} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50">
                {salvandoDados && <Loader2 className="w-4 h-4 animate-spin" />} {t("profileUpdate.me.save")}
              </button>
            </div>
          </>
        )}
      </form>

      {/* ===== BANCO INTER (só professor do Brasil) ===== */}
      {souProfessor && guardado && professorTemBancoInter(guardado.pais) && <BancoInter uid={uid} nome={userData?.nome || ""} />}

      {/* ===== MINHAS UNIDADES (mentor e líder) ===== */}
      {(souLider || souMentor) && <MinhasUnidades cracha={userData} uid={uid} emailLogin={user?.email} unidades={unidades} />}

      {/* ===== UNIDADES DO PROFESSOR (lista + pedido de unidade nova) ===== */}
      {souProfessor && <UnidadesDoProfessor uid={uid} nome={userData?.nome || ""} ficha={ficha} unidades={unidades} idsMinhas={idsDasUnidades} />}

      {/* ===== CONTRATO (só professor; pede a mudança e precisa de aprovação) ===== */}
      {souProfessor && <h2 className={SECAO}>{t("profileUpdate.me.contractTitle")}</h2>}
      {!souProfessor ? null : !destino ? (
        <div className="flex gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {t("certificates.noUnit")}
        </div>
      ) : (
        <>
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t("profileUpdate.current")}</p>
            <p className="font-black text-slate-800 dark:text-white mt-1">{resumoContrato(atual, nomeDaUnidade)}</p>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">{t("profileUpdate.me.modalities")}: {modalidadesAtuais || "-"}</p>
            {!ficha && <p className="text-xs text-amber-600 mt-2">{t("profileUpdate.noFicha")}</p>}
          </div>

          {pedido === undefined ? (
            <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-red-500" /></div>
          ) : faixa && (
            <div className={`p-4 rounded-2xl border text-sm space-y-1 ${faixa.cor}`}>
              <p className="font-black flex items-center gap-2"><faixa.Icone className="w-4 h-4" /> {t(`profileUpdate.status.${pedido.status}`)}</p>
              <p className="font-bold">{resumoContrato(pedido, nomeDaUnidade)}</p>
              {typeof pedido.modalidades === "string" && <p className="font-bold">{t("profileUpdate.me.modalities")}: {pedido.modalidades || "-"}</p>}
              {pedido.status === "recusado" && pedido.motivo && <p>{t("profileUpdate.reason", { reason: pedido.motivo })}</p>}
              {pendente && <button type="button" onClick={desistir} disabled={enviando} className="text-xs font-black uppercase underline">{t("profileUpdate.cancelRequest")}</button>}
            </div>
          )}

          <form onSubmit={enviar} className={cartao}>
            <h3 className="font-black text-slate-800 dark:text-white uppercase">{t("profileUpdate.change")}</h3>
            <SeletorModalidades claro id="meu-modalidades" valor={modalidades} onChange={setModalidades} unidade={unidadeParaModalidades} desabilitado={enviando} />
            <CampoContrato claro id="meu-contrato" valor={contrato} onChange={setContrato} unidades={unidades} desabilitado={enviando} />
            {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3">{erro}</p>}
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("profileUpdate.approvalHint")}</p>
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
