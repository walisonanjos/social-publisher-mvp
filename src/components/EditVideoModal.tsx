// src/components/EditVideoModal.tsx
"use client";

import { useState, FormEvent, useEffect } from "react";
import { Video } from "@/types";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X } from "lucide-react";

interface EditVideoModalProps {
  video: Video;
  onClose: () => void;
  onSave: (updatedData: {
    title: string;
    description: string;
    scheduled_at: string;
  }) => Promise<void>;
}

export default function EditVideoModal({ video, onClose, onSave }: EditVideoModalProps) {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  
  const initialDate = new Date(video.scheduled_at);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(initialDate);
  const [scheduleTime, setScheduleTime] = useState(format(initialDate, "HH:mm"));

  const [isSaving, setIsSaving] = useState(false);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tenDaysFromNow = addDays(today, 9);
  const availableTimes = ["09:00", "11:00", "13:00", "15:00", "17:00"];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!scheduleDate) return;

    setIsSaving(true);
    
    const [hours, minutes] = scheduleTime.split(":").map(Number);
    const finalScheduleDate = new Date(scheduleDate);
    finalScheduleDate.setHours(hours, minutes, 0, 0);
    
    await onSave({
      title,
      // --- CORREÇÃO AQUI ---
      // Garante que nunca passaremos 'null', e sim uma string vazia.
      description: description ?? '', 
      scheduled_at: finalScheduleDate.toISOString(),
    });

    setIsSaving(false);
  };

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700 w-full max-w-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <X size={24} />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">Editar Agendamento</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-300">Título</label>
            <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full bg-gray-900 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500" required />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300">Descrição</label>
            <textarea id="description" value={description || ''} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 block w-full bg-gray-900 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Data do Agendamento</label>
              <DayPicker mode="single" selected={scheduleDate} onSelect={setScheduleDate} locale={ptBR} disabled={{ before: today, after: tenDaysFromNow }} className="bg-gray-900 p-2 rounded-md" classNames={{ caption: "flex justify-center py-2 mb-2 relative items-center", caption_label: "text-sm font-medium text-white", nav: "flex items-center", nav_button: "h-6 w-6 bg-transparent hover:bg-gray-700 p-1 rounded-full", nav_button_previous: "absolute left-1", nav_button_next: "absolute right-1", table: "w-full border-collapse", head_row: "flex font-medium text-gray-400", head_cell: "w-8 font-normal text-xs", row: "flex w-full mt-2", cell: "text-white h-8 w-8 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-teal-500/20 rounded-full", day: "h-8 w-8 p-0 font-normal hover:bg-teal-500/30 rounded-full transition-colors", day_selected: "bg-teal-600 text-white hover:bg-teal-700 rounded-full", day_today: "text-teal-400", day_outside: "text-gray-500 opacity-50", day_disabled: "text-gray-600 opacity-50" }} />
            </div>
            <div>
              <label htmlFor="scheduleTime" className="block text-sm font-medium text-gray-300 mb-2">Hora do Agendamento</label>
              <select id="scheduleTime" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="mt-1 block w-full bg-gray-900 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500">
                {availableTimes.map((time) => (<option key={time} value={time}>{time}</option>))}
              </select>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="w-full flex justify-center py-3 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50">
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}