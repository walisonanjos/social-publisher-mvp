// src/components/I18nClientProvider.tsx
"use client";

import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";

interface I18nClientProviderProps {
  children: React.ReactNode;
}

export default function I18nClientProvider({ children }: I18nClientProviderProps) {
  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  );
}