// src/components/HtmlLangSetter.tsx
"use client";

import { useTranslation } from "react-i18next";
import { useEffect } from "react";

export default function HtmlLangSetter() {
  const { i18n } = useTranslation();

  useEffect(() => {
    // ✅ Atualiza o atributo lang do html quando o idioma mudar
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return null;
}