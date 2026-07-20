import React, { useState } from "react";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import BugReportIcon from "@mui/icons-material/BugReport";
import GitHubIcon from "@mui/icons-material/GitHub";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";
import { useThemeMode } from "@/theme/ThemeContext";
import { useAuth } from "@/hooks";

interface NavbarProps {
  drawerWidth: number;
  onMenuClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { mode, toggleMode } = useThemeMode();
  const theme = useTheme();
  const { user, isAuthenticated, login, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleCloseMenu = () => setAnchorEl(null);

  const handleProfile = () => {
    handleCloseMenu();
    navigate("/profile");
  };

  const handleLogout = async () => {
    handleCloseMenu();
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: theme.zIndex.drawer + 1,
        bgcolor: "background.paper",
        borderBottom: `1px solid ${theme.palette.divider}`,
        color: "text.primary",
        width: "100%",
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <IconButton
          edge="start"
          onClick={onMenuClick}
          sx={{ display: { md: "none" }, color: "text.primary" }}
          aria-label="toggle sidebar"
        >
          <MenuIcon />
        </IconButton>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1 }}>
          <BugReportIcon sx={{ color: "primary.main", fontSize: 28 }} />
          <Typography
            variant="h6"
            noWrap
            sx={{ fontWeight: 700, color: "text.primary", letterSpacing: -0.5 }}
          >
            AI Quality Review
          </Typography>
        </Box>

        {/* Theme toggle */}
        <Tooltip title={mode === "dark" ? "Light mode" : "Dark mode"}>
          <IconButton
            onClick={toggleMode}
            sx={{ color: "text.secondary" }}
            aria-label="toggle theme"
          >
            {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Tooltip>

        {/* Auth — not authenticated */}
        {!isAuthenticated && (
          <Button
            variant="contained"
            size="small"
            startIcon={<GitHubIcon />}
            onClick={login}
            sx={{ bgcolor: "#238636", "&:hover": { bgcolor: "#2ea043" }, fontWeight: 600 }}
          >
            Sign in
          </Button>
        )}

        {/* Auth — authenticated */}
        {isAuthenticated && user && (
          <>
            <Tooltip title={`${user.username} · ${user.role}`}>
              <IconButton onClick={handleOpenMenu} size="small" sx={{ p: 0.5 }}>
                <Avatar
                  src={user.avatar_url ?? undefined}
                  alt={user.username}
                  sx={{ width: 34, height: 34 }}
                />
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleCloseMenu}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              PaperProps={{ sx: { mt: 1, minWidth: 200 } }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="body2" fontWeight={700}>
                  {user.username}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user.email ?? "No public email"}
                </Typography>
                <Box sx={{ mt: 0.75 }}>
                  <Chip
                    label={user.role}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ fontSize: 11 }}
                  />
                </Box>
              </Box>
              <Divider />
              <MenuItem onClick={handleProfile}>
                <ListItemIcon>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Profile</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" sx={{ color: "error.main" }} />
                </ListItemIcon>
                <ListItemText>Sign out</ListItemText>
              </MenuItem>
            </Menu>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};
