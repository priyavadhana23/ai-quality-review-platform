/**
 * OwaspBarChart — Recharts BarChart showing findings grouped by OWASP category.
 * Also renders a secondary CWE distribution table below the chart.
 */
import React from "react";
import { Box, Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography, useTheme } from "@mui/material";
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
import type { SecurityFinding } from "@/types";

interface OwaspBarChartProps {
  findings: SecurityFinding[];
}

// Shorten long OWASP strings for the X-axis label
function shortOwasp(s: string): string {
  const m = s.match(/A\d+:\d+-(.+)/);
  if (m) return m[1].replace(/ and /g, " & ").substring(0, 22);
  return s.substring(0, 22);
}

const OwaspBarChart: React.FC<OwaspBarChartProps> = ({ findings }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const gridColor = isDark ? "#30363d" : "#e5e7eb";
  const textColor = isDark ? "#8b949e" : "#6b7280";

  // Build OWASP frequency map
  const owaspCounts: Record<string, number> = {};
  for (const f of findings) {
    if (f.owasp_category) {
      owaspCounts[f.owasp_category] = (owaspCounts[f.owasp_category] ?? 0) + 1;
    }
  }
  const owaspData = Object.entries(owaspCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({ name: shortOwasp(cat), full: cat, count }));

  // Build CWE frequency map
  const cweCounts: Record<string, number> = {};
  for (const f of findings) {
    if (f.cwe_id) {
      cweCounts[f.cwe_id] = (cweCounts[f.cwe_id] ?? 0) + 1;
    }
  }
  const cweData = Object.entries(cweCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const BAR_COLORS = ["#f85149", "#d29922", "#58a6ff", "#3fb950", "#a371f7", "#39c5cf"];

  return (
    <Box>
      {/* OWASP bar chart */}
      {owaspData.length > 0 ? (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Findings by OWASP Category
          </Typography>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={owaspData} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: textColor, fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: textColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: isDark ? "#161b22" : "#fff",
                  border: `1px solid ${gridColor}`,
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v: number, _: string, props: { payload?: { full?: string } }) => [
                  v,
                  props.payload?.full ?? "Findings",
                ]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {owaspData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          No OWASP mappings available.
        </Typography>
      )}

      {/* CWE distribution table */}
      {cweData.length > 0 && (
        <Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            CWE Distribution
          </Typography>
          <Paper elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>CWE ID</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Occurrences</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cweData.map(([cwe, count]) => (
                  <TableRow key={cwe} hover>
                    <TableCell>
                      <Chip
                        label={cwe}
                        size="small"
                        variant="outlined"
                        sx={{ fontFamily: "monospace", fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>{count}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default OwaspBarChart;
