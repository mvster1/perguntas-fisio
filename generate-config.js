const fs = require("fs");

const out = `window.SUPABASE_URL = "${process.env.SUPABASE_URL}";
window.SUPABASE_ANON_KEY = "${process.env.SUPABASE_ANON_KEY}";
`;

fs.writeFileSync("config.js", out);
console.log("config.js gerado a partir do .env");
