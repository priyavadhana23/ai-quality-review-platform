/**
 * PerformanceChart — two panels:
 *   1. RadarChart showing relative avg execution time per tool
 *   2. BarChart comparing fastest / avg / p95 / slowest review times
 */
import React from "react";
import { Box, Grid, Typography, useTheme } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerformanceAnalytics } from "@/types";

interface PerformanceChartProps {
  data: PerformanceAnalytics;
  height?: number;
}

const TOOL_COLORS: Record<string, string> = {
  review: "#6366f1",
  describe: "#22c55e",
  improve: "#f59e0b",
  ask: "#06b6d4",
};

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, height = 260 }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const gridColor = isDark ? "#2d333b" : "#e5e7eb";
  const textColor = theme.palette.text.secondary;
  const tooltipStyle = {
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    fontSize: 12,
  };

  // Summary bar data
  const summaryData = [
    { name: "Fastest", value: data.fastest_review, fill: "#22c55e" },
    { name: "Average", value: data.avg_review_time, fill: "#6366f1" },
    { name: "p95", value: data.p95_review_time, fill: "#f59e0b" },
    { name: "Slowest", value: data.slowest_review, fill: "#ef4444" },
  ];

  const radarData = data.time_by_tool.map((t) => ({
    tool: t.tool.charAt(0).toUpperCase() + t.tool.slice(1),
    avg_time: t.avg_time,
    count: t.count,
  }));

  return (
    <Grid container spacing={2}>
      {/* Radar — per-tool timing */}
      <Grid item xs={12} md={5}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
          Avg Time by Tool
        </Typography>
        {radarData.length > 0 ? (
          <ResponsiveContainer width="100%" height={height}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke={gridColor} />
              <PolarAngleAxis
                dataKey="tool"
                tick={{ fontSize: 12, fill: textColor }}
              />
              <Radar
                name="Avg Time (s)"
                dataKey="avg_time"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.35}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}s`, "Avg Time"]} />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height }}>
            <Typography color="text.disabled">No data</Typography>
          </Box>
        )}
      </Grid>

      {/* Bar — fastest / avg / p95 / slowest */}
      <Grid item xs={12} md={7}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
          Review Time Distribution (seconds)
        </Typography>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={summaryData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: textColor }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => [`${v.toFixed(2)}s`]}
            />
            <Bar dataKey="value" name="Time (s)" radius={[4, 4, 0, 0]}>
              {summaryData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Grid>
    </Grid>
  );
};

export default PerformanceChart;
