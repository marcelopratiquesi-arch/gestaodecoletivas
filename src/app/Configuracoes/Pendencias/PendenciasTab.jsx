// Pedidos de acesso de quem entrou pelo Google (aparece no topo da aba Líderes).
// - Pedido de LÍDER (até 5 unidades): o admin aprova todas; o mentor aprova as unidades DELE (as de outro
//   mentor ficam de fora e ele pode acrescentar depois pela aba Líderes). Cada unidade tem até 2 líderes:
//   se a vaga estiver ocupada, o sistema pergunta se entra como 2º líder ou se substitui.
// - Pedido de MENTOR: só o admin aprova; pode também passar as unidades escolhidas para o mentor novo.
import { useState } from "react";
import { doc, writeBatch, serverTimestamp, updateDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { Inbox, Check, X, Loader2, Building2, Phone, Mail, User, Clock, ShieldCheck, Dumbbell } from "lucide-react";
import { db } from "../../../services/firebase";
import { registrarAuditoriaAcesso } from "../../../services/auditoriaAcessos";
import { publicarUnidades } from "../../../services/vitrinePublica";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { usePedidosPendentes, idsDoPedido } from "./usePedidosPendentes";
import { tirarLiderDaUnidade, dadosDaVaga } from "../Lideres/saidaDoLider";

const formatarData = (ts, idioma) => {
  const d = ts?.toDate?.();
  return d ? d.toLocaleString(idioma, { dateStyle: "short", timeStyle: "short" }) : "-";
};

export function PendenciasTab() {
  const { t, i18n } = useTranslation();
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();
  const { pedidos, carregando } = usePedidosPendentes();
  const [processando, setProcessando] = useState(null);

  const role = String(userData?.role || "").trim().toLowerCase();
  const souAdmin = role === "admin";
  const userId = userData?.id || userData?.uid;
  const meuNome = userData?.nome || userData?.email || "Admin";
  const todasUnidades = catalogs?.unidades || [];
  const unidadesDoPedido = (p) => idsDoPedido(p).map((id) => todasUnidades.find((u) => u.id === id)).filter(Boolean);
  const nomeDoMentor = (id) => (catalogs?.mentores || []).find((u) => u.id === id)?.nome || "";

  // Auditoria única de acessos: quem aprovou/recusou e quem pediu (o e-mail do pedido é o do Google).
  const registrarAuditoria = (tipoAcao, descricao, unidadeNome, detalhes, pedido, papelNovo) =>
    registrarAuditoriaAcesso({
      tipoAcao, descricao, detalhes, unidadeNome, papelNovo,
      quem: userData,
      alvo: { id: pedido.id, nome: pedido.nome, email: pedido.email, emailGoogle: pedido.email },
    });

  // Pergunta a vaga numa unidade: { vaga: 1|2, substitui } ou null (pular esta unidade).
  function escolherVaga(unidade, p) {
    const jaTemLider = unidade.liderUid && unidade.liderUid !== p.id;
    if (unidade.lider2Uid === p.id) return null; // já é o 2º líder dela
    if (jaTemLider && !unidade.lider2Uid
      && window.confirm(t("pendingTab.secondConfirm", { unit: unidade.nome, current: unidade.liderNome || unidade.liderEmail, name: p.nome }))) {
      return { vaga: 2, substitui: false };
    }
    const pergunta = jaTemLider
      ? t("pendingTab.replaceConfirm", { unit: unidade.nome, current: unidade.liderNome || unidade.liderEmail, name: p.nome })
      : t("pendingTab.approveConfirm", { name: p.nome, unit: unidade.nome });
    return window.confirm(pergunta) ? { vaga: 1, substitui: !!jaTemLider } : null;
  }

  async function aprovarLider(p) {
    const unidades = unidadesDoPedido(p);
    if (!unidades.length) return alert(t("pendingTab.unitNotFound"));
    const minhas = souAdmin ? unidades : unidades.filter((u) => u.mentorId === userId);
    const deFora = unidades.filter((u) => !minhas.includes(u));
    if (!minhas.length) return alert(t("pendingTab.notYourUnit"));

    const plano = [];
    for (const u of minhas) {
      const escolha = escolherVaga(u, p);
      if (escolha) plano.push({ unidade: u, ...escolha });
    }
    if (!plano.length) return;

    setProcessando(p.id);
    try {
      const lista = [];
      for (const [i, { unidade, vaga, substitui }] of plano.entries()) {
        const batch = writeBatch(db);
        // Líder anterior sai (ver Lideres/saidaDoLider.js).
        if (substitui) {
          await tirarLiderDaUnidade(batch, {
            liderUid: unidade.liderUid, unidadeId: unidade.id, professores: catalogs?.professores || [],
            motivo: t("pendingTab.replacedReason", { name: p.nome }), quemId: userId, quemNome: meuNome,
          });
        }
        lista.push(unidade.id);
        if (i === 0) {
          // 1ª unidade: cria o crachá de líder e fecha o pedido.
          batch.set(doc(db, "usuarios", p.id), {
            nome: p.nome, email: p.email, telefone: p.telefone,
            role: "lider", unidadeId: unidade.id, unidadeIds: [unidade.id], status: "ativo",
            loginGoogle: true, criadoPor: userId, criadoEm: serverTimestamp(),
          });
          batch.update(doc(db, "solicitacoes_acesso", p.id), {
            status: "aprovado", analisadoPor: userId, analisadoPorNome: meuNome, analisadoEm: serverTimestamp(),
          });
        } else {
          // Demais unidades: uma por vez no crachá (o banco só aceita do mentor assim).
          batch.update(doc(db, "usuarios", p.id), {
            role: "lider", unidadeId: lista[0], unidadeIds: [...lista], unidadeAlterada: unidade.id,
          });
        }
        batch.update(doc(db, "unidades", unidade.id), dadosDaVaga(vaga, { uid: p.id, nome: p.nome, email: p.email, telefone: p.telefone, tipo: "google" }));
        await batch.commit();
        await registrarAuditoria(
          "NOVA", vaga === 2 ? "2º líder aprovado (login pelo Google)." : "Líder aprovado (login pelo Google).", unidade.nome,
          [substitui ? `Substituiu ${unidade.liderNome || unidade.liderEmail}` : "", p.tambemProfessor ? "Disse que também dá aulas." : ""].filter(Boolean).join(" | "),
          p, "lider"
        );
      }
      const naoEntraram = [...deFora, ...minhas.filter((u) => !plano.some((x) => x.unidade.id === u.id))];
      if (naoEntraram.length) alert(t("pendingTab.leftOut", { units: naoEntraram.map((u) => u.nome).join(", ") }));
    } catch (e) {
      console.error(e);
      alert(t("pendingTab.approveError") + " " + (e.message || ""));
    } finally {
      setProcessando(null);
    }
  }

  async function aprovarMentor(p) {
    if (!souAdmin) return;
    if (!window.confirm(t("pendingTab.approveMentorConfirm", { name: p.nome }))) return;
    const unidades = unidadesDoPedido(p);
    const passarUnidades = unidades.length > 0 && window.confirm(t("pendingTab.moveUnitsConfirm", {
      name: p.nome,
      units: unidades.map((u) => `${u.nome}${u.mentorId ? ` (${nomeDoMentor(u.mentorId) || t("pendingTab.otherMentor")})` : ""}`).join("\n"),
    }));

    setProcessando(p.id);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "usuarios", p.id), {
        nome: p.nome, email: p.email, telefone: p.telefone, pais: unidades[0]?.pais || "",
        role: "mentor", status: "ativo", loginGoogle: true, criadoPor: userId, criadoEm: serverTimestamp(),
      });
      batch.update(doc(db, "solicitacoes_acesso", p.id), {
        status: "aprovado", analisadoPor: userId, analisadoPorNome: meuNome, analisadoEm: serverTimestamp(),
      });
      if (passarUnidades) unidades.forEach((u) => batch.update(doc(db, "unidades", u.id), { mentorId: p.id }));
      await batch.commit();
      if (passarUnidades) await publicarUnidades(unidades.map((u) => ({ id: u.id, dados: { ...u, mentorNome: p.nome } })));
      await registrarAuditoria(
        "NOVA", "Mentor aprovado (login pelo Google).", "Gestão/Diretoria",
        passarUnidades ? `Unidades passadas para ele: ${unidades.map((u) => u.nome).join(", ")}` : `Unidades informadas: ${unidades.map((u) => u.nome).join(", ")}`,
        p, "mentor"
      );
    } catch (e) {
      console.error(e);
      alert(t("pendingTab.approveError") + " " + (e.message || ""));
    } finally {
      setProcessando(null);
    }
  }

  async function recusar(p) {
    const motivo = window.prompt(t("pendingTab.refusePrompt", { name: p.nome }), "");
    if (motivo === null) return;
    setProcessando(p.id);
    try {
      await updateDoc(doc(db, "solicitacoes_acesso", p.id), {
        status: "recusado", motivo: motivo.trim(),
        analisadoPor: userId, analisadoPorNome: meuNome, analisadoEm: serverTimestamp(),
      });
      await registrarAuditoria("ALTERADA", "Pedido de acesso recusado.", p.unidadeNome, motivo.trim() ? `Motivo: ${motivo.trim()}` : "", p);
    } catch (e) {
      console.error(e);
      alert(t("pendingTab.refuseError"));
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <span className="p-2 bg-amber-500 text-white rounded-lg"><Inbox className="w-6 h-6" /></span>
          {t("pendingTab.title")}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t("pendingTab.subtitle")}</p>
      </div>

      {carregando ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-red-500" /></div>
      ) : pedidos.length === 0 ? (
        <div className="py-16 text-center text-slate-400 font-bold text-sm">
          <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" /> {t("pendingTab.empty")}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pedidos.map((p) => {
            const ehMentor = p.papel === "mentor";
            const ids = idsDoPedido(p);
            const ocupado = processando === p.id;
            const algumaValida = unidadesDoPedido(p).length > 0;
            return (
              <div key={p.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-slate-800 dark:text-white flex items-center gap-2"><User className="w-4 h-4 text-blue-500" /> {p.nome}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-1 break-all"><Mail className="w-3 h-3 shrink-0" /> {p.email}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-1"><Phone className="w-3 h-3" /> {p.telefone}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${ehMentor ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"}`}>
                      {ehMentor ? <ShieldCheck className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                      {t(ehMentor ? "pendingTab.roleMentor" : "pendingTab.roleLeader")}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 whitespace-nowrap"><Clock className="w-3 h-3" /> {formatarData(p.criadoEm, i18n.language)}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 text-sm space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400">{t(ehMentor ? "pendingTab.mentorOf" : "pendingTab.leaderOfUnits")}</p>
                  {ids.map((id, i) => {
                    const unidade = todasUnidades.find((u) => u.id === id);
                    const minha = souAdmin || unidade?.mentorId === userId;
                    const liderAtual = unidade?.liderUid && unidade.liderUid !== p.id ? (unidade.liderNome || unidade.liderEmail) : null;
                    return (
                      <div key={id}>
                        <p className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" /> {unidade?.nome || p.unidadeNomes?.[i] || p.unidadeNome || id}
                          {ehMentor && unidade?.mentorId && <span className="text-[11px] font-normal text-slate-400">· {nomeDoMentor(unidade.mentorId) || t("pendingTab.otherMentor")}</span>}
                        </p>
                        {!unidade && <p className="text-xs text-red-500 font-bold ml-6">{t("pendingTab.unitNotFound")}</p>}
                        {!ehMentor && unidade && !minha && <p className="text-xs text-slate-400 font-bold ml-6">{t("pendingTab.otherMentorUnit")}</p>}
                        {!ehMentor && unidade && minha && liderAtual && <p className="text-xs text-amber-600 dark:text-amber-400 font-bold ml-6">{t("pendingTab.hasLeader", { name: liderAtual })}</p>}
                      </div>
                    );
                  })}
                  {!ehMentor && p.tambemProfessor && (
                    <p className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 pt-1"><Dumbbell className="w-3.5 h-3.5" /> {t("pendingTab.alsoTeacher")}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={() => recusar(p)} disabled={ocupado} className="px-4 py-2 rounded-lg text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-red-50 hover:text-red-600 flex items-center gap-1.5 disabled:opacity-50">
                    <X className="w-3.5 h-3.5" /> {t("pendingTab.refuse")}
                  </button>
                  <button
                    onClick={() => (ehMentor ? aprovarMentor(p) : aprovarLider(p))}
                    disabled={ocupado || (!ehMentor && !algumaValida) || (ehMentor && !souAdmin)}
                    className="px-4 py-2 rounded-lg text-xs font-black uppercase bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t("pendingTab.approve")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
