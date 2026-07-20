import React, { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import AppLayout from "@/layouts/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const History = lazy(() => import("@/pages/History"));
const ReviewDetailPage = lazy(() => import("@/pages/ReviewDetailPage"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const TestGenerator = lazy(() => import("@/pages/TestGenerator"));
const ApiQualityPage = lazy(() => import("@/pages/ApiQualityPage"));
const SecurityScannerPage = lazy(() => import("@/pages/SecurityScannerPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const WorkspacePage = lazy(() => import("@/pages/WorkspacePage"));
const WorkspaceMembersPage = lazy(() => import("@/pages/WorkspaceMembersPage"));
const Settings = lazy(() => import("@/pages/Settings"));
const About = lazy(() => import("@/pages/About"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));

const PageFallback = () => (
  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
    <CircularProgress />
  </Box>
);

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      {/* ── Public auth routes (no layout) ────────────────────────── */}
      <Route
        path="/login"
        element={
          <Suspense fallback={<PageFallback />}>
            <LoginPage />
          </Suspense>
        }
      />
      <Route
        path="/auth/callback"
        element={
          <Suspense fallback={<PageFallback />}>
            <AuthCallback />
          </Suspense>
        }
      />

      {/* ── App shell (Navbar + Sidebar layout) ───────────────────── */}
      <Route element={<AppLayout />}>
        {/* Protected pages */}
        <Route
          index
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageFallback />}>
                <Dashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="history"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageFallback />}>
                <History />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="history/:id"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageFallback />}>
                <ReviewDetailPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageFallback />}>
                <Analytics />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="tests"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageFallback />}>
                <TestGenerator />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="api-quality"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageFallback />}>
                <ApiQualityPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="security"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageFallback />}>
                <SecurityScannerPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageFallback />}>
                <ProfilePage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageFallback />}>
                <ReportsPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="workspace"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageFallback />}>
                <WorkspacePage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="workspace/:id"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageFallback />}>
                <WorkspacePage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="workspace/:id/members"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageFallback />}>
                <WorkspaceMembersPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Public pages (accessible without login) */}
        <Route
          path="settings"
          element={
            <Suspense fallback={<PageFallback />}>
              <Settings />
            </Suspense>
          }
        />
        <Route
          path="about"
          element={
            <Suspense fallback={<PageFallback />}>
              <About />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <Suspense fallback={<PageFallback />}>
              <NotFound />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
