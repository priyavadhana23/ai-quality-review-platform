import React from "react";
import { Chip, Tooltip } from "@mui/material";
import CircleIcon from "@mui/icons-material/Circle";
import { useHealth } from "@/hooks";

export const HealthIndicator: React.FC = () => {
  const { data, isError, isPending } = useHealth();

  if (isPending) {
    return (
      <Chip
        icon={<CircleIcon sx={{ fontSize: "10px !important", color: "text.disabled" }} />}
        label="Checking…"
        size="small"
        variant="outlined"
        sx={{ fontSize: 11 }}
      />
    );
  }

  if (isError || !data) {
    return (
      <Tooltip title="Backend is not reachable — check that the FastAPI server is running on port 8000">
        <Chip
          icon={<CircleIcon sx={{ fontSize: "10px !important", color: "error.main" }} />}
          label="Backend offline"
          size="small"
          color="error"
          variant="outlined"
          sx={{ fontSize: 11 }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={`${data.engine} — API v${data.version}`}>
      <Chip
        icon={<CircleIcon sx={{ fontSize: "10px !important", color: "success.main" }} />}
        label="Backend online"
        size="small"
        color="success"
        variant="outlined"
        sx={{ fontSize: 11 }}
      />
    </Tooltip>
  );
};
