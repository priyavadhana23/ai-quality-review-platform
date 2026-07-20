/**
 * ToolPieChart — Recharts PieChart showing review count per tool.
 */
import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface ToolPieChartProps {
  data: Record<string, number>;
}

const TOOL_COLORS: Record<string, string> = {
  review: "#6366f1",
  describe: "#22c55e",
  improve: "#f59e0b",
  ask: "#06b6d4",
};

const DEFAULT_COLOR = "#94a3b8";

const ToolPieChart: React.FC<ToolPieChartProps> = ({ data }) => {
  const theme = useTheme();

  const chartData = Object.entries(data).map(([tool, count]) => ({
    name: tool.charAt(0).toUpperCase() + tool.slice(1),
    value: count,
    tool,
  }));

  if (chartData.length === 0) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220 }}>
        <Typography color="text.disabled">No data</Typography>
      </Box>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.tool}
              fill={TOOL_COLORS[entry.tool] ?? DEFAULT_COLOR}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 8,
            fontSize: 13,
          }}
          formatter={(value: number, name: string) => [`${value} reviews`, name]}
        />
        <Legend
          iconType="circle"
          iconSize={10}
          formatter={(value) => (
            <span style={{ fontSize: 12, color: theme.palette.text.secondary }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default ToolPieChart;
