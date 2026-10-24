import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { FeedbackFloatButton } from './FeedbackFloatButton';

export function Layout() {
  return (
    <div className="min-h-svh flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
      <FeedbackFloatButton />
    </div>
  );
}