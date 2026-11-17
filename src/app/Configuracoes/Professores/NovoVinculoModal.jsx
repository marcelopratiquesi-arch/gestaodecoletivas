// "Adicionar professor" pelo DOCUMENTO (CPF / DNI / SSN), a chave única do professor.
//  1) Documento: achou a ficha dona → mostra e vincula à unidade.
//  2) Não achou → e-mail e telefone. Bateu com ficha antiga SEM documento → "É esta pessoa?" (grava o documento nela).
//     E-mail igual ao de ficha que já tem OUTRO documento → barrado (é outra pessoa).
//  3) Nada bateu → abre o cadastro novo já com documento, e-mail e telefone.
// Avisos sempre na tela (nunca alert do navegador), dizendo qual campo bateu e de quem é.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { collection, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { X, Search, CheckCircle2, AlertTriangle, ChevronDown, Loader2, Link as LinkIcon, ArrowRight, Mail, Phone, UserCheck } from "lucide-react";
import { db } from "../../../services/firebase";
import CampoDocumento from "../../../components/acesso/CampoDocumento";
import { documentoValido, formatarDocumento, limparDocumento, tipoDocumentoPadrao } from "../../../utils/documento";
import { acharFichaPorDocumento, documentoDaFichaNoLote } from "../../../services/documentoFichaService";
import { ERRO_DOCUMENTO_EM_USO, acharDonoDoDocumento, gravarComAviso } from "../../../services/documentoService";
import { chaveTelefone, emailDeMentira, emailFormatoValido, fichasParecidas, normalizarEmail } from "../../../utils/repetidos";

const PAIS_DO_DOCUMENTO = { cpf: "BR", dni: "AR", ssn: "US" };
const campoClasse = "w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-green-500 rounded-xl text-sm font-semibold outline-none transition-all dark:text-white normal-case";
const rotuloClasse = "text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block pl-1";

function Aviso({ tipo = "erro", children }) {
  const cor = tipo === "erro"
    ? "text-red-600 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800"
    : tipo === "ok" ? "text-green-600 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800"
    : "text-amber-700 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
  return <p className={`text-xs font-bold border p-3 rounded-lg flex items-start gap-2 normal-case ${cor}`}><AlertTriangle className="w-4 h-4 shrink-0" /> <span>{children}</span></p>;
}

export default function NovoVinculoModal({
  professores, vinculos, unidades, minhasUnidades, profInicial = null, documentoInicial = null,
  formatarTelefone, placeholderTelefone, aoNovoCadastro, aoFechar, registrarLog,
}) {
  const { t, i18n } = useTranslation();
  const [etapa, setEtapa] = useState(profInicial ? "achado" : "documento"); // documento | contato | parecidas | achado
  const [tipo, setTipo] = useState(() => documentoInicial?.tipo || tipoDocumentoPadrao(i18n.language));
  const [numero, setNumero] = useState(() => (documentoInicial ? formatarDocumento(documentoInicial.tipo, documentoInicial.numero) : ""));
  // O documento é do LOGIN de alguém (crachá), ainda não da ficha da grade: { uid, nome, email, telefone, papel }.
  const [pessoaLogin, setPessoaLogin] = useState(null);
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [achado, setAchado] = useState(profInicial);
  const [gravarDocumento, setGravarDocumento] = useState(false); // ficha antiga confirmada: grava o documento nela
  const [parecidas, setParecidas] = useState([]);
  const [unidadeId, setUnidadeId] = useState(minhasUnidades.length === 1 ? String(minhasUnidades[0].id) : "");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const pais = PAIS_DO_DOCUMENTO[tipo] || "BR";

  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [String(u.id), u.nome])), [unidades]);
  const unidadesDaFicha = (id) => vinculos.filter(v => String(v.professorId) === String(id))
    .map(v => nomesUnidades.get(String(v.unidadeId))).filter(Boolean).join(", ");
  const rotuloCampo = (c) => t(`teachersTab.cpf.fields.${c}`);

  async function procurarDocumento(e) {
    e.preventDefault();
    setErro("");
    if (!documentoValido(tipo, numero)) return setErro(t("document.errors.invalid"));
    setOcupado(true);
    setPessoaLogin(null);
    const n = limparDocumento(numero);
    try {
      // 1) Ficha da grade com este documento.
      const dono = await acharFichaPorDocumento(tipo, n);
      if (dono) {
        const ficha = professores.find(p => String(p.id) === dono.professorId);
        if (!ficha) return setErro(t("teachersTab.cpf.orphan"));
        setAchado(ficha); setGravarDocumento(false); setEtapa("achado");
        return;
      }
      // 2) Login (crachá) com este documento: a pessoa já tem acesso; acha (ou liga) a ficha da grade dela.
      const login = await acharDonoDoDocumento(tipo, n);
      if (login) {
        const snap = await getDoc(doc(db, "usuarios", login.uid));
        const c = snap.exists() ? snap.data() : {};
        const pessoa = { uid: login.uid, nome: c.nome || "", email: c.email || "", telefone: c.telefone || "", papel: c.role || "" };
        setPessoaLogin(pessoa);
        const ligada = professores.find(p => p.uidLogin === login.uid)
          || (c.professorId && professores.find(p => String(p.id) === String(c.professorId)));
        if (ligada) { setAchado(ligada); setGravarDocumento(!ligada.documentoOk); setEtapa("achado"); return; }
        setEmail(pessoa.email);
        setTelefone(formatarTelefone(pessoa.telefone, pais));
        const achados = fichasParecidas(professores, { email: pessoa.email, telefone: pessoa.telefone, pais, nome: pessoa.nome })
          .filter(a => !a.ficha.documentoOk && !a.ficha.uidLogin);
        if (achados.length) { setParecidas(achados); setEtapa("parecidas"); return; }
        aoNovoCadastro({ tipo, numero: n, email: normalizarEmail(pessoa.email), telefone: pessoa.telefone, pais, nome: pessoa.nome, uidLogin: login.uid });
        return;
      }
      setEtapa("contato");
    } catch (err) {
      console.error("Procurar documento:", err);
      setErro(t("teachersTab.cpf.searchError"));
    } finally { setOcupado(false); }
  }

  function conferirContato(e) {
    e.preventDefault();
    setErro("");
    const em = normalizarEmail(email);
    if (!emailFormatoValido(em)) return setErro(t("teachersTab.cpf.emailInvalid"));
    if (emailDeMentira(em)) return setErro(t("teachersTab.cpf.emailFake"));
    if (!chaveTelefone(telefone, pais)) return setErro(t("teachersTab.cpf.phoneInvalid"));

    const achados = fichasParecidas(professores, { email: em, telefone, pais });
    // E-mail de ficha que já tem OUTRO documento: é outra pessoa.
    const outraPessoa = achados.find(a => a.ficha.documentoOk && a.campos.includes("email"));
    if (outraPessoa) return setErro(t("teachersTab.cpf.emailOfOther", { name: outraPessoa.ficha.nome }));
    const semDocumento = achados.filter(a => !a.ficha.documentoOk);
    if (semDocumento.length) { setParecidas(semDocumento); setEtapa("parecidas"); return; }
    seguirParaNovo(achados);
  }

  function seguirParaNovo(achados = parecidas) {
    // Nenhuma das fichas parecidas é a pessoa. Se o E-MAIL bateu, não deixa repetir: corrigir a outra ficha antes.
    const mesmoEmail = achados.find(a => a.campos.includes("email"));
    if (mesmoEmail) { setEtapa("contato"); return setErro(t("teachersTab.cpf.emailTaken", { name: mesmoEmail.ficha.nome })); }
    const mesmoTelefone = achados.find(a => a.campos.includes("telefone"));
    aoNovoCadastro({
      tipo, numero: limparDocumento(numero), email: normalizarEmail(email), telefone, pais,
      avisoTelefone: mesmoTelefone ? mesmoTelefone.ficha.nome : "",
      nome: pessoaLogin?.nome || "", uidLogin: pessoaLogin?.uid || "",
    });
  }

  function escolher(ficha) { setAchado(ficha); setGravarDocumento(true); setErro(""); setEtapa("achado"); }

  async function confirmar(e) {
    e.preventDefault();
    if (!unidadeId) return setErro(t("teachersTab.messages.selectUnit"));
    const jaVinculado = vinculos.some(v => String(v.professorId) === String(achado.id) && String(v.unidadeId) === String(unidadeId));
    const precisaLigar = pessoaLogin && achado.uidLogin !== pessoaLogin.uid;
    if (jaVinculado && !gravarDocumento && !precisaLigar) return setErro(t("teachersTab.messages.alreadyLinked"));
    setOcupado(true); setErro("");
    try {
      const batch = writeBatch(db);
      // Documento de um login: a ficha passa a apontar para esse login (o banco confere que é a mesma pessoa).
      const ligarLogin = pessoaLogin && achado.uidLogin !== pessoaLogin.uid ? pessoaLogin.uid : null;
      if (ligarLogin || gravarDocumento) {
        batch.update(doc(db, "professores", String(achado.id)), {
          ...(ligarLogin ? { uidLogin: ligarLogin } : {}),
          ...(gravarDocumento ? { documentoOk: true } : {}),
          updatedAt: serverTimestamp(),
        });
      }
      if (gravarDocumento) documentoDaFichaNoLote(batch, { professorId: achado.id, tipo, numero, marcarFicha: false });
      if (!jaVinculado) {
        batch.set(doc(collection(db, "vinculos")), {
          professorId: String(achado.id), unidadeId: String(unidadeId), status: "ativo", createdAt: serverTimestamp(),
        });
      }
      await gravarComAviso(batch);
      const uniNome = nomesUnidades.get(String(unidadeId)) || "";
      if (!jaVinculado) await registrarLog("ALTERADA", "Professor vinculado a nova unidade.", achado.nome, `Vinculado à: ${uniNome}`, uniNome);
      if (gravarDocumento) await registrarLog("ALTERADA", "Documento de identificação informado na ficha.", achado.nome, "", uniNome);
      if (ligarLogin) await registrarLog("ALTERADA", "Ficha ligada ao login (acesso) do professor.", achado.nome, `Login: ${pessoaLogin.email || ligarLogin}`, uniNome);
      setSucesso(t("teachersTab.messages.linkedSuccess"));
      setTimeout(aoFechar, 1000);
    } catch (err) {
      console.error("Vincular professor:", err);
      setErro(err?.message === ERRO_DOCUMENTO_EM_USO ? t("teachersTab.cpf.inUse") : t("teachersTab.messages.linkError"));
    } finally { setOcupado(false); }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-black text-slate-800 dark:text-white text-xl">{t("teachersTab.verifyModal.title")}</h3>
            <p className="text-xs font-medium text-slate-500 mt-1 normal-case">{t(`teachersTab.cpf.step.${etapa}`)}</p>
          </div>
          <button type="button" onClick={aoFechar} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-red-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {etapa === "documento" && (
            <form onSubmit={procurarDocumento} className="space-y-4">
              <CampoDocumento claro tipo={tipo} onTipo={setTipo} valor={numero} onValor={setNumero} desabilitado={ocupado} id="docNovoProfessor" />
              <button type="submit" disabled={ocupado} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 flex justify-center items-center gap-2 disabled:opacity-50">
                {ocupado ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />} {t("teachersTab.cpf.search")}
              </button>
            </form>
          )}

          {etapa === "contato" && (
            <form onSubmit={conferirContato} className="space-y-4">
              <Aviso tipo="info">{t("teachersTab.cpf.notFoundByDocument")}</Aviso>
              <div>
                <label className={rotuloClasse} htmlFor="emailNovoProf">{t("teachersTab.verifyModal.emailLabel")}</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                  <input id="emailNovoProf" type="email" className={campoClasse} value={email} onChange={e => setEmail(e.target.value)} placeholder={t("teachersTab.verifyModal.emailPlaceholder")} autoFocus />
                </div>
              </div>
              <div>
                <label className={rotuloClasse} htmlFor="telNovoProf">{t("teachersTab.formModal.whatsapp")} ({pais})</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                  <input id="telNovoProf" className={campoClasse} value={telefone} onChange={e => setTelefone(formatarTelefone(e.target.value, pais))} placeholder={placeholderTelefone(pais)} maxLength={15} />
                </div>
              </div>
              <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 flex justify-center items-center gap-2">
                <ArrowRight className="w-5 h-5" /> {t("teachersTab.cpf.continue")}
              </button>
            </form>
          )}

          {etapa === "parecidas" && (
            <div className="space-y-3">
              <Aviso tipo="info">{t("teachersTab.cpf.similarIntro")}</Aviso>
              {parecidas.map(({ ficha, campos }) => (
                <div key={ficha.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                  <p className="font-black text-slate-800 dark:text-white">{ficha.nome}</p>
                  <p className="text-xs text-slate-500 normal-case break-all">{[ficha.email, ficha.telefone].filter(Boolean).join(" · ")}</p>
                  <p className="text-xs text-slate-400 normal-case">{unidadesDaFicha(ficha.id) || t("teachersTab.table.noLinks")}</p>
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 normal-case">{t("teachersTab.cpf.matched", { fields: campos.map(rotuloCampo).join(", ") })}</p>
                  <button type="button" onClick={() => escolher(ficha)} className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold flex justify-center items-center gap-2">
                    <UserCheck className="w-4 h-4" /> {t("teachersTab.cpf.isThis")}
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => seguirParaNovo()} className="w-full py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200">
                {t("teachersTab.cpf.noneOfThem")}
              </button>
            </div>
          )}

          {etapa === "achado" && achado && (
            <form onSubmit={confirmar} className="space-y-5">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-xl flex items-start gap-4">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div>
                  <h4 className="font-black text-green-800 dark:text-green-300 text-lg">{t("teachersTab.verifyModal.foundTitle")}</h4>
                  <p className="text-sm font-bold text-green-700 dark:text-green-400 mt-1">{achado.nome}</p>
                  <p className="text-xs text-green-600 dark:text-green-500 normal-case">{achado.email}</p>
                  <p className="text-xs text-green-600 dark:text-green-500 normal-case">{unidadesDaFicha(achado.id)}</p>
                </div>
              </div>
              {gravarDocumento && <Aviso tipo="info">{t("teachersTab.cpf.willSaveDocument")}</Aviso>}
              <div>
                <label className={rotuloClasse}>{t("teachersTab.verifyModal.linkToUnit")}</label>
                <div className="relative">
                  <select className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-green-500 rounded-xl text-sm font-bold outline-none appearance-none dark:text-white"
                    value={unidadeId} onChange={e => setUnidadeId(e.target.value)}>
                    {minhasUnidades.length > 1 && <option value="">{t("teachersTab.verifyModal.select")}</option>}
                    {minhasUnidades.map(u => <option key={u.id} value={String(u.id)}>{u.nome}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <button type="submit" disabled={ocupado || !unidadeId} className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 flex justify-center items-center gap-2">
                {ocupado ? <Loader2 className="w-5 h-5 animate-spin" /> : <><LinkIcon className="w-5 h-5" /> {t("teachersTab.verifyModal.confirmLink")}</>}
              </button>
            </form>
          )}

          {pessoaLogin && etapa !== "documento" && (
            <Aviso tipo="info">{t("teachersTab.cpf.fromLogin", { name: pessoaLogin.nome || "-", email: pessoaLogin.email || "-" })}</Aviso>
          )}
          {erro && <Aviso>{erro}</Aviso>}
          {sucesso && <Aviso tipo="ok">{sucesso}</Aviso>}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800 flex justify-between items-center border-t border-slate-100 dark:border-slate-700">
          <button type="button" onClick={aoFechar} className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider hover:text-slate-800 dark:hover:text-slate-200">{t("teachersTab.verifyModal.cancel")}</button>
          {etapa !== "documento" && !profInicial && (
            <button type="button" onClick={() => { setEtapa("documento"); setErro(""); setAchado(null); }} className="text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase tracking-wider">
              {t("teachersTab.cpf.back")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
