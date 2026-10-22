import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors, darkColors, lightColors } from './tokens';

const ThemeContext = createContext<Colors>(lightColors);

export function ThemeProvider({
  children,
  mode = 'system',
}: {
  children: React.ReactNode;
  mode?: 'light' | 'dark' | 'system';
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
