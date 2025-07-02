// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBDU_wlgy13AXtCLdFiXzWzUcShSw9D-m8",
  authDomain: "sys-v2-5486e.firebaseapp.com",
  projectId: "sys-v2-5486e",
  storageBucket: "sys-v2-5486e.firebasestorage.app",
  messagingSenderId: "930234849632",
  appId: "1:930234849632:web:1320c422781617e1056605"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
