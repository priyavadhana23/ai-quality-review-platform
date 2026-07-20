import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { SnackbarProvider } from "notistack";
import { AppThemeProvider } from "@/theme/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import App from "@/App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
    mutations: {
      retry: 0,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        {/* AuthProvider must be inside ThemeProvider (uses MUI) and outside BrowserRouter */}
        <AuthProvider>
          <SnackbarProvider
            maxSnack={4}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            autoHideDuration={4000}
          >
            <App />
          </SnackbarProvider>
        </AuthProvider>
      </AppThemeProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </React.StrictMode>,
);
