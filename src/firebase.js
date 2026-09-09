import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAonypGwlK-DWg8BjLVMRhMEgfVPOP77Uo",
  authDomain: "me-connect-15aa9.firebaseapp.com",
  projectId: "me-connect-15aa9",
  storageBucket: "me-connect-15aa9.firebasestorage.app",
  messagingSenderId: "177725109984",
  appId: "1:177725109984:web:6de7462836f9b333b88285"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
