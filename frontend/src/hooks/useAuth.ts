/**
 * useAuth — consume the AuthContext.
 *
 * Usage:
 *   const { user, isAuthenticated, login, logout } = useAuth();
 */
import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";

export const useAuth = () => useContext(AuthContext);
