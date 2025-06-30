import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Crie um cliente Supabase no navegador com as credenciais do projeto
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
