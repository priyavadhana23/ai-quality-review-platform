import React from "react";
import { Alert, AlertTitle, Box, Button, Collapse, Typography } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import type { AxiosError } from "axios";

interface ApiError {
  message?: string;
  status?: string;
}

interface ErrorDialogProps {
  error: Error | AxiosError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

function extractMessage(error: Error | AxiosError | null): string {
  if (!error) return "An unexpected error occurred.";
  const axiosErr = error as AxiosError<ApiError>;
  if (axiosErr.response?.data?.message) return axiosErr.response.data.message;
  if (axiosErr.message) return axiosErr.message;
  return "An unexpected error occurred.";
}

export const ErrorDialog: React.FC<ErrorDialogProps> = ({ error, onRetry, onDismiss }) => {
  if (!error) return null;

  const msg = extractMessage(error);
  const axiosErr = error as AxiosError;
  const statusCode = axiosErr.response?.status;

  return (
    <Collapse in={!!error}>
      <Alert
        severity="error"
        icon={<ErrorOutlineIcon />}
        action={
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            {onRetry && (
              <Button size="small" color="inherit" onClick={onRetry} variant="outlined">
                Retry
              </Button>
            )}
            {onDismiss && (
              <Button size="small" color="inherit" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </Box>
        }
        sx={{ mb: 2, alignItems: "flex-start" }}
      >
        <AlertTitle>
          {statusCode === 422
            ? "Invalid Request"
            : statusCode === 502
              ? "AI Engine Error"
              : statusCode === 0 || !statusCode
                ? "Network Error"
                : "Error"}
        </AlertTitle>
        <Typography variant="body2">{msg}</Typography>
        {(statusCode === 0 || !statusCode) && (
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }} color="error.dark">
            Make sure the backend is running on port 8000.
          </Typography>
        )}
      </Alert>
    </Collapse>
  );
};
