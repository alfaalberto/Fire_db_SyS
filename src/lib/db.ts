"use client";

import { db } from './firebase';
import { collection, doc, getDocs, setDoc } from "firebase/firestore";

const SLIDES_COLLECTION = 'slides';

export const saveSlideToDB = async (id: string, content: string[] | null): Promise<void> => {
  try {
    const slideRef = doc(db, SLIDES_COLLECTION, id);
    await setDoc(slideRef, { id, content });
  } catch (error) {
    console.error("Error saving slide to Firestore:", error);
    throw error;
  }
};

export const loadAllSlidesFromDB = async (): Promise<{id: string, content: string[] | null}[]> => {
  try {
    const slidesCollectionRef = collection(db, SLIDES_COLLECTION);
    const querySnapshot = await getDocs(slidesCollectionRef);
    const slides: {id: string, content: string[] | null}[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      slides.push({
        id: doc.id,
        content: data.content ?? null
      });
    });
    return slides;
  } catch (error) {
    console.error("Error loading slides from Firestore:", error);
    throw error;
  }
};
