// src/components/LanguageSwitcher.tsx
"use client";

import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const languages = {
    pt: 'Português',
    en: 'English',
    fr: 'Français',
    es: 'Español',
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors"
      >
        <span>{languages[i18n.language as keyof typeof languages]}</span>
        <ChevronDown size={14} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <ul className="absolute right-0 mt-2 z-20 w-40 rounded-lg bg-gray-800 border border-gray-600 shadow-lg">
          {Object.keys(languages).map((lng) => (
            <li
              key={lng}
              onClick={() => changeLanguage(lng)}
              className="p-3 hover:bg-teal-600 cursor-pointer rounded-lg text-sm"
            >
              {languages[lng as keyof typeof languages]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}