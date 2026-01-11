import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB2nCXPlY7m4V-Rt5gzeUqNpy-ow7PBRzY",
  authDomain: "daamal-414d3.firebaseapp.com",
  projectId: "daamal-414d3",
  storageBucket: "daamal-414d3.firebasestorage.app",
  messagingSenderId: "272480064718",
  appId: "1:272480064718:web:945e7b37ec5cf5fc952c9f",
  measurementId: "G-SK9T89VMLB"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
