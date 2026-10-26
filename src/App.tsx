import React, { useEffect, useState, lazy, Suspense } from 'react';
import { supabase } from './lib/supabase';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminLayout } from './components/AdminLayout';
import { VisitTracker } from './components/VisitTracker';

/* Tách code theo trang (lazy): khách vào trang chủ chỉ tải code trang chủ,
   không phải tải cả code quản trị (kể cả thư viện Excel nặng) và các trang
   khác — trang nhẹ hơn, mở nhanh hơn, cuộn mượt hơn. Mỗi trang chỉ tải khi
   người dùng bấm vào. Các trang dùng export tên riêng nên cần map sang default
   cho lazy(). */
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const CertificateLookup = lazy(() =>
  import('./pages/CertificateLookup').then((m) => ({ default: m.CertificateLookup })),
);
const Feedback = lazy(() => import('./pages/Feedback').then((m) => ({ default: m.Feedback })));
const SubmitResult = lazy(() =>
  import('./pages/SubmitResult').then((m) => ({ default: m.SubmitResult })),
);
const ChillGame = lazy(() => import('./pages/ChillGame').then((m) => ({ default: m.ChillGame })));
const AdminFeedback = lazy(() =>
  import('./pages/AdminFeedback').then((m) => ({ default: m.AdminFeedback })),
);
const AdminResults = lazy(() =>
  import('./pages/AdminResults').then((m) => ({ default: m.AdminResults })),
);
const AdminLogin = lazy(() =>
  import('./pages/AdminLogin').then((m) => ({ default: m.AdminLogin })),
);
const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
);
const AdminCertificates = lazy(() =>
  import('./pages/AdminCertificates').then((m) => ({ default: m.AdminCertificates })),
);
const AdminGameScores = lazy(() =>
  import('./pages/AdminGameScores').then((m) => ({ default: m.AdminGameScores })),
);

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
      <VisitTracker />
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-slate-500">
            Đang tải trang…
          </div>
        }
      >
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/tra-cuu" element={<CertificateLookup />} />
          <Route path="/gop-y" element={<Feedback />} />
          <Route path="/nop-ket-qua" element={<SubmitResult />} />
          <Route path="/goc-chill" element={<Navigate to="/minigame" replace />} />
          <Route path="/minigame" element={<ChillGame />} />
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
          <Route path="/quan-tri/phan-anh" element={<AdminFeedback />} />
          <Route path="/quan-tri/ket-qua" element={<AdminResults />} />
          <Route path="/quan-tri/tro-choi" element={<AdminGameScores />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;