'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getDesignTokens } from '@/styles/theme';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

interface ThemeContextProviderProps {
  children: React.ReactNode;
}

export default function ThemeContextProvider({ children }: ThemeContextProviderProps) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [mounted, setMounted] = useState(false);

  // Load preference on mount
  useEffect(() => {
    // First check localStorage
    const stored = localStorage.getItem('theme-mode') as ThemeMode | null;
    if (stored && (stored === 'light' || stored === 'dark')) {
      setMode(stored);
    } else if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      // Fall back to system preference
      setMode('light');
    }
    setMounted(true);
  }, []);

  // Sync with user preferences when authenticated
  useEffect(() => {
    const syncUserPreference = async () => {
      try {
        const response = await fetch('/api/users/me');
        if (response.ok) {
          const userData = await response.json();
          if (userData?.preferences?.theme?.mode) {
            const userMode = userData.preferences.theme.mode as ThemeMode;
            if (userMode === 'light' || userMode === 'dark') {
              setMode(userMode);
              localStorage.setItem('theme-mode', userMode);
            }
          }
        }
      } catch {
        // Not authenticated or error, use localStorage preference
      }
    };
    
    if (mounted) {
      syncUserPreference();
    }
  }, [mounted]);

  // Update data-theme attribute on html element
  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', mode);
    }
  }, [mode, mounted]);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme-mode', next);
      return next;
    });
  }, []);

  const setThemeMode = useCallback((newMode: ThemeMode) => {
    if (newMode === 'light' || newMode === 'dark') {
      setMode(newMode);
      localStorage.setItem('theme-mode', newMode);
    }
  }, []);

  const theme = useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

  // Prevent flash of wrong theme by rendering nothing until mounted
  // This ensures server and client render the same initial state
  if (!mounted) {
    return (
      <ThemeProvider theme={createTheme(getDesignTokens('dark'))}>
        <CssBaseline />
        <div style={{ visibility: 'hidden' }}>{children}</div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setThemeMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}

