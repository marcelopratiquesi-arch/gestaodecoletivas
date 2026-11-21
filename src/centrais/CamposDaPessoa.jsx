// Campos que TODA Central de pessoa (mentor, líder, professor) mostra no quadro de cadastro:
// o documento (CPF/DNI/SSN, com copiar) e o último acesso (data e hora). Cada um faz UMA leitura quando a ficha abre
// e só se a pessoa logada tem direito (o banco também confere). PADRÃO: não deixar a Central sem esses dois campos.
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { IdCard, Landmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '../services/firebase';
import { formatarDocumento } from '../utils/documento';
import { formatarNascimento } from '../utils/nascimento';
import { lerNascimento } from '../services/meuCadastroService';
import { lerDadosBancarios } from '../services/dadosBancariosService';
import { formatarConta, NOME_BANCO } from '../utils/dadosBancarios';
import { Campo } from './pecas/Basicos';
import Contato from './pecas/Contato';
import { UltimoAcessoTexto } from './secoes';

// Lê algo uma vez por `chave` e devolve { carregando, dado, erro }. Só lê se `pode`.
function useLeituraUnica(pode, chave, leitor) {
  const [estado, setEstado] = useState({ chave: null, dado: null, erro: false });
  useEffect(() => {
    if (!pode || !chave) return undefined;
    let vivo = true;
    leitor(chave)
      .then((dado) => { if (vivo) setEstado({ chave, dado, erro: false }); })
      .catch((e) => { console.error(e); if (vivo) setEstado({ chave, dado: null, erro: true }); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pode, chave]);
  const pronto = estado.chave === chave;
  return { carregando: pode && !!chave && !pronto, dado: pronto ? estado.dado : null, erro: pronto && estado.erro };
}

// Documento da pessoa. `leitor(chave)` devolve { tipo, numero } ou null. Sem direito de ver, não mostra o campo.
export function CampoDocumento({ pode, chave, leitor, rotulo }) {
  const { t } = useTranslation();
  const { carregando, dado, erro } = useLeituraUnica(pode, chave, leitor);
  if (!pode) return null;
  const nome = dado?.tipo ? dado.tipo.toUpperCase() : null;
  return (
    <Campo rotulo={rotulo || (nome ? `${t('centrais.cadastro.documento')} (${nome})` : t('centrais.cadastro.documento'))} falta={!carregando && !dado}>
      {carregando ? '…' : erro ? t('centrais.naoCarregou') : dado
        ? <Contato icone={IdCard} texto={formatarDocumento(dado.tipo, dado.numero)} copiar />
        : t('centrais.naoInformado')}
    </Campo>
  );
}

// Data de nascimento (gaveta privada nascimentos/{login}): só admin, mentor e líder da unidade leem (o banco confere).
// Sem login ainda, não há onde ler: aparece "não informado".
// Banco Inter do professor do Brasil (gaveta dados_bancarios/{login}): a própria pessoa, admin, mentor e líder da unidade leem.
export function CampoBancoInter({ pode, uid }) {
  const { t } = useTranslation();
  const { carregando, dado, erro } = useLeituraUnica(pode && !!uid, uid, lerDadosBancarios);
  if (!pode) return null;
  return (
    <Campo rotulo={NOME_BANCO} falta={!carregando && !dado}>
      {carregando ? '…' : erro ? t('centrais.naoCarregou') : dado
        ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5"><span className="text-[10px] font-black uppercase text-slate-500">{t('centrais.cadastro.agencia')}</span><Contato icone={Landmark} texto={dado.agencia} copiar /></div>
            <div className="flex items-center gap-1.5"><span className="text-[10px] font-black uppercase text-slate-500">{t('centrais.cadastro.conta')}</span><Contato icone={Landmark} texto={formatarConta(dado.conta)} copiar /></div>
          </div>
        )
        : t('centrais.naoInformado')}
    </Campo>
  );
}

export function CampoNascimento({ pode, uid }) {
  const { t } = useTranslation();
  const { carregando, dado, erro } = useLeituraUnica(pode && !!uid, uid, lerNascimento);
  if (!pode) return null;
  return (
    <Campo rotulo={t('centrais.cadastro.nascimento')} falta={!carregando && !dado}>
      {carregando ? '…' : erro ? t('centrais.naoCarregou') : dado ? formatarNascimento(dado) : t('centrais.naoInformado')}
    </Campo>
  );
}

// Último acesso: usa `quando` se já veio na lista (mentor); senão lê usuarios/{uid} (líder e professor com login).
export function CampoUltimoAcesso({ quando, uid }) {
  const { t } = useTranslation();
  const precisaLer = !quando && !!uid;
  const { carregando, dado } = useLeituraUnica(precisaLer, uid, async (id) => {
    const snap = await getDoc(doc(db, 'usuarios', String(id)));
    return snap.exists() ? snap.data().ultimoAcesso || null : null;
  });
  return (
    <Campo rotulo={t('centrais.ultimoAcessoRotulo')}>
      {carregando ? '…' : <UltimoAcessoTexto quando={quando || dado} />}
    </Campo>
  );
}
