export const MOCK_CERTIFICATES = [
  { id: '1', full_name: 'Nguyen Van A', class_name: 'Du lieu dia chat K68', is_eligible: true },
  { id: '2', full_name: 'Tran Thi B', class_name: 'Moi truong K67', is_eligible: true },
  { id: '3', full_name: 'Le Van C', class_name: 'Du lieu dia chat K68', is_eligible: false },
  { id: '4', full_name: 'Pham Van D', class_name: 'Khoa hoc dia chat K69', is_eligible: true },
  { id: '5', full_name: 'Nguyen Van A', class_name: 'Moi truong K67', is_eligible: true },
];

import type { Album, Photo } from '../types';

export const MOCK_ALBUMS: Album[] = [
  {
    id: '1',
    name: 'Toàn cảnh sự kiện',
    description: 'Những khoảnh khắc tổng quan của GEOENV RUN 2026',
    cover_image_url: null,
    photo_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Khai mạc và xuất phát',
    description: 'Lễ khai mạc và xuất phát của các đội',
    cover_image_url: null,
    photo_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Trên đường chạy',
    description: 'Khoảnh khắc trên đường chạy 10KM EKIDEN',
    cover_image_url: null,
    photo_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Về đích',
    description: 'Khoảnh khắc về đích và hoàn thành chặng đua',
    cover_image_url: null,
    photo_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'Khoảnh khắc tập thể',
    description: 'Ảnh tập thể các đội, sinh viên và ban tổ chức',
    cover_image_url: null,
    photo_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'test',
    name: 'Ảnh test',
    description: 'Ảnh test trước khi đăng tải toàn bộ — sẽ gỡ sau khi test xong',
    cover_image_url: '/test-anh/khanh-beo-1.jpg',
    photo_count: 6,
    created_at: new Date().toISOString(),
  },
];

/* Ảnh test (Tiến gửi, trừ ảnh thẻ) — tiêu đề giữ đúng tên "khánh béo N" để test tìm kiếm */
export const MOCK_PHOTOS: Photo[] = [
  { id: 'test-1', album_id: 'test', title: 'khánh béo 1', description: 'Ảnh test', url: '/test-anh/khanh-beo-1.jpg', thumbnail_url: '/test-anh/khanh-beo-1.jpg', created_at: new Date().toISOString() },
  { id: 'test-2', album_id: 'test', title: 'khánh béo 2', description: 'Ảnh test', url: '/test-anh/khanh-beo-2.jpg', thumbnail_url: '/test-anh/khanh-beo-2.jpg', created_at: new Date().toISOString() },
  { id: 'test-4', album_id: 'test', title: 'khánh béo 4', description: 'Ảnh test', url: '/test-anh/khanh-beo-4.jpg', thumbnail_url: '/test-anh/khanh-beo-4.jpg', created_at: new Date().toISOString() },
  { id: 'test-5', album_id: 'test', title: 'khánh béo 5', description: 'Ảnh test', url: '/test-anh/khanh-beo-5.jpg', thumbnail_url: '/test-anh/khanh-beo-5.jpg', created_at: new Date().toISOString() },
  { id: 'test-6', album_id: 'test', title: 'khánh béo 6', description: 'Ảnh test', url: '/test-anh/khanh-beo-6.jpg', thumbnail_url: '/test-anh/khanh-beo-6.jpg', created_at: new Date().toISOString() },
  { id: 'test-7', album_id: 'test', title: 'khánh béo 7', description: 'Ảnh test', url: '/test-anh/khanh-beo-7.jpg', thumbnail_url: '/test-anh/khanh-beo-7.jpg', created_at: new Date().toISOString() },
];