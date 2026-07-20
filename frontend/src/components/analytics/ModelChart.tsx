/**
 * ModelChart — Recharts BarChart showing review count and avg response time
 * per LLM model, plus a PieChart for share-of-total.
 */
import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ModelAnalytics } from "@/types";

interface ModelChartProps {
  items: ModelAnalytics[];
  height?: number;
}

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#06b6d4", "#ec4899", "#8b5cf6"];

const ModelChart: React.FC<ModelChartProps> = ({ items, height = 260 }) => {
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

  if (items.length === 0) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height }}>
        <Typography color="text.disabled">No model data</Typography>
      </Box>
    );
  }

  // Shorten model names for display
  const data = items.map((m) => ({
    ...m,
    short_name: m.model_name.length > 24 ? m.model_name.slice(0, 22) + "…" : m.model_name,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 32 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis
          dataKey="short_name"
          tick={{ fontSize: 11, fill: textColor }}
          tickLine={false}
          angle={-30}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          yAxisId="left"
          allowDecimals={false}
          tick={{ fontSize: 11, fill: textColor }}
          tickLine={false}
          axisLine={false}
          label={{ value: "Reviews", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: textColor } }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: textColor }}
          tickLine={false}
          axisLine={false}
          label={{ value: "Avg Time (s)", angle: 90, position: "insideRight", style: { fontSize: 11, fill: textColor } }}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar yAxisId="left" dataKey="review_count" name="Reviews" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
        <Bar
          yAxisId="right"
          dataKey="avg_response_time"
          name="Avg Time (s)"
          fill="#94a3b8"
          radius={[4, 4, 0, 0]}
          opacity={0.6}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ModelChart;
