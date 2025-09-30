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

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const languages = [
    { code: "pt", name: "Português" },
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
  ];

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // ✅ FORÇA usar o idioma atual do i18n, mesmo que mude durante renderização
  const currentLanguageName = languages.find(l => l.code === i18n.language)?.name || "Language";

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
            className={`cursor-pointer text-white hover:bg-gray-700 px-3 py-2 text-sm ${i18n.language === lng.code ? 'bg-gray-700' : ''}`}
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