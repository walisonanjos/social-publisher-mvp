// src/components/UploadForm.tsx
"use client";

import { useState, FormEvent, useMemo } from "react";
import { createClient } from "../lib/supabaseClient";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { Video } from "@/types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface UploadFormProps {
  nicheId: string;
  nicheTimezone: string;
  onScheduleSuccess: (newVideo: Video, clearFileCallback: () => void) => void;
  isYouTubeConnected: boolean;
  isInstagramConnected: boolean;
  isTikTokConnected: boolean;
  title: string;
  setTitle: (title: string) => void;
  description: string;
  setDescription: (description: string) => void;
}

export default function UploadForm({
  nicheId,
  nicheTimezone,
  onScheduleSuccess,
  isYouTubeConnected,
  isInstagramConnected,
  isTikTokConnected,
  title,
  setTitle,
  description,
  setDescription,
}: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(
    new Date()
  );
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [isUploading, setIsUploading] = useState(false);

  const [postToYouTube, setPostToYouTube] = useState(true);
  const [postToInstagram, setPostToInstagram] = useState(true);
  const [postToFacebook, setPostToFacebook] = useState(true);
  const [postToTikTok, setPostToTikTok] = useState(false);

  const supabase = createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tenDaysFromNow = addDays(today, 9);
  const availableTimes = ["09:00", "11:00", "13:00", "15:00", "17:00"];

  const displayTimezone = useMemo(() => {
    try {
      const nowInTimezone = toZonedTime(new Date(), nicheTimezone);
      const formatter = new Intl.DateTimeFormat("pt-BR", {
        timeZone: nicheTimezone,
        timeZoneName: "shortOffset",
      });
      const offset = formatter.format(nowInTimezone).split(' ')[1];
      return `(${nicheTimezone} ${offset})`;
    } catch (e) {
      return nicheTimezone;
    }
  }, [nicheTimezone]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setFile(null);
    const fileInput = document.getElementById(
      "file-upload"
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !title || !scheduleDate) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    if (
      !postToYouTube &&
      !postToInstagram &&
      !postToFacebook &&
      !postToTikTok
    ) {
      toast.error(
        "Por favor, selecione pelo menos uma rede social para postar."
      );
      return;
    }

    setIsUploading(true);

    try {
      if (!nicheId) throw new Error("O ID do workspace é inválido.");

      const [hours, minutes] = scheduleTime.split(":");
      const finalScheduleDate = new Date(scheduleDate);
      finalScheduleDate.setHours(
        parseInt(hours, 10),
        parseInt(minutes, 10),
        0,
        0
      );
      const scheduledAtUTC = fromZonedTime(finalScheduleDate, nicheTimezone).toISOString();
      const scheduled_at_iso = scheduledAtUTC;

      const { data: existingPost, error: checkError } = await supabase
        .from("videos")
        .select("id")
        .eq("niche_id", nicheId)
        .eq("scheduled_at", scheduled_at_iso)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        throw checkError;
      }
      if (existingPost) {
        throw new Error(
          "Já existe um agendamento para este workspace neste mesmo dia e hora."
        );
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "upload_preset",
        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
      );

      const cloudinaryResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`,
        { method: "POST", body: formData }
      );
      if (!cloudinaryResponse.ok)
        throw new Error("Falha no upload para o Cloudinary.");

      const cloudinaryData = await cloudinaryResponse.json();
      const videoUrl = cloudinaryData.secure_url;
      const cloudinaryPublicId = cloudinaryData.public_id;
      const videoSizeBytes = cloudinaryData.bytes;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const { data: newVideo, error: insertError } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          niche_id: nicheId,
          title,
          description,
          video_url: videoUrl,
          cloudinary_public_id: cloudinaryPublicId,
          video_size_bytes: videoSizeBytes,
          scheduled_at: scheduled_at_iso,
          target_youtube: postToYouTube,
          target_instagram: postToInstagram,
          target_facebook: postToFacebook,
          target_tiktok: postToTikTok,
          youtube_status: postToYouTube ? "agendado" : null,
          instagram_status: postToInstagram ? "agendado" : null,
          facebook_status: postToFacebook ? "agendado" : null,
          tiktok_status: postToTikTok ? "agendado" : null,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          throw new Error(
            "Já existe um agendamento para este workspace neste mesmo dia e hora."
          );
        }
        throw insertError;
      }
      if (!newVideo)
        throw new Error(
          "Não foi possível obter os dados do agendamento criado."
        );

      toast.success("Seu vídeo foi agendado com sucesso!");

      onScheduleSuccess(newVideo as Video, clearFile);
    } catch (err) {
      if (err instanceof Error) {
        toast.error(`Ocorreu um erro: ${err.message}`);
      } else {
        toast.error("Ocorreu um erro inesperado.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      id="upload-form"
      className="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700"
    >
      <h2 className="text-xl font-bold text-white mb-6">Novo Agendamento</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="file-upload"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Arquivo de Vídeo
          </label>
          <input
            id="file-upload"
            type="file"
            accept="video/mp4,video/quicktime"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-500/10 file:text-teal-300 hover:file:bg-teal-500/20"
          />
        </div>
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-300"
          >
            Título
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(_e) => setTitle(_e.target.value)} // <-- Linha corrigida
            className="mt-1 block w-full bg-gray-900 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500"
            required
          />
        </div>
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-300"
          >
            Descrição
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(_e) => setDescription(_e.target.value)}
            rows={3}
            className="mt-1 block w-full bg-gray-900 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Data do Agendamento
            </label>
            <DayPicker
              mode="single"
              selected={scheduleDate}
              onSelect={setScheduleDate}
              locale={ptBR}
              disabled={{ before: today, after: tenDaysFromNow }}
              className="bg-gray-900 p-2 rounded-md"
              classNames={{
                caption: "flex justify-center py-2 mb-2 relative items-center",
                caption_label: "text-sm font-medium text-white",
                nav: "flex items-center",
                nav_button:
                  "h-6 w-6 bg-transparent hover:bg-gray-700 p-1 rounded-full",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse",
                head_row: "flex font-medium text-gray-400",
                head_cell: "w-8 font-normal text-xs",
                row: "flex w-full mt-2",
                cell: "text-white h-8 w-8 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-teal-500/20 rounded-full",
                day: "h-8 w-8 p-0 font-normal hover:bg-teal-500/30 rounded-full transition-colors",
                day_selected:
                  "bg-teal-600 text-white hover:bg-teal-700 rounded-full",
                day_today: "text-teal-400",
                day_outside: "text-gray-500 opacity-50",
                day_disabled: "text-gray-600 opacity-50",
              }}
            />
          </div>
          <div>
            <label
              htmlFor="scheduleTime"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Hora do Agendamento
            </label>
            <div className="flex items-center gap-2">
              <select
                id="scheduleTime"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="mt-1 block w-full bg-gray-900 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500"
              >
                {availableTimes.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
              <span className="text-gray-400 text-sm">{displayTimezone}</span>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">Postar em:</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label
              className={`flex items-center gap-2 ${
                isInstagramConnected
                  ? "cursor-pointer text-white"
                  : "cursor-not-allowed text-gray-500"
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                checked={postToInstagram}
                onChange={(e) => setPostToInstagram(e.target.checked)}
                disabled={!isInstagramConnected}
              />
              Instagram
            </label>
            <label
              className={`flex items-center gap-2 ${
                isInstagramConnected
                  ? "cursor-pointer text-white"
                  : "cursor-not-allowed text-gray-500"
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                checked={postToFacebook}
                onChange={(e) => setPostToFacebook(e.target.checked)}
                disabled={!isInstagramConnected}
              />
              Facebook
            </label>
            <label
              className={`flex items-center gap-2 ${
                isYouTubeConnected
                  ? "cursor-pointer text-white"
                  : "cursor-not-allowed text-gray-500"
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                checked={postToYouTube}
                onChange={(e) => setPostToYouTube(e.target.checked)}
                disabled={!isYouTubeConnected}
              />
              YouTube
            </label>
            <label
              className={`flex items-center gap-2 ${
                isTikTokConnected
                  ? "cursor-pointer text-white"
                  : "cursor-not-allowed text-gray-500"
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                checked={postToTikTok}
                onChange={(e) => setPostToTikTok(e.target.checked)}
                disabled={!isTikTokConnected}
              />
              TikTok
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-gray-500">
              <input
                type="checkbox"
                className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-teal-600 focus:ring-teal-500"
                disabled
              />
              Kwai
            </label>
          </div>
        </div>
        <div>
          <button
            type="submit"
            disabled={isUploading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500 disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Agendando...
              </>
            ) : (
              "Agendar Post"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}