// src/components/LanguageSwitcher.tsx
"use client";

import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function LanguageSwitcher() {
  const { i18n, ready } = useTranslation(); // ✅ 'ready' indica se i18n está carregado
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [isLoading, setIsLoading] = useState(!ready);

  const languages = [
    { code: "pt", name: "Português" },
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
  ];

  // ✅ Sincroniza quando i18n estiver pronto e quando idioma mudar
  useEffect(() => {
    if (ready) {
      setCurrentLanguage(i18n.language);
      setIsLoading(false);
    }
  }, [i18n.language, ready]);

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
    setCurrentLanguage(lng);
  };

  // ✅ Encontra o nome do idioma atual ou mostra loading
  const currentLanguageName = languages.find(l => l.code === currentLanguage)?.name;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-white bg-gray-700 py-2 px-3 rounded-lg w-32">
        <Loader2 size={16} className="animate-spin" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center justify-center gap-2 text-white bg-gray-700 hover:bg-gray-600 py-2 px-3 rounded-lg focus:outline-none transition-colors w-32 relative">
        <span className="text-sm flex-1 text-center">
          {currentLanguageName || "Idioma"}
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