"use client";
/**
 * Formulaire de saisie d'une nouvelle interaction outbound.
 * Cible polymorphe : radio "Candidat existant / Contact existant / Nouveau
 * (libre)". Un seul target à la fois.
 * Sélection optionnelle d'un template — le body est copié dans le form
 * mais l'utilisateur peut l'éditer avant envoi.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createOutreach } from "@/server/actions/outreach";
import { Plus, Loader2, Send, ChevronDown, ChevronUp } from "lucide-react";

type Candidate = { id: string; firstName: string; lastName: string; seniority: string | null };
type Contact   = {
  id: string; firstName: string; lastName: string; jobTitle: string | null;
  company: { name: string } | null;
};
type Template  = {
  id: string; name: string; channel: string; purpose: string;
  subject: string | null; body: string;
};

type TargetMode = "candidate" | "contact" | "freeform";

export function NewInteractionForm({
  candidates, contacts, templates
}: {
  candidates: Candidate[];
  contacts: Contact[];
  templates: Template[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [targetMode, setTargetMode] = useState<TargetMode>("freeform");
  const [channel, setChannel] = useState("LINKEDIN");
  const [purpose, setPurpose] = useState("SOURCE_CANDIDATE");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function pickTemplate(id: string) {
    setTemplateId(id);
    if (!id) return;
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (t.subject && !subject) setSubject(t.subject);
    if (t.body && !body) setBody(t.body);
    setChannel(t.channel);
    setPurpose(t.purpose);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Nettoie les champs de la cible non choisie (évite l'erreur "un seul target")
    if (targetMode !== "candidate") fd.delete("candidateId");
    if (targetMode !== "contact") fd.delete("contactId");
    if (targetMode !== "freeform") {
      fd.delete("freeformName"); fd.delete("freeformCompany");
      fd.delete("freeformJobTitle"); fd.delete("freeformLinkedinUrl");
      fd.delete("freeformEmail");
    }
    start(async () => {
      try {
        await createOutreach(fd);
        toast.success("Interaction enregistrée");
        // Reset partiel : garde le template + canal, vide la cible
        setSubject(""); setBody(""); setTemplateId("");
        (e.currentTarget as HTMLFormElement).reset();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary mb-3">
        <Plus className="w-4 h-4" /> Nouvelle interaction
      </button>
    );
  }

  return (
    <section className="card p-5 mb-5 border-2 border-indigoaccent">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Nouvelle interaction</h2>
        <button onClick={() => setOpen(false)} className="text-midnight-500 hover:text-midnight-900">
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {/* Canal + purpose + statut */}
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="label">Canal</label>
            <select name="channel" className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="LINKEDIN">LinkedIn</option>
              <option value="EMAIL">Email</option>
              <option value="PHONE">Téléphone</option>
              <option value="MEETING">Réunion</option>
              <option value="OTHER">Autre</option>
            </select>
          </div>
          <div>
            <label className="label">Objectif</label>
            <select name="purpose" className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="SOURCE_CANDIDATE">Sourcing candidat</option>
              <option value="SELL_TO_CLIENT">Prospect client</option>
              <option value="OTHER">Autre</option>
            </select>
          </div>
          <div>
            <label className="label">Statut</label>
            <select name="status" className="input" defaultValue="SENT">
              <option value="SENT">Envoyé</option>
              <option value="READ">Lu</option>
              <option value="REPLIED_POSITIVE">Réponse +</option>
              <option value="REPLIED_NEGATIVE">Réponse −</option>
              <option value="NO_RESPONSE">Sans réponse</option>
              <option value="BOUNCED">Rejeté</option>
            </select>
          </div>
          <div>
            <label className="label">Template (facultatif)</label>
            <select className="input" value={templateId} onChange={(e) => pickTemplate(e.target.value)} name="templateId">
              <option value="">— Aucun —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Choix de cible */}
        <div>
          <label className="label">Personne contactée</label>
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setTargetMode("freeform")}
                    className={"btn-sm " + (targetMode === "freeform" ? "btn-primary" : "btn-ghost")}>
              LinkedIn / nouveau
            </button>
            <button type="button" onClick={() => setTargetMode("candidate")}
                    className={"btn-sm " + (targetMode === "candidate" ? "btn-primary" : "btn-ghost")}>
              Candidat existant
            </button>
            <button type="button" onClick={() => setTargetMode("contact")}
                    className={"btn-sm " + (targetMode === "contact" ? "btn-primary" : "btn-ghost")}>
              Contact existant
            </button>
          </div>

          {targetMode === "candidate" && (
            <select name="candidateId" required className="input">
              <option value="">Choisir…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}{c.seniority ? ` — ${c.seniority}` : ""}
                </option>
              ))}
            </select>
          )}

          {targetMode === "contact" && (
            <select name="contactId" required className="input">
              <option value="">Choisir…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                  {c.jobTitle ? ` — ${c.jobTitle}` : ""}
                  {c.company?.name ? ` (${c.company.name})` : ""}
                </option>
              ))}
            </select>
          )}

          {targetMode === "freeform" && (
            <div className="grid grid-cols-2 gap-2">
              <input name="freeformName" placeholder="Nom prénom *" required className="input" />
              <input name="freeformCompany" placeholder="Entreprise" className="input" />
              <input name="freeformJobTitle" placeholder="Poste actuel" className="input" />
              <input name="freeformLinkedinUrl" placeholder="URL LinkedIn" className="input" />
              <input name="freeformEmail" placeholder="Email (facultatif)" className="input col-span-2" />
            </div>
          )}
        </div>

        {/* Contenu du message */}
        <div className="grid grid-cols-3 gap-2">
          {channel === "EMAIL" && (
            <input name="subject" className="input col-span-3" placeholder="Objet"
                   value={subject} onChange={(e) => setSubject(e.target.value)} />
          )}
          <textarea name="body" className="input col-span-3" rows={4}
                    placeholder="Message envoyé (peut contenir des placeholders si template)"
                    value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        {/* Prochaine action */}
        <div className="grid grid-cols-3 gap-2 border-t border-midnight-100 pt-3">
          <div>
            <label className="label">Relance prévue le</label>
            <input type="date" name="nextActionAt" className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Note de relance</label>
            <input name="nextActionNote" className="input"
                   placeholder="ex. relancer après trois jours, mentionner mission Y" />
          </div>
        </div>

        <textarea name="notes" className="input" rows={2}
                  placeholder="Notes internes (jamais envoyées)" />

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Annuler</button>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </form>
    </section>
  );
}
