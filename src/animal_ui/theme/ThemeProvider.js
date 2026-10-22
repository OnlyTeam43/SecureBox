import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors } from './tokens.js';

const ThemeContext = createContext(lightColors);

export function ThemeProvider({
  children,
  mode = 'system',
}) {
  const scheme = useColorScheme();
  const resolved = mode === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : mode;
  return (
    <ThemeContext.Provider value={resolved === 'dark' ? darkColors : lightColors}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useColors = () => useContext(ThemeContext);
