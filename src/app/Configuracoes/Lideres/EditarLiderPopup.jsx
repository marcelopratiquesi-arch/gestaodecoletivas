// Janela "Editar" do líder (aba Líderes, computador e celular): TUDO do cadastro numa janela só, no padrão do sistema
// (PopupFlutuante): nome, país, data de nascimento, WhatsApp e documento (CPF/DNI/SSN do país). O e-mail de login aparece
// travado. Admin e mentor da unidade podem preencher e corrigir tudo (o banco confere: firestore.rules).
// `foco` = o que falta no cadastro ("nome" | "telefone" | "documento" | "nascimento"): a janela abre já no 1º campo que falta.
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Trash2 } from "lucide-react";
import PopupFlutuante from "../../../components/PopupFlutuante";
import CampoDocumento from "../../../components/acesso/CampoDocumento";
import { db } from "../../../services/firebase";
import { ERRO_DOCUMENTO_EM_USO, lerDocumento } from "../../../services/documentoService";
import { lerNascimento, nascimentoValido } from "../../../services/meuCadastroService";
import { apagarDocumentoDoLider, salvarCadastroDoLider } from "../../../services/editarCadastroLiderService";
import { documentoValido, formatarDocumento, limparDocumento, tipoDocumentoDoPais } from "../../../utils/documento";
import { normalizarPais } from "../../../utils/feriados";
import { faltaDoCracha } from "../../../utils/cadastroCompleto";
import { PAISES, DDI_MAP, formatarTelefone, exemploDeTelefone } from "../ui/telefone";
import { atualizarCadastroGuardado } from "../ui/useUltimosAcessos";
import { CAMPO, CAMPO_LEITURA, ROTULO, SECAO } from "../../../pages/meuCadastro/estilos";

// Id do campo que recebe o cursor, por tipo de "falta".
const CAMPO_DO_FOCO = { nome: "ed-nome", telefone: "ed-tel", documento: "ed-doc", nascimento: "ed-nasc" };
const ORDEM_DO_FOCO = ["nome", "telefone", "documento", "nascimento"];

/**
 * @param {{ unidade: object, vaga?: 1|2, foco?: string[], quem: {id:string, nome:string}, onFechar: ()=>void, onSalvo?: ()=>void }} props
 */
export function EditarLiderPopup({ unidade, vaga = 1, foco = [], quem, onFechar, onSalvo }) {
  const { t } = useTranslation();
  const p = vaga === 2 ? "lider2" : "lider";
  const uid = unidade[`${p}Uid`];
  const nomeAtual = unidade[`${p}Nome`] || "";
  const emailLogin = unidade[`${p}Email`] || "";

  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);
  const [antes, setAntes] = useState(null);
  const [nome, setNome] = useState("");
  const [pais, setPais] = useState("BR");
  const [telefone, setTelefone] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [docTipo, setDocTipo] = useState("cpf");
  const [docNumero, setDocNumero] = useState("");
  const [pedindoApagar, setPedindoApagar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Lê o que a janela precisa (crachá, documento, nascimento): 3 leituras, só ao abrir.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [snap, documento, nasc] = await Promise.all([getDoc(doc(db, "usuarios", uid)), lerDocumento(uid), lerNascimento(uid)]);
        if (!vivo) return;
        const c = snap.exists() ? snap.data() : {};
        const paisInicial = normalizarPais(c.pais || unidade.pais);
        const inicio = {
          nome: c.nome || nomeAtual, telefone: c.telefone || unidade[`${p}Telefone`] || "", pais: paisInicial, documento, nascimento: nasc,
          documentoOk: c.documentoOk === true, nascimentoOk: c.nascimentoOk === true,
        };
        setAntes(inicio);
        setNome(inicio.nome); setPais(paisInicial); setTelefone(formatarTelefone(inicio.telefone, paisInicial));
        setNascimento(nasc);
        setDocTipo(documento?.tipo || tipoDocumentoDoPais(paisInicial));
        setDocNumero(documento ? formatarDocumento(documento.tipo, documento.numero) : "");
      } catch (e) {
        console.error(e);
        if (vivo) setErroCarga(true);
      } finally { if (vivo) setCarregando(false); }
    })();
    return () => { vivo = false; };
    // Lê só uma vez por pessoa: se a lista atualizar enquanto a janela está aberta, o que a pessoa digitou não se perde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Cursor no 1º campo que falta (vindo do clique na etiqueta "Cadastro incompleto").
  const primeiroQueFalta = useMemo(() => ORDEM_DO_FOCO.find((f) => foco.includes(f)), [foco]);
  useEffect(() => {
    if (carregando || !primeiroQueFalta) return;
    const el = document.getElementById(CAMPO_DO_FOCO[primeiroQueFalta]);
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: "center" }); }
  }, [carregando, primeiroQueFalta]);

  function trocarPais(novo) {
    setPais(novo);
    setTelefone((v) => formatarTelefone(v, novo));
    // Documento acompanha o país, mas só troca o tipo se a pessoa ainda não tem um número guardado.
    if (!antes?.documento) setDocTipo(tipoDocumentoDoPais(novo));
  }

  async function auditar(descricao, detalhes) {
    try {
      await addDoc(collection(db, "auditoria_configuracoes"), {
        tipoAcao: "ALTERADA", descricao, diffExtras: detalhes, modulo: "CONFIGURACOES",
        unidadeNome: unidade.nome || "-", usuarioAcaoNome: quem.nome, usuarioAcaoId: quem.id, dataAcao: serverTimestamp(),
      });
    } catch (e) { console.error("Falha ao gravar auditoria", e); }
  }

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    const nomeLimpo = nome.trim();
    if (nomeLimpo.length < 3) return setErro(t("leadersTab.errors.name"));
    if (limparDocumento(telefone).length < 8) return setErro(t("leadersTab.errors.phone"));
    if (nascimento && !nascimentoValido(nascimento)) return setErro(t("leadersTab.modal.edit.errBirth"));
    if (antes.nascimento && !nascimento) return setErro(t("leadersTab.modal.edit.errBirth")); // data já guardada não se apaga, só se corrige
    const temDoc = limparDocumento(docNumero).length > 0;
    if (temDoc && !documentoValido(docTipo, docNumero)) return setErro(t("leadersTab.modal.edit.errDoc"));
    const documento = temDoc ? { tipo: docTipo, numero: limparDocumento(docNumero) } : null;
    if (!documento && antes.documento) return setErro(t("leadersTab.modal.edit.errDoc")); // para tirar o documento use "Apagar documento"

    setSalvando(true);
    try {
      const resp = await salvarCadastroDoLider({
        uid, unidades: [{ id: unidade.id, vaga }], email: emailLogin,
        antes: { nome: antes.nome, telefone: antes.telefone, pais: antes.pais, documento: antes.documento, nascimento: antes.nascimento },
        depois: { nome: nomeLimpo, telefone: telefone.trim(), pais, documento, nascimento },
      }, t);
      if (!resp.ok) { setErro(resp.mensagem); return; }
      if (resp.mudou.length) await auditar(t("leadersTab.modal.edit.audit"), `${nomeAtual || "-"} | ${resp.mudou.join(" | ")}`);
      // O selo "Cadastro incompleto" da tela enxerga o crachá guardado em memória: atualiza na hora.
      atualizarCadastroGuardado(uid, {
        nome: nomeLimpo, telefone: telefone.trim(), pais,
        documentoOk: !!documento || antes.documentoOk, nascimentoOk: !!nascimento || antes.nascimentoOk,
      });
      onSalvo?.();
      onFechar();
    } catch (err) {
      console.error(err);
      setErro(err?.message === ERRO_DOCUMENTO_EM_USO ? t("leadersTab.modal.edit.errDocUse") : `${t("leadersTab.errors.save")} ${err?.message || ""}`);
    } finally { setSalvando(false); }
  }

  async function apagarDocumento() {
    setErro("");
    setSalvando(true);
    try {
      await apagarDocumentoDoLider({ uid, documento: antes.documento });
      await auditar(t("leadersTab.modal.edit.audit"), `${nomeAtual || "-"} | Documento apagado`);
      atualizarCadastroGuardado(uid, { documentoOk: false });
      setAntes((a) => ({ ...a, documento: null, documentoOk: false }));
      setDocNumero(""); setDocTipo(tipoDocumentoDoPais(pais)); setPedindoApagar(false);
    } catch (err) {
      console.error(err);
      setErro(t("leadersTab.modal.edit.errDelete"));
    } finally { setSalvando(false); }
  }

  const aindaFalta = antes ? faltaDoCracha({ nome: antes.nome, telefone: antes.telefone, documentoOk: antes.documentoOk, nascimentoOk: antes.nascimentoOk, loginGoogle: true }) : [];

  const rodape = (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onFechar} disabled={salvando} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-300 disabled:opacity-50">{t("leadersTab.modal.cancel")}</button>
      <button type="submit" form="form-editar-lider" disabled={salvando || carregando || erroCarga} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 disabled:opacity-50">
        {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t("leadersTab.modal.save")}
      </button>
    </div>
  );

  return (
    <PopupFlutuante titulo={t("leadersTab.modal.edit.title")} onFechar={onFechar} rodape={rodape} bloquearFechar={salvando}
      chaveMemoria="lideres.popupEditar" largura={460} altura={760}>
      <form id="form-editar-lider" onSubmit={salvar} className="p-5 space-y-4">
        {carregando ? (
          <div className="py-10 flex flex-col items-center gap-2 text-slate-500 normal-case text-sm font-bold"><Loader2 className="w-6 h-6 animate-spin text-red-500" />{t("leadersTab.modal.edit.loadingData")}</div>
        ) : erroCarga ? (
          <p className="text-xs font-bold text-red-600 normal-case">{t("leadersTab.modal.edit.loadError")}</p>
        ) : (
          <>
            {aindaFalta.length > 0 && (
              <p className="text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 border border-amber-200 dark:border-amber-800 p-3 rounded-xl normal-case">
                {t("leadersTab.modal.edit.missingHint", { fields: aindaFalta.map((f) => t(`profileUpdate.incomplete.fields.${f}`)).join(", ") })}
              </p>
            )}

            <p className={SECAO}>{t("leadersTab.modal.sectionPerson")}</p>
            <div>
              <span className={ROTULO}>{t("leadersTab.modal.unit")}</span>
              <div className={CAMPO_LEITURA}>{unidade.nome}</div>
            </div>
            <div>
              <label htmlFor="ed-nome" className={ROTULO}>{t("leadersTab.modal.name")}</label>
              <input id="ed-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} disabled={salvando} className={CAMPO} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ed-pais" className={ROTULO}>{t("leadersTab.modal.edit.country")}</label>
                <select id="ed-pais" value={pais} onChange={(e) => trocarPais(e.target.value)} disabled={salvando} className={CAMPO}>
                  {PAISES.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ed-nasc" className={ROTULO}>{t("leadersTab.modal.edit.birth")}</label>
                <input id="ed-nasc" type="date" value={nascimento} min="1920-01-01" max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setNascimento(e.target.value)} disabled={salvando} className={CAMPO} />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 normal-case -mt-2">{t("leadersTab.modal.edit.birthHint")}</p>

            <div>
              <label htmlFor="ed-tel" className={ROTULO}>{t("leadersTab.modal.phone")}</label>
              <div className="flex gap-2">
                <span className="px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-sm font-black">{DDI_MAP[pais]}</span>
                <input id="ed-tel" value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value, pais))} inputMode="tel"
                  placeholder={exemploDeTelefone(pais)} disabled={salvando} className={CAMPO} />
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
              <p className={SECAO}>{t("leadersTab.modal.edit.document")}</p>
              {!antes.documento && <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 normal-case">{t("leadersTab.modal.edit.docNone")}</p>}
              <CampoDocumento claro id="ed-doc" key={pais} tipoDoPais={tipoDocumentoDoPais(pais)} tipo={docTipo} onTipo={setDocTipo}
                valor={docNumero} onValor={setDocNumero} desabilitado={salvando} />
              {antes.documento && !pedindoApagar && (
                <button type="button" onClick={() => setPedindoApagar(true)} disabled={salvando}
                  className="text-[11px] font-black uppercase text-red-600 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /> {t("leadersTab.modal.edit.docDelete")}</button>
              )}
              {pedindoApagar && (
                <div className="p-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 space-y-2">
                  <p className="text-xs font-bold text-red-700 dark:text-red-300 normal-case">{t("leadersTab.modal.edit.docDeleteAsk", { name: nomeAtual || nome })}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={apagarDocumento} disabled={salvando} className="px-3 py-2 rounded-xl text-[11px] font-black uppercase bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">{t("leadersTab.modal.edit.docDeleteYes")}</button>
                    <button type="button" onClick={() => setPedindoApagar(false)} disabled={salvando} className="px-3 py-2 rounded-xl text-[11px] font-black uppercase bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{t("leadersTab.modal.edit.docDeleteNo")}</button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <span className={ROTULO}>{t("leadersTab.modal.email")}</span>
              <div className={`${CAMPO_LEITURA} normal-case`}>{emailLogin || "-"}</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 normal-case mt-1">{t("leadersTab.modal.emailLocked")}</p>
            </div>

            {erro && <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl normal-case">{erro}</p>}
          </>
        )}
      </form>
    </PopupFlutuante>
  );
}
