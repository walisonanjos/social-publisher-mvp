'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="w-full border-t border-gray-700 mt-auto py-8 bg-gray-800">
      <div className="container mx-auto text-center text-gray-400 text-sm">
        <p>© {new Date().getFullYear()} Social Publisher MVP. {t("all_rights_reserved")}</p>
        <div className="mt-4 flex justify-center gap-x-6">
          <Link href="/terms" className="hover:text-teal-400 transition-colors">
            {t("terms_of_service")}
          </Link>
          <Link href="/privacy" className="hover:text-teal-400 transition-colors">
            {t("privacy_policy")}
          </Link>
        </div>
      </div>
    </footer>
  );
}