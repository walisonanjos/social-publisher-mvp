import { corsHeaders } from "../_shared/cors.ts";

console.log("Código da função 'exchange-auth-code' carregado.");

Deno.serve(async (_req) => {
  console.log("Função 'exchange-auth-code' foi chamada!");

  return new Response(
    JSON.stringify({ message: "Olá do exchange-auth-code!" }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    },
  );
});
