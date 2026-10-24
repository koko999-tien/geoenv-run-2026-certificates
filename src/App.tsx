import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminLayout } from './components/AdminLayout';
import { Home } from './pages/Home';
import { CertificateLookup } from './pages/CertificateLookup';
import { Gallery } from './pages/Gallery';
import { Feedback } from './pages/Feedback';
import { AdminFeedback } from './pages/AdminFeedback';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminCertificates } from './pages/AdminCertificates';
import { AdminGallery } from './pages/AdminGallery';

/* Web này là trang đơn (không tải lại trang khi chuyển mục) nên trình duyệt giữ
   nguyên vị trí cuộn sang trang mới — đang ở cuối trang chủ mà bấm sang trang
   ngắn hơn là bị dồn xuống cuối trang đó. Component này đưa về đầu trang mỗi
   khi đổi đường dẫn. Cuộn tức thì (không hiệu ứng) để không thấy cảnh kéo lên. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

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

  /* Phiên đăng nhập quản trị lấy từ Supabase Auth — tải lại trang vẫn còn đăng nhập */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsAuthenticated(!!data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogin = () => setIsAuthenticated(true);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/tra-cuu" element={<CertificateLookup />} />
          <Route path="/thu-vien-anh" element={<Gallery />} />
          <Route path="/gop-y" element={<Feedback />} />
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
          <Route path="/quan-tri/phan-anh" element={<AdminFeedback />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;