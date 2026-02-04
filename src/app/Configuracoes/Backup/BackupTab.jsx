<<<<<<< HEAD
import React, { useState } from 'react';
import { db } from '../../../services/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx'; // Biblioteca para Excel
import { 
  Database, Download, Upload, FileJson, FileSpreadsheet, 
  AlertTriangle, CheckCircle2, Loader2, ShieldAlert 
} from 'lucide-react';

// LISTA DE TODAS AS COLEÇÕES DO SEU SISTEMA
// Se criar novas tabelas no futuro, adicione o nome aqui.
const COLLECTIONS_TO_BACKUP = [
  'unidades',
  'mentores',
  'professores',
  'modalidades',
  'usuarios',
  'aulas',           // Cronograma
  'validacoes',      // Validação Diária/Coletiva
  'feriados',
  'vinculos',
  'professorVinculos'
];

export function BackupTab() {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [progress, setProgress] = useState(0);

  // === FUNÇÃO 1: EXPORTAR (BACKUP) ===
  const handleExport = async (format) => {
    setLoading(true);
    setStatusMsg("Iniciando varredura do banco de dados...");
    setProgress(0);

    try {
      const fullBackupData = {};

      // 1. Busca dados de todas as coleções
      for (let i = 0; i < COLLECTIONS_TO_BACKUP.length; i++) {
        const colName = COLLECTIONS_TO_BACKUP[i];
        setStatusMsg(`Baixando coleção: ${colName}...`);
        
        const querySnapshot = await getDocs(collection(db, colName));
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        fullBackupData[colName] = data;
        
        // Atualiza barra de progresso
        setProgress(Math.round(((i + 1) / COLLECTIONS_TO_BACKUP.length) * 100));
      }

      setStatusMsg("Gerando arquivo...");

      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const fileName = `BACKUP_SISTEMA_PRATIQUE_${dateStr}`;

      if (format === 'json') {
        // --- EXPORTAR JSON (Ideal para Restore) ---
        const jsonString = JSON.stringify(fullBackupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } else if (format === 'excel') {
        // --- EXPORTAR EXCEL (Ideal para Leitura) ---
        const wb = XLSX.utils.book_new();

        Object.keys(fullBackupData).forEach(colName => {
          const data = fullBackupData[colName];
          if (data.length > 0) {
            // Converte JSON para Aba do Excel
            // Trata objetos complexos (como timestamps) para string para não quebrar o Excel
            const cleanData = data.map(row => {
                const newRow = { ...row };
                // Simplificação rápida de objetos para texto
                Object.keys(newRow).forEach(k => {
                    if (typeof newRow[k] === 'object' && newRow[k] !== null) {
                        newRow[k] = JSON.stringify(newRow[k]);
                    }
                });
                return newRow;
            });

            const ws = XLSX.utils.json_to_sheet(cleanData);
            // Nome da aba (máximo 31 chars no Excel)
            XLSX.utils.book_append_sheet(wb, ws, colName.substring(0, 31));
          }
        });

        XLSX.writeFile(wb, `${fileName}.xlsx`);
      }

      setStatusMsg("Backup concluído com sucesso!");

    } catch (error) {
      console.error("Erro no backup:", error);
      setStatusMsg("Erro ao realizar backup. Verifique o console.");
    } finally {
      setLoading(false);
      setTimeout(() => setStatusMsg(""), 5000);
    }
  };

  // === FUNÇÃO 2: IMPORTAR (RESTORE) ===
  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.confirm("ATENÇÃO PERIGO CRÍTICO:\n\nIsso irá SOBRESCREVER os dados existentes com os dados do arquivo.\nDados novos criados após esse backup podem ser perdidos.\n\nTem certeza absoluta que deseja restaurar o sistema?")) {
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

        // Contar total para progresso
        collections.forEach(col => totalDocs += backupData[col].length);

        setStatusMsg(`Restaurando ${collections.length} coleções...`);

        // O Firebase tem limite de 500 escritas por lote (Batch). 
        // Vamos quebrar em lotes seguros.
        let batch = writeBatch(db);
        let batchCount = 0;

        for (const colName of collections) {
            const docs = backupData[colName];
            
            for (const docData of docs) {
                const docId = docData.id; // ID original
                const { id, ...dataToSave } = docData; // Remove ID dos dados

                const ref = doc(db, colName, docId);
                batch.set(ref, dataToSave); // .set substitui o documento se existir
                
                batchCount++;
                processedDocs++;

                // Se atingir 450 (margem de segurança), commita e abre novo lote
                if (batchCount >= 450) {
                    await batch.commit();
                    batch = writeBatch(db);
                    batchCount = 0;
                    setStatusMsg(`Processando... ${Math.round((processedDocs / totalDocs) * 100)}%`);
                }
            }
        }

        // Comita o restante
        if (batchCount > 0) {
            await batch.commit();
        }

        setStatusMsg("RESTAURAÇÃO COMPLETA! O sistema foi atualizado.");
        alert("Restauração concluída com sucesso. A página será recarregada.");
        window.location.reload();

      } catch (error) {
        console.error("Erro na importação:", error);
        setStatusMsg("Erro fatal na importação. O arquivo pode estar corrompido.");
        alert("Erro ao importar. Veja o console.");
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
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Central de Backup & Segurança</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Gere cópias de segurança completas do seu banco de dados ou restaure versões anteriores.
            </p>
        </div>
        {loading && (
            <div className="text-right">
                <div className="flex items-center gap-2 text-blue-600 font-bold text-sm mb-1">
                    <Loader2 className="w-4 h-4 animate-spin" /> Processando...
                </div>
                <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all duration-300" style={{width: `${progress}%`}}></div>
                </div>
            </div>
        )}
      </div>

      {statusMsg && (
          <div className={`p-4 rounded-lg font-bold text-sm flex items-center gap-2 ${statusMsg.includes("Erro") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
            {statusMsg.includes("Erro") ? <AlertTriangle className="w-4 h-4"/> : <CheckCircle2 className="w-4 h-4"/>}
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
                Baixe uma cópia completa de todas as coleções do Firebase.
            </p>

            <div className="space-y-3">
                <button 
                    onClick={() => handleExport('json')}
                    disabled={loading}
                    className="w-full py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-bold text-slate-700 dark:text-slate-200"
                >
                    <FileJson className="w-5 h-5 text-yellow-500" />
                    Baixar em JSON (Completo)
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Recomendado</span>
                </button>

                <button 
                    onClick={() => handleExport('excel')}
                    disabled={loading}
                    className="w-full py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-bold text-slate-700 dark:text-slate-200"
                >
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    Baixar em Excel (Visualização)
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
                Restaurar Sistema (Importar)
            </h3>
            <p className="text-sm text-slate-500 mb-6 min-h-[40px]">
                Recupere o sistema usando um arquivo <strong>.JSON</strong> gerado anteriormente. 
                <span className="block mt-1 text-red-500 font-bold text-xs">⚠️ AVISO: Isso substituirá dados existentes.</span>
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
                    <Upload className="w-5 h-5" />
                    Selecionar Arquivo de Backup (.json)
                </button>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-2">Apenas arquivos .json gerados por este sistema.</p>
        </div>

      </div>

      <div className="text-center text-xs text-slate-400 mt-8">
        <p>Sistema de Backup Seguro v1.0 • Pratique Gestão</p>
      </div>
    </div>
  );
=======
import React, { useState } from 'react';
import { db } from '../../../services/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx'; // Biblioteca para Excel
import { 
  Database, Download, Upload, FileJson, FileSpreadsheet, 
  AlertTriangle, CheckCircle2, Loader2, ShieldAlert 
} from 'lucide-react';

// LISTA DE TODAS AS COLEÇÕES DO SEU SISTEMA
// Se criar novas tabelas no futuro, adicione o nome aqui.
const COLLECTIONS_TO_BACKUP = [
  'unidades',
  'mentores',
  'professores',
  'modalidades',
  'usuarios',
  'aulas',           // Cronograma
  'validacoes',      // Validação Diária/Coletiva
  'feriados',
  'vinculos',
  'professorVinculos'
];

export function BackupTab() {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [progress, setProgress] = useState(0);

  // === FUNÇÃO 1: EXPORTAR (BACKUP) ===
  const handleExport = async (format) => {
    setLoading(true);
    setStatusMsg("Iniciando varredura do banco de dados...");
    setProgress(0);

    try {
      const fullBackupData = {};

      // 1. Busca dados de todas as coleções
      for (let i = 0; i < COLLECTIONS_TO_BACKUP.length; i++) {
        const colName = COLLECTIONS_TO_BACKUP[i];
        setStatusMsg(`Baixando coleção: ${colName}...`);
        
        const querySnapshot = await getDocs(collection(db, colName));
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        fullBackupData[colName] = data;
        
        // Atualiza barra de progresso
        setProgress(Math.round(((i + 1) / COLLECTIONS_TO_BACKUP.length) * 100));
      }

      setStatusMsg("Gerando arquivo...");

      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const fileName = `BACKUP_SISTEMA_PRATIQUE_${dateStr}`;

      if (format === 'json') {
        // --- EXPORTAR JSON (Ideal para Restore) ---
        const jsonString = JSON.stringify(fullBackupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } else if (format === 'excel') {
        // --- EXPORTAR EXCEL (Ideal para Leitura) ---
        const wb = XLSX.utils.book_new();

        Object.keys(fullBackupData).forEach(colName => {
          const data = fullBackupData[colName];
          if (data.length > 0) {
            // Converte JSON para Aba do Excel
            // Trata objetos complexos (como timestamps) para string para não quebrar o Excel
            const cleanData = data.map(row => {
                const newRow = { ...row };
                // Simplificação rápida de objetos para texto
                Object.keys(newRow).forEach(k => {
                    if (typeof newRow[k] === 'object' && newRow[k] !== null) {
                        newRow[k] = JSON.stringify(newRow[k]);
                    }
                });
                return newRow;
            });

            const ws = XLSX.utils.json_to_sheet(cleanData);
            // Nome da aba (máximo 31 chars no Excel)
            XLSX.utils.book_append_sheet(wb, ws, colName.substring(0, 31));
          }
        });

        XLSX.writeFile(wb, `${fileName}.xlsx`);
      }

      setStatusMsg("Backup concluído com sucesso!");

    } catch (error) {
      console.error("Erro no backup:", error);
      setStatusMsg("Erro ao realizar backup. Verifique o console.");
    } finally {
      setLoading(false);
      setTimeout(() => setStatusMsg(""), 5000);
    }
  };

  // === FUNÇÃO 2: IMPORTAR (RESTORE) ===
  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.confirm("ATENÇÃO PERIGO CRÍTICO:\n\nIsso irá SOBRESCREVER os dados existentes com os dados do arquivo.\nDados novos criados após esse backup podem ser perdidos.\n\nTem certeza absoluta que deseja restaurar o sistema?")) {
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

        // Contar total para progresso
        collections.forEach(col => totalDocs += backupData[col].length);

        setStatusMsg(`Restaurando ${collections.length} coleções...`);

        // O Firebase tem limite de 500 escritas por lote (Batch). 
        // Vamos quebrar em lotes seguros.
        let batch = writeBatch(db);
        let batchCount = 0;

        for (const colName of collections) {
            const docs = backupData[colName];
            
            for (const docData of docs) {
                const docId = docData.id; // ID original
                const { id, ...dataToSave } = docData; // Remove ID dos dados

                const ref = doc(db, colName, docId);
                batch.set(ref, dataToSave); // .set substitui o documento se existir
                
                batchCount++;
                processedDocs++;

                // Se atingir 450 (margem de segurança), commita e abre novo lote
                if (batchCount >= 450) {
                    await batch.commit();
                    batch = writeBatch(db);
                    batchCount = 0;
                    setStatusMsg(`Processando... ${Math.round((processedDocs / totalDocs) * 100)}%`);
                }
            }
        }

        // Comita o restante
        if (batchCount > 0) {
            await batch.commit();
        }

        setStatusMsg("RESTAURAÇÃO COMPLETA! O sistema foi atualizado.");
        alert("Restauração concluída com sucesso. A página será recarregada.");
        window.location.reload();

      } catch (error) {
        console.error("Erro na importação:", error);
        setStatusMsg("Erro fatal na importação. O arquivo pode estar corrompido.");
        alert("Erro ao importar. Veja o console.");
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
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Central de Backup & Segurança</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Gere cópias de segurança completas do seu banco de dados ou restaure versões anteriores.
            </p>
        </div>
        {loading && (
            <div className="text-right">
                <div className="flex items-center gap-2 text-blue-600 font-bold text-sm mb-1">
                    <Loader2 className="w-4 h-4 animate-spin" /> Processando...
                </div>
                <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all duration-300" style={{width: `${progress}%`}}></div>
                </div>
            </div>
        )}
      </div>

      {statusMsg && (
          <div className={`p-4 rounded-lg font-bold text-sm flex items-center gap-2 ${statusMsg.includes("Erro") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
            {statusMsg.includes("Erro") ? <AlertTriangle className="w-4 h-4"/> : <CheckCircle2 className="w-4 h-4"/>}
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
                Baixe uma cópia completa de todas as coleções do Firebase.
            </p>

            <div className="space-y-3">
                <button 
                    onClick={() => handleExport('json')}
                    disabled={loading}
                    className="w-full py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-bold text-slate-700 dark:text-slate-200"
                >
                    <FileJson className="w-5 h-5 text-yellow-500" />
                    Baixar em JSON (Completo)
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Recomendado</span>
                </button>

                <button 
                    onClick={() => handleExport('excel')}
                    disabled={loading}
                    className="w-full py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-bold text-slate-700 dark:text-slate-200"
                >
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    Baixar em Excel (Visualização)
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
                Restaurar Sistema (Importar)
            </h3>
            <p className="text-sm text-slate-500 mb-6 min-h-[40px]">
                Recupere o sistema usando um arquivo <strong>.JSON</strong> gerado anteriormente. 
                <span className="block mt-1 text-red-500 font-bold text-xs">⚠️ AVISO: Isso substituirá dados existentes.</span>
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
                    <Upload className="w-5 h-5" />
                    Selecionar Arquivo de Backup (.json)
                </button>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-2">Apenas arquivos .json gerados por este sistema.</p>
        </div>

      </div>

      <div className="text-center text-xs text-slate-400 mt-8">
        <p>Sistema de Backup Seguro v1.0 • Pratique Gestão</p>
      </div>
    </div>
  );
>>>>>>> 1bc9f3a116290a3ca37d4d1618d2c8d4a37459b0
}