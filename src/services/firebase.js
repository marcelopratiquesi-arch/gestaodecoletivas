import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";

// ⚠️ ATENÇÃO COMANDANTE: MANTENHA AS SUAS CHAVES REAIS AQUI DENTRO!
const firebaseConfig = {
  apiKey: "AIzaSyDT0zOAzIoUGm5XZ4yw34Fxuhh2Gbd9iZw",
  authDomain: "gestaopratiquecoletivas.firebaseapp.com",
  projectId: "gestaopratiquecoletivas",
  storageBucket: "gestaopratiquecoletivas.appspot.com",
  messagingSenderId: "728545652688",
  appId: "1:728545652688:web:ec76c253d70501e4dbd3d5",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

// 🟢 A MÁGICA DA PERSISTÊNCIA OFFLINE MODERNA (CACHE DE DISCO)
// Esta é a API mais recente do Firebase v9+. Ela faz cache no HD do usuário 
// e gerencia perfeitamente se ele abrir várias abas do sistema ao mesmo tempo.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export { app, auth, db, storage };