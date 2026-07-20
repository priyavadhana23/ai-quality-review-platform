import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";

const DRAWER_W = 240;

const AppLayout: React.FC = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Navbar drawerWidth={DRAWER_W} onMenuClick={() => setMobileOpen((o) => !o)} />
      <Sidebar
        drawerWidth={DRAWER_W}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: "64px",
          ml: isDesktop ? `${DRAWER_W}px` : 0,
          p: { xs: 2, sm: 3 },
          minHeight: "calc(100vh - 64px)",
          bgcolor: "background.default",
          transition: theme.transitions.create("margin", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default AppLayout;
