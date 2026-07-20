import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ThemeProvider as MuiThemeProvider, CssBaseline } from "@mui/material";
import { buildTheme } from "@/theme";
import type { PaletteMode } from "@mui/material";

interface ThemeCtx {
  mode: PaletteMode;
  toggleMode: () => void;
}

const Ctx = createContext<ThemeCtx>({ mode: "dark", toggleMode: () => {} });

const stored = (): PaletteMode => {
  try {
    const v = localStorage.getItem("qrp_theme");
    return v === "light" || v === "dark" ? v : "dark";
  } catch {
    return "dark";
  }
};

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<PaletteMode>(stored);

  const toggleMode = useCallback(() => {
    setMode((m) => {
      const next = m === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("qrp_theme", next);
      } catch {
        /* localStorage unavailable — ignore */
      }
      return next;
    });
  }, []);

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <Ctx.Provider value={{ mode, toggleMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </Ctx.Provider>
  );
};

export const useThemeMode = () => useContext(Ctx);
