import { createTheme, type PaletteMode } from "@mui/material";

declare module "@mui/material/styles" {
  interface Palette {
    sidebar: { bg: string; active: string; text: string };
  }
  interface PaletteOptions {
    sidebar?: { bg: string; active: string; text: string };
  }
}

export const buildTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === "dark"
        ? {
            primary: { main: "#58a6ff" },
            secondary: { main: "#3fb950" },
            background: { default: "#0d1117", paper: "#161b22" },
            text: { primary: "#c9d1d9", secondary: "#8b949e" },
            divider: "#30363d",
            sidebar: { bg: "#161b22", active: "#21262d", text: "#c9d1d9" },
            error: { main: "#f85149" },
            warning: { main: "#d29922" },
            success: { main: "#3fb950" },
            info: { main: "#58a6ff" },
          }
        : {
            primary: { main: "#0969da" },
            secondary: { main: "#1a7f37" },
            background: { default: "#f6f8fa", paper: "#ffffff" },
            text: { primary: "#24292f", secondary: "#57606a" },
            divider: "#d0d7de",
            sidebar: { bg: "#ffffff", active: "#f6f8fa", text: "#24292f" },
            error: { main: "#cf222e" },
            warning: { main: "#9a6700" },
            success: { main: "#1a7f37" },
            info: { main: "#0969da" },
          }),
    },
    typography: {
      fontFamily: [
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "Roboto",
        "Helvetica",
        "Arial",
        "sans-serif",
      ].join(","),
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 6 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 600 },
          containedPrimary: {
            ...(mode === "dark" && {
              backgroundColor: "#238636",
              "&:hover": { backgroundColor: "#2ea043" },
            }),
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: `1px solid ${mode === "dark" ? "#30363d" : "#d0d7de"}`,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            "& fieldset": {
              borderColor: mode === "dark" ? "#30363d" : "#d0d7de",
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 500 } },
      },
    },
  });
