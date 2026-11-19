import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeDollarSign, X, Pencil, Save, Loader2, AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { lerTabelaPrecos, salvarTabelaPrecos } from '../../services/tabelaPrecosService';
import {
  NIVEIS, ORDEM, MODALIDADES_TABELA, camposDoNivel, deTexto, paraTexto, podeEditarTabelaPrecos, podeVerTabelaPrecos,
} from '../../utils/tabelaPrecos';

// Cores das colunas (como na tabela impressa) e das modalidades.
const COR_NIVEL = {
  cinza: { cabecalho: 'bg-slate-500', celula: 'bg-slate-600' },
  verde: { cabecalho: 'bg-green-700', celula: 'bg-green-600' },
  vermelha: { cabecalho: 'bg-red-800', celula: 'bg-red-600' },
  preta: { cabecalho: 'bg-black', celula: 'bg-black' },
};
const COR_MODALIDADE = {
  core20: 'from-cyan-500 to-sky-500', core40: 'from-cyan-500 to-sky-500', training: 'from-lime-500 to-green-500',
  jump: 'from-sky-500 to-blue-500', dance: 'from-purple-500 to-fuchsia-500', bumbum: 'from-fuchsia-600 to-pink-500',
};

const moeda = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);

export default function TabelaPrecosModal({ aberto, onFechar }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const role = String(userData?.role || '').trim().toLowerCase();
  const podeVer = podeVerTabelaPrecos(role);
  const podeEditar = podeEditarTabelaPrecos(role);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [dados, setDados] = useState(null); // { tabela, salvo, atualizadoEm, atualizadoPorNome }
  const [rascunho, setRascunho] = useState(null); // tabela em texto, só durante a edição
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setDados(await lerTabelaPrecos());
    } catch (e) {
      console.error('Erro ao ler a tabela de preços', e);
      setErro(t('priceTable.loadError'));
    } finally {
      setCarregando(false);
    }
  }, [t]);

  // Lê 1 documento quando a tabela é aberta (não ao entrar no sistema).
  useEffect(() => {
    if (aberto && podeVer) { setSucesso(''); setRascunho(null); carregar(); }
  }, [aberto, podeVer, carregar]);

  const editando = rascunho !== null;
  const tabela = editando ? rascunho : dados?.tabela;

  const ligarEdicao = () => { setSucesso(''); setErro(''); setRascunho(paraTexto(dados.tabela)); };
  const cancelar = () => { setRascunho(null); setErro(''); };

  const mudarValor = (id, nivel, campo, valor) => setRascunho((r) => ({
    ...r, precos: { ...r.precos, [id]: { ...r.precos[id], [nivel]: { ...r.precos[id][nivel], [campo]: valor } } },
  }));
  const mudarFrequencia = (periodo, valor) => setRascunho((r) => ({ ...r, frequenciaPreta: { ...r.frequenciaPreta, [periodo]: valor } }));
  const alternarVisivel = (id) => setRascunho((r) => ({ ...r, modalidades: { ...r.modalidades, [id]: { visivel: !r.modalidades[id].visivel } } }));

  const salvar = async () => {
    const { tabela: nova, invalidos } = deTexto(rascunho);
    if (invalidos.length > 0) { setErro(t('priceTable.invalidValues', { count: invalidos.length })); return; }
    setSalvando(true);
    setErro('');
    try {
      const mudancas = await salvarTabelaPrecos({
        tabela: nova, anterior: dados.tabela, usuario: { id: userData?.id || userData?.uid, nome: userData?.nome || userData?.email },
      });
      setRascunho(null);
      setSucesso(mudancas.length > 0 ? t('priceTable.saved', { count: mudancas.length }) : t('priceTable.noChanges'));
      await carregar();
    } catch (e) {
      console.error('Erro ao salvar a tabela de preços', e);
      setErro(t('priceTable.saveError'));
    } finally {
      setSalvando(false);
    }
  };

  const linhas = useMemo(() => {
    if (!tabela) return [];
    return ORDEM.filter((id) => editando || tabela.modalidades[id].visivel);
  }, [tabela, editando]);

  if (!aberto || !podeVer) return null;

  const rotuloCampo = (campo) => t(`priceTable.fields.${campo}`);
  const frequencia = tabela?.frequenciaPreta;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto" onMouseDown={(e) => { if (e.target === e.currentTarget && !editando) onFechar(); }}>
      <div className="w-full max-w-6xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 my-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0"><BadgeDollarSign className="w-5 h-5" /></div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">{t('priceTable.title')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('priceTable.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {podeEditar && dados && !editando && (
              <button type="button" onClick={ligarEdicao} className="h-10 px-4 rounded-xl bg-slate-800 dark:bg-slate-600 text-white text-xs font-bold uppercase flex items-center gap-2 hover:bg-slate-700 transition-colors">
                <Pencil className="w-4 h-4" /> {t('priceTable.edit')}
              </button>
            )}
            <button type="button" onClick={onFechar} aria-label={t('priceTable.close')} className="w-10 h-10 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {erro && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 shrink-0" />{erro}</div>}
          {sucesso && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5 shrink-0" />{sucesso}</div>}

          {carregando && !dados && <div className="py-16 flex justify-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin" /></div>}

          {tabela && (
            <>
              {/* Tabela */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[820px] border-collapse text-white">
                  <thead>
                    <tr>
                      <th className="w-40 bg-white dark:bg-slate-800" />
                      {NIVEIS.map((nivel) => (
                        <th key={nivel} className={`${COR_NIVEL[nivel].cabecalho} px-3 py-3 text-xs font-black uppercase tracking-wide`}>
                          {t(`priceTable.levels.${nivel}`)}
                          <span className="block text-[10px] font-bold opacity-80 normal-case tracking-normal">{t(`priceTable.levelHint.${nivel}`)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((id) => {
                      const modalidade = MODALIDADES_TABELA[id];
                      const escondida = !tabela.modalidades[id].visivel;
                      return (
                        <tr key={id} className={`border-t border-white/20 ${escondida ? 'opacity-50' : ''}`}>
                          <td className={`bg-gradient-to-br ${COR_MODALIDADE[id]} px-3 py-4 align-middle`}>
                            <div className="text-sm font-black uppercase leading-tight">{modalidade.nome}</div>
                            {editando && (
                              <button type="button" onClick={() => alternarVisivel(id)} className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-white/25 hover:bg-white/40 rounded-md px-2 py-1">
                                {escondida ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                {escondida ? t('priceTable.hidden') : t('priceTable.visible')}
                              </button>
                            )}
                          </td>
                          {NIVEIS.map((nivel) => (
                            <td key={nivel} className={`${COR_NIVEL[nivel].celula} px-3 py-3 align-middle border-l border-white/20`}>
                              <div className="space-y-1.5">
                                {camposDoNivel(modalidade.tipo, nivel).map((campo) => (
                                  <div key={campo} className="flex items-center justify-between gap-2 text-sm font-bold">
                                    <span className="uppercase text-[11px] opacity-90">{rotuloCampo(campo)}</span>
                                    {editando ? (
                                      <label className="flex items-center gap-1 bg-white rounded-md px-2 h-8 text-slate-800">
                                        <span className="text-[11px] font-bold text-slate-400">R$</span>
                                        <input
                                          type="text" inputMode="decimal" value={tabela.precos[id][nivel][campo]}
                                          onChange={(e) => mudarValor(id, nivel, campo, e.target.value)}
                                          aria-label={`${modalidade.nome} ${t(`priceTable.levels.${nivel}`)} ${rotuloCampo(campo)}`}
                                          className="w-14 text-right text-sm font-black outline-none bg-transparent"
                                        />
                                      </label>
                                    ) : (
                                      <span className="text-base font-black whitespace-nowrap">{moeda(tabela.precos[id][nivel][campo])}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Regras */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 space-y-2">
                  <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{t('priceTable.rulesTitle')}</p>
                  <p>{t('priceTable.ruleWorkshop')}</p>
                  <p>{t('priceTable.ruleAcademic')}</p>
                  <p>{t('priceTable.ruleStreak')}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 space-y-2">
                  <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{t('priceTable.blackTitle')}</p>
                  <p>{t('priceTable.blackIntro')}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-bold text-slate-800 dark:text-white">
                    {['manha', 'noite'].map((periodo) => (
                      <span key={periodo} className="inline-flex items-center gap-2">
                        {t(`priceTable.freq.${periodo}`)}
                        {editando ? (
                          <input type="text" inputMode="numeric" value={frequencia[periodo]} onChange={(e) => mudarFrequencia(periodo, e.target.value)}
                            aria-label={t(`priceTable.freq.${periodo}`)} className="w-14 h-8 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-center text-sm font-black outline-none focus:border-red-500" />
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-black text-white">{frequencia[periodo]}</span>
                        )}
                        {t('priceTable.students')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 font-medium">{t('priceTable.notAutomatic')}</p>

              {/* Rodapé */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400 font-medium">
                  {dados.salvo && dados.atualizadoEm
                    ? t('priceTable.lastUpdate', { when: new Date(dados.atualizadoEm).toLocaleString('pt-BR'), who: dados.atualizadoPorNome || '-' })
                    : t('priceTable.neverSaved')}
                </p>
                {editando && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={cancelar} disabled={salvando} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase hover:bg-slate-50 dark:hover:bg-slate-700">{t('priceTable.cancel')}</button>
                    <button type="button" onClick={salvar} disabled={salvando} className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-xs font-bold uppercase flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-60">
                      {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('priceTable.save')}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
