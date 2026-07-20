/**
 * MetricCard — a single KPI summary tile.
 *
 * Shows an icon, a numeric value, a label, and an optional subtitle.
 * Used across the top summary row of the Analytics dashboard.
 */
import React from "react";
import { Box, CircularProgress, Paper, Skeleton, Typography } from "@mui/material";

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number | null | undefined;
  subtitle?: string;
  color?: string;
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  subtitle,
  color = "primary.main",
  loading = false,
}) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2.5,
      borderRadius: 2,
      display: "flex",
      flexDirection: "column",
      gap: 0.5,
      height: "100%",
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, color, mb: 0.5 }}>
      {icon}
      <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.8}>
        {label}
      </Typography>
    </Box>

    {loading ? (
      <Skeleton variant="text" width="60%" height={40} />
    ) : (
      <Typography variant="h4" fontWeight={700} color={color} lineHeight={1.1}>
        {value ?? "—"}
      </Typography>
    )}

    {subtitle && (
      <Typography variant="caption" color="text.secondary">
        {subtitle}
      </Typography>
    )}
  </Paper>
);

export default MetricCard;
