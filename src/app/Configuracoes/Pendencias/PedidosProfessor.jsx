// Pedidos de acesso de PROFESSORES (login pessoal pelo Google), no topo da aba Professores.
// - O professor escolhe UMA unidade ao pedir. Quem aprova: o líder dessa unidade, o mentor dela ou o admin.
// - Aprovar só cria o crachá de professor (role "professor", unidadeId, modalidades) e fecha o pedido.
//   NÃO liga o professor a nenhum nome da grade nem a aulas: isso o líder faz depois, pelo cadastro de
//   professores como sempre foi (o cronograma não é mexido aqui).
import { useState } from "react";
import { doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { Check, X, Loader2, Building2, Phone, Mail, User, Clock, Dumbbell, Info } from "lucide-react";
import { db } from "../../../services/firebase";
import { registrarAuditoriaAcesso } from "../../../services/auditoriaAcessos";
import { useAuth } from "../../../contexts/AuthContext";
import { useCatalogs } from "../../../contexts/CatalogContext";
import { usePedidosProfessor } from "./usePedidosProfessor";

const formatarData = (ts, idioma) => {
  const d = ts?.toDate?.();
  return d ? d.toLocaleString(idioma, { dateStyle: "short", timeStyle: "short" }) : "-";
};

export default function PedidosProfessor() {
  const { t, i18n } = useTranslation();
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();
  const { pedidos, carregando } = usePedidosProfessor();
  const [processando, setProcessando] = useState(null);
  const userId = userData?.id || userData?.uid;
  const meuNome = userData?.nome || userData?.email || "-";

  const unidadeDe = (p) => (catalogs?.unidades || []).find((u) => String(u.id) === String(p.unidadeId));

  async function aprovar(p) {
    const unidade = unidadeDe(p);
    if (!unidade) return alert(t("pendingTab.unitNotFound"));
    if (!window.confirm(t("pendingTab.teacher.approveConfirm", { name: p.nome, unit: unidade.nome }))) return;
    setProcessando(p.id);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "usuarios", p.id), {
        nome: p.nome, email: p.email, telefone: p.telefone,
        role: "professor", unidadeId: String(unidade.id), status: "ativo", loginGoogle: true,
        ...(p.modalidades ? { modalidades: p.modalidades } : {}),
        criadoPor: userId, criadoEm: serverTimestamp(),
      });
      batch.update(doc(db, "solicitacoes_acesso", p.id), {
        status: "aprovado", analisadoPor: userId, analisadoPorNome: meuNome, analisadoEm: serverTimestamp(),
      });
      await batch.commit();
      try {
        await registrarAuditoriaAcesso({
          tipoAcao: "NOVA", descricao: "Professor aprovado (login pelo Google).", detalhes: p.modalidades ? `Modalidades: ${p.modalidades}` : "",
          unidadeNome: unidade.nome, papelNovo: "professor", quem: userData,
          alvo: { id: p.id, nome: p.nome, email: p.email, emailGoogle: p.email },
        });
      } catch (e) { console.error("Falha ao gravar auditoria", e); }
      alert(t("pendingTab.teacher.approved", { name: p.nome }));
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
    } catch (e) {
      console.error(e);
      alert(t("pendingTab.refuseError"));
    } finally {
      setProcessando(null);
    }
  }

  if (carregando || pedidos.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      <div>
        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-red-500" /> {t("pendingTab.teacher.title")}
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white">{pedidos.length}</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {t("pendingTab.teacher.subtitle")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {pedidos.map((p) => {
          const ocupado = processando === p.id;
          const unidade = unidadeDe(p);
          return (
            <div key={p.id} className="p-5 rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-800 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-slate-800 dark:text-white flex items-center gap-2"><User className="w-4 h-4 text-blue-500" /> {p.nome}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-2 mt-1 break-all"><Mail className="w-3 h-3 shrink-0" /> {p.email}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-2 mt-1"><Phone className="w-3 h-3" /> {p.telefone}</p>
                </div>
                <span className="text-[10px] text-slate-400 flex items-center gap-1 whitespace-nowrap"><Clock className="w-3 h-3" /> {formatarData(p.criadoEm, i18n.language)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 text-sm space-y-1">
                <p className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" /> {unidade?.nome || p.unidadeNome || p.unidadeId}
                </p>
                {!unidade && <p className="text-xs text-red-500 font-bold ml-6">{t("pendingTab.unitNotFound")}</p>}
                <p className="text-xs text-slate-500 ml-6">
                  {t("pendingTab.teacher.modalities")}: <b>{p.modalidades || t("pendingTab.teacher.noModalities")}</b>
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold ml-6">{t("pendingTab.teacher.documentOk")}</p>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => recusar(p)} disabled={ocupado} className="px-4 py-2 rounded-lg text-xs font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1.5 disabled:opacity-50">
                  <X className="w-3.5 h-3.5" /> {t("pendingTab.refuse")}
                </button>
                <button onClick={() => aprovar(p)} disabled={ocupado || !unidade} className="px-4 py-2 rounded-lg text-xs font-black uppercase bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 disabled:opacity-50">
                  {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t("pendingTab.approve")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
