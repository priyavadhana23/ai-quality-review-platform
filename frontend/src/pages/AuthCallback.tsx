/**
 * AuthCallback — landing page for /auth/callback.
 *
 * The backend redirects here after OAuth with:
 *   ?refresh_token=<token>#access_token=<token>
 *
 * AuthContext (in main.tsx) reads those values on mount and completes
 * the session setup.  This page just shows a spinner while that happens,
 * then redirects to the dashboard once isAuthenticated becomes true.
 */
import React, { useEffect } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks";

const AuthCallback: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/", { replace: true });
    }
    if (!isLoading && !isAuthenticated) {
      // Something went wrong — the AuthContext couldn't parse the tokens.
      navigate("/login?error=auth_failed", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        bgcolor: "background.default",
      }}
    >
      <CircularProgress size={48} />
      <Typography color="text.secondary">Completing sign-in…</Typography>
    </Box>
  );
};

export default AuthCallback;
