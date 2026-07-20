import React from "react";
import { Chip, type ChipProps } from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import BugReportIcon from "@mui/icons-material/BugReport";
import SpeedIcon from "@mui/icons-material/Speed";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

type BadgeVariant = "security" | "effort" | "tests" | "success" | "warning" | "error";

interface QualityBadgeProps {
  variant: BadgeVariant;
  label: string;
  size?: ChipProps["size"];
}

const VARIANT_CONFIG: Record<
  BadgeVariant,
  { color: ChipProps["color"]; icon: React.ReactElement }
> = {
  security: { color: "error", icon: <SecurityIcon /> },
  effort: { color: "warning", icon: <SpeedIcon /> },
  tests: { color: "info", icon: <BugReportIcon /> },
  success: { color: "success", icon: <CheckCircleIcon /> },
  warning: { color: "warning", icon: <SpeedIcon /> },
  error: { color: "error", icon: <SecurityIcon /> },
};

export const QualityBadge: React.FC<QualityBadgeProps> = ({ variant, label, size = "small" }) => {
  const { color, icon } = VARIANT_CONFIG[variant];
  return (
    <Chip
      icon={icon}
      label={label}
      color={color}
      size={size}
      variant="outlined"
      sx={{ fontWeight: 500, fontSize: 12 }}
    />
  );
};
