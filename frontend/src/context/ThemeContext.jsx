import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem('maharaj_theme') || 'light';
    } catch {
      return 'light';
    }
  });

  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('maharaj_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    let activeDark = false;

    if (theme === 'dark') {
      activeDark = true;
    } else if (theme === 'light') {
      activeDark = false;
    } else {
      activeDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    setIsDark(activeDark);

    if (activeDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    try {
      localStorage.setItem('maharaj_theme', theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme]);

  // Listen to system changes if theme === 'system'
  useEffect(() => {
    if (theme !== 'system' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      const activeDark = e.matches;
      setIsDark(activeDark);
      const root = document.documentElement;
      if (activeDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      if (prev === 'dark') return 'light';
      return 'dark';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
