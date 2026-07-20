/**
 * InviteDialog — modal for sending workspace invitations.
 */
import React, { useState } from "react";
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import type { InviteCreate, WorkspaceRole } from "@/types";
import { WORKSPACE_ROLE_LABELS } from "@/types";

const INVITABLE_ROLES: WorkspaceRole[] = ["admin", "maintainer", "developer", "qa_engineer", "viewer"];

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  onInvite: (req: InviteCreate) => void;
  isLoading: boolean;
}

const InviteDialog: React.FC<InviteDialogProps> = ({ open, onClose, onInvite, isLoading }) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("developer");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    onInvite({ email: email.trim().toLowerCase(), role });
  };

  const handleClose = () => {
    setEmail("");
    setRole("developer");
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <PersonAddIcon fontSize="small" color="primary" />
        Invite Member
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Email Address" type="email" fullWidth
            value={email} onChange={(e) => setEmail(e.target.value)}
            error={Boolean(error)} helperText={error}
            disabled={isLoading} autoFocus
          />
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select value={role} label="Role"
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              disabled={isLoading}>
              {INVITABLE_ROLES.map((r) => (
                <MenuItem key={r} value={r}>{WORKSPACE_ROLE_LABELS[r]}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isLoading}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isLoading}>
          Send Invitation
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InviteDialog;
