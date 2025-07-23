// src/types/index.ts

export type Niche = {
  id: string;
  name: string;
};

export type Video = {
  id: number; // Alterado para number para corresponder ao tipo bigint
  created_at: string;
  title: string;
  description: string | null;
  video_url: string;
  scheduled_at: string;
  
  // Status individuais
  youtube_status: 'agendado' | 'publicado' | 'falhou' | null;
  instagram_status: 'agendado' | 'publicado' | 'falhou' | null;
  facebook_status: 'agendado' | 'publicado' | 'falhou' | null;

  user_id: string;
  youtube_video_id: string | null;
  
  // --- NOVAS COLUNAS PARA OS IDs ---
  instagram_post_id: string | null;
  facebook_post_id: string | null;

  post_error: string | null;
  
  // Alvos
  target_youtube: boolean | null;
  target_instagram: boolean | null;
  target_facebook: boolean | null;
  
  niche_id: number; // Assumindo que niche_id também é um número (bigint)
  retry_count: number;
};