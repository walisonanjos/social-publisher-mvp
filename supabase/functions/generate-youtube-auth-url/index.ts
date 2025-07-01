import { corsHeaders } from "../_shared/cors.ts";

console.log("Código da função 'generate-youtube-auth-url' carregado.");

Deno.serve(async (_req) => {
  console.log("Função 'generate-youtube-auth-url' foi chamada!");

  // Retorna uma resposta simples em vez de uma URL do Google
  return new Response(
    JSON.stringify({ message: "Olá do generate-youtube-auth-url!" }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Retorna um status de sucesso
    },
  );
});
