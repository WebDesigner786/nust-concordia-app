import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc,
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBQll-wAz36amMDnLPKbcj3C0nY4AojZ5k",
  authDomain: "nust-concordia-app.firebaseapp.com",
  projectId: "nust-concordia-app",
  storageBucket: "nust-concordia-app.firebasestorage.app",
  messagingSenderId: "694851144935",
  appId: "1:694851144935:web:d5b4b37a7af7f705ac6642",
  measurementId: "G-JMGGMQW8SL"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  app,
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
};
