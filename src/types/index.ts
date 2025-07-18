// src/types/index.ts
// VERSÃO ATUALIZADA PARA STATUS INDIVIDUAIS

// A definição ÚNICA e COMPLETA para Niche, usada em todo o app.
export type Niche = {
  id: string;
  name: string;
};

// A definição ÚNICA e COMPLETA para Video, usada em todo o app.
export type Video = {
  id: string;
  created_at: string;
  title: string;
  description: string;
  video_url: string;
  scheduled_at: string;
  user_id: string;
  niche_id: string;
  youtube_video_id: string | null;
  post_error: string | null;
  cloudinary_public_id: string | null; // Adicionado para consistência
  
  // ALVO DAS PUBLICAÇÕES
  target_youtube: boolean | null;
  target_instagram: boolean | null;
  target_facebook: boolean | null;
  target_tiktok?: boolean | null;

  // NOVOS STATUS INDIVIDUAIS
  youtube_status: 'agendado' | 'publicado' | 'falhou' | null;
  instagram_status: 'agendado' | 'publicado' | 'falhou' | null;
  facebook_status: 'agendado' | 'publicado' | 'falhou' | null;

  // A coluna antiga 'status' foi removida do tipo
};