// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB9fXul1pKxb_IJ2nqvlfeIP3qtXT7jYLg",
  authDomain: "bbuch-edba7.firebaseapp.com",
  databaseURL: "https://bbuch-edba7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bbuch-edba7",
  storageBucket: "bbuch-edba7.firebasestorage.app",
  messagingSenderId: "1044565839577",
  appId: "1:1044565839577:web:f17c280f3c56c64167b8c8",
  measurementId: "G-N89MRCRRNF"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
