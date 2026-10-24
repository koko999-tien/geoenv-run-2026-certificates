export interface CertificateRecord {
  id: string;
  full_name: string;
  class_name: string;
  is_eligible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  album_id: string;
  title: string;
  description: string | null;
  url: string;
  thumbnail_url: string;
  created_at: string;
}

export interface Album {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  photo_count: number;
  created_at: string;
}

export interface SearchResult {
  found: boolean;
  unique: boolean;
  record: CertificateRecord | null;
  message: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
}