// Helper LLM unifié — fallback automatique Anthropic → Gemini.
//
// Variables d'environnement supportées :
//   - ANTHROPIC_API_KEY  (Claude — payant après les ~5$ d'essai)
//   - GOOGLE_API_KEY     (Gemini — free tier 15 req/min, 1500 req/jour)
//   - GEMINI_API_KEY     (alias accepté)
//
// Si ANTHROPIC_API_KEY est défini, on tente Claude d'abord (meilleure qualité).
// Sinon, ou en cas d'échec Claude, on tombe sur Gemini Flash.

export type LlmTask = "ocr" | "cv";

export interface LlmCallOptions {
  prompt: string;
  /// Data URI complet : "data:image/png;base64,..." ou "data:application/pdf;base64,..."
  dataUri: string;
  /// "ocr" → modèles rapides (Haiku / Gemini Flash). "cv" → modèles qualité (Sonnet / Gemini Flash)
  task: LlmTask;
  maxTokens?: number;
}

export type LlmCallResult =
  | { ok: true; text: string; provider: "anthropic" | "gemini" }
  | { ok: false; error: string };

const PDF_MIME = "application/pdf";

export async function callLlmWithMedia(opts: LlmCallOptions): Promise<LlmCallResult> {
  const match = opts.dataUri.match(
    /^data:(image\/(png|jpeg|jpg|webp)|application\/pdf);base64,(.+)$/
  );
  if (!match) {
    return { ok: false, error: "Format non supporté (PNG/JPEG/WebP/PDF requis)" };
  }
  const isImage = match[1].startsWith("image/");
  const mediaType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const base64 = match[3];

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;

  if (!anthropicKey && !googleKey) {
    return {
      ok: false,
      error:
        "Aucune clé API configurée. Définis GOOGLE_API_KEY (Gemini, gratuit) ou ANTHROPIC_API_KEY dans Vercel."
    };
  }

  // 1. Anthropic d'abord si dispo
  if (anthropicKey) {
    const r = await callAnthropic({
      prompt: opts.prompt,
      isImage,
      mediaType,
      base64,
      task: opts.task,
      maxTokens: opts.maxTokens,
      apiKey: anthropicKey
    });
    if (r.ok) return r;
    // Si Anthropic a planté mais qu'on a Gemini, on tente quand même
    if (!googleKey) return r;
  }

  // 2. Fallback Gemini
  if (googleKey) {
    return callGemini({
      prompt: opts.prompt,
      mediaType,
      base64,
      task: opts.task,
      maxTokens: opts.maxTokens,
      apiKey: googleKey
    });
  }

  return { ok: false, error: "Aucun provider disponible" };
}

async function callAnthropic(p: {
  prompt: string;
  isImage: boolean;
  mediaType: string;
  base64: string;
  task: LlmTask;
  maxTokens?: number;
  apiKey: string;
}): Promise<LlmCallResult> {
  const model =
    p.task === "cv" ? "claude-sonnet-4-5" : "claude-haiku-4-5-20251001";
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": p.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: p.maxTokens ?? 2000,
        messages: [
          {
            role: "user",
            content: [
              p.isImage
                ? {
                    type: "image",
                    source: { type: "base64", media_type: p.mediaType, data: p.base64 }
                  }
                : {
                    type: "document",
                    source: { type: "base64", media_type: PDF_MIME, data: p.base64 }
                  },
              { type: "text", text: p.prompt }
            ]
          }
        ]
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return { ok: false, error: `Anthropic ${resp.status}: ${errText.slice(0, 300)}` };
    }
    const json = (await resp.json()) as any;
    const text: string = json?.content?.[0]?.text ?? "";
    return { ok: true, text, provider: "anthropic" };
  } catch (e: any) {
    return { ok: false, error: `Anthropic: ${String(e?.message ?? e)}` };
  }
}

async function callGemini(p: {
  prompt: string;
  mediaType: string;
  base64: string;
  task: LlmTask;
  maxTokens?: number;
  apiKey: string;
}): Promise<LlmCallResult> {
  // Ordre de fallback : flash-lite d'abord (moins de congestion + meilleur
  // free tier), puis flash standard, puis versions plus anciennes. On enchaîne
  // sur 429 (quota), 404 (modèle retiré) ET 503 (surcharge Google temporaire).
  const models = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-1.5-flash-latest"
  ];
  const isRetryable = (err: string) =>
    err.includes("429") || err.includes("404") || err.includes("503") || err.includes("UNAVAILABLE");

  let lastErr = "";
  for (const model of models) {
    // 1er essai immédiat
    let r = await callGeminiModel({ ...p, model });
    // Si 503 (surcharge Google), on fait UN seul retry après 800ms sur le même
    // modèle avant de bascule — ça règle 80% des pics transitoires.
    if (!r.ok && r.error.includes("503")) {
      await new Promise((res) => setTimeout(res, 800));
      r = await callGeminiModel({ ...p, model });
    }
    if (r.ok) return r;
    lastErr = r.error;
    if (!isRetryable(r.error)) return r;
  }
  return { ok: false, error: lastErr || "Gemini indisponible sur tous les modèles" };
}

async function callGeminiModel(p: {
  prompt: string;
  mediaType: string;
  base64: string;
  maxTokens?: number;
  apiKey: string;
  model: string;
}): Promise<LlmCallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${p.model}:generateContent?key=${encodeURIComponent(p.apiKey)}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: p.mediaType, data: p.base64 } },
              { text: p.prompt }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: p.maxTokens ?? 2000,
          temperature: 0.1
        }
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return { ok: false, error: `Gemini ${p.model} ${resp.status}: ${errText.slice(0, 250)}` };
    }
    const json = (await resp.json()) as any;
    const text: string =
      json?.candidates?.[0]?.content?.parts?.map((x: any) => x.text ?? "").join("") ?? "";
    if (!text) return { ok: false, error: `Gemini ${p.model} : réponse vide` };
    return { ok: true, text, provider: "gemini" };
  } catch (e: any) {
    return { ok: false, error: `Gemini ${p.model}: ${String(e?.message ?? e)}` };
  }
}

/**
 * Nettoie la sortie LLM pour extraire le JSON pur :
 *   1. Enlève les fences ```json … ```
 *   2. Enlève préambule type « Voici le JSON : » et trailing
 *   3. Cherche le premier { ou [ jusqu'au dernier } ou ] correspondant
 *
 * Gère le cas typique de Gemini qui ajoute parfois un préambule narratif
 * malgré l'instruction explicite, et le cas Claude qui peut ajouter une
 * petite phrase de conclusion.
 */
export function extractJson(text: string): string {
  let s = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  // Si la string commence déjà par { ou [ et finit par } ou ], on garde tel quel
  const startsClean = (s.startsWith("{") || s.startsWith("[")) && (s.endsWith("}") || s.endsWith("]"));
  if (startsClean) return s;

  // Sinon on cherche le premier { ou [ pour démarrer
  const firstBrace = s.indexOf("{");
  const firstBracket = s.indexOf("[");
  let start = -1;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);
  if (start === -1) return s; // pas de JSON apparent, on laisse échouer en aval

  let body = s.slice(start).trim();

  // Nettoie tout suffixe markdown potentiellement collé après coup
  body = body.replace(/```\s*$/, "").trim();

  // Si le JSON finit correctement, on retourne tel quel
  if (body.endsWith("}") || body.endsWith("]")) return body;

  // Sinon : réponse LLM TRONQUÉE (dépassé maxTokens). On tente de la réparer
  // en coupant à la dernière virgule / champ complet et en fermant les
  // accolades/crochets manquants. Mieux vaut un JSON partiel exploitable
  // qu'une erreur de parsing complète.
  return attemptJsonRepair(body);
}

/**
 * Répare un JSON tronqué :
 *  1. Coupe la chaîne au dernier caractère "sûr" (virgule, close bracket)
 *  2. Compte accolades / crochets ouverts restants
 *  3. Ferme les structures ouvertes avec les bons caractères
 */
function attemptJsonRepair(body: string): string {
  // Enlève tout suffixe incomplet (ex: `"description": "quelque chose à moi` → coupe la string ouverte)
  let s = body;
  // Supprime le dernier élément incomplet si la ligne finit sans guillemet fermé
  // On cherche la dernière occurrence sûre : "," ou "}" ou "]"
  const lastSafe = Math.max(
    s.lastIndexOf('",'),
    s.lastIndexOf('}'),
    s.lastIndexOf(']')
  );
  if (lastSafe > 0) {
    s = s.slice(0, lastSafe + 1);
    // Si on a terminé par une virgule, c'est OK, on la supprimera après
    if (s.endsWith(",")) s = s.slice(0, -1);
  }

  // Compte les ouvertures/fermetures NON escapées et hors strings
  let depthObj = 0, depthArr = 0, inStr = false, escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depthObj++;
    else if (ch === "}") depthObj--;
    else if (ch === "[") depthArr++;
    else if (ch === "]") depthArr--;
  }

  // Ferme les structures ouvertes restantes (dans l'ordre inverse d'ouverture)
  while (depthArr-- > 0) s += "]";
  while (depthObj-- > 0) s += "}";

  return s;
}
