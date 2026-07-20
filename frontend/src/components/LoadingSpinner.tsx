import React from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = "Analyzing pull request…",
}) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      py: 10,
    }}
  >
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <CircularProgress size={72} thickness={2} color="primary" />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AutoFixHighIcon sx={{ color: "primary.main", fontSize: 30 }} />
      </Box>
    </Box>
    <Typography color="text.secondary" variant="body1">
      {message}
    </Typography>
    <Typography variant="caption" color="text.disabled">
      AI review can take 20–60 seconds
    </Typography>
  </Box>
);
