import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WorkoutBuilder from './pages/WorkoutBuilder';
import WorkoutSession from './pages/WorkoutSession';
import UserManagement from './pages/UserManagement';
import AdminDashboard from './pages/AdminDashboard';
import SeedAdmin from './pages/SeedAdmin';
import CoachDashboard from './pages/CoachDashboard';
import WorkoutExecution from './pages/WorkoutExecution';
import InstallButton from './components/InstallButton';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/seed" element={<SeedAdmin />} />
          <Route path="/workout-hiit" element={<WorkoutExecution />} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="builder" element={<WorkoutBuilder />} />
            <Route path="session" element={<WorkoutSession />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="coach-hiit" element={<CoachDashboard />} />
          </Route>
        </Routes>
        <InstallButton />
      </Router>
    </AuthProvider>
  );
}

export default App;
