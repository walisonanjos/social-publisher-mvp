"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { timeZones } from "@/lib/timezones";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [selectedTimezone, setSelectedTimezone] = useState(initialTimezone);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialTimezone);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setSelectedTimezone(initialTimezone);
    setSearchQuery(initialTimezone);
  }, [initialTimezone]);

  const filteredTimeZones = useMemo(() => {
    if (!searchQuery) {
      return timeZones;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return timeZones.filter(tz => tz.toLowerCase().includes(lowerCaseQuery));
  }, [searchQuery]);

  const handleSelectTimezone = (timezone: string) => {
    setSelectedTimezone(timezone);
    setSearchQuery(timezone);
    setShowDropdown(false);
  };

  const handleSaveTimezone = async () => {
    setIsSaving(true);
    try {
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
        const savedTimezone = timeZones.find(tz => tz.endsWith(data.timezone));
        onTimezoneChange(savedTimezone || data.timezone);
        toast.success(t("timezone_updated_success"));
      }
    } catch (e) {
      if (e instanceof Error) {
        toast.error(`${t("save_error")}: ${e.message}`);
      } else {
        toast.error(t("unexpected_error"));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
      <label htmlFor="timezone-input" className="text-sm font-medium text-gray-300">
        {t("niche_timezone")}
      </label>
      <div className="relative flex items-center gap-2 w-full md:w-auto">
        <input
          id="timezone-input"
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => {
            setSearchQuery("");
            setShowDropdown(true);
          }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className="flex-grow md:flex-grow-0 bg-gray-900 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500"
          disabled={isSaving}
        />
        {showDropdown && (
          <ul className="absolute z-10 w-full mt-2 top-full max-h-60 overflow-y-auto bg-gray-800 border border-gray-600 rounded-md shadow-lg">
            {filteredTimeZones.map((tz) => (
              <li
                key={tz}
                onClick={() => handleSelectTimezone(tz)}
                className="px-3 py-2 cursor-pointer text-sm hover:bg-teal-600 hover:text-white"
              >
                {tz}
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={handleSaveTimezone}
          className="flex-shrink-0 flex items-center justify-center h-10 w-10 md:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500 disabled:opacity-50"
          disabled={isSaving || selectedTimezone === initialTimezone}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
        </button>
      </div>
    </div>
  );
}