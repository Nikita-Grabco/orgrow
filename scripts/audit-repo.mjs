/**
 * Auditoría previa a subir el repositorio: busca lo que NUNCA debe publicarse.
 *
 *   node scripts/audit-repo.mjs            # archivos versionados + historial local sin subir
 *   node scripts/audit-repo.mjs --files-only  # solo archivos (lo usa la integración continua)
 *
 * Revisa:
 *  - archivos .env* versionados (solo se admite .env.example)
 *  - claves y tokens: JWT de Supabase (eyJ…), sb_secret_/sb_publishable_ con valor, claves
 *    privadas PEM, claves VAPID privadas, tokens de GitHub/AWS
 *  - variables sensibles con valor asignado en archivos versionados
 *  - correos personales en archivos y en autor/committer del historial
 *  - líneas "Co-Authored-By" en los mensajes de commit aún no publicados
 *
 * Sale con código 1 si encuentra algo. No imprime el valor del secreto, solo dónde está.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const SKIP_FILES =
  /(^|\/)(package-lock\.json|bun\.lock|bun\.lockb|routeTree\.gen\.ts)$|\.(png|jpg|ico|webp|woff2?)$/i;

/** Dominios de correo que no son personales (ejemplos de los tests, cuentas anónimas de GitHub). */
const SAFE_EMAIL =
  /@(example\.(com|invalid|org)|users\.noreply\.github\.com|noreply\.github\.com|anthropic\.com|[a-z0-9-]*\.invalid|test\.[a-z]+|localhost|mail.com|ejemplo.com|b.c)$/i;

const PATTERNS = [
  {
    name: "JWT (clave de Supabase u otro token)",
    re: /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/,
  },
  { name: "clave secreta de Supabase", re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: "clave publicable de Supabase con valor", re: /sb_publishable_[A-Za-z0-9_-]{10,}/ },
  { name: "clave privada PEM", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "token de GitHub", re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: "clave de AWS", re: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: "variable sensible con valor",
    re: /\b(VAPID_PRIVATE_KEY|CRON_SECRET|SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|LOVABLE_API_KEY)\s*[=:]\s*["']?[A-Za-z0-9_\-+/=]{16,}/,
  },
  {
    name: "URL de proyecto de Supabase real",
    // TU_REF, <ref>, xxxx… y similares son marcadores; un ref real son 20 letras/números.
    re: /https:\/\/(?!TU_REF|abcdefghijklmnopqrst)[a-z0-9]{20}\.supabase\.co/,
  },
];

const problems = [];
const report = (where, what) => problems.push(`${where}: ${what}`);

/* 1) Archivos versionados */
const tracked = git("ls-files", "-z").split("\0").filter(Boolean);

for (const file of tracked) {
  if (/(^|\/)\.env(\.|$)/.test(file) && !file.endsWith(".env.example")) {
    report(file, "archivo .env versionado");
  }
  if (SKIP_FILES.test(file)) continue;

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (text.includes("\0")) continue;

  text.split(/\r?\n/).forEach((line, index) => {
    for (const { name, re } of PATTERNS) {
      if (re.test(line)) report(`${file}:${index + 1}`, name);
    }
    for (const email of line.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/g) ?? []) {
      // Cosas como "@types/node" o "name@1.2.3" no son correos.
      if (/\.(ts|js|mjs|json|css|tsx|png)$/i.test(email) || /@\d/.test(email)) continue;
      if (!SAFE_EMAIL.test(email) && !/^(tu|su|mi)@|TU_EMAIL|tu@email/i.test(email)) {
        report(`${file}:${index + 1}`, `correo (${email.replace(/^[^@]*/, "***")})`);
      }
    }
  });
}

/* 2) Historial aún no publicado (o todo si no hay remoto) */
const filesOnly = process.argv.includes("--files-only");
let range = "HEAD";
try {
  const upstream = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}").trim();
  range = `${upstream}..HEAD`;
} catch {
  // Sin rama remota asociada: se revisa todo el historial.
}

const log = filesOnly
  ? []
  : git("log", range, "--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e")
      .split("\x1e")
      .map((entry) => entry.trim())
      .filter(Boolean);

for (const entry of log) {
  const [hash, an, ae, cn, ce, body = ""] = entry.split("\x1f");
  const short = hash.slice(0, 7);
  for (const email of [ae, ce]) {
    if (!SAFE_EMAIL.test(email))
      report(`commit ${short}`, `correo en autor/committer (${email.replace(/^[^@]*/, "***")})`);
  }
  if (/co-authored-by/i.test(body)) report(`commit ${short}`, "línea Co-Authored-By en el mensaje");
  void an;
  void cn;
}

console.log(
  `Revisados ${tracked.length} archivos versionados y ${log.length} commits (${range === "HEAD" ? "todo el historial" : range}).`,
);

if (problems.length > 0) {
  console.error(
    `\n✖ ${problems.length} problema(s):\n` + problems.map((p) => `  - ${p}`).join("\n"),
  );
  process.exit(1);
}
console.log("✔ Nada sospechoso.");
