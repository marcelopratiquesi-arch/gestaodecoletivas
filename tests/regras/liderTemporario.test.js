// Líder temporário: convite pelo e-mail do Google (admin ou mentor das unidades), crachá com prazo
// (temporarioAte) que deixa de valer sozinho, e o mentor que prorroga, encerra ou efetiva.
// Rodar: npm run test:regras
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, writeBatch, deleteField, serverTimestamp, Timestamp, query, where, collection } from 'firebase/firestore';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gestao-pratique',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(globalThis.process?.env?.FIRESTORE_EMULATOR_HOST?.split(':').pop() || 8080) },
  });
});
afterAll(async () => { await env?.cleanup(); });

const DIA = 24 * 60 * 60 * 1000;
const daqui = (dias) => Timestamp.fromMillis(Date.now() + dias * DIA);
const EMAIL = 'temp@gmail.com';
// Prazos fixos: o crachá tem que copiar EXATAMENTE o do convite (mesmo milissegundo).
const ATE = daqui(10);
const ATE_VENCIDO = daqui(-1);

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { role: 'admin', nome: 'Admin' });
    await setDoc(doc(db, 'usuarios/mentor1'), { role: 'mentor', nome: 'Mentor 1' });
    await setDoc(doc(db, 'usuarios/mentor2'), { role: 'mentor', nome: 'Mentor 2' });
    await setDoc(doc(db, 'usuarios/liderA'), { role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Líder A' });
    await setDoc(doc(db, 'unidades/uniA'), { nome: 'Unidade A', mentorId: 'mentor1' });
    await setDoc(doc(db, 'unidades/uniA2'), { nome: 'Unidade A2', mentorId: 'mentor1' });
    await setDoc(doc(db, 'unidades/uniB'), { nome: 'Unidade B', mentorId: 'mentor2' });
  });
});

const como = (uid) => env.authenticatedContext(uid).firestore();
const google = (uid, email = EMAIL) =>
  env.authenticatedContext(uid, { email, email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore();

const convite = (extra = {}) => ({
  papel: 'lider', status: 'pendente', email: EMAIL, nome: 'Líder Temporário', telefone: '(31) 99999-0000', pais: 'BR',
  unidadeId: 'uniA', unidadeIds: ['uniA'], temporarioAte: ATE, mentorId: 'mentor1', criadoPor: 'mentor1', ...extra,
});
const conviteNoBanco = (extra = {}) => env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), `convites_acesso/${EMAIL}`), convite(extra));
});
const noConvite = (db) => doc(db, `convites_acesso/${EMAIL}`);

// Aceitar = criar o crachá e marcar o convite como usado na mesma gravação.
const aceitar = (db, uid, c = convite(), extra = {}) => {
  const b = writeBatch(db);
  b.set(doc(db, `usuarios/${uid}`), {
    nome: c.nome, email: EMAIL, telefone: c.telefone, pais: c.pais, role: 'lider', loginGoogle: true,
    criadoPor: c.criadoPor, criadoEm: serverTimestamp(), unidadeId: c.unidadeIds[0], unidadeIds: c.unidadeIds,
    temporarioAte: c.temporarioAte, temporarioDesde: serverTimestamp(), ...extra,
  });
  b.update(noConvite(db), { status: 'usado', usadoPor: uid });
  return b.commit();
};

const temporarioNoBanco = (uid, extra = {}) => env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), `usuarios/${uid}`), {
    role: 'lider', unidadeId: 'uniA', unidadeIds: ['uniA'], nome: 'Temp', loginGoogle: true,
    temporarioDesde: daqui(-5), temporarioAte: daqui(5), ...extra,
  });
});

describe('convite de líder temporário', () => {
  it('admin e o mentor da unidade criam; outro mentor, líder e estranho não', async () => {
    await assertSucceeds(setDoc(noConvite(como('admin1')), convite({ criadoPor: 'admin1' })));
    await assertSucceeds(setDoc(noConvite(como('mentor1')), convite()));
    await assertFails(setDoc(noConvite(como('mentor2')), convite({ mentorId: 'mentor2', criadoPor: 'mentor2' })));
    await assertFails(setDoc(noConvite(como('liderA')), convite({ criadoPor: 'liderA' })));
    await assertFails(setDoc(noConvite(google('estranho', 'estranho@gmail.com')), convite({ email: EMAIL, criadoPor: 'estranho' })));
  });
  it('o mentor só convida para unidades dele (todas elas)', async () => {
    await assertSucceeds(setDoc(noConvite(como('mentor1')), convite({ unidadeIds: ['uniA', 'uniA2'] })));
    await assertFails(setDoc(noConvite(como('mentor1')), convite({ unidadeId: 'uniB', unidadeIds: ['uniB'] })));
    await assertFails(setDoc(noConvite(como('mentor1')), convite({ unidadeIds: ['uniA', 'uniB'] })));
  });
  it('prazo: não pode estar no passado nem passar de 61 dias', async () => {
    await assertFails(setDoc(noConvite(como('mentor1')), convite({ temporarioAte: daqui(-1) })));
    await assertFails(setDoc(noConvite(como('mentor1')), convite({ temporarioAte: daqui(90) })));
    await assertSucceeds(setDoc(noConvite(como('mentor1')), convite({ temporarioAte: daqui(60) })));
  });
  it('o mentor cancela o convite dele, mas não o de outro mentor', async () => {
    await conviteNoBanco();
    await assertSucceeds(updateDoc(noConvite(como('mentor1')), { status: 'cancelado' }));
    await conviteNoBanco({ unidadeId: 'uniB', unidadeIds: ['uniB'], mentorId: 'mentor2', criadoPor: 'mentor2' });
    await assertFails(updateDoc(noConvite(como('mentor1')), { status: 'cancelado' }));
  });
  it('o admin cancela o convite que o mentor criou', async () => {
    await conviteNoBanco();
    await assertSucceeds(updateDoc(noConvite(como('admin1')), { status: 'cancelado' }));
  });
  it('o mentor lê os convites dele pela consulta por mentorId; não os de outro', async () => {
    await conviteNoBanco();
    await assertSucceeds(getDocs(query(collection(como('mentor1'), 'convites_acesso'), where('mentorId', '==', 'mentor1'), where('papel', '==', 'lider'))));
    await assertFails(getDocs(query(collection(como('mentor2'), 'convites_acesso'), where('mentorId', '==', 'mentor1'), where('papel', '==', 'lider'))));
    await assertFails(getDoc(noConvite(como('liderA'))));
  });
  it('convite de mentor continua só do admin (mentor não lê nem cria)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'convites_acesso/m@gmail.com'), { papel: 'mentor', status: 'pendente', email: 'm@gmail.com', mentorId: 'mentor1' });
    });
    await assertFails(getDoc(doc(como('mentor1'), 'convites_acesso/m@gmail.com')));
  });
});

describe('a pessoa convidada entra como líder temporária', () => {
  it('cria o crachá com as unidades e o prazo do convite e passa a ter acesso', async () => {
    await conviteNoBanco({ unidadeIds: ['uniA', 'uniA2'] });
    await assertSucceeds(aceitar(google('temp1'), 'temp1', convite({ unidadeIds: ['uniA', 'uniA2'] })));
  });
  it('depois de entrar, lê as unidades dele', async () => {
    await conviteNoBanco();
    await assertSucceeds(aceitar(google('temp1'), 'temp1'));
    await assertSucceeds(getDoc(doc(google('temp1'), 'unidades/uniA')));
  });
  it('não muda unidades, prazo, papel nem dados do convite', async () => {
    await conviteNoBanco();
    const db = google('temp1');
    await assertFails(aceitar(db, 'temp1', convite(), { unidadeId: 'uniB', unidadeIds: ['uniB'] }));
    await assertFails(aceitar(db, 'temp1', convite(), { unidadeIds: ['uniA', 'uniB'] }));
    await assertFails(aceitar(db, 'temp1', convite(), { temporarioAte: daqui(60) }));
    await assertFails(aceitar(db, 'temp1', convite(), { role: 'admin' }));
    await assertFails(aceitar(db, 'temp1', convite(), { nome: 'Outro Nome' }));
    await assertFails(aceitar(db, 'temp1', convite(), { professorId: 'p1' }));
  });
  it('sem o prazo (crachá de líder comum) não serve', async () => {
    await conviteNoBanco();
    const db = google('temp1');
    const b = writeBatch(db);
    b.set(doc(db, 'usuarios/temp1'), { nome: 'Líder Temporário', email: EMAIL, telefone: '(31) 99999-0000', pais: 'BR', role: 'lider', loginGoogle: true, criadoPor: 'mentor1', unidadeId: 'uniA', unidadeIds: ['uniA'] });
    await assertFails(b.commit());
  });
  it('convite de outro e-mail, cancelado ou vencido não serve', async () => {
    await conviteNoBanco();
    await assertFails(aceitar(google('intruso', 'intruso@gmail.com'), 'intruso'));
    await conviteNoBanco({ status: 'cancelado' });
    await assertFails(aceitar(google('temp1'), 'temp1'));
    await conviteNoBanco({ temporarioAte: ATE_VENCIDO });
    await assertFails(aceitar(google('temp1'), 'temp1', convite({ temporarioAte: ATE_VENCIDO })));
  });
});

describe('prazo vencido corta o acesso sozinho', () => {
  it('dentro do prazo lê e grava; vencido não faz mais nada', async () => {
    await temporarioNoBanco('tempOk');
    await temporarioNoBanco('tempVencido', { temporarioAte: daqui(-1) });
    await assertSucceeds(getDoc(doc(como('tempOk'), 'unidades/uniA')));
    await assertFails(getDoc(doc(como('tempVencido'), 'unidades/uniA')));
    await assertFails(setDoc(doc(como('tempVencido'), 'unidades/uniA'), { nome: 'X', mentorId: 'mentor1' }));
  });
  it('o líder temporário não prorroga o próprio prazo', async () => {
    await temporarioNoBanco('tempOk');
    await assertFails(updateDoc(doc(como('tempOk'), 'usuarios/tempOk'), { temporarioAte: daqui(60) }));
    await assertFails(updateDoc(doc(como('tempOk'), 'usuarios/tempOk'), { temporarioAte: deleteField(), temporarioDesde: deleteField() }));
  });
});

describe('mentor e admin cuidam do líder temporário', () => {
  it('o mentor prorroga e encerra o temporário das unidades dele', async () => {
    await temporarioNoBanco('temp1');
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'usuarios/temp1'), { temporarioAte: daqui(30) }));
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'usuarios/temp1'), { temporarioAte: Timestamp.now() }));
  });
  it('não prorroga além de 61 dias nem mexe em outra coisa junto', async () => {
    await temporarioNoBanco('temp1');
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/temp1'), { temporarioAte: daqui(100) }));
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/temp1'), { temporarioAte: daqui(30), role: 'mentor' }));
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/temp1'), { temporarioAte: daqui(30), unidadeIds: ['uniA', 'uniB'] }));
  });
  it('o mentor reativa um temporário que já venceu (prorrogando)', async () => {
    await temporarioNoBanco('temp1', { temporarioAte: daqui(-2) });
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'usuarios/temp1'), { temporarioAte: daqui(7) }));
    await assertSucceeds(getDoc(doc(como('temp1'), 'unidades/uniA')));
  });
  it('efetiva como líder de verdade (apaga o prazo)', async () => {
    await temporarioNoBanco('temp1');
    await assertSucceeds(updateDoc(doc(como('mentor1'), 'usuarios/temp1'), { temporarioAte: deleteField(), temporarioDesde: deleteField() }));
    await assertSucceeds(getDoc(doc(como('temp1'), 'unidades/uniA')));
  });
  it('outro mentor não mexe no temporário alheio; admin mexe', async () => {
    await temporarioNoBanco('temp1');
    await assertFails(updateDoc(doc(como('mentor2'), 'usuarios/temp1'), { temporarioAte: daqui(30) }));
    await assertFails(updateDoc(doc(como('liderA'), 'usuarios/temp1'), { temporarioAte: daqui(30) }));
    await assertSucceeds(updateDoc(doc(como('admin1'), 'usuarios/temp1'), { temporarioAte: daqui(30) }));
  });
  it('líder comum (sem prazo) não ganha prazo pelo mentor', async () => {
    await assertFails(updateDoc(doc(como('mentor1'), 'usuarios/liderA'), { temporarioAte: daqui(30) }));
  });
});
