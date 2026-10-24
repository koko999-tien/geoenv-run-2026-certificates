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
    name: 'Toan canh su kien',
    description: 'Nhung khoảnh khac tong quan cua GEOENV RUN 2026',
    cover_image_url: null,
    photo_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Khai mac va xuat phat',
    description: 'Lan sao khai mac va khoi hanh cua cac doi',
    cover_image_url: null,
    photo_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Tren duong chay',
    description: 'Khoảnh khac tren duong chay 10KM EKIDEN',
    cover_image_url: null,
    photo_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Ve dich',
    description: 'Khoảnh khac den dich va hoa hong hoan thanh',
    cover_image_url: null,
    photo_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'Khoan khac tap the',
    description: 'Anh tap the cac doi, sinh vien va ban to chuc',
    cover_image_url: null,
    photo_count: 0,
    created_at: new Date().toISOString(),
  },
];

export const MOCK_PHOTOS: Photo[] = [];