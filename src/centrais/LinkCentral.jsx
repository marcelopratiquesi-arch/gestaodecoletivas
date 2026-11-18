import { Building2, IdCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useCatalogs } from '../contexts/CatalogContext';
import { abrirCentral } from './abrirCentral';
import { acessoCentral, resolverAlvo } from './acessos';

// Nome clicável que abre uma Central por cima da tela (ou da ficha) atual.
//   <LinkCentral tipo="professor" alvo={professor}>{professor.nome}</LinkCentral>
//   tipo: 'unidade' | 'professor' | 'mentor' | 'lider' | 'lider2' (o alvo do líder é a unidade dele; 'lider2' = 2º líder)
// Quem não pode abrir aquela ficha vê só o texto, sem clique (ninguém clica para tomar um "não pode").
export default function LinkCentral({ tipo, alvo, className = '', children }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { catalogs } = useCatalogs();
  const registro = resolverAlvo(tipo, alvo, catalogs);
  const pode = !!acessoCentral(tipo, registro, userData, catalogs);

  if (!pode) return <span className={className}>{children}</span>;

  const Icone = tipo === 'unidade' ? Building2 : IdCard;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); abrirCentral(tipo, registro); }}
      title={t(`centrais.abrirFicha.${tipo === 'lider2' ? 'lider' : tipo}`)}
      className={`group/central inline-flex items-center gap-1.5 text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors max-w-full ${className}`}
    >
      <span className="group-hover/central:underline min-w-0 break-words">{children}</span>
      <Icone className="w-3.5 h-3.5 shrink-0 text-blue-500 opacity-60 group-hover/central:opacity-100" />
    </button>
  );
}
