/* Shared cloud state for the whole family — same Firebase project as the original file.
   Exposes window.TripSync; every screen writes through it so all phones stay in step.
   Falls back to localStorage when offline, and replays nothing (Firestore is the truth). */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, deleteDoc, collection, onSnapshot, query, orderBy, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVjHOPDv3bA95wxxCZb4BMDojyDPbL1Ok",
  authDomain: "japan-app-47ec2.firebaseapp.com",
  projectId: "japan-app-47ec2",
  storageBucket: "japan-app-47ec2.firebasestorage.app",
  messagingSenderId: "291308253439",
  appId: "1:291308253439:web:3b4738d3f3d4f6ca03dcca"
};

let db = null;
try { db = getFirestore(initializeApp(firebaseConfig)); } catch (e) { console.warn("sync off", e); }

const cache = (k, v) => {
  try {
    if (v === undefined) { const s = localStorage.getItem("trip::" + k); return s ? JSON.parse(s) : null; }
    localStorage.setItem("trip::" + k, JSON.stringify(v));
  } catch (e) { /* private mode */ }
  return null;
};

const TripSync = {
  ready: !!db,
  /* One shared document of arbitrary JSON, e.g. notes, checklists, votes. */
  listenDoc(id, cb) {
    const local = cache("doc:" + id);
    if (local) cb(local);
    if (!db) return () => {};
    return onSnapshot(doc(db, "shared", id), (snap) => {
      const data = snap.exists() ? (snap.data().v ?? {}) : {};
      cache("doc:" + id, data);
      cb(data);
    }, (e) => console.warn("listenDoc", id, e));
  },
  setDoc(id, value) {
    cache("doc:" + id, value);
    if (!db) return Promise.resolve();
    return setDoc(doc(db, "shared", id), { v: value, at: Date.now() }).catch((e) => console.warn("setDoc", e));
  },
  /* A growing list, newest last — expenses live here. */
  listenList(name, cb) {
    const local = cache("list:" + name);
    if (local) cb(local);
    if (!db) return () => {};
    return onSnapshot(query(collection(db, name), orderBy("ts", "asc")), (snap) => {
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      cache("list:" + name, rows);
      cb(rows);
    }, (e) => console.warn("listenList", name, e));
  },
  addToList(name, obj) {
    if (!db) return Promise.resolve();
    return addDoc(collection(db, name), { ts: Date.now(), ...obj }).catch((e) => console.warn("addToList", e));
  },
  removeFromList(name, id) {
    if (!db) return Promise.resolve();
    return deleteDoc(doc(db, name, id)).catch((e) => console.warn("removeFromList", e));
  },
  /* Expenses keep the original file's collection and schema, so everything the
     family already entered still shows up. */
  listenExpenses(cb) {
    const local = cache("expenses");
    if (local) cb(local);
    if (!db) return () => {};
    return onSnapshot(query(collection(db, "tripExpenses"), orderBy("id", "asc")), (snap) => {
      const rows = [];
      snap.forEach((d) => rows.push(d.data()));
      cache("expenses", rows);
      cb(rows);
    }, (e) => console.warn("listenExpenses", e));
  },
  saveExpense(entry) {
    if (!db) return Promise.resolve();
    return setDoc(doc(db, "tripExpenses", String(entry.id)), entry);
  },
  deleteExpense(id) {
    if (!db) return Promise.resolve();
    return deleteDoc(doc(db, "tripExpenses", String(id)));
  }
};

window.TripSync = TripSync;
window.dispatchEvent(new Event("tripsync-ready"));
