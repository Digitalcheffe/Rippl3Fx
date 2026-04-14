import { Routes, Route, Navigate } from 'react-router-dom';
import Setup from './pages/Setup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Platform from './pages/Platform';
import Settings from './pages/Settings';
import Events from './pages/Events';
import Layout from './components/Layout';
import ProtectedRoute from './router/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><Layout><Events /></Layout></ProtectedRoute>} />
      <Route path="/:platform" element={<ProtectedRoute><Layout><Platform /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
