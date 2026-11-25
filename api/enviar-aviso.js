/* global process */
// Envia aviso (notificação) para o celular/computador da equipe. SÓ O ADMIN pode usar.
// Roda na Vercel (servidor). A chave de serviço do Firebase fica na variável FIREBASE_SERVICE_ACCOUNT (nunca no site nem no GitHub).
// Corpo (POST, JSON): { titulo, texto, link?, destino, destinoResumo?, somenteContar? }
//   destino = { tipo: 'filtro', papeis: [], unidadeIds: [] }  (vazio = todos)   |   { tipo: 'pessoas', uids: [] }
import admin from 'firebase-admin';
import { escolherDestinatarios, montarMensagem, validarAviso, ehAdmin } from './_avisos.js';

function iniciar() {
  if (admin.apps.length) return;
  const bruto = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!bruto) throw new Error('SEM_CHAVE');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(bruto)) });
}

const lerTudo = async (db, nome) => (await db.collection(nome).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' });
  try {
    iniciar();
  } catch (e) {
    return res.status(500).json({ erro: e.message === 'SEM_CHAVE' ? 'O servidor ainda não tem a chave do Firebase (FIREBASE_SERVICE_ACCOUNT).' : 'Chave do Firebase inválida no servidor.' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ erro: 'Entre no sistema para enviar aviso.' });
  let uid;
  try { uid = (await admin.auth().verifyIdToken(token)).uid; } catch { return res.status(401).json({ erro: 'Sessão inválida. Entre de novo.' }); }

  const db = admin.firestore();
  const meu = await db.doc(`usuarios/${uid}`).get();
  if (!meu.exists || !ehAdmin(meu.data())) return res.status(403).json({ erro: 'Só o administrador envia avisos.' });

  let corpo;
  try { corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { return res.status(400).json({ erro: 'Pedido inválido.' }); }
  const erroDeCampo = validarAviso(corpo);
  if (erroDeCampo) return res.status(400).json({ erro: erroDeCampo });

  const [usuarios, professores, vinculos, aparelhos] = await Promise.all([
    lerTudo(db, 'usuarios'), lerTudo(db, 'professores'), lerTudo(db, 'vinculos'), lerTudo(db, 'push_aparelhos'),
  ]);
  const pessoas = escolherDestinatarios({ usuarios, professores, vinculos, destino: corpo.destino });
  const uidsAlvo = new Set(pessoas.map((p) => p.id));
  const aparelhosAlvo = aparelhos.filter((a) => uidsAlvo.has(a.uid) && a.token);
  const uidsComAviso = new Set(aparelhosAlvo.map((a) => a.uid));
  const resumo = {
    pessoas: pessoas.length,
    pessoasComAviso: uidsComAviso.size,
    pessoasSemAviso: pessoas.length - uidsComAviso.size,
    aparelhos: aparelhosAlvo.length,
    nomesSemAviso: pessoas.filter((p) => !uidsComAviso.has(p.id)).map((p) => p.nome || p.email || p.id).slice(0, 50),
  };
  if (corpo.somenteContar) return res.status(200).json(resumo);
  if (!aparelhosAlvo.length) return res.status(400).json({ erro: 'Ninguém desse grupo ativou os avisos ainda.', ...resumo });

  let sucesso = 0;
  let falhas = 0;
  const invalidos = [];
  for (let i = 0; i < aparelhosAlvo.length; i += 500) {
    const lote = aparelhosAlvo.slice(i, i + 500);
    const r = await admin.messaging().sendEachForMulticast({ tokens: lote.map((a) => a.token), ...montarMensagem(corpo) });
    r.responses.forEach((x, k) => {
      if (x.success) { sucesso += 1; return; }
      falhas += 1;
      const cod = x.error?.code || '';
      if (cod.includes('registration-token-not-registered') || cod.includes('invalid-registration-token') || cod.includes('invalid-argument')) invalidos.push(lote[k].id);
    });
  }
  await Promise.all(invalidos.map((id) => db.doc(`push_aparelhos/${id}`).delete().catch(() => {})));

  const { nomesSemAviso, ...contagem } = resumo;
  await db.collection('avisos_enviados').add({
    titulo: corpo.titulo.trim(), texto: corpo.texto.trim(), link: corpo.link || '',
    destino: corpo.destino, destinoResumo: String(corpo.destinoResumo || '').slice(0, 300),
    enviadoPor: uid, enviadoPorNome: meu.data().nome || '', enviadoEm: admin.firestore.FieldValue.serverTimestamp(),
    ...contagem, entregues: sucesso, falhas, aparelhosLimpos: invalidos.length,
  });
  return res.status(200).json({ ...contagem, nomesSemAviso, entregues: sucesso, falhas });
}
