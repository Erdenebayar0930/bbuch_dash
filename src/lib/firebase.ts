import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: 'AIzaSyB2nCXPlY7m4V-Rt5gzeUqNpy-ow7PBRzY',
  authDomain: 'daamal-414d3.firebaseapp.com',
  projectId: 'daamal-414d3',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);