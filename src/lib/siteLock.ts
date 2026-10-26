import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/* Cờ khóa khu vực công khai (bảng site_settings, key public_locked).
   Bảng chưa có hoặc đọc lỗi thì coi như KHÔNG khóa, để trang không tự khóa oan. */
export async function isPublicLocked(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'public_locked')
      .maybeSingle();
    return data?.value === 'true';
  } catch {
    return false;
  }
}

/* Người xem hiện tại có đang đăng nhập bằng tài khoản quản trị hay không. */
export async function hasAdminSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

/* Hook dùng chung cho trang công khai: đang kiểm tra / bị khóa / có phải admin. */
export function usePublicLock() {
  const [lock, setLock] = useState({ checked: false, locked: false, isAdmin: false });
  useEffect(() => {
    let alive = true;
    (async () => {
      const [locked, session] = await Promise.all([isPublicLocked(), hasAdminSession()]);
      if (alive) setLock({ checked: true, locked, isAdmin: !!session });
    })();
    return () => {
      alive = false;
    };
  }, []);
  return lock;
}

/* Cờ khóa trò chơi (bảng site_settings, key game_locked).
   NGƯỢC với khóa tra cứu: bảng chưa có hoặc đọc lỗi thì coi như ĐANG KHÓA
   (fail closed) — trò chơi ra mắt ở trạng thái khóa, chỉ quản trị viên chơi
   được, đến khi Tiến mở bằng công tắc trong Dashboard. */
export async function isGameLocked(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'game_locked')
      .maybeSingle();
    if (!data) return true;
    return data.value === 'true';
  } catch {
    return true;
  }
}

/* Hook dùng chung cho tab trò chơi: đang kiểm tra / bị khóa / có phải admin. */
export function useGameLock() {
  const [lock, setLock] = useState({ checked: false, locked: true, isAdmin: false });
  useEffect(() => {
    let alive = true;
    (async () => {
      const [locked, session] = await Promise.all([isGameLocked(), hasAdminSession()]);
      if (alive) setLock({ checked: true, locked, isAdmin: !!session });
    })();
    return () => {
      alive = false;
    };
  }, []);
  return lock;
}
