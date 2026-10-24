import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminLayout } from './components/AdminLayout';
import { Home } from './pages/Home';
import { CertificateLookup } from './pages/CertificateLookup';
import { Gallery } from './pages/Gallery';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminCertificates } from './pages/AdminCertificates';
import { AdminGallery } from './pages/AdminGallery';

function ProtectedRoute({ children, isAuthenticated }: { children: React.ReactNode; isAuthenticated: boolean }) {
  const location = useLocation();
  if (!isAuthenticated) {
    /* Nhớ lại trang người dùng đang định vào — để sau khi đăng nhập quay lại đúng chỗ */
    return <Navigate to="/quan-tri/dang-nhap" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => setIsAuthenticated(true);
  const handleLogout = () => setIsAuthenticated(false);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/tra-cuu" element={<CertificateLookup />} />
          <Route path="/thu-vien-anh" element={<Gallery />} />
        </Route>

        <Route path="/quan-tri/dang-nhap" element={<AdminLogin onLogin={handleLogin} />} />

        <Route
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AdminLayout onLogout={handleLogout} />
            </ProtectedRoute>
          }
        >
          <Route path="/quan-tri" element={<AdminDashboard />} />
          <Route path="/quan-tri/chung-nhan" element={<AdminCertificates />} />
          <Route path="/quan-tri/anh" element={<AdminGallery />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;