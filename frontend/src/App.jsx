import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import MainLayout from './components/Layout/MainLayout';
import ProtectedRoute from './components/Layout/ProtectedRoute';
// Admin
import AdminDashboard from './pages/Admin/Dashboard';
import AdminTripDetails from './pages/Admin/TripDetails';
import AdminUsers from './pages/Admin/Users';
import AdminVehicles from './pages/Admin/Vehicles';
import AdminDrivers from './pages/Admin/Drivers';
import AdminRoutes from './pages/Admin/Routes';
import AdminSchedule from './pages/Admin/Schedule';
import AdminAuditLogs from './pages/Admin/AuditLogs';
import AdminTickets from './pages/Admin/Tickets';
import AdminRotations from './pages/Admin/Rotations';
import AdminMaintenance from './pages/Admin/Maintenance';
import AdminReports from './pages/Admin/Reports';
// Manager
import ManagerDashboard from './pages/Manager/Dashboard';
import ManagerMaintenance from './pages/Manager/Maintenance';
import ManagerFleet from './pages/Manager/Fleet';
import ManagerReroutes from './pages/Manager/Reroutes';
import ManagerNotifications from './pages/Manager/Notifications';

function App() {
  return (
    <Router>
      <AuthProvider>
        <WebSocketProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            <Route element={<MainLayout />}>
              {/* Admin Routes */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route path="/admin/dashboard" element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
                <Route path="/admin/trips/:id" element={<ErrorBoundary><AdminTripDetails /></ErrorBoundary>} />
                <Route path="/admin/users" element={<ErrorBoundary><AdminUsers /></ErrorBoundary>} />
                <Route path="/admin/vehicles" element={<ErrorBoundary><AdminVehicles /></ErrorBoundary>} />
                <Route path="/admin/drivers" element={<ErrorBoundary><AdminDrivers /></ErrorBoundary>} />
                <Route path="/admin/routes" element={<ErrorBoundary><AdminRoutes /></ErrorBoundary>} />
                <Route path="/admin/schedule" element={<ErrorBoundary><AdminSchedule /></ErrorBoundary>} />
                <Route path="/admin/rotations" element={<ErrorBoundary><AdminRotations /></ErrorBoundary>} />
                <Route path="/admin/maintenance" element={<ErrorBoundary><AdminMaintenance /></ErrorBoundary>} />
                <Route path="/admin/reports" element={<ErrorBoundary><AdminReports /></ErrorBoundary>} />
                <Route path="/admin/audit-logs" element={<ErrorBoundary><AdminAuditLogs /></ErrorBoundary>} />
                <Route path="/admin/tickets" element={<ErrorBoundary><AdminTickets /></ErrorBoundary>} />
              </Route>

              {/* Manager Routes */}
              <Route element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']} />}>
                <Route path="/manager/dashboard" element={<ErrorBoundary><ManagerDashboard /></ErrorBoundary>} />
                <Route path="/manager/maintenance" element={<ErrorBoundary><ManagerMaintenance /></ErrorBoundary>} />
                <Route path="/manager/fleet" element={<ErrorBoundary><ManagerFleet /></ErrorBoundary>} />
                <Route path="/manager/reroutes" element={<ErrorBoundary><ManagerReroutes /></ErrorBoundary>} />
                <Route path="/manager/notifications" element={<ErrorBoundary><ManagerNotifications /></ErrorBoundary>} />
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </WebSocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
