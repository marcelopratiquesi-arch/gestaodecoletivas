// Líderes temporários da aba Líderes: carrega quem está ativo (crachá com prazo) e os convites pendentes,
// e entrega por unidade, para cada um aparecer como cartão DENTRO da linha da unidade (não mais numa seção à parte).
// As ações (prorrogar, efetivar, encerrar, cancelar convite) e a auditoria são as mesmas de antes.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cancelarConvite, efetivar, encerrar, lerConvitesPendentes, lerTemporarios, prorrogar } from "./liderTemporario";
import { diaDoFim, diasRestantes, fimDoTemporario, nivelDoAviso } from "../../../utils/temporario";

const idsDe = (r) => (r.unidadeIds?.length ? r.unidadeIds : [r.unidadeId]).filter(Boolean).map(String);

export function useLideresTemporarios({ role, escopos, unidades, registrarAuditoria, aoMudar }) {
  const { t, i18n } = useTranslation();
  const [temporarios, setTemporarios] = useState([]);
  const [convites, setConvites] = useState([]);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const [convidando, setConvidando] = useState(null); // { unidade } = modal de convite aberto
  const [prorrogando, setProrrogando] = useState(null); // crachá em prorrogação

  const porId = useMemo(() => new Map(unidades.map((u) => [String(u.id), u])), [unidades]);
  const nomeDaUnidade = useCallback((r) => porId.get(idsDe(r)[0])?.nome, [porId]);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const [tem, con] = await Promise.all([lerTemporarios({ role, escopos, unidades }), lerConvitesPendentes({ role, escopos })]);
      setTemporarios(tem.sort((a, b) => (fimDoTemporario(a)?.getTime() || 0) - (fimDoTemporario(b)?.getTime() || 0)));
      setConvites(con);
    } catch (e) {
      console.error(e);
      setErro(t("tempLeader.errors.load"));
    }
  }, [role, escopos, unidades, t]);

  useEffect(() => { carregar(); }, [carregar]);

  // unidadeId -> { temporarios, convites }
  const porUnidade = useMemo(() => {
    const mapa = new Map();
    const pega = (id) => { if (!mapa.has(id)) mapa.set(id, { temporarios: [], convites: [] }); return mapa.get(id); };
    temporarios.forEach((c) => idsDe(c).forEach((id) => pega(id).temporarios.push(c)));
    convites.forEach((c) => idsDe(c).forEach((id) => pega(id).convites.push(c)));
    return mapa;
  }, [temporarios, convites]);

  const vencendo = useMemo(() => temporarios.filter((c) => { const n = nivelDoAviso(diasRestantes(c.temporarioAte)); return n && n !== "vencido"; }).length, [temporarios]);

  async function agir(id, fn, auditoria) {
    setOcupado(id);
    try {
      await fn();
      if (auditoria) await registrarAuditoria?.("ALTERADA", auditoria.descricao, auditoria.unidade, auditoria.detalhes);
      await carregar();
      aoMudar?.();
    } catch (e) {
      console.error(e);
      alert(t("tempLeader.errors.action") + " " + (e.message || ""));
    } finally { setOcupado(null); }
  }

  async function encerrarAgora(c) {
    if (!window.confirm(t("tempLeader.confirmEnd", { name: c.nome }))) return;
    await agir(c.id, () => encerrar(c.id), { descricao: "Líder temporário encerrado.", unidade: nomeDaUnidade(c), detalhes: `${c.nome} (${c.email})` });
  }
  async function efetivarAgora(c) {
    if (!window.confirm(t("tempLeader.confirmMakePermanent", { name: c.nome }))) return;
    setOcupado(c.id);
    try {
      const r = await efetivar({ cracha: c, unidades });
      if (!r.ok) { alert(t("tempLeader.errors.noSlot", { unit: r.unidade })); return; }
      await registrarAuditoria?.("ALTERADA", "Líder temporário efetivado como líder.", nomeDaUnidade(c), `${c.nome} (${c.email})`);
      await carregar();
      aoMudar?.();
    } catch (e) {
      console.error(e);
      alert(t("tempLeader.errors.action") + " " + (e.message || ""));
    } finally { setOcupado(null); }
  }
  async function cancelar(c) {
    if (!window.confirm(t("tempLeader.confirmCancel", { email: c.email }))) return;
    await agir(c.id, () => cancelarConvite(c.id));
  }
  async function salvarPrazo(fim) {
    const c = prorrogando; setProrrogando(null);
    await agir(c.id, () => prorrogar(c.id, fim), { descricao: "Líder temporário prorrogado.", unidade: nomeDaUnidade(c), detalhes: `${c.nome} (${c.email}) até ${diaDoFim(fim, i18n.language)}` });
  }
  async function aoConvidar(dados) {
    setConvidando(null);
    await registrarAuditoria?.("NOVA", "Líder temporário convidado.", dados.unidades[0]?.nome, `${dados.nome} (${dados.email}) até ${diaDoFim(dados.fim, i18n.language)}`);
    await carregar();
    aoMudar?.();
  }

  return {
    porUnidade, vencendo, erro, ocupado,
    convidando, abrirConvite: (unidade) => setConvidando({ unidade }), fecharConvite: () => setConvidando(null), aoConvidar,
    prorrogando, abrirPrazo: setProrrogando, fecharPrazo: () => setProrrogando(null), salvarPrazo,
    encerrarAgora, efetivarAgora, cancelar,
  };
}
