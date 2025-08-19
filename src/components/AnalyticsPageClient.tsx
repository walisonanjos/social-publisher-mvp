// src/components/AnalyticsPageClient.tsx

"use client";

import { useEffect, useState, useCallback } from "react";

import Link from 'next/link';

import { createClient } from "@/lib/supabaseClient";

import { User } from "@supabase/supabase-js";

import { Loader2, BarChart2 as ChartIcon, Youtube, Instagram } from "lucide-react";



import MainHeader from "@/components/MainHeader";

import Navbar from "@/components/Navbar";

import Auth from "@/components/Auth";



// NOSSOS NOVOS COMPONENTES DE VISUALIZAÇÃO

import YouTubeAnalyticsView from "./YouTubeAnalyticsView";

import MetaAnalyticsView from "./MetaAnalyticsView";



// Tipos (atualizados para remover 'any' e corresponder aos componentes)

interface VideoStatistics { viewCount: string; likeCount: string; commentCount: string; } // Tipo movido, mas mantido para referência se ainda usado em AnalyticsPageClient

interface YouTubeAnalyticsVideo { youtube_video_id: string; title: string; thumbnail: string; scheduled_at: string; statistics: VideoStatistics; }



interface MetaInsightValue { value: number; } // Tipo movido, mas mantido para referência

interface MetaInsight { name: string; period: string; values: MetaInsightValue[]; } // Tipo movido, mas mantido para referência

interface MetaAnalyticsVideo { id: number; title: string; scheduled_at: string; instagram_post_id: string | null; facebook_post_id: string | null; instagram_insights: MetaInsight[] | null; facebook_insights: MetaInsight[] | null; }





export default function AnalyticsPageClient({ nicheId }: { nicheId: string }) {

  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);

  const [nicheName, setNicheName] = useState("Análises");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

 

  const [youtubeData, setYoutubeData] = useState<YouTubeAnalyticsVideo[]>([]);

  const [metaData, setMetaData] = useState<MetaAnalyticsVideo[]>([]);

 

  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);

  const [isInstagramConnected, setIsInstagramConnected] = useState(false);

  const [activeTab, setActiveTab] = useState<'youtube' | 'meta'>('youtube');



  const fetchPageData = useCallback(async (userId: string) => {

    setError(null);

    setLoading(true);



    try {

      const { data: nicheData } = await supabase.from('niches').select('name').eq('id', nicheId).single();

      if (nicheData) setNicheName(nicheData.name);



      const { data: connections } = await supabase.from('social_connections').select('platform').eq('user_id', userId).eq('niche_id', nicheId);

     

      const ytConnected = connections?.some(c => c.platform === 'youtube') || false;

      const igConnected = connections?.some(c => c.platform === 'instagram') || false;

      setIsYouTubeConnected(ytConnected);

      setIsInstagramConnected(igConnected);



      // Define a aba inicial com base na conexão

      if (ytConnected && activeTab !== 'meta') { // Se YouTube está conectado e a aba atual não é Meta

        setActiveTab('youtube');

      } else if (igConnected) { // Se Instagram está conectado (e YouTube não, ou a aba já era Meta)

        setActiveTab('meta');

      } else { // Se nenhum está conectado, ou se a aba atual é meta e YouTube não está conectado, default para youtube (será a tela de "não conectado")

        setActiveTab('youtube');

      }



      // Busca os dados para ambas as plataformas em paralelo

      const promises = [];

      if (ytConnected) promises.push(supabase.functions.invoke("get-youtube-analytics", { body: { nicheId } }));

      if (igConnected) promises.push(supabase.functions.invoke("get-meta-analytics", { body: { nicheId } }));

     

      const results = await Promise.all(promises);

      let resultIndex = 0;



      if (ytConnected) {

        const ytResult = results[resultIndex++];

        if (ytResult?.error) throw new Error(`YouTube Analytics: ${ytResult.error.message}`);

        setYoutubeData(ytResult?.data?.data || []);

      } else {

        setYoutubeData([]); // Limpa dados se não estiver conectado

      }

      if (igConnected) {

        const metaResult = results[resultIndex++];

        if (metaResult?.error) throw new Error(`Meta Analytics: ${metaResult.error.message}`);

        setMetaData(metaResult?.data?.data || []);

      } else {

        setMetaData([]); // Limpa dados se não estiver conectado

      }

    } catch (e) {

      if (e instanceof Error) setError(e.message);

      else setError("Ocorreu um erro desconhecido ao buscar análises.");

    } finally {

      setLoading(false);

    }

  }, [nicheId, supabase, activeTab]);



  useEffect(() => {

    const initialize = async () => {

      const { data: { user: currentUser } } = await supabase.auth.getUser();

      setUser(currentUser);

      if (currentUser) {

        await fetchPageData(currentUser.id);

      } else {

        setLoading(false);

      }

    };

    initialize();

  }, [fetchPageData, supabase.auth]);



  useEffect(() => {

    if (!user) return;

    // Monitora mudanças na tabela de 'videos'

    const videosChannel = supabase.channel(`analytics-realtime-videos-${nicheId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'videos', filter: `niche_id=eq.${nicheId}`}, () => {

      if (user) fetchPageData(user.id);

    }).subscribe();



    // Monitora mudanças na tabela de 'social_connections'

    const connectionsChannel = supabase.channel(`analytics-realtime-connections-${nicheId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'social_connections', filter: `niche_id=eq.${nicheId}`}, () => {

      if (user) fetchPageData(user.id);

    }).subscribe();



    return () => {

      supabase.removeChannel(videosChannel);

      supabase.removeChannel(connectionsChannel);

    };

  }, [user, nicheId, supabase, fetchPageData]);





  if (loading) { return <div className="flex items-center justify-center min-h-screen bg-gray-900"><Loader2 className="h-12 w-12 text-teal-400 animate-spin" /></div>; }

  if (!user) { return <Auth />; }



  const renderContent = () => {

    if (!isYouTubeConnected && !isInstagramConnected) {

      return (

        <div className="text-center bg-gray-800 p-8 rounded-lg border border-gray-700">

          <ChartIcon className="mx-auto h-12 w-12 text-gray-500" />

          <h3 className="mt-4 text-lg font-medium text-white">Nenhuma plataforma conectada</h3>

          <p className="mt-2 text-sm text-gray-400">

            Conecte uma conta para começar a ver as análises de performance.

          </p>

          <Link href={`/niche/${nicheId}`}>

            <button className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700">

              Ir para a página de conexão

            </button>

          </Link>

        </div>

      );

    }



    if (error) {

      return <div className="bg-red-500/20 text-red-300 p-4 rounded-md"><p className="font-bold mb-2">Ocorreu um erro:</p><p>{error}</p></div>

    }



    return (

      <>

        <div className="mb-6 border-b border-gray-700">

          <nav className="-mb-px flex space-x-6" aria-label="Tabs">

            {isYouTubeConnected && (<button onClick={() => setActiveTab('youtube')} className={`${activeTab === 'youtube' ? 'border-teal-400 text-teal-300' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}><Youtube size={16} /> YouTube</button>)}

            {isInstagramConnected && (<button onClick={() => setActiveTab('meta')} className={`${activeTab === 'meta' ? 'border-teal-400 text-teal-300' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}><Instagram size={16} /> Instagram & Facebook</button>)}

          </nav>

        </div>



        {activeTab === 'youtube' && <YouTubeAnalyticsView data={youtubeData} nicheId={nicheId} />}

        {activeTab === 'meta' && <MetaAnalyticsView data={metaData} nicheId={nicheId} />}

      </>

    );

  };

 

  return (

    <div className="bg-gray-900 min-h-screen text-white">

      <MainHeader user={user} pageTitle={`${nicheName} - Análises`} backLink={`/niche/${nicheId}`} />

      <main className="container mx-auto p-4 md:p-8">

        <Navbar nicheId={nicheId} />

        <div className="mt-8">

          <h2 className="text-2xl font-bold tracking-tight text-white mb-6">Dashboard de Análises</h2>

          {renderContent()}

        </div>

      </main>

    </div>

  );

}