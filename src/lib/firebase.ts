import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB9fXul1pKxb_IJ2nqvlfeIP3qtXT7jYLg",
  authDomain: "bbuch-edba7.firebaseapp.com",
  projectId: "bbuch-edba7",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);