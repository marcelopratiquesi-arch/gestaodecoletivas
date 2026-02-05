import React, { useState } from 'react';
import { db } from '../../../services/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx'; 
import { 
  Database, Download, Upload, FileJson, FileSpreadsheet, 
  TriangleAlert, CircleCheck, Loader2, ShieldAlert, Archive 
} from 'lucide-react';

// === LISTA MESTRA DE BACKUP ===
// Adicionei todas as tabelas possíveis para garantir a migração futura
const COLLECTIONS_TO_BACKUP = [
  'unidades',
  'mentores',
  'professores',
  'modalidades',
  'usuarios',
  'aulas',            // Grade/Cronograma
  'validacoes',       // Histórico financeiro e de presença
  'feriados',
  'vinculos',
  'professorVinculos',
  'configuracoes',    // Caso tenha salvo configurações globais
  'metas',            // Caso a performance financeira use metas salvas
  'logs'              // Histórico de atividades (se houver)
];

export default function BackupTab() {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [progress, setProgress] = useState(0);

  // === FUNÇÃO 1: EXPORTAR (BACKUP BLINDADO) ===
  const handleExport = async (format) => {
    setLoading(true);
    setStatusMsg("Iniciando varredura completa do sistema...");
    setProgress(0);

    try {
      const fullBackupData = {};
      
      // Data formatada para o nome do arquivo
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const fileName = `BACKUP_SISTEMA_PRATIQUE_${dateStr}_${timeStr}`;

      // 1. Busca dados de todas as coleções
      for (let i = 0; i < COLLECTIONS_TO_BACKUP.length; i++) {
        const colName = COLLECTIONS_TO_BACKUP[i];
        setStatusMsg(`Extraindo dados da tabela: ${colName}...`);
        
        try {
            const querySnapshot = await getDocs(collection(db, colName));
            const data = querySnapshot.docs.map(doc => ({
              _id: doc.id, // Salva o ID original com _id para facilitar migração SQL
              ...doc.data()
            }));
            
            // Só adiciona se tiver dados ou se for JSON (para manter estrutura)
            if (data.length > 0 || format === 'json') {
                fullBackupData[colName] = data;
            }
        } catch (err) {
            console.warn(`Coleção ${colName} não encontrada ou vazia.`);
        }
        
        // Atualiza barra de progresso
        setProgress(Math.round(((i + 1) / COLLECTIONS_TO_BACKUP.length) * 100));
      }

      setStatusMsg("Compactando e gerando arquivo...");

      if (format === 'json') {
        // --- EXPORTAR JSON (Formato Ouro para Migração SQL/Supabase) ---
        const jsonString = JSON.stringify(fullBackupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } else if (format === 'excel') {
        // --- EXPORTAR EXCEL (Para Conferência Humana) ---
        const wb = XLSX.utils.book_new();

        Object.keys(fullBackupData).forEach(colName => {
          const data = fullBackupData[colName];
          if (data.length > 0) {
            // Tratamento para não quebrar o Excel com objetos complexos
            const cleanData = data.map(row => {
                const newRow = { ...row };
                Object.keys(newRow).forEach(k => {
                    if (typeof newRow[k] === 'object' && newRow[k] !== null) {
                        // Converte Timestamps do Firebase e Arrays para string
                        newRow[k] = JSON.stringify(newRow[k]);
                    }
                });
                return newRow;
            });

            const ws = XLSX.utils.json_to_sheet(cleanData);
            // Nome da aba (Excel limita a 31 caracteres)
            XLSX.utils.book_append_sheet(wb, ws, colName.substring(0, 31));
          }
        });

        XLSX.writeFile(wb, `${fileName}.xlsx`);
      }

      setStatusMsg("Backup finalizado com sucesso!");

    } catch (error) {
      console.error("Erro no backup:", error);
      setStatusMsg("Erro crítico ao gerar backup. Verifique o console.");
    } finally {
      setLoading(false);
      setTimeout(() => setStatusMsg(""), 5000);
    }
  };

  // === FUNÇÃO 2: IMPORTAR (RESTORE) ===
  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.confirm("⚠️ ALERTA DE SEGURANÇA MÁXIMA ⚠️\n\nVocê está prestes a RESTAURAR o banco de dados.\nIsso irá SOBRESCREVER as informações atuais.\n\nTem certeza absoluta?")) {
      return;
    }

    setLoading(true);
    setStatusMsg("Lendo arquivo de backup...");
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        const collections = Object.keys(backupData);
        let totalDocs = 0;
        let processedDocs = 0;

        collections.forEach(col => totalDocs += backupData[col].length);

        setStatusMsg(`Restaurando ${collections.length} coleções...`);

        let batch = writeBatch(db);
        let batchCount = 0;

        for (const colName of collections) {
            const docs = backupData[colName];
            
            for (const docData of docs) {
                // Recupera ID. Se foi salvo como _id (padrão novo) ou id (antigo)
                const docId = docData._id || docData.id; 
                const { _id, id, ...dataToSave } = docData; // Remove ID do corpo dos dados

                if (docId) {
                    const ref = doc(db, colName, docId);
                    batch.set(ref, dataToSave); 
                    
                    batchCount++;
                    processedDocs++;

                    // Limite do Firebase: 500 operações por lote
                    if (batchCount >= 450) {
                        await batch.commit();
                        batch = writeBatch(db);
                        batchCount = 0;
                        setStatusMsg(`Restaurando... ${Math.round((processedDocs / totalDocs) * 100)}%`);
                    }
                }
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        setStatusMsg("SISTEMA RESTAURADO COM SUCESSO!");
        alert("Restauração concluída. A página será recarregada.");
        window.location.reload();

      } catch (error) {
        console.error("Erro na importação:", error);
        setStatusMsg("Arquivo corrompido ou formato inválido.");
        alert("Erro ao importar.");
      } finally {
        setLoading(false);
      }
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      
      {/* STATUS HEADER */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 rounded-xl flex items-center gap-4">
        <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
            <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Central de Backup & Migração</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Gere cópias de segurança 100% fiéis para fins de auditoria ou migração de servidor.
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
          <div className={`p-4 rounded-lg font-bold text-sm flex items-center gap-2 ${statusMsg.includes("Erro") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
            {statusMsg.includes("Erro") ? <TriangleAlert className="w-4 h-4"/> : <CircleCheck className="w-4 h-4"/>}
            {statusMsg}
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CARD EXPORTAR */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-green-600" />
                Exportar Dados (Backup)
            </h3>
            <p className="text-sm text-slate-500 mb-6 min-h-[40px]">
                Selecione o formato desejado. Para migração de sistema (SQL/Supabase), use sempre <strong>JSON</strong>.
            </p>

            <div className="space-y-3">
                <button 
                    onClick={() => handleExport('json')}
                    disabled={loading}
                    className="w-full py-3 px-4 border border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800 rounded-lg flex items-center justify-center gap-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors font-bold text-blue-700 dark:text-blue-300"
                >
                    <FileJson className="w-5 h-5" />
                    Baixar JSON (Completo p/ Migração)
                    <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded">Recomendado</span>
                </button>

                <button 
                    onClick={() => handleExport('excel')}
                    disabled={loading}
                    className="w-full py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-bold text-slate-700 dark:text-slate-200"
                >
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    Baixar Excel (Visualização)
                </button>
            </div>
        </div>

        {/* CARD IMPORTAR */}
        <div className="bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldAlert className="w-32 h-32 text-red-600" />
            </div>
            
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-red-600" />
                Restaurar do Arquivo
            </h3>
            <p className="text-sm text-slate-500 mb-6 min-h-[40px]">
                Restaura o sistema para o estado exato de um arquivo <strong>.JSON</strong> salvo anteriormente.
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
                    Selecionar Backup (.json)
                </button>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-2">Apenas arquivos gerados pelo botão de exportar JSON.</p>
        </div>

      </div>

      <div className="text-center text-xs text-slate-400 mt-8">
        <p>Sistema de Backup Seguro v2.0 • Pratique Gestão</p>
      </div>
    </div>
  );
}