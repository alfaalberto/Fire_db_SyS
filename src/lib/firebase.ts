// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDHHSmJW3oRjPFD29At5xDePkEeGvF6Qws",
  authDomain: "sys-v2-nuevo.firebaseapp.com",
  projectId: "sys-v2-nuevo",
  storageBucket: "sys-v2-nuevo.firebasestorage.app",
  messagingSenderId: "319727149676",
  appId: "1:319727149676:web:f783c86ca3b1e556ee6e49"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
