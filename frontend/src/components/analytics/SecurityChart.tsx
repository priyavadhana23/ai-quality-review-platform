/**
 * SecurityChart — BarChart for the security score distribution buckets
 * and a horizontal BarChart for top repos by bugs found.
 */
import React from "react";
import { Box, Grid, Typography, useTheme } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SecurityAnalytics } from "@/types";

interface SecurityChartProps {
  data: SecurityAnalytics;
  height?: number;
}

const BUCKET_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"];

const SecurityChart: React.FC<SecurityChartProps> = ({ data, height = 220 }) => {
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

  const hasDistribution = data.score_distribution.some((b) => b.count > 0);
  const hasTopRepos = data.top_repos_by_bugs.length > 0;

  return (
    <Grid container spacing={2}>
      {/* Score distribution */}
      <Grid item xs={12} md={6}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
          Security Score Distribution
        </Typography>
        {hasDistribution ? (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data.score_distribution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 12, fill: textColor }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Reviews" radius={[4, 4, 0, 0]}>
                {data.score_distribution.map((_, i) => (
                  <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height }}>
            <Typography color="text.disabled">No security scores recorded yet</Typography>
          </Box>
        )}
      </Grid>

      {/* Top repos by bugs */}
      <Grid item xs={12} md={6}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
          Top Repos by Bugs Found
        </Typography>
        {hasTopRepos ? (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={data.top_repos_by_bugs}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: textColor }} tickLine={false} />
              <YAxis
                type="category"
                dataKey="repo"
                width={130}
                tick={{ fontSize: 11, fill: textColor }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="bugs" name="Bugs Found" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height }}>
            <Typography color="text.disabled">No bugs recorded yet</Typography>
          </Box>
        )}
      </Grid>
    </Grid>
  );
};

export default SecurityChart;
