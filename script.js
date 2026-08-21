// Valores vêm de config.js (gerado a partir do .env, veja README)
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const form = document.getElementById("form");
const textarea = document.getElementById("pergunta");
const senhaInput = document.getElementById("senha");
const status = document.getElementById("status");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pergunta = textarea.value.trim();
  const senha = senhaInput.value;
  if (!pergunta || !senha) return;

  status.textContent = "Enviando...";

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/enviar_pergunta`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_pergunta: pergunta, p_senha: senha }),
    });

    if (!res.ok) throw new Error(await res.text());

    status.textContent = "Pergunta enviada!";
    form.reset();
  } catch (err) {
    status.textContent = "Senha incorreta ou erro ao enviar.";
    console.error(err);
  }
});
