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
  // Gemini 2.0 Flash (free tier généreux) supporte image + PDF en vision.
  // Pour le parsing CV on prend le même modèle — Flash est très bon sur du texte structuré
  // et le free tier (15 RPM, 1500 RPD) suffit largement pour notre usage.
  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(p.apiKey)}`;
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
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      // Si gemini-2.0-flash n'est pas dispo, retomber sur 1.5-flash-latest
      if (resp.status === 404) {
        return callGeminiLegacy(p);
      }
      return { ok: false, error: `Gemini ${resp.status}: ${errText.slice(0, 300)}` };
    }
    const json = (await resp.json()) as any;
    const text: string =
      json?.candidates?.[0]?.content?.parts?.map((x: any) => x.text ?? "").join("") ?? "";
    if (!text) {
      return { ok: false, error: "Gemini : réponse vide" };
    }
    return { ok: true, text, provider: "gemini" };
  } catch (e: any) {
    return { ok: false, error: `Gemini: ${String(e?.message ?? e)}` };
  }
}

async function callGeminiLegacy(p: {
  prompt: string;
  mediaType: string;
  base64: string;
  maxTokens?: number;
  apiKey: string;
}): Promise<LlmCallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(p.apiKey)}`;
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
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    })
  });
  if (!resp.ok) {
    const errText = await resp.text();
    return { ok: false, error: `Gemini 1.5 ${resp.status}: ${errText.slice(0, 300)}` };
  }
  const json = (await resp.json()) as any;
  const text: string =
    json?.candidates?.[0]?.content?.parts?.map((x: any) => x.text ?? "").join("") ?? "";
  if (!text) return { ok: false, error: "Gemini : réponse vide" };
  return { ok: true, text, provider: "gemini" };
}

/**
 * Nettoie la sortie LLM pour extraire le JSON pur (enlève les fences ```json … ```)
 */
export function extractJson(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}
