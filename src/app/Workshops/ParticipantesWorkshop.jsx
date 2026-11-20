// Lista de participantes de um workshop (só admin): ligados a professor e guardados sem cadastro.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Loader2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import ModalWorkshop from './ModalWorkshop';
import { lerParticipantes, ligarParticipante, removerParticipante, acertarContador } from '../../services/participantesWorkshopService';
import { normalizarNome } from '../../utils/repetidos';

const botao = 'px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all';
const mini = 'px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-700';

export default function ParticipantesWorkshop({ workshop, professores, unidades, onClose, onImportar }) {
  const { t } = useTranslation();
  const [lista, setLista] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  const [ligando, setLigando] = useState(null); // participante
  const [busca, setBusca] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const nomeUnidade = useMemo(() => new Map((unidades || []).map((u) => [String(u.id), u.nome])), [unidades]);
  const fichaPorId = useMemo(() => new Map((professores || []).map((p) => [String(p.id), p])), [professores]);

  const carregar = async () => {
    try {
      const l = await lerParticipantes(workshop.id);
      l.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
      setLista(l);
      acertarContador(workshop, l.length).catch(() => {});
    } catch (e) { console.error(e); toast.error(t('shop.ws.part.loadError')); setLista([]); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [workshop.id]);

  const nomesLigados = (p) => (p.professorIds || []).map((id) => {
    const f = fichaPorId.get(String(id));
    if (!f) return null;
    const un = nomeUnidade.get(String(f.unidadeId));
    return un ? `${f.nome} (${un})` : f.nome;
  }).filter(Boolean);

  const candidatos = useMemo(() => {
    const q = normalizarNome(busca);
    if (q.length < 2) return [];
    return (professores || []).filter((p) => normalizarNome(p.nome).includes(q)).slice(0, 8);
  }, [busca, professores]);

  const remover = async (p) => {
    if (confirmando !== p.id) { setConfirmando(p.id); setTimeout(() => setConfirmando((c) => (c === p.id ? null : c)), 3500); return; }
    setOcupado(true);
    try { await removerParticipante({ workshop, participante: p, todos: lista, fichas: professores }); toast.success(t('shop.ws.part.removed')); await carregar(); }
    catch (e) { console.error(e); toast.error(t('shop.ws.imp.saveError')); }
    setConfirmando(null); setOcupado(false);
  };

  const ligar = async (ficha) => {
    setOcupado(true);
    try {
      // Liga a todas as fichas da mesma pessoa (mesmo nome em outras unidades).
      const irmas = (professores || []).filter((f) => normalizarNome(f.nome) === normalizarNome(ficha.nome)).map((f) => String(f.id));
      await ligarParticipante({ workshop, participante: ligando, professorIds: irmas, fichas: professores });
      toast.success(t('shop.ws.part.linked'));
      setLigando(null); setBusca(''); await carregar();
    } catch (e) { console.error(e); toast.error(t('shop.ws.imp.saveError')); }
    setOcupado(false);
  };

  const baixar = () => {
    const dados = (lista || []).map((p) => ({
      [t('shop.ws.part.name')]: p.nome,
      [t('shop.ws.part.status')]: p.status === 'ligado' ? t('shop.ws.part.statusLinked') : t('shop.ws.part.statusNone'),
      [t('shop.ws.who.partLinkedTo')]: nomesLigados(p).join(' · '),
      Email: p.email || '',
      [t('shop.ws.who.partPhone')]: p.telefone || '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados), t('shop.ws.part.title').slice(0, 31));
    XLSX.writeFile(wb, `Participantes_${String(workshop.nome).replace(/s+/g, '_')}.xlsx`);
  };

  const ligados = (lista || []).filter((p) => p.status === 'ligado').length;
  const sem = (lista || []).length - ligados;

  return (
    <ModalWorkshop largo titulo={`${t('shop.ws.part.title')} · ${workshop.nome}`} onClose={onClose}
      rodape={<>
        <span className="text-xs text-slate-500 mr-auto">{t('shop.ws.part.deleteNote')}</span>
        <button type="button" onClick={onClose} className={`${botao} text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700`}>{t('shop.ws.imp.close')}</button>
        <button type="button" onClick={baixar} disabled={!lista?.length} className={`${botao} border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white disabled:opacity-60`}><Download className="w-4 h-4" /> {t('shop.ws.who.partDownload')}</button>
        <button type="button" onClick={onImportar} className={`${botao} bg-red-600 text-white hover:bg-red-700`}>{t('shop.ws.importBtn')}</button>
      </>}>
      {lista === null ? <div className="flex justify-center py-10 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3 bg-slate-100 dark:bg-slate-700"><b className="block text-2xl tabular-nums">{lista.length}</b><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('shop.ws.part.total')}</span></div>
            <div className="rounded-xl p-3 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><b className="block text-2xl tabular-nums">{ligados}</b><span className="text-[10px] font-black uppercase tracking-wider">{t('shop.ws.part.linkedCount')}</span></div>
            <div className="rounded-xl p-3 bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"><b className="block text-2xl tabular-nums">{sem}</b><span className="text-[10px] font-black uppercase tracking-wider">{t('shop.ws.part.noRecord')}</span></div>
          </div>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead><tr className="bg-slate-50 dark:bg-slate-900 text-left text-[10px] font-black uppercase tracking-widest text-slate-500"><th className="p-2">{t('shop.ws.part.name')}</th><th className="p-2">{t('shop.ws.part.status')}</th><th className="p-2">{t('shop.ws.part.contact')}</th><th className="p-2" /></tr></thead>
              <tbody>
                {lista.map((p) => {
                  const ligadoA = nomesLigados(p);
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="border-t border-slate-100 dark:border-slate-700 align-top">
                        <td className="p-2"><b className="break-words">{p.nome}</b>{ligadoA.length > 0 && <div className="text-[11px] text-slate-500">{ligadoA.join(' · ')}</div>}</td>
                        <td className="p-2"><span className={`px-2 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${p.status === 'ligado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{p.status === 'ligado' ? t('shop.ws.part.statusLinked') : t('shop.ws.part.statusNone')}</span></td>
                        <td className="p-2 text-[11px] text-slate-500 break-all">{p.email}<br />{p.telefone}</td>
                        <td className="p-2 whitespace-nowrap text-right space-x-2">
                          {p.status !== 'ligado' && <button type="button" disabled={ocupado} onClick={() => { setLigando(p); setBusca(''); }} className={mini}>{t('shop.ws.part.link')}</button>}
                          <button type="button" disabled={ocupado} onClick={() => remover(p)} className={`${mini} text-red-600`}>{confirmando === p.id ? t('shop.ws.confirmDelete') : t('shop.ws.part.remove')}</button>
                        </td>
                      </tr>
                      {ligando?.id === p.id && (
                        <tr className="bg-slate-50 dark:bg-slate-900/20"><td colSpan={4} className="p-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1" htmlFor="busca-prof">{t('shop.ws.part.searchTeacher')}</label>
                          <input id="busca-prof" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" placeholder={t('shop.ws.part.searchPh')} />
                          <div className="flex flex-wrap gap-2 mt-2">
                            {candidatos.map((f) => <button key={f.id} type="button" disabled={ocupado} onClick={() => ligar(f)} className={mini}>{f.nome}{nomeUnidade.get(String(f.unidadeId)) ? ` · ${nomeUnidade.get(String(f.unidadeId))}` : ''}</button>)}
                            <button type="button" onClick={() => setLigando(null)} className={`${mini} text-slate-500`}>{t('shop.ws.cancel')}</button>
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {lista.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">{t('shop.ws.part.empty')}</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">{t('shop.ws.part.note')}</p>
        </>
      )}
    </ModalWorkshop>
  );
}
