// Pedidos de acesso de quem entrou pelo Google (aparece no topo da aba Líderes).
// Aprovar = a pessoa vira LÍDER da unidade (crachá com papel "lider"). Cada unidade tem 1 líder só:
// se já houver um, o sistema pergunta se quer substituir (o antigo perde o acesso).
import { useState } from "react";
import { doc, getDoc, writeBatch, serverTimestamp, addDoc, collection, updateDoc, deleteField } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { Inbox, Check, X, Loader2, Building2, Phone, Mail, User, Clock } from "lucide-react";
import { db } from "../../../services/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { usePedidosPendentes } from "./usePedidosPendentes";
import { liderMantemAcesso } from "../../../permissions";

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
  const userId = userData?.id || userData?.uid;
  const meuNome = userData?.nome || userData?.email || "Admin";

  const registrarAuditoria = async (tipoAcao, descricao, unidadeNome, detalhes) => {
    try {
      await addDoc(collection(db, "auditoria_configuracoes"), {
        tipoAcao, descricao, diffExtras: detalhes, modulo: "CONFIGURACOES",
        unidadeNome: unidadeNome || "-", usuarioAcaoNome: meuNome, usuarioAcaoId: userId, dataAcao: serverTimestamp(),
      });
    } catch (e) { console.error("Falha ao gravar auditoria", e); }
  };

  async function aprovar(p) {
    const unidade = (catalogs?.unidades || []).find((u) => u.id === p.unidadeId);
    if (!unidade) return alert(t("pendingTab.unitNotFound"));
    if (role === "mentor" && unidade.mentorId !== userId) return alert(t("pendingTab.notYourUnit"));

    const temOutroLider = unidade.liderUid && unidade.liderUid !== p.id;
    const pergunta = temOutroLider
      ? t("pendingTab.replaceConfirm", { unit: unidade.nome, current: unidade.liderNome || unidade.liderEmail, name: p.nome })
      : t("pendingTab.approveConfirm", { name: p.nome, unit: unidade.nome });
    if (!window.confirm(pergunta)) return;

    setProcessando(p.id);
    try {
      const batch = writeBatch(db);

      // Líder anterior perde o acesso (apaga o crachá) e o pedido dele fica como "substituído".
      // Se o líder anterior também é admin ou mentor, ele só sai da unidade: o acesso dele fica.
      const crachaAntigo = temOutroLider ? await getDoc(doc(db, "usuarios", unidade.liderUid)) : null;
      if (temOutroLider && !(crachaAntigo.exists() && liderMantemAcesso(crachaAntigo.data().role))) {
        if (crachaAntigo.exists()) batch.delete(crachaAntigo.ref);
        const pedidoAntigo = await getDoc(doc(db, "solicitacoes_acesso", unidade.liderUid));
        if (pedidoAntigo.exists()) {
          batch.update(pedidoAntigo.ref, {
            status: "recusado", motivo: t("pendingTab.replacedReason", { name: p.nome }),
            analisadoPor: userId, analisadoPorNome: meuNome, analisadoEm: serverTimestamp(),
          });
        }
      }

      batch.set(doc(db, "usuarios", p.id), {
        nome: p.nome, email: p.email, telefone: p.telefone,
        role: "lider", unidadeId: p.unidadeId, status: "ativo",
        loginGoogle: true, criadoPor: userId, criadoEm: serverTimestamp(),
      });
      batch.update(doc(db, "unidades", p.unidadeId), {
        liderUid: p.id, liderNome: p.nome, liderEmail: p.email, liderTelefone: p.telefone, liderTipo: "google", liderDesde: serverTimestamp(), liderAConferir: deleteField(),
      });
      batch.update(doc(db, "solicitacoes_acesso", p.id), {
        status: "aprovado", analisadoPor: userId, analisadoPorNome: meuNome, analisadoEm: serverTimestamp(),
      });
      await batch.commit();

      await registrarAuditoria(
        "NOVA", "Líder aprovado (login pelo Google).", unidade.nome,
        `${p.nome} (${p.email})${temOutroLider ? ` substituiu ${unidade.liderNome || unidade.liderEmail}` : ""}`
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
      await registrarAuditoria("ALTERADA", "Pedido de acesso recusado.", p.unidadeNome, `${p.nome} (${p.email})${motivo.trim() ? ` — ${motivo.trim()}` : ""}`);
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
            const unidade = (catalogs?.unidades || []).find((u) => u.id === p.unidadeId);
            const liderAtual = unidade?.liderUid && unidade.liderUid !== p.id ? (unidade.liderNome || unidade.liderEmail) : null;
            const ocupado = processando === p.id;
            return (
              <div key={p.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-800 dark:text-white flex items-center gap-2"><User className="w-4 h-4 text-blue-500" /> {p.nome}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-1"><Mail className="w-3 h-3" /> {p.email}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-1"><Phone className="w-3 h-3" /> {p.telefone}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 whitespace-nowrap"><Clock className="w-3 h-3" /> {formatarData(p.criadoEm, i18n.language)}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 text-sm">
                  <p className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                    <Building2 className="w-4 h-4 text-slate-400" /> {t("pendingTab.leaderOf", { unit: unidade?.nome || p.unidadeNome })}
                  </p>
                  {liderAtual && <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-2">{t("pendingTab.hasLeader", { name: liderAtual })}</p>}
                  {!unidade && <p className="text-xs text-red-500 font-bold mt-2">{t("pendingTab.unitNotFound")}</p>}
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={() => recusar(p)} disabled={ocupado} className="px-4 py-2 rounded-lg text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-red-50 hover:text-red-600 flex items-center gap-1.5 disabled:opacity-50">
                    <X className="w-3.5 h-3.5" /> {t("pendingTab.refuse")}
                  </button>
                  <button onClick={() => aprovar(p)} disabled={ocupado || !unidade} className="px-4 py-2 rounded-lg text-xs font-black uppercase bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 disabled:opacity-50">
                    {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {liderAtual ? t("pendingTab.replace") : t("pendingTab.approve")}
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
