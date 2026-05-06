import { NextRequest } from "next/server";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { TOOLS } from "@/server/services/chat-tools";
import { logActivity } from "@/lib/audit";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";        // Free tier Groq, excellent tool-calling
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
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({
      error: "Chatbot non configuré. Définissez GROQ_API_KEY dans .env (clé gratuite sur https://console.groq.com)."
    }, { status: 503 });
  }

  const body = await req.json();
  const userMessages: Array<{ role: string; content: string }> = body.messages ?? [];
  if (userMessages.length === 0) return Response.json({ error: "Aucun message" }, { status: 400 });

  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const ctx = { userId: session.user.id, perms };

  // Filtre les tools auxquels l'utilisateur a accès
  const availableTools = TOOLS.filter(t => t.permission === "any" || perms.includes(t.permission as any));
  const toolsSpec = availableTools.map(t => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters }
  }));

  let messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT + `\n\nUtilisateur connecté : ${session.user.name}. Permissions : ${perms.join(", ") || "(aucune)"}.` },
    ...userMessages
  ];

  // Boucle tool-calling
  for (let i = 0; i < MAX_LOOPS; i++) {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL, messages, tools: toolsSpec.length ? toolsSpec : undefined,
        temperature: 0.2, max_tokens: 1500
      })
    });
    if (!r.ok) {
      const text = await r.text();
      return Response.json({ error: `Groq ${r.status}: ${text.slice(0, 200)}` }, { status: 502 });
    }
    const data = await r.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) return Response.json({ error: "Réponse vide" }, { status: 502 });

    messages.push(msg);

    // Pas d'appel d'outil → réponse finale
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      await logActivity({
        actorId: session.user.id, action: "UPDATE", entityType: "ChatMessage",
        message: `Q: ${userMessages[userMessages.length - 1]?.content?.slice(0, 80)}…`
      });
      return Response.json({ reply: msg.content ?? "" });
    }

    // Sinon, exécute chaque tool demandé
    for (const tc of msg.tool_calls) {
      const tool = availableTools.find(t => t.name === tc.function.name);
      let result: any;
      if (!tool) {
        result = { error: `Tool inconnu: ${tc.function.name}` };
      } else {
        try {
          const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
          result = await tool.run(args, ctx);
        } catch (e: any) {
          result = { error: e.message ?? String(e) };
        }
      }
      messages.push({
        role: "tool", tool_call_id: tc.id, name: tc.function.name,
        content: JSON.stringify(result).slice(0, 8000)   // garde-fou taille
      });
    }
  }

  return Response.json({ reply: "Je n'ai pas pu finaliser la réponse après plusieurs essais. Reformulez votre question ?" });
}
