import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "../components/Footer";
import { Toaster } from 'sonner';
import I18nClientProvider from "@/components/I18nClientProvider";
import MainHeader from "@/components/MainHeader";
import { createClient } from "@/lib/supabaseClient";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <I18nClientProvider>
      <html lang="pt-br">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-gray-900`}
        >
          <MainHeader user={user} />
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