import { NextRequest } from "next/server";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { TOOLS } from "@/server/services/chat-tools";
import { logActivity } from "@/lib/audit";

// ─────────────────────────────────────────────────────────────
// PROVIDERS
//   1. Gemini (GOOGLE_API_KEY) — gratuit, 15 req/min / 1500/jour
//   2. Groq   (GROQ_API_KEY)   — gratuit aussi, Llama 3.3 70B
// ─────────────────────────────────────────────────────────────

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GEMINI_MODEL = "gemini-2.0-flash";
const MAX_LOOPS = 5;

const SYSTEM_PROMPT = `Tu es l'assistant IA de Dasolabs, une startup IT/industrielle utilisant un ERP interne.

VOCABULAIRE IMPORTANT — distingue bien :
- "Consultant" = employé interne Dasolabs (table User). Pour LISTER → list_consultants. Pour un consultant précis par nom → get_consultant_status.
- "Candidat" = personne externe du vivier de recrutement → search_candidates.
- "Entreprise" / "société" / "client" / "prospect" = table Company → search_companies.
- "Contact" = personne dans une entreprise externe (CTO, acheteur, RH...) → search_contacts.
- "Mission" = affectation T&M contractualisée → list_active_missions.
- "Demande de mission" = besoin client en attente → list_open_mission_requests.
- "Offre" = devis forfait → list_open_offers.
- "Tranche" / "facture" / "milestone" → list_billing_status.
- "Charge équipe" / "planning" → team_workload.
- Pour un APERÇU CHIFFRÉ rapide ("combien j'ai de…", "quel est le total de…") → get_counts (donne tous les compteurs en un appel).

Règles strictes :
- Réponds TOUJOURS en français.
- Pour TOUTE question portant sur des données ERP, APPELLE D'ABORD UN OUTIL. N'improvise JAMAIS une réponse "il n'y a pas de…" ou "0 résultat" sans avoir vraiment vérifié.
- Si l'utilisateur dit "j'ai importé X, où sont mes données ?", appelle l'outil correspondant : search_contacts pour les contacts, search_companies pour les entreprises, etc.
- Si un outil renvoie un tableau vide, redis-le clairement mais propose une variante : essayer sans filtre, ou élargir.
- Si la question est ambiguë, choisis l'outil le plus probable et appelle-le.
- N'invente JAMAIS de données.
- Si un outil renvoie 'permission denied', dis-le et suggère de contacter l'admin.
- Cite tes sources : références (ex: MIS-2026-0001) et liens markdown des résultats sous la forme [Texte](/url).
- Reste concis : phrases courtes, listes à puces claires.
- N'expose jamais de mot de passe ni d'information personnelle sensible (email pro est OK).`;

export async function POST(req: NextRequest) {
  const session = await requireSession();

  const geminiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!geminiKey && !groqKey) {
    return Response.json(
      {
        error:
          "Chatbot non configuré. Définis GOOGLE_API_KEY (Gemini, gratuit) ou GROQ_API_KEY dans Vercel."
      },
      { status: 503 }
    );
  }

  const body = await req.json();
  const userMessages: Array<{ role: string; content: string }> = body.messages ?? [];
  if (userMessages.length === 0) return Response.json({ error: "Aucun message" }, { status: 400 });

  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const ctx = { userId: session.user.id, perms };

  const availableTools = TOOLS.filter(
    (t) => t.permission === "any" || perms.includes(t.permission as any)
  );

  const systemPrompt = `${SYSTEM_PROMPT}\n\nUtilisateur connecté : ${session.user.name}. Permissions : ${perms.join(", ") || "(aucune)"}.`;

  // Priorité Groq pour le chatbot (30 req/min vs 15 chez Gemini, et le
  // tool-calling fait jusqu'à 5 appels par question — Groq tient mieux la charge).
  // Gemini reste fallback si pas de clé Groq.
  // Si Groq plante (429, 5xx…), on retombe automatiquement sur Gemini.
  try {
    let reply: string;
    if (groqKey) {
      try {
        reply = await runGroqLoop({
          apiKey: groqKey,
          systemPrompt,
          userMessages,
          tools: availableTools,
          ctx
        });
      } catch (e: any) {
        if (geminiKey) {
          console.warn("Groq down, fallback Gemini", e?.message);
          reply = await runGeminiLoop({
            apiKey: geminiKey,
            systemPrompt,
            userMessages,
            tools: availableTools,
            ctx
          });
        } else {
          throw e;
        }
      }
    } else {
      reply = await runGeminiLoop({
        apiKey: geminiKey!,
        systemPrompt,
        userMessages,
        tools: availableTools,
        ctx
      });
    }

    await logActivity({
      actorId: session.user.id,
      action: "UPDATE",
      entityType: "ChatMessage",
      message: `Q: ${userMessages[userMessages.length - 1]?.content?.slice(0, 80)}…`
    });
    return Response.json({ reply });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Erreur LLM" }, { status: 502 });
  }
}

// ─────────────────────────────────────────────────────────────
// GEMINI tool-calling loop
// ─────────────────────────────────────────────────────────────

async function runGeminiLoop(p: {
  apiKey: string;
  systemPrompt: string;
  userMessages: Array<{ role: string; content: string }>;
  tools: typeof TOOLS;
  ctx: { userId: string; perms: any[] };
}): Promise<string> {
  // Construction du tableau "contents" Gemini.
  // Gemini accepte 2 rôles : "user" et "model". Pas de rôle "system" dans contents
  // (on passe la consigne via systemInstruction).
  const contents: any[] = p.userMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const functionDeclarations = p.tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: cleanJsonSchemaForGemini(t.parameters)
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(p.apiKey)}`;

  for (let i = 0; i < MAX_LOOPS; i++) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: p.systemPrompt }] },
        tools: functionDeclarations.length
          ? [{ functionDeclarations }]
          : undefined,
        generationConfig: { temperature: 0.2, maxOutputTokens: 2000 }
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Gemini ${resp.status}: ${txt.slice(0, 300)}`);
    }
    const data = (await resp.json()) as any;
    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    if (parts.length === 0) {
      throw new Error("Gemini : réponse vide");
    }

    // Sépare functionCalls et text
    const functionCalls = parts
      .map((part: any) => part.functionCall)
      .filter(Boolean) as Array<{ name: string; args: any }>;
    const textParts = parts
      .map((part: any) => part.text)
      .filter((t: any) => typeof t === "string");

    // Pas d'appel d'outil → réponse finale
    if (functionCalls.length === 0) {
      return textParts.join("\n").trim() || "(réponse vide)";
    }

    // Ajoute le tour model (functionCalls) dans contents
    contents.push({
      role: "model",
      parts: functionCalls.map((fc) => ({ functionCall: fc }))
    });

    // Exécute chaque tool puis ajoute le tour user (functionResponses)
    const fnResponses: any[] = [];
    for (const fc of functionCalls) {
      const tool = p.tools.find((t) => t.name === fc.name);
      let result: any;
      if (!tool) {
        result = { error: `Tool inconnu: ${fc.name}` };
      } else {
        try {
          result = await tool.run(fc.args ?? {}, p.ctx);
        } catch (e: any) {
          result = { error: e?.message ?? String(e) };
        }
      }
      fnResponses.push({
        functionResponse: {
          name: fc.name,
          response: truncatePayload(result)
        }
      });
    }
    contents.push({ role: "user", parts: fnResponses });
  }

  return "Je n'ai pas pu finaliser la réponse après plusieurs essais. Reformule ta question ?";
}

// Gemini est plus strict que OpenAI sur le JSON Schema. Il ne supporte pas certains
// champs (additionalProperties, $schema, default, etc.). On nettoie.
function cleanJsonSchemaForGemini(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(cleanJsonSchemaForGemini);
  const { additionalProperties, $schema, default: _def, ...rest } = schema;
  const out: any = {};
  for (const [k, v] of Object.entries(rest)) {
    out[k] = cleanJsonSchemaForGemini(v);
  }
  return out;
}

// Bornage des payloads d'outils renvoyés au modèle (sécurité)
function truncatePayload(obj: any): any {
  try {
    const s = JSON.stringify(obj);
    if (s.length <= 8000) return obj;
    return { truncated: true, preview: JSON.parse(s.slice(0, 7900) + '"}') };
  } catch {
    return { error: "Payload non sérialisable" };
  }
}

// ─────────────────────────────────────────────────────────────
// GROQ (OpenAI-compatible) — implémentation d'origine, conservée en fallback
// ─────────────────────────────────────────────────────────────

async function runGroqLoop(p: {
  apiKey: string;
  systemPrompt: string;
  userMessages: Array<{ role: string; content: string }>;
  tools: typeof TOOLS;
  ctx: { userId: string; perms: any[] };
}): Promise<string> {
  const toolsSpec = p.tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters }
  }));

  let messages: any[] = [
    { role: "system", content: p.systemPrompt },
    ...p.userMessages
  ];

  for (let i = 0; i < MAX_LOOPS; i++) {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        tools: toolsSpec.length ? toolsSpec : undefined,
        temperature: 0.2,
        max_tokens: 1500
      })
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Groq ${r.status}: ${text.slice(0, 200)}`);
    }
    const data = await r.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("Groq : réponse vide");

    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content ?? "";
    }

    for (const tc of msg.tool_calls) {
      const tool = p.tools.find((t) => t.name === tc.function.name);
      let result: any;
      if (!tool) {
        result = { error: `Tool inconnu: ${tc.function.name}` };
      } else {
        try {
          const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
          result = await tool.run(args, p.ctx);
        } catch (e: any) {
          result = { error: e.message ?? String(e) };
        }
      }
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(result).slice(0, 8000)
      });
    }
  }
  return "Je n'ai pas pu finaliser la réponse après plusieurs essais. Reformule ta question ?";
}
