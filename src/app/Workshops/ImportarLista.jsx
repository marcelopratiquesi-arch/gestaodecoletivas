// Importar lista de participantes: arquivo .xlsx da plataforma de ingressos -> conferência (verde/amarelo/cinza) -> grava.
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Loader2, FileSpreadsheet } from 'lucide-react';
import ModalWorkshop from './ModalWorkshop';
import { lerArquivoXlsx, lerParticipantes, gravarImportacao } from '../../services/participantesWorkshopService';
import { montarConferencia } from '../../utils/importarParticipantes';
import { dataBr } from '../../utils/workshopCadastro';

const botao = 'px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all';
const COR = {
  v: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  a: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  c: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  x: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
const BARRA = { v: 'border-l-emerald-500', a: 'border-l-amber-400', c: 'border-l-slate-400', x: 'border-l-red-400' };

export default function ImportarLista({ workshop, professores, unidades, onClose, onVerParticipantes }) {
  const { t } = useTranslation();
  const [passo, setPasso] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [arquivo, setArquivo] = useState(null); // { nome, dataIso, local, total }
  const [linhas, setLinhas] = useState([]);
  const [existentes, setExistentes] = useState([]);
  const [resultado, setResultado] = useState(null);
  const inputRef = useRef(null);

  const nomeUnidade = useMemo(() => new Map((unidades || []).map((u) => [String(u.id), u.nome])), [unidades]);
  const rotuloGrupo = (g) => {
    const un = [...new Set(g.fichas.map((f) => nomeUnidade.get(String(f.unidadeId))).filter(Boolean))];
    const base = un.length ? `${g.nome} · ${un.join(', ')}` : g.nome;
    return g.fichas.length > 1 ? `${base} (${t('shop.ws.imp.fichas', { count: g.fichas.length })})` : base;
  };

  const escolherArquivo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErro(''); setOcupado(true);
    try {
      const lida = await lerArquivoXlsx(f);
      if (lida.erro || !lida.linhas.length) { setErro(t('shop.ws.imp.badFile')); setOcupado(false); return; }
      const ja = await lerParticipantes(workshop.id);
      setExistentes(ja);
      setArquivo({ nome: f.name, dataIso: lida.dataIso, local: lida.local, total: lida.linhas.length });
      setLinhas(montarConferencia(lida.linhas, professores));
      setPasso(2);
    } catch (err) {
      console.error(err);
      setErro(t('shop.ws.imp.readError'));
    }
    setOcupado(false);
  };

  const contagem = useMemo(() => {
    const c = { v: 0, a: 0, c: 0, x: 0, marcadas: 0 };
    linhas.forEach((l) => { c[l.cls] += 1; if (l.incluir) c.marcadas += 1; });
    return c;
  }, [linhas]);

  const mudar = (i, campo, valor) => setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, [campo]: valor } : l)));
  // Marcar todos não inclui quem não pagou / não fez check-in (isso só na mão, linha a linha).
  const marcarTodos = (v) => setLinhas((ls) => ls.map((l) => ({ ...l, incluir: v && l.cls !== 'x' })));

  const gravar = async () => {
    const marcadas = linhas.filter((l) => l.incluir);
    if (!marcadas.length) { toast.error(t('shop.ws.imp.nothing')); return; }
    setOcupado(true);
    try {
      // Linha que não conta (sem pagamento/check-in) mas foi marcada na mão usa o que o sistema achou.
      const r = await gravarImportacao({ workshop, linhas: marcadas, existentes, fichas: professores });
      setResultado(r); setPasso(3);
    } catch (err) {
      console.error(err);
      toast.error(t('shop.ws.imp.saveError'));
    }
    setOcupado(false);
  };

  const dataDiferente = arquivo?.dataIso && arquivo.dataIso !== workshop.data;

  const rodape = passo === 1 ? (
    <button type="button" onClick={onClose} className={`${botao} text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700`}>{t('shop.ws.cancel')}</button>
  ) : passo === 2 ? (
    <>
      <span className="text-xs font-bold text-slate-500 mr-auto">{t('shop.ws.imp.marked', { count: contagem.marcadas })}</span>
      <button type="button" onClick={onClose} className={`${botao} text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700`}>{t('shop.ws.cancel')}</button>
      <button type="button" onClick={gravar} disabled={ocupado || !contagem.marcadas} className={`${botao} bg-red-600 text-white hover:bg-red-700 disabled:opacity-60`}>{ocupado ? t('shop.ws.saving') : t('shop.ws.imp.confirm')}</button>
    </>
  ) : (
    <>
      <button type="button" onClick={onClose} className={`${botao} text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700`}>{t('shop.ws.imp.close')}</button>
      <button type="button" onClick={onVerParticipantes} className={`${botao} bg-red-600 text-white hover:bg-red-700`}>{t('shop.ws.imp.seeList')}</button>
    </>
  );

  return (
    <ModalWorkshop largo titulo={`${t('shop.ws.imp.title')} · ${workshop.nome}`} onClose={onClose} rodape={rodape}>
      <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest flex-wrap">
        {[1, 2, 3].map((n) => <span key={n} className={`px-3 py-1 rounded-full ${passo === n ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>{n} {t(`shop.ws.imp.step${n}`)}</span>)}
      </div>

      {passo === 1 && (
        <>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={ocupado}
            className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-8 text-center text-slate-500 hover:border-slate-500 bg-slate-50 dark:bg-slate-900">
            {ocupado ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : <FileSpreadsheet className="w-7 h-7 mx-auto mb-2" />}
            <b className="block text-slate-800 dark:text-white text-sm">{t('shop.ws.imp.choose')}</b>
            <span className="text-xs">{t('shop.ws.imp.chooseHint')}</span>
          </button>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={escolherArquivo} />
          {erro && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-bold">{erro}</div>}
          <p className="text-xs text-slate-500">{t('shop.ws.imp.rule')}</p>
        </>
      )}

      {passo === 2 && (
        <>
          <div className="text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex flex-wrap gap-x-4 gap-y-1">
            <span>📄 <b>{arquivo.nome}</b></span>
            <span className="text-slate-500">{t('shop.ws.imp.rows', { count: arquivo.total })}</span>
            {arquivo.dataIso && <span className="text-slate-500">{t('shop.ws.imp.fileDate')}: {dataBr(arquivo.dataIso)}</span>}
          </div>
          {dataDiferente && <div className="p-3 rounded-xl bg-amber-50 text-amber-700 text-sm font-bold">{t('shop.ws.imp.dateWarn', { file: dataBr(arquivo.dataIso), ws: dataBr(workshop.data) })}</div>}
          {existentes.length > 0 && <div className="text-xs text-slate-500">{t('shop.ws.imp.already', { count: existentes.length })}</div>}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['v', 'sumV'], ['a', 'sumA'], ['c', 'sumC'], ['x', 'sumX']].map(([k, rot]) => (
              <div key={k} className={`rounded-xl p-3 ${COR[k]}`}><b className="block text-2xl tabular-nums">{contagem[k]}</b><span className="text-[10px] font-black uppercase tracking-wider">{t(`shop.ws.imp.${rot}`)}</span></div>
            ))}
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <th className="p-2 w-9"><input type="checkbox" checked={linhas.length > 0 && linhas.every((l) => l.incluir)} onChange={(e) => marcarTodos(e.target.checked)} aria-label={t('shop.ws.imp.all')} /></th>
                  <th className="p-2">{t('shop.ws.imp.person')}</th><th className="p-2">{t('shop.ws.imp.payCheck')}</th><th className="p-2">{t('shop.ws.imp.teacher')}</th><th className="p-2">{t('shop.ws.imp.how')}</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => {
                  const mostra = l.cls === 'x' && l.incluir ? l.achado : l.cls;
                  return (
                    <tr key={l.id} className={`border-t border-slate-100 dark:border-slate-700 border-l-4 ${BARRA[l.cls]} ${l.cls === 'x' && !l.incluir ? 'opacity-60' : ''}`}>
                      <td className="p-2"><input type="checkbox" checked={l.incluir} onChange={(e) => mudar(i, 'incluir', e.target.checked)} aria-label={t('shop.ws.imp.include')} /></td>
                      <td className="p-2 min-w-0"><b className="break-words">{l.nome || '—'}</b><div className="text-[11px] text-slate-500 break-all">{l.email} {l.telefones[0] ? `· ${l.telefones[0]}` : ''}</div></td>
                      <td className="p-2 whitespace-nowrap">{l.pagamento || '—'} / {l.checkin || '—'}</td>
                      <td className="p-2">
                        {mostra === 'a' ? (
                          <select value={l.grupoSel} onChange={(e) => mudar(i, 'grupoSel', Number(e.target.value))} className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold" aria-label={t('shop.ws.imp.teacher')}>
                            {l.grupos.map((g, k) => <option key={k} value={k}>{rotuloGrupo(g)}</option>)}
                            <option value={-1}>{t('shop.ws.imp.none')}</option>
                          </select>
                        ) : mostra === 'v' ? (
                          <span className="font-semibold">{rotuloGrupo(l.grupos[l.grupoSel])}</span>
                        ) : <span className="text-xs text-slate-400">{t('shop.ws.imp.keepNoRecord')}</span>}
                      </td>
                      <td className="p-2"><span className={`px-2 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${COR[l.cls]}`}>{l.cls === 'x' ? t('shop.ws.imp.notCount') : t(`shop.ws.imp.how_${l.cls}`)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">{t('shop.ws.imp.legend')}</p>
        </>
      )}

      {passo === 3 && resultado && (
        <>
          <div className="p-4 rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 font-bold text-sm">
            {t('shop.ws.imp.done', { count: resultado.gravados, linked: resultado.ligados, none: resultado.semCadastro })}
          </div>
          <p className="text-xs text-slate-500">{t('shop.ws.imp.again')}</p>
        </>
      )}
    </ModalWorkshop>
  );
}
