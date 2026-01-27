import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDT0zOAzIoUGm5XZ4yw34Fxuhh2Gbd9iZw",
  authDomain: "gestaopratiquecoletivas.firebaseapp.com",
  projectId: "gestaopratiquecoletivas",
  storageBucket: "gestaopratiquecoletivas.appspot.com",
  messagingSenderId: "728545652688",
  appId: "1:728545652688:web:ec76c253d70501e4dbd3d5",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
