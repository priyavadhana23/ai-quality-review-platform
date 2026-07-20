/**
 * TrendChart — Recharts AreaChart / LineChart for time-series data.
 *
 * Renders review count as an area and optional quality/security score
 * overlay lines on a secondary axis.
 */
import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendDataPoint } from "@/types";

interface TrendChartProps {
  data: TrendDataPoint[];
  /** "area" shows review counts; "line" shows quality+security scores */
  variant?: "area" | "line";
  height?: number;
}

const TrendChart: React.FC<TrendChartProps> = ({ data, variant = "area", height = 260 }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const gridColor = isDark ? "#2d333b" : "#e5e7eb";
  const textColor = theme.palette.text.secondary;

  if (data.length === 0) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height }}>
        <Typography color="text.disabled">No data for selected range</Typography>
      </Box>
    );
  }

  const tickStyle = { fontSize: 11, fill: textColor };
  const tooltipStyle = {
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    fontSize: 12,
  };

  if (variant === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
          <YAxis domain={[0, 100]} tick={tickStyle} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend iconSize={10} />
          <Line
            type="monotone"
            dataKey="avg_quality"
            name="Quality Score"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="avg_security"
            name="Security Score"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="avg_review_time"
            name="Avg Time (s)"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="reviewGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="date" tick={tickStyle} tickLine={false} />
        <YAxis allowDecimals={false} tick={tickStyle} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="reviews"
          name="Reviews"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#reviewGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default TrendChart;
