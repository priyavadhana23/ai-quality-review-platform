import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 2,
        textAlign: "center",
      }}
    >
      <Typography variant="h1" sx={{ fontSize: 96, fontWeight: 700, color: "text.disabled" }}>
        404
      </Typography>
      <Typography variant="h5" color="text.secondary">
        Page not found
      </Typography>
      <Typography variant="body2" color="text.disabled">
        The page you're looking for doesn't exist.
      </Typography>
      <Button
        variant="contained"
        startIcon={<HomeIcon />}
        onClick={() => navigate("/")}
        sx={{ mt: 1 }}
      >
        Back to Dashboard
      </Button>
    </Box>
  );
};

export default NotFound;
