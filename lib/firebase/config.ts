// Firebase Configuration for MY DX
// NOTE: Firebase is currently NOT USED in the project
// This file is kept for future reference but imports are disabled to avoid compilation errors

// Uncomment below if Firebase is needed in the future:
/*
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

// Firebase configuration
// TODO: Replace with your actual Firebase config from Flutter project
// Get these values from: lib/core/firebase/firebase_options.dart in Flutter project
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBoHvk0kIyS5UmTR2FHQqcf0hZROaXYQIc",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "my-dx-dailer.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "my-dx-dailer",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "my-dx-dailer.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "941500067016",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:941500067016:web:0061a52baea1736e74c9fd",
};

// Initialize Firebase (only if not already initialized)
let firebaseApp: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

if (typeof window !== "undefined") {
  if (getApps().length === 0) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApps()[0];
  }
  db = getFirestore(firebaseApp);
  auth = getAuth(firebaseApp);
}
*/

// Export stubs (undefined) - Firebase not in use
export const firebaseApp = undefined;
export const db = undefined;
export const auth = undefined;
