import React, { useState, useEffect } from 'react';
import { db } from "../../../services/firebase"; 
import { useTranslation } from "react-i18next";
import { collection, addDoc, getDocs, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy } from "firebase/firestore";
import { 
  Headphones, Music, PlayCircle, Trash2, Loader2, 
  CheckCircle2, AlertTriangle, FolderSync, Link as LinkIcon, Video
} from "lucide-react";

export function PratiquePlayTab() {
  const { t } = useTranslation();
  const [modalidades, setModalidades] = useState([]);
  const [faixas, setFaixas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Seleção
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState("");
  
  // Form State
  const [titulo, setTitulo] = useState("");
  const [bpm, setBpm] = useState("");
  const [vimeoUrl, setVimeoUrl] = useState("");
  
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // 1. Puxar Modalidades e Faixas
  useEffect(() => {
    const fetchModalidades = async () => {
      const snap = await getDocs(collection(db, "modalidades"));
      const mods = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setModalidades(mods.sort((a, b) => a.nome.localeCompare(b.nome)));
      if (mods.length > 0) setModalidadeSelecionada(mods[0].id);
    };
    fetchModalidades();

    const q = query(collection(db, "pratique_play_faixas"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
        setFaixas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
    });

    return () => unsub();
  }, []);

  // Extrai apenas o número do vídeo a partir de qualquer link do Vimeo
  const extrairVimeoId = (url) => {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match ? match[1] : null;
  };

  const salvarFaixa = async (e) => {
    e.preventDefault();
    if (!titulo || !vimeoUrl || !modalidadeSelecionada) {
        return setErro(t('playTab.messages.fillRequired'));
    }

    const vimeoId = extrairVimeoId(vimeoUrl);
    if (!vimeoId) {
        return setErro(t('playTab.messages.invalidLink'));
    }

    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
        await addDoc(collection(db, "pratique_play_faixas"), {
            modalidadeId: modalidadeSelecionada,
            titulo: titulo.toUpperCase(),
            bpm: bpm || "N/A",
            vimeoUrl: vimeoUrl,
            vimeoId: vimeoId, // Guardamos o ID limpo para usar no Player Global depois
            tipo: "vimeo",
            createdAt: serverTimestamp(),
        });

        setSucesso(t('playTab.messages.added'));
        setTitulo("");
        setBpm("");
        setVimeoUrl("");
        
        setTimeout(() => setSucesso(""), 3000);
    } catch (err) {
        setErro(t('playTab.messages.saveError', { error: err.message }));
    } finally {
        setSalvando(false);
    }
  };

  const excluirFaixa = async (faixa) => {
      if (!window.confirm(t('playTab.messages.confirmDelete', { name: faixa.titulo }))) return;
      try {
          await deleteDoc(doc(db, "pratique_play_faixas", faixa.id));
      } catch (error) {
          alert(t('playTab.messages.deleteError', { error: error.message }));
      }
  };

  const faixasVisiveis = faixas.filter(f => f.modalidadeId === modalidadeSelecionada);

  return (
    <div className="p-6 md:p-8 animate-fade-in max-w-6xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3 uppercase tracking-tight">
            <span className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/20">
                <Video className="w-6 h-6"/>
            </span>
            {t('playTab.title')}
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 uppercase tracking-wide">
             {t('playTab.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* PAINEL DE CADASTRO (ESQUERDA) */}
          <div className="lg:col-span-4 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                  <h3 className="font-black text-slate-800 dark:text-white uppercase flex items-center gap-2 mb-5 pb-3 border-b border-slate-100 dark:border-slate-700">
                      <LinkIcon className="w-5 h-5 text-blue-500"/> {t('playTab.linkNew')}
                  </h3>

                  <form onSubmit={salvarFaixa} className="space-y-4">
                      {erro && <div className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> {erro}</div>}
                      {sucesso && <div className="text-blue-600 text-xs font-bold bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> {sucesso}</div>}

                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">{t('playTab.album')}</label>
                          <select 
                              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white outline-none focus:border-blue-500 transition-colors"
                              value={modalidadeSelecionada}
                              onChange={e => setModalidadeSelecionada(e.target.value)}
                              disabled={salvando}
                          >
                              {modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                          </select>
                      </div>

                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">{t('playTab.vimeoLink')} <span className="text-red-500">*</span></label>
                          <input 
                              type="url"
                              value={vimeoUrl}
                              onChange={e => setVimeoUrl(e.target.value)}
                              disabled={salvando}
                              placeholder="https://vimeo.com/123456789"
                              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white outline-none focus:border-blue-500 transition-colors"
                          />
                      </div>

                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">{t('playTab.trackName')} <span className="text-red-500">*</span></label>
                          <input 
                              type="text"
                              value={titulo}
                              onChange={e => setTitulo(e.target.value)}
                              disabled={salvando}
                              placeholder={t('playTab.trackPlaceholder')}
                              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white outline-none focus:border-blue-500 transition-colors"
                          />
                      </div>

                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">{t('playTab.bpm')}</label>
                          <input 
                              type="number"
                              value={bpm}
                              onChange={e => setBpm(e.target.value)}
                              disabled={salvando}
                              placeholder={t('playTab.bpmPlaceholder')}
                              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white outline-none focus:border-blue-500 transition-colors"
                          />
                      </div>

                      <button 
                          type="submit"
                          disabled={salvando}
                          className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                          {salvando ? (
                              <Loader2 className="w-5 h-5 animate-spin"/>
                          ) : (
                              <><CheckCircle2 className="w-4 h-4"/> {t('playTab.save')}</>
                          )}
                      </button>
                  </form>
              </div>
          </div>

          {/* LISTA DE MÚSICAS (DIREITA) */}
          <div className="lg:col-span-8">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
                  
                  <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                      <h3 className="font-black text-slate-800 dark:text-white uppercase flex items-center gap-2 text-lg">
                          <FolderSync className="w-5 h-5 text-indigo-500"/> {t('playTab.library')}
                      </h3>
                      <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                          {t('playTab.tracksCount', { count: faixasVisiveis.length })}
                      </span>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                      {loading ? (
                          <div className="flex justify-center items-center h-full text-slate-400"><Loader2 className="w-8 h-8 animate-spin"/></div>
                      ) : faixasVisiveis.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50 py-10">
                              <Music className="w-16 h-16 mb-4"/>
                              <p className="font-bold uppercase tracking-wide">{t('playTab.none')}</p>
                              <p className="text-xs mt-1">{t('playTab.noneHint')}</p>
                          </div>
                      ) : (
                          <div className="space-y-3">
                              {faixasVisiveis.map((faixa) => (
                                  <div key={faixa.id} className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-700 transition-colors group">
                                      
                                      <div className="flex items-center gap-4 w-full overflow-hidden">
                                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 flex-shrink-0">
                                              <PlayCircle className="w-6 h-6"/>
                                          </div>
                                          <div className="flex-1 min-w-0 pr-4">
                                              <p className="font-black text-slate-800 dark:text-slate-200 text-sm truncate uppercase tracking-tight">{faixa.titulo}</p>
                                              <div className="flex items-center gap-3 mt-1">
                                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Video className="w-3 h-3"/> VIMEO</span>
                                                  <span className="text-[10px] font-bold text-slate-400">ID: {faixa.vimeoId}</span>
                                                  {faixa.bpm !== "N/A" && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800/30">{faixa.bpm} BPM</span>}
                                              </div>
                                          </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                          <a 
                                              href={faixa.vimeoUrl} 
                                              target="_blank" 
                                              rel="noreferrer"
                                              className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                              title={t('playTab.testLink')}
                                          >
                                              <LinkIcon className="w-4 h-4"/>
                                          </a>
                                          <button 
                                              onClick={() => excluirFaixa(faixa)}
                                              className="p-2.5 text-slate-400 hover:text-white hover:bg-red-500 rounded-lg transition-colors"
                                              title={t('playTab.deleteTrack')}
                                          >
                                              <Trash2 className="w-4 h-4"/>
                                          </button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
}