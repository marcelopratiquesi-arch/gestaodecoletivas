import LinkCentral from './LinkCentral';

// Nome de unidade clicável (com o prediozinho): abre a Central da Unidade por cima da tela atual.
// Use em qualquer tabela/lista: <LinkUnidade unidade={u} className="...">{u.nome}</LinkUnidade>
export default function LinkUnidade({ unidade, className = '', children }) {
  return <LinkCentral tipo="unidade" alvo={unidade} className={className}>{children ?? unidade?.nome}</LinkCentral>;
}
