"use client";

import React, { createContext, useContext } from 'react';

interface AppContextType {
  togglePresentationMode: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children, value }: { children: React.ReactNode; value: AppContextType }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
