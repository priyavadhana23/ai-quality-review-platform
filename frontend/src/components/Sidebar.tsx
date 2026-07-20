import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useTheme,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import HistoryIcon from "@mui/icons-material/History";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ScienceIcon from "@mui/icons-material/Science";
import ApiIcon from "@mui/icons-material/Api";
import SecurityIcon from "@mui/icons-material/Security";
import SummarizeIcon from "@mui/icons-material/Summarize";
import GroupsIcon from "@mui/icons-material/Groups";
import SettingsIcon from "@mui/icons-material/Settings";
import InfoIcon from "@mui/icons-material/Info";
import PersonIcon from "@mui/icons-material/Person";
import { useAuth } from "@/hooks";

const PUBLIC_NAV = [
  { label: "Dashboard", path: "/", icon: <DashboardIcon fontSize="small" /> },
  { label: "History", path: "/history", icon: <HistoryIcon fontSize="small" /> },
  { label: "Analytics", path: "/analytics", icon: <AssessmentIcon fontSize="small" /> },
  { label: "Test Generator", path: "/tests", icon: <ScienceIcon fontSize="small" /> },
  { label: "API Quality", path: "/api-quality", icon: <ApiIcon fontSize="small" /> },
  { label: "Security Scanner", path: "/security", icon: <SecurityIcon fontSize="small" /> },
  { label: "Reports", path: "/reports", icon: <SummarizeIcon fontSize="small" /> },
  { label: "Workspaces", path: "/workspace", icon: <GroupsIcon fontSize="small" /> },
  { label: "Settings", path: "/settings", icon: <SettingsIcon fontSize="small" /> },
  { label: "About", path: "/about", icon: <InfoIcon fontSize="small" /> },
];

interface SidebarProps {
  drawerWidth: number;
  mobileOpen: boolean;
  onClose: () => void;
}

const DrawerContent: React.FC = () => {
  const location = useLocation();
  const theme = useTheme();
  const { isAuthenticated } = useAuth();

  const navItems = isAuthenticated
    ? [...PUBLIC_NAV, { label: "Profile", path: "/profile", icon: <PersonIcon fontSize="small" /> }]
    : PUBLIC_NAV;

  return (
    <Box sx={{ height: "100%", bgcolor: "background.paper" }}>
      <Box sx={{ height: 64 }} />
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}
        >
          Navigation
        </Typography>
      </Box>
      <List dense sx={{ px: 1 }}>
        {navItems.map((item) => {
          const active =
            item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={NavLink}
                to={item.path}
                sx={{
                  borderRadius: 1.5,
                  py: 0.75,
                  color: active ? "primary.main" : "text.secondary",
                  bgcolor: active
                    ? theme.palette.mode === "dark"
                      ? "#21262d"
                      : "#f3f4f6"
                    : "transparent",
                  "&:hover": {
                    bgcolor: theme.palette.mode === "dark" ? "#21262d" : "#f3f4f6",
                    color: "text.primary",
                  },
                  transition: "all 0.15s",
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ drawerWidth, mobileOpen, onClose }) => {
  const theme = useTheme();

  return (
    <>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" },
        }}
      >
        <DrawerContent />
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            border: "none",
            borderRight: `1px solid ${theme.palette.divider}`,
          },
        }}
        open
      >
        <DrawerContent />
      </Drawer>
    </>
  );
};
