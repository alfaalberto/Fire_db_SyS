"use client";

import { db } from './firebase';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';

export const saveSlideToDB = async (id: string, content: string | null): Promise<void> => {
  try {
    const slideRef = doc(db, 'slides', id);
    // Using setDoc with merge: true will create the doc if it doesn't exist,
    // or update it if it does. This is useful if we add more fields later.
    await setDoc(slideRef, { content }, { merge: true });
  } catch (error) {
    console.error("Error saving slide to Firestore:", error);
    throw error; // Re-throw the error to be caught by the caller
  }
};

export const loadAllSlidesFromDB = async (): Promise<{id: string, content: string | null}[]> => {
  try {
    const slidesCollectionRef = collection(db, 'slides');
    const querySnapshot = await getDocs(slidesCollectionRef);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      content: doc.data().content || null
    }));
  } catch (error) {
    console.error("Error loading slides from Firestore:", error);
    throw error;
  }
};
