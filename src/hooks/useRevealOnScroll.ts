import { useEffect } from 'react';

/* Hiệu ứng cuộn hiện dần, dùng chung cho mọi trang: các mục có class
   reveal-on-scroll sẽ mờ dần thành rõ khi cuộn tới. Mỗi mục chỉ hiện 1 lần.
   (Tách từ Home.tsx để trang Minigame dùng chung cùng một ngôn ngữ reveal.) */
export function useRevealOnScroll() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('.reveal-on-scroll'));
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);
}
