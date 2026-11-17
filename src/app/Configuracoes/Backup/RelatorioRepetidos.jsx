// Relatório de repetidos (só admin, só leitura): mesma pessoa com e-mail, telefone ou nome repetido
// entre professores da grade, crachás e pedidos de acesso. Nunca lê nem mostra documento.
// Professores e unidades vêm do catálogo já carregado (0 leituras); crachás e pedidos são lidos uma vez, ao clicar.
import React, { useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';
import { Users, Loader2, FileSpreadsheet, Search, TriangleAlert, Merge, Link2 } from 'lucide-react';
import JuntarFichasModal from './JuntarFichasModal';
import LigarCrachaModal from './LigarCrachaModal';
import { db } from '../../../services/firebase';
import { useCatalogs } from '../../../contexts/CatalogContext';
import { normalizarPais } from '../../../utils/feriados';
import { formatRole } from '../../../utils/formatters';
import { acharRepetidos } from '../../../utils/repetidos';

const TIPOS = ['email', 'telefone', 'nome'];

function Item({ item, rotuloOrigem }) {
  return (
    <li className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-2">
      <span className="font-bold text-slate-700 dark:text-slate-200">{rotuloOrigem}</span>
      <span>· {item.nome || '—'}</span>
      {item.detalhe && <span className="text-slate-400">· {item.detalhe}</span>}
      {item.unidade && <span className="text-slate-400">· {item.unidade}</span>}
    </li>
  );
}

export default function RelatorioRepetidos() {
  const { t } = useTranslation();
  const { catalogs } = useCatalogs();
  // "lidos" guarda só crachás e pedidos (lidos uma vez); os professores vêm sempre do catálogo ao vivo,
  // então depois de juntar fichas o relatório se atualiza sozinho, sem ler de novo.
  const [estado, setEstado] = useState({ carregando: false, erro: false, lidos: null });
  const [aberto, setAberto] = useState('email');
  const [juntando, setJuntando] = useState(null); // fichas da grade abertas na janela "Juntar fichas"
  const [ligando, setLigando] = useState(null);   // { fichas, crachas } da janela "Ligar ficha ao crachá"

  const unidadePorId = useMemo(
    () => new Map((catalogs?.unidades || []).map(u => [String(u.id), u])),
    [catalogs?.unidades]
  );
  const nomeUnidade = (id) => (id ? unidadePorId.get(String(id))?.nome || id : '');
  const paisDaUnidade = (id) => normalizarPais(unidadePorId.get(String(id))?.pais);

  const gerar = async () => {
    setEstado({ carregando: true, erro: false, lidos: null });
    try {
      const [crachas, pedidos] = await Promise.all([
        getDocs(collection(db, 'usuarios')),
        getDocs(collection(db, 'solicitacoes_acesso')),
      ]);
      // Logins antigos não são pessoas: login da unidade (papel "unidade") e crachá de professor da
      // senha antiga (sem loginGoogle, inativo desde o fim da senha 123456). Ficam numa lista à parte.
      const ehLoginAntigo = (c) => {
        const papel = String(c.role || '').toLowerCase();
        return papel === 'unidade' || (papel === 'professor' && c.loginGoogle !== true);
      };
      const loginsAntigos = [];
      const registros = [
        ...crachas.docs.flatMap(d => {
          const c = d.data();
          const unidadeId = c.unidadeId || (c.unidadeIds || [])[0] || '';
          const registro = {
            origem: 'cracha', id: d.id, nome: c.nome, email: c.email || c.emailAuth, telefone: c.telefone,
            pais: paisDaUnidade(unidadeId), professorId: c.professorId || '', papel: String(c.role || '').toLowerCase(),
            detalhe: formatRole(c.role), unidade: nomeUnidade(unidadeId),
          };
          if (ehLoginAntigo(c)) { loginsAntigos.push({ ...registro, origem: 'loginAntigo' }); return []; }
          return [registro];
        }),
        ...pedidos.docs.map(d => {
          const s = d.data();
          return {
            origem: 'pedido', id: d.id, nome: s.nome, email: s.email, telefone: s.telefone,
            pais: paisDaUnidade(s.unidadeId),
            detalhe: `${formatRole(s.papel || 'lider')} · ${t(`backupTab.duplicates.requestStatus.${s.status}`, s.status || '')}`,
            unidade: s.unidadeNome || nomeUnidade(s.unidadeId),
          };
        }),
      ];
      loginsAntigos.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
      setEstado({ carregando: false, erro: false, lidos: { registros, loginsAntigos, total: crachas.size + pedidos.size } });
    } catch (err) {
      console.error('Relatório de repetidos:', err);
      setEstado({ carregando: false, erro: true, lidos: null });
    }
  };

  const professorPorId = useMemo(
    () => new Map((catalogs?.professores || []).map(p => [String(p.id), p])),
    [catalogs?.professores]
  );

  const r = useMemo(() => {
    if (!estado.lidos) return null;
    const professores = (catalogs?.professores || []).map(p => ({
      origem: 'professor', id: String(p.id), nome: p.nome, email: p.email, telefone: p.telefone,
      pais: normalizarPais(p.pais), uidLogin: p.uidLogin || '',
      detalhe: p.status || '', unidade: '',
    }));
    const resultado = acharRepetidos([...professores, ...estado.lidos.registros]);
    resultado.problemas.loginAntigo = estado.lidos.loginsAntigos;
    return resultado;
  }, [estado.lidos, catalogs?.professores]);

  // Depois de juntar: os crachás guardados aqui passam a apontar para a ficha que ficou (como no banco).
  const aoJuntar = (idPrincipal, idsApagados) => {
    const apagados = new Set(idsApagados.map(String));
    setEstado(prev => (!prev.lidos ? prev : {
      ...prev,
      lidos: {
        ...prev.lidos,
        registros: prev.lidos.registros.map(x => (apagados.has(String(x.professorId)) ? { ...x, professorId: idPrincipal } : x)),
      },
    }));
  };

  const aoLigar = (uid, professorId) => setEstado(prev => (!prev.lidos ? prev : {
    ...prev,
    lidos: {
      ...prev.lidos,
      registros: prev.lidos.registros.map(x => (x.origem === 'cracha' && x.id === uid ? { ...x, professorId } : x)),
    },
  }));

  // Crachás do grupo que ainda não estão ligados a nenhuma das fichas do grupo.
  const crachasSoltos = (itens, fichas) => {
    const vistos = new Set();
    return itens.filter(i => {
      if (i.origem !== 'cracha' || vistos.has(i.id)) return false;
      vistos.add(i.id);
      return !fichas.some(f => f.id === String(i.professorId) || f.uidLogin === i.id);
    });
  };

  const fichasDoGrupo = (itens) => {
    const ids = [...new Set(itens.filter(i => i.origem === 'professor').map(i => i.id))];
    return ids.map(id => professorPorId.get(id)).filter(Boolean).map(p => ({ ...p, id: String(p.id) }));
  };
  const origem = (o) => t(`backupTab.duplicates.origin.${o}`);
  const valorDoGrupo = (tipo, g) => (tipo === 'telefone' ? g.itens[0].telefone : g.valor);

  const baixarPlanilha = () => {
    const linha = (tipo, valor, item) => ({
      [t('backupTab.duplicates.sheet.type')]: t(`backupTab.duplicates.types.${tipo}`),
      [t('backupTab.duplicates.sheet.value')]: valor,
      [t('backupTab.duplicates.sheet.origin')]: origem(item.origem),
      [t('backupTab.duplicates.sheet.name')]: item.nome || '',
      [t('backupTab.duplicates.sheet.email')]: item.email || '',
      [t('backupTab.duplicates.sheet.phone')]: item.telefone || '',
      [t('backupTab.duplicates.sheet.detail')]: item.detalhe || '',
      [t('backupTab.duplicates.sheet.unit')]: item.unidade || '',
      [t('backupTab.duplicates.sheet.id')]: item.id,
    });
    const repetidos = TIPOS.flatMap(tipo => r[tipo].flatMap(g => g.itens.map(i => linha(tipo, valorDoGrupo(tipo, g), i))));
    const problemas = Object.entries(r.problemas).flatMap(([tipo, itens]) =>
      itens.map(i => linha(tipo, tipo === 'telefoneInvalido' ? i.telefone : (i.email || i.telefone || ''), i)));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(repetidos), t('backupTab.duplicates.sheet.duplicates').slice(0, 31));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(problemas), t('backupTab.duplicates.sheet.problems').slice(0, 31));
    XLSX.writeFile(wb, `REPETIDOS_${new Date().toLocaleDateString('en-CA')}.xlsx`);
  };

  const contagens = r ? [
    ...TIPOS.map(tipo => ({ chave: tipo, n: r[tipo].length, rotulo: t(`backupTab.duplicates.types.${tipo}`) })),
    ...Object.keys(r.problemas).map(tipo => ({ chave: tipo, n: r.problemas[tipo].length, rotulo: t(`backupTab.duplicates.types.${tipo}`) })),
  ] : [];

  const lista = r ? (TIPOS.includes(aberto)
    ? r[aberto].map(g => ({ chave: g.valor, titulo: valorDoGrupo(aberto, g), extra: t('backupTab.duplicates.people', { count: g.pessoas }), itens: g.itens }))
    : r.problemas[aberto].map((i, n) => ({
      chave: `${i.origem}_${i.id}_${n}`,
      titulo: aberto === 'telefoneInvalido' ? i.telefone : aberto === 'loginAntigo' ? (i.email || i.telefone || '—') : i.email,
      itens: [i],
    }))
  ) : [];

  return (
    <div className="md:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" /> {t('backupTab.duplicates.title')}
          </h3>
          <p className="text-sm text-slate-500 mt-1">{t('backupTab.duplicates.desc')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {r && (
            <button onClick={baixarPlanilha} className="py-2 px-3 border border-slate-300 dark:border-slate-600 rounded-lg flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
              <FileSpreadsheet className="w-4 h-4 text-green-600" /> {t('backupTab.duplicates.download')}
            </button>
          )}
          <button onClick={gerar} disabled={estado.carregando} className="py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-2 text-sm font-bold disabled:opacity-50">
            {estado.carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {r ? t('backupTab.duplicates.regenerate') : t('backupTab.duplicates.generate')}
          </button>
        </div>
      </div>

      {estado.erro && (
        <p className="p-3 rounded-lg bg-red-100 text-red-700 text-sm font-bold flex items-center gap-2">
          <TriangleAlert className="w-4 h-4 shrink-0" /> {t('backupTab.duplicates.error')}
        </p>
      )}

      {r && (
        <>
          <p className="text-[11px] text-slate-400 mb-3">
            {t('backupTab.duplicates.readSummary', { teachers: (catalogs?.professores || []).length, reads: estado.lidos.total })}
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {contagens.map(c => (
              <button key={c.chave} onClick={() => setAberto(c.chave)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${aberto === c.chave
                  ? 'bg-amber-600 border-amber-600 text-white'
                  : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                {c.rotulo}: {c.n}
              </button>
            ))}
          </div>
          {lista.length === 0 ? (
            <p className="text-sm text-slate-500">{t('backupTab.duplicates.none')}</p>
          ) : (
            <ul className="max-h-[28rem] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
              {lista.map(g => {
                const fichas = TIPOS.includes(aberto) ? fichasDoGrupo(g.itens) : [];
                const soltos = fichas.length ? crachasSoltos(g.itens, fichas) : [];
                return (
                <li key={g.chave} className="px-3 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 break-all">
                      {g.titulo} {g.extra && <span className="text-xs font-normal text-slate-400">({g.extra})</span>}
                    </p>
                    <div className="flex flex-wrap gap-1 shrink-0">
                      {fichas.length >= 2 && (
                        <button onClick={() => setJuntando(fichas)} className="py-1 px-2 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-1">
                          <Merge className="w-3.5 h-3.5" /> {t('backupTab.merge.button', { count: fichas.length })}
                        </button>
                      )}
                      {soltos.length >= 1 && (
                        <button onClick={() => setLigando({ fichas, crachas: soltos })} className="py-1 px-2 border border-sky-300 dark:border-sky-700 rounded-lg text-xs font-bold text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 flex items-center gap-1">
                          <Link2 className="w-3.5 h-3.5" /> {t('backupTab.link.button')}
                        </button>
                      )}
                    </div>
                  </div>
                  <ul className="mt-1 space-y-0.5">{g.itens.map((i, n) => <Item key={`${i.origem}_${i.id}_${n}`} item={i} rotuloOrigem={origem(i.origem)} />)}</ul>
                </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {juntando && (
        <JuntarFichasModal
          fichas={juntando}
          aoJuntar={aoJuntar}
          aoFechar={() => setJuntando(null)}
        />
      )}
      {ligando && (
        <LigarCrachaModal
          fichas={ligando.fichas}
          crachas={ligando.crachas}
          aoLigar={aoLigar}
          aoFechar={() => setLigando(null)}
        />
      )}
    </div>
  );
}
