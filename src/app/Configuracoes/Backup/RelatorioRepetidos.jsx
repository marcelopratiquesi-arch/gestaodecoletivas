// Relatório de repetidos (só admin): mesma pessoa com e-mail, telefone ou nome repetido entre professores
// da grade, crachás e pedidos de acesso — e a LIMPEZA direto daqui: buscar, juntar fichas, ligar ficha ao
// crachá e corrigir e-mail/telefone. Nunca lê nem mostra documento.
// Professores e unidades vêm do catálogo já carregado (0 leituras, atualiza sozinho); crachás e pedidos são
// lidos uma vez, ao clicar, e acompanham as correções feitas aqui.
import React, { useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';
import { Users, Loader2, FileSpreadsheet, Search, TriangleAlert, Merge, Link2, Pencil, X } from 'lucide-react';
import JuntarFichasModal from './JuntarFichasModal';
import LigarCrachaModal from './LigarCrachaModal';
import CriarReservas from './CriarReservas';
import CorrigirContatoModal from './CorrigirContatoModal';
import { db } from '../../../services/firebase';
import { useCatalogs } from '../../../contexts/CatalogContext';
import { normalizarPais } from '../../../utils/feriados';
import { formatRole } from '../../../utils/formatters';
import { acharRepetidos, analisarRepetidos, normalizarNome } from '../../../utils/repetidos';
import { planejarReservas } from '../../../utils/contatos';

// Listas de grupos. "Sem trava" vem primeiro: é o que falta limpar para o bloqueio valer para todo mundo.
const TIPOS = ['semTrava', 'mesma', 'outra', 'soNome'];
const CORRIGIVEL = new Set(['professor', 'cracha']);

// Busca por nome, e-mail ou telefone (só os números), sem ligar para acento e maiúscula.
const soNumeros = (v) => String(v || '').replace(/\D/g, '');
function combina(item, busca) {
  const b = busca.trim();
  if (!b) return true;
  const nome = normalizarNome(item.nome);
  const email = String(item.email || '').toLowerCase();
  const numeros = soNumeros(b);
  return nome.includes(normalizarNome(b))
    || email.includes(b.toLowerCase())
    || (numeros.length >= 4 && soNumeros(item.telefone).includes(numeros));
}

function Item({ item, rotuloOrigem, aoCorrigir, t }) {
  return (
    <li className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-1 py-0.5">
      <span className="font-bold text-slate-700 dark:text-slate-200">{rotuloOrigem}</span>
      <span>· {item.nome || '—'}</span>
      {item.detalhe && <span className="text-slate-400">· {item.detalhe}</span>}
      {item.unidade && <span className="text-slate-400">· {item.unidade}</span>}
      {item.email && <span className="text-slate-500 break-all">· {item.email}</span>}
      {item.telefone && <span className="text-slate-500">· {item.telefone}</span>}
      {aoCorrigir && CORRIGIVEL.has(item.origem) && (
        <button onClick={() => aoCorrigir(item)}
          className="ml-auto py-0.5 px-2 border border-slate-300 dark:border-slate-600 rounded-md text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1">
          <Pencil className="w-3 h-3" /> {t('backupTab.fix.button')}
        </button>
      )}
    </li>
  );
}

export default function RelatorioRepetidos() {
  const { t } = useTranslation();
  const { catalogs } = useCatalogs();
  // "lidos" guarda só crachás e pedidos (lidos uma vez); os professores vêm sempre do catálogo ao vivo,
  // então depois de juntar fichas o relatório se atualiza sozinho, sem ler de novo.
  const [estado, setEstado] = useState({ carregando: false, erro: false, lidos: null });
  const [aberto, setAberto] = useState('semTrava');
  const [busca, setBusca] = useState('');
  const [juntando, setJuntando] = useState(null);   // fichas da grade abertas na janela "Juntar fichas"
  const [ligando, setLigando] = useState(null);     // { fichas, crachas } da janela "Ligar ficha ao crachá"
  const [corrigindo, setCorrigindo] = useState(null); // registro aberto na janela "Corrigir"

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
    const todos = [...professores, ...estado.lidos.registros];
    const { mesmaPessoa, outraPessoa, soNome } = analisarRepetidos(todos);
    const problemas = acharRepetidos(todos).problemas;
    problemas.loginAntigo = estado.lidos.loginsAntigos;
    // Sem trava = o mesmo e-mail/telefone em pessoas diferentes (o mesmo cálculo do botão "Criar reservas").
    const { conflitos } = planejarReservas(todos);
    const valorDaChave = (id) => id.replace(/^email_|^tel_[A-Z]{2}:/, '');
    return {
      semTrava: conflitos.map(c => ({
        valor: c.id, titulo: `${t(`contacts.reserve.type.${c.tipo}`)}: ${valorDaChave(c.id)}`, itens: c.itens,
        pessoas: new Set(c.itens.map(i => `${i.origem}:${i.id}`)).size,
      })),
      mesma: mesmaPessoa.map((g, n) => ({ valor: `m${n}`, titulo: g.nome, itens: g.itens, fichas: g.itens.filter(i => i.origem === 'professor').length })),
      outra: outraPessoa.map(g => ({ valor: g.valor, titulo: g.itens[0].telefone, itens: g.itens, pessoas: g.grupos.length })),
      soNome: soNome.map(g => ({ valor: g.valor, titulo: g.itens[0].nome, itens: g.itens, pessoas: g.grupos.length })),
      problemas,
      todos,
    };
  }, [estado.lidos, catalogs?.professores, t]);

  const mudarCrachas = (fn) => setEstado(prev => (!prev.lidos ? prev : {
    ...prev, lidos: { ...prev.lidos, registros: prev.lidos.registros.map(fn) },
  }));

  // Depois de juntar: os crachás guardados aqui passam a apontar para a ficha que ficou (como no banco).
  const aoJuntar = (idPrincipal, idsApagados) => {
    const apagados = new Set(idsApagados.map(String));
    mudarCrachas(x => (apagados.has(String(x.professorId)) ? { ...x, professorId: idPrincipal } : x));
  };
  const aoLigar = (uid, professorId) => mudarCrachas(x => (x.origem === 'cracha' && x.id === uid ? { ...x, professorId } : x));
  // Ficha corrigida atualiza sozinha (catálogo ao vivo); crachá corrigido é acertado aqui.
  const aoCorrigir = (item, novo) => {
    if (item.origem === 'cracha') mudarCrachas(x => (x.origem === 'cracha' && x.id === item.id ? { ...x, telefone: novo.telefone } : x));
  };

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
    const repetidos = TIPOS.flatMap(tipo => r[tipo].flatMap(g => g.itens.map(i => linha(tipo, g.titulo, i))));
    const problemas = Object.entries(r.problemas).flatMap(([tipo, itens]) =>
      itens.map(i => linha(tipo, tipo === 'telefoneInvalido' ? i.telefone : (i.email || i.telefone || ''), i)));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(repetidos), t('backupTab.duplicates.sheet.duplicates').slice(0, 31));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(problemas), t('backupTab.duplicates.sheet.problems').slice(0, 31));
    XLSX.writeFile(wb, `REPETIDOS_${new Date().toLocaleDateString('en-CA')}.xlsx`);
  };

  // Grupos de cada lista, já filtrados pela busca (o grupo aparece se ALGUÉM dele combina).
  const gruposDe = (tipo) => {
    if (!r) return [];
    if (TIPOS.includes(tipo)) {
      return r[tipo]
        .filter(g => g.itens.some(i => combina(i, busca)))
        .map(g => ({
          chave: g.valor, titulo: g.titulo, itens: g.itens,
          extra: tipo === 'mesma' ? t('backupTab.duplicates.cards', { count: g.fichas }) : t('backupTab.duplicates.people', { count: g.pessoas }),
        }));
    }
    return r.problemas[tipo]
      .filter(i => combina(i, busca))
      .map((i, n) => ({
        chave: `${i.origem}_${i.id}_${n}`,
        titulo: tipo === 'telefoneInvalido' ? i.telefone : tipo === 'loginAntigo' ? (i.email || i.telefone || '—') : i.email,
        itens: [i],
      }));
  };

  const contagens = r ? [
    ...TIPOS.map(tipo => ({ chave: tipo, n: gruposDe(tipo).length, rotulo: t(`backupTab.duplicates.types.${tipo}`) })),
    ...Object.keys(r.problemas).map(tipo => ({ chave: tipo, n: gruposDe(tipo).length, rotulo: t(`backupTab.duplicates.types.${tipo}`) })),
  ] : [];
  const lista = gruposDe(aberto);
  const podeCorrigir = aberto !== 'loginAntigo';

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
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> {t('backupTab.duplicates.download')}
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
          <CriarReservas registros={r.todos} conflitos={r.semTrava.length} />

          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={t('backupTab.duplicates.searchPlaceholder')}
              className="w-full pl-9 pr-9 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100" />
            {busca && (
              <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700" title={t('common.multiSelect.clear')}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            {contagens.map(c => (
              <button key={c.chave} onClick={() => setAberto(c.chave)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${aberto === c.chave
                  ? 'bg-amber-600 border-amber-600 text-white'
                  : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                {c.rotulo}: {c.n}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mb-3">{t(`backupTab.duplicates.help.${aberto}`, '')}</p>

          {lista.length === 0 ? (
            <p className="text-sm text-slate-500">{busca ? t('backupTab.duplicates.noMatch') : t('backupTab.duplicates.none')}</p>
          ) : (
            <ul className="max-h-[32rem] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
              {lista.map(g => {
                const fichas = fichasDoGrupo(g.itens);
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
                        <button onClick={() => setLigando({ fichas, crachas: soltos })} className="py-1 px-2 border border-red-300 dark:border-red-700 rounded-lg text-xs font-bold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1">
                          <Link2 className="w-3.5 h-3.5" /> {t('backupTab.link.button')}
                        </button>
                      )}
                    </div>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {g.itens.map((i, n) => (
                      <Item key={`${i.origem}_${i.id}_${n}`} item={i} rotuloOrigem={origem(i.origem)} t={t}
                        aoCorrigir={podeCorrigir ? setCorrigindo : null} />
                    ))}
                  </ul>
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
      {corrigindo && (
        <CorrigirContatoModal
          item={corrigindo}
          todos={r?.todos || []}
          rotuloOrigem={origem}
          aoCorrigir={aoCorrigir}
          aoFechar={() => setCorrigindo(null)}
        />
      )}
    </div>
  );
}
