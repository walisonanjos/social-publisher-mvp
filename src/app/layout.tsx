// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "../components/Footer";
import { Toaster } from 'sonner';
import I18nClientProvider from "@/components/I18nClientProvider";
import HtmlLangSetter from "@/components/HtmlLangSetter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Social Publisher MVP",
  description: "Agende suas postagens de forma fácil.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <I18nClientProvider>
      <html>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-gray-900`}
        >
          <HtmlLangSetter />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
          <Toaster theme="dark" richColors position="bottom-right" />
        </body>
      </html>
    </I18nClientProvider>
  );
}