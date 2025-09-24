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
  const currentLanguage = i18n.language;

  const languages = [
    { code: "pt", name: "Português" },
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
  ];

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 text-white bg-gray-700 hover:bg-gray-600 py-2 px-3 rounded-lg focus:outline-none transition-colors">
        <span className="text-sm">{languages.find(l => l.code === currentLanguage)?.name || "Idioma"}</span>
        <ChevronDown size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="bg-gray-800 border border-gray-700 min-w-[128px]" 
        align="end"
      >
        {languages.map((lng) => (
          <DropdownMenuItem
            key={lng.code}
            onClick={() => handleLanguageChange(lng.code)}
            className={`cursor-pointer text-white hover:bg-gray-700 ${currentLanguage === lng.code ? 'bg-gray-700' : ''}`}
          >
            {lng.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}