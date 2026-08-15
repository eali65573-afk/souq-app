import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// إعدادات مشروع Firebase الخاص بالسوق المفتوح
const firebaseConfig = {
  apiKey: "AIzaSyATXTpf0_-VUGzlFZba0Fd8RceG68HQs4s",
  authDomain: "souq-al-maftouh.firebaseapp.com",
  projectId: "souq-al-maftouh",
  storageBucket: "souq-al-maftouh.firebasestorage.app",
  messagingSenderId: "244245007903",
  appId: "1:244245007903:web:88d2acee851c86c5b00f2a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
