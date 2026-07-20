/**
 * ScoreRadar — Recharts RadarChart + BarChart showing score distribution.
 */
import React from "react";
import { Box, Grid, Paper, Typography, useTheme } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ApiQualityScores } from "@/types";

interface ScoreRadarProps {
  scores: ApiQualityScores;
}

const DIMS = [
  { key: "security" as const, label: "Security" },
  { key: "documentation" as const, label: "Docs" },
  { key: "validation" as const, label: "Validation" },
  { key: "design" as const, label: "Design" },
  { key: "maintainability" as const, label: "Maintainability" },
];

function barColor(val: number | null | undefined): string {
  if (val === null || val === undefined) return "#8b949e";
  if (val >= 80) return "#3fb950";
  if (val >= 60) return "#d29922";
  return "#f85149";
}

const ScoreRadar: React.FC<ScoreRadarProps> = ({ scores }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const gridColor = isDark ? "#30363d" : "#e5e7eb";
  const textColor = isDark ? "#8b949e" : "#6b7280";

  const radarData = DIMS.map((d) => ({
    subject: d.label,
    score: scores[d.key] ?? 0,
    fullMark: 100,
  }));

  const barData = DIMS.map((d) => ({
    name: d.label,
    value: scores[d.key] ?? 0,
  }));

  return (
    <Grid container spacing={2}>
      {/* Radar */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2 }} elevation={0}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Score Radar
          </Typography>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke={gridColor} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: textColor, fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: textColor, fontSize: 10 }} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#58a6ff"
                fill="#58a6ff"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  background: isDark ? "#161b22" : "#fff",
                  border: `1px solid ${gridColor}`,
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>

      {/* Bar */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2 }} elevation={0}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Score Distribution
          </Typography>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: textColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: isDark ? "#161b22" : "#fff",
                  border: `1px solid ${gridColor}`,
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v: number) => [v.toFixed(0), "Score"]}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.value)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default ScoreRadar;
