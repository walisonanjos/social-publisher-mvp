// src/components/LanguageSwitcher.tsx
"use client";

import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState("en"); // ✅ MUDANÇA AQUI: "pt" → "en"

  const languages = [
    { code: "pt", name: "Português" },
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
  ];

  const getBaseLanguageCode = (languageCode: string) => {
    return languageCode.split('-')[0];
  };

  useEffect(() => {
    const baseLanguage = getBaseLanguageCode(i18n.language);
    setCurrentLanguage(baseLanguage);
  }, [i18n.language]);

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
    setCurrentLanguage(lng);
  };

  const currentLanguageName = languages.find(l => l.code === currentLanguage)?.name || "English"; // ✅ MUDANÇA AQUI: "Português" → "English"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center justify-center gap-2 text-white bg-gray-700 hover:bg-gray-600 py-2 px-3 rounded-lg focus:outline-none transition-colors w-32 relative">
        <span className="text-sm flex-1 text-center">
          {currentLanguageName}
        </span>
        <ChevronDown size={16} className="flex-shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="bg-gray-800 border border-gray-700 w-32" 
        align="center"
      >
        {languages.map((lng) => (
          <DropdownMenuItem
            key={lng.code}
            onClick={() => handleLanguageChange(lng.code)}
            className={`cursor-pointer text-white hover:bg-gray-700 px-3 py-2 text-sm ${currentLanguage === lng.code ? 'bg-gray-700' : ''}`}
          >
            <span className="flex justify-center w-full">
              {lng.name}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}