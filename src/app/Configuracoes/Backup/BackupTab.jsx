import React, { useState } from 'react';
import { db } from '../../../services/firebase';
import { collection, getDocs, getCountFromServer, writeBatch, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { useTranslation, Trans } from 'react-i18next';
import {
  Database, Download, Upload, FileJson, FileSpreadsheet,
  TriangleAlert, CircleCheck, Loader2, ShieldAlert, Archive, X
} from 'lucide-react';
import { serializarValor, desserializarValor, linhaParaExcel } from '../../../utils/backupSerializacao';

// === LISTA MESTRA DE BACKUP ===
// Todas as coleções usadas pelo sistema. Coleções vazias custam só a contagem (não são lidas).
const COLLECTIONS_TO_BACKUP = [
  'unidades',
  'professores',
  'modalidades',
  'usuarios',
  'vinculos',
  'aulas',                    // Grade/Cronograma
  'validacoes',               // Histórico financeiro e de presença
  'feriados',
  'indicadores_mensais',
  'pratique_play_faixas',
  'unipower_workshops',       // Loja & Workshops
  'unipower_transacoes',
  'unipower_stock',
  'auditoria_cronograma',
  'auditoria_configuracoes',
  'auditoria_financeiro',
  // Nomes antigos: só entram no arquivo se ainda existirem documentos neles.
  'mentores',
  'professorVinculos',
  'configuracoes',
  'metas',
  'logs'
];

// Cotas do plano gratuito do Firebase (por dia).
const COTA_LEITURAS_DIA = 50000;
const COTA_GRAVACOES_DIA = 20000;
const TAMANHO_LOTE = 450; // limite do Firestore: 500 operações por lote

const formatarNumero = (n) => Number(n || 0).toLocaleString('pt-BR');

export default function BackupTab() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusErro, setStatusErro] = useState(false);
  const [progress, setProgress] = useState(0);

  // Restauração em duas etapas: lê o arquivo, a pessoa escolhe as coleções, depois grava.
  const [restauracao, setRestauracao] = useState(null); // { nomeArquivo, dados, selecionadas: Set }

  const mostrarStatus = (msg, erro = false) => { setStatusMsg(msg); setStatusErro(erro); };

  // === FUNÇÃO 1: EXPORTAR ===
  const handleExport = async (format) => {
    setLoading(true);
    mostrarStatus(t('backupTab.status.counting'));
    setProgress(0);

    try {
      // 1. Conta antes de ler: a contagem custa ~1 leitura a cada 1.000 documentos.
      const contagens = {};
      const falhas = [];
      for (const colName of COLLECTIONS_TO_BACKUP) {
        try {
          const snap = await getCountFromServer(collection(db, colName));
          contagens[colName] = snap.data().count;
        } catch (err) {
          console.error(`Falha ao contar ${colName}:`, err);
          falhas.push(colName);
        }
      }

      if (falhas.length === COLLECTIONS_TO_BACKUP.length) {
        throw new Error('Nenhuma coleção pôde ser lida (cota esgotada ou sem conexão).');
      }

      const totalDocs = Object.values(contagens).reduce((a, b) => a + b, 0);
      const pctCota = Math.round((totalDocs / COTA_LEITURAS_DIA) * 100);
      const avisoCota = totalDocs > COTA_LEITURAS_DIA * 0.5 ? `\n\n${t('backupTab.quotaWarning')}` : '';
      if (!window.confirm(t('backupTab.confirmExport', { total: formatarNumero(totalDocs), pct: pctCota }) + avisoCota)) {
        mostrarStatus("");
        return;
      }

      // 2. Lê só as coleções que têm documentos.
      const fullBackupData = {};
      const comDados = COLLECTIONS_TO_BACKUP.filter(c => contagens[c] > 0);
      for (let i = 0; i < comDados.length; i++) {
        const colName = comDados[i];
        mostrarStatus(t('backupTab.status.extracting', { name: colName }));
        try {
          const querySnapshot = await getDocs(collection(db, colName));
          fullBackupData[colName] = querySnapshot.docs.map(d => ({ _id: d.id, ...d.data() }));
        } catch (err) {
          console.error(`Falha ao ler ${colName}:`, err);
          falhas.push(colName);
        }
        setProgress(Math.round(((i + 1) / comDados.length) * 100));
      }

      mostrarStatus(t('backupTab.status.compressing'));

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const sufixo = falhas.length > 0 ? '_INCOMPLETO' : '';
      const fileName = `BACKUP_SISTEMA_PRATIQUE_${dateStr}_${timeStr}${sufixo}`;

      if (format === 'json') {
        const arquivo = {
          __backup: {
            versao: 3,
            geradoEm: now.toISOString(),
            documentos: Object.fromEntries(Object.entries(fullBackupData).map(([c, l]) => [c, l.length])),
            falhas
          },
          ...Object.fromEntries(Object.entries(fullBackupData).map(([c, lista]) => [c, lista.map(serializarValor)]))
        };
        const blob = new Blob([JSON.stringify(arquivo, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } else if (format === 'excel') {
        const wb = XLSX.utils.book_new();
        Object.entries(fullBackupData).forEach(([colName, lista]) => {
          if (lista.length === 0) return;
          const ws = XLSX.utils.json_to_sheet(lista.map(linhaParaExcel));
          XLSX.utils.book_append_sheet(wb, ws, colName.substring(0, 31)); // Excel limita a 31 caracteres
        });
        XLSX.writeFile(wb, `${fileName}.xlsx`);
      }

      if (falhas.length > 0) mostrarStatus(t('backupTab.status.incomplete', { list: falhas.join(', ') }), true);
      else mostrarStatus(t('backupTab.status.done'));
    } catch (error) {
      console.error("Erro no backup:", error);
      mostrarStatus(t('backupTab.status.criticalError'), true);
    } finally {
      setLoading(false);
    }
  };

  // === FUNÇÃO 2A: LER O ARQUIVO DE RESTAURAÇÃO ===
  const handleImport = (event) => {
    const file = event.target.files[0];
    event.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!file) return;

    mostrarStatus(t('backupTab.status.reading'));
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bruto = JSON.parse(e.target.result);
        if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) throw new Error('formato');
        const dados = Object.fromEntries(
          Object.entries(bruto).filter(([c, lista]) => !c.startsWith('__') && Array.isArray(lista) && lista.length > 0)
        );
        if (Object.keys(dados).length === 0) throw new Error('vazio');
        setRestauracao({ nomeArquivo: file.name, dados, selecionadas: new Set(Object.keys(dados)) });
        mostrarStatus("");
      } catch (error) {
        console.error("Arquivo de backup inválido:", error);
        mostrarStatus(t('backupTab.status.corrupted'), true);
      }
    };
    reader.readAsText(file);
  };

  const alternarColecao = (colName) => setRestauracao(prev => {
    const selecionadas = new Set(prev.selecionadas);
    if (selecionadas.has(colName)) selecionadas.delete(colName); else selecionadas.add(colName);
    return { ...prev, selecionadas };
  });

  const totalSelecionado = restauracao
    ? [...restauracao.selecionadas].reduce((soma, c) => soma + restauracao.dados[c].length, 0)
    : 0;

  // === FUNÇÃO 2B: GRAVAR AS COLEÇÕES ESCOLHIDAS ===
  const executarRestauracao = async () => {
    const colecoes = [...restauracao.selecionadas];
    if (colecoes.length === 0) return;
    if (!window.confirm(t('backupTab.confirmRestore'))) return;

    setLoading(true);
    setProgress(0);
    let gravados = 0;
    let colecaoAtual = '';

    try {
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const colName of colecoes) {
        colecaoAtual = colName;
        for (const docData of restauracao.dados[colName]) {
          // Recupera ID. Se foi salvo como _id (padrão novo) ou id (antigo)
          const docId = docData._id || docData.id;
          if (!docId) continue;
          const { _id, id, ...dataToSave } = docData; // eslint-disable-line no-unused-vars
          batch.set(doc(db, colName, String(docId)), desserializarValor(dataToSave, db));
          batchCount++;

          if (batchCount >= TAMANHO_LOTE) {
            await batch.commit();
            gravados += batchCount;
            batch = writeBatch(db);
            batchCount = 0;
            setProgress(Math.round((gravados / totalSelecionado) * 100));
            mostrarStatus(t('backupTab.status.restoringPct', { pct: Math.round((gravados / totalSelecionado) * 100) }));
          }
        }
      }
      if (batchCount > 0) {
        await batch.commit();
        gravados += batchCount;
      }

      mostrarStatus(t('backupTab.status.restored'));
      alert(t('backupTab.restoreDone'));
      window.location.reload();
    } catch (error) {
      console.error("Erro na restauração:", error);
      mostrarStatus(t('backupTab.status.restorePartial', { done: formatarNumero(gravados), total: formatarNumero(totalSelecionado), name: colecaoAtual }), true);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-8 animate-fade-in">

      {/* STATUS HEADER */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 rounded-xl flex items-center gap-4">
        <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
            <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('backupTab.title')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('backupTab.subtitle')}
            </p>
        </div>
        {loading && (
            <div className="text-right">
                <div className="flex items-center gap-2 text-blue-600 font-bold text-sm mb-1">
                    <Loader2 className="w-4 h-4 animate-spin" /> {progress}%
                </div>
                <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all duration-300" style={{width: `${progress}%`}}></div>
                </div>
            </div>
        )}
      </div>

      {statusMsg && (
          <div className={`p-4 rounded-lg font-bold text-sm flex items-center gap-2 ${statusErro ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
            {statusErro ? <TriangleAlert className="w-4 h-4 shrink-0"/> : <CircleCheck className="w-4 h-4 shrink-0"/>}
            {statusMsg}
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* CARD EXPORTAR */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-green-600" />
                {t('backupTab.exportTitle')}
            </h3>
            <p className="text-sm text-slate-500 mb-6 min-h-[40px]">
                <Trans i18nKey="backupTab.exportDesc" />
            </p>

            <div className="space-y-3">
                <button
                    onClick={() => handleExport('json')}
                    disabled={loading}
                    className="w-full py-3 px-4 border border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800 rounded-lg flex items-center justify-center gap-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors font-bold text-blue-700 dark:text-blue-300 disabled:opacity-50"
                >
                    <FileJson className="w-5 h-5" />
                    {t('backupTab.downloadJson')}
                    <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded">{t('backupTab.recommended')}</span>
                </button>

                <button
                    onClick={() => handleExport('excel')}
                    disabled={loading}
                    className="w-full py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50"
                >
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    {t('backupTab.downloadExcel')}
                </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">{t('backupTab.quotaNote')}</p>
        </div>

        {/* CARD IMPORTAR */}
        <div className="bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <ShieldAlert className="w-32 h-32 text-red-600" />
            </div>

            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-red-600" />
                {t('backupTab.restoreTitle')}
            </h3>

            {!restauracao ? (
              <>
                <p className="text-sm text-slate-500 mb-6 min-h-[40px]">
                    <Trans i18nKey="backupTab.restoreDesc" />
                </p>
                <div className="relative">
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        disabled={loading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    <button
                        disabled={loading}
                        className="w-full py-3 px-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-center gap-3 text-red-700 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    >
                        <Archive className="w-5 h-5" />
                        {t('backupTab.selectBackup')}
                    </button>
                </div>
                <p className="text-center text-[10px] text-slate-400 mt-2">{t('backupTab.onlyJson')}</p>
              </>
            ) : (
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{restauracao.nomeArquivo}</p>
                    <button onClick={() => setRestauracao(null)} disabled={loading} className="p-1 text-slate-400 hover:text-red-600 rounded" title={t('common.actions.cancel')}>
                        <X className="w-4 h-4"/>
                    </button>
                </div>
                <p className="text-xs text-slate-500">{t('backupTab.chooseCollections')}</p>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                    {Object.entries(restauracao.dados).map(([colName, lista]) => (
                        <label key={colName} className="flex items-center justify-between gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40">
                            <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                                <input type="checkbox" checked={restauracao.selecionadas.has(colName)} onChange={() => alternarColecao(colName)} disabled={loading} />
                                {colName}
                            </span>
                            <span className="text-xs font-mono text-slate-400">{formatarNumero(lista.length)}</span>
                        </label>
                    ))}
                </div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {t('backupTab.selectedTotal', { total: formatarNumero(totalSelecionado) })}
                </p>
                {totalSelecionado > COTA_GRAVACOES_DIA * 0.9 && (
                    <p className="text-xs font-bold text-red-700 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 rounded-lg">
                        {t('backupTab.writeQuotaWarning', { limit: formatarNumero(COTA_GRAVACOES_DIA) })}
                    </p>
                )}
                <button
                    onClick={executarRestauracao}
                    disabled={loading || restauracao.selecionadas.size === 0}
                    className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
                    {t('backupTab.restoreSelected')}
                </button>
              </div>
            )}
        </div>

      </div>

      <div className="text-center text-xs text-slate-400 mt-8">
        <p>{t('backupTab.footer')}</p>
      </div>
    </div>
  );
}
