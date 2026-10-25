// Lance la fonction Edge « gerer-acces » sur le port 54325 sans modifier son code.
const original = Deno.serve.bind(Deno);
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: any) => original({ port: 54325, hostname: '127.0.0.1' }, h);
const ici = new URL('.', import.meta.url);
await import(new URL('../../functions/gerer-acces/index.ts', ici).href);
