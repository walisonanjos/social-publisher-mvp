// src/components/TimezoneSelector.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { timeZones } from "@/lib/timezones";

interface TimezoneSelectorProps {
  nicheId: string;
  initialTimezone: string;
  onTimezoneChange: (newTimezone: string) => void;
}

export default function TimezoneSelector({
  nicheId,
  initialTimezone,
  onTimezoneChange,
}: TimezoneSelectorProps) {
  const supabase = createClient();
  const [selectedTimezone, setSelectedTimezone] = useState(initialTimezone);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedTimezone(initialTimezone);
  }, [initialTimezone]);

  const handleSaveTimezone = async () => {
    setIsSaving(true);
    try {
      // Extraindo apenas o nome canônico do fuso horário antes de salvar
      const timezoneToSave = selectedTimezone.split(') ')[1];

      const { data, error } = await supabase
        .from("niches")
        .update({ timezone: timezoneToSave })
        .eq("id", nicheId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      if (data) {
        // Retornando a string completa para o componente pai
        const savedTimezone = timeZones.find(tz => tz.endsWith(data.timezone));
        onTimezoneChange(savedTimezone || data.timezone);
        toast.success("Fuso horário atualizado!");
      }
    } catch (e) {
      if (e instanceof Error) {
        toast.error(`Erro ao salvar: ${e.message}`);
      } else {
        toast.error("Ocorreu um erro inesperado.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
      <label htmlFor="timezone-select" className="text-sm font-medium text-gray-300">
        Fuso Horário do Nicho:
      </label>
      <div className="flex items-center gap-2 w-full md:w-auto">
        <select
          id="timezone-select"
          value={selectedTimezone}
          onChange={(e) => setSelectedTimezone(e.target.value)}
          className="flex-grow md:flex-grow-0 bg-gray-900 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500"
          disabled={isSaving}
        >
          {timeZones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <button
          onClick={handleSaveTimezone}
          className="flex-shrink-0 flex items-center justify-center h-10 w-10 md:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500 disabled:opacity-50"
          disabled={isSaving || selectedTimezone === initialTimezone}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
        </button>
      </div>
    </div>
  );
}