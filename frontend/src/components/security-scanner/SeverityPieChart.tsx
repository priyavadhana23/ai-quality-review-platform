/**
 * SeverityPieChart — Recharts PieChart showing finding distribution
 * across critical / high / medium / low severities.
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
import type { RiskDistribution } from "@/types";

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "#f85149",
  High: "#d29922",
  Medium: "#58a6ff",
  Low: "#8b949e",
};

interface SeverityPieChartProps {
  distribution: RiskDistribution;
}

const SeverityPieChart: React.FC<SeverityPieChartProps> = ({ distribution }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const data = [
    { name: "Critical", value: distribution.critical },
    { name: "High", value: distribution.high },
    { name: "Medium", value: distribution.medium },
    { name: "Low", value: distribution.low },
  ].filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220 }}>
        <Typography color="text.secondary" variant="body2">
          No findings
        </Typography>
      </Box>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? "#8b949e"} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: isDark ? "#161b22" : "#fff",
            border: `1px solid ${isDark ? "#30363d" : "#e5e7eb"}`,
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [
            `${value} (${((value / total) * 100).toFixed(0)}%)`,
            name,
          ]}
        />
        <Legend
          iconType="circle"
          iconSize={10}
          formatter={(value) => (
            <span style={{ fontSize: 12, color: isDark ? "#8b949e" : "#6b7280" }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default SeverityPieChart;
