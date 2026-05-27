"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, Building2, MapPin, FileText, CreditCard, Mail } from "lucide-react";
import { updateCompanyInfo } from "@/server/actions/company-info";
import type { CompanyInfo } from "@/lib/company-info";

export function CompanyInfoForm({ initial }: { initial: CompanyInfo }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState<CompanyInfo>(initial);

  function update<K extends keyof CompanyInfo>(key: K, value: CompanyInfo[K]) {
    setForm({ ...form, [key]: value });
  }

  function submit() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) {
      fd.set(k, String(v ?? ""));
    }
    start(async () => {
      try {
        await updateCompanyInfo(fd);
        toast.success("Informations enregistrées");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Identité légale */}
      <Section
        icon={Building2}
        title="Identité légale"
        subtitle="Nom commercial, BCE, TVA — apparaît dans les en-têtes de devis/factures"
      >
        <Field label="Raison sociale" required>
          <input
            value={form.legalName}
            onChange={(e) => update("legalName", e.target.value)}
            className="input"
            placeholder="DASOLABS SRL"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Numéro TVA" required>
            <input
              value={form.vatNumber}
              onChange={(e) => update("vatNumber", e.target.value)}
              className="input font-mono"
              placeholder="BE0123.456.789"
            />
          </Field>
          <Field label="Numéro BCE">
            <input
              value={form.bceNumber}
              onChange={(e) => update("bceNumber", e.target.value)}
              className="input font-mono"
              placeholder="0123.456.789"
            />
          </Field>
        </div>
      </Section>

      {/* Adresse */}
      <Section icon={MapPin} title="Adresse du siège">
        <Field label="Rue et numéro" required>
          <input
            value={form.street}
            onChange={(e) => update("street", e.target.value)}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Code postal" required>
            <input
              value={form.postalCode}
              onChange={(e) => update("postalCode", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Ville" required>
            <input
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Pays" required>
            <input
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              className="input"
            />
          </Field>
        </div>
      </Section>

      {/* Contact */}
      <Section icon={Mail} title="Contact">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" required>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Téléphone">
            <input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="input"
              placeholder="+32 ..."
            />
          </Field>
        </div>
        <Field label="Site web">
          <input
            value={form.website}
            onChange={(e) => update("website", e.target.value)}
            className="input"
            placeholder="www.dasolabs.com"
          />
        </Field>
      </Section>

      {/* Banque */}
      <Section icon={CreditCard} title="Coordonnées bancaires (pour paiement clients)">
        <div className="grid grid-cols-2 gap-3">
          <Field label="IBAN" required>
            <input
              value={form.iban}
              onChange={(e) => update("iban", e.target.value)}
              className="input font-mono"
              placeholder="BE00 0000 0000 0000"
            />
          </Field>
          <Field label="BIC">
            <input
              value={form.bic}
              onChange={(e) => update("bic", e.target.value)}
              className="input font-mono"
              placeholder="GEBABEBB"
            />
          </Field>
        </div>
      </Section>

      {/* Conditions commerciales */}
      <Section
        icon={FileText}
        title="Conditions commerciales par défaut"
        subtitle="Apparaissent en bas des devis et factures (modifiables au cas par cas)"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Délai de paiement (jours)">
            <input
              type="number"
              min={0}
              max={365}
              value={form.paymentTermsDays ?? 30}
              onChange={(e) => update("paymentTermsDays", Number(e.target.value))}
              className="input"
            />
            <div className="text-[10px] text-midnight-400 mt-0.5">
              30 jours fin de mois est le standard belge B2B
            </div>
          </Field>
          <Field label="Validité d'un devis (jours)">
            <input
              type="number"
              min={1}
              max={365}
              value={form.offerValidityDays ?? 30}
              onChange={(e) => update("offerValidityDays", Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>
        <Field label="Mentions légales personnalisées (optionnel)">
          <textarea
            value={form.legalNotice ?? ""}
            onChange={(e) => update("legalNotice", e.target.value)}
            className="input min-h-[100px]"
            placeholder="Si vide, on utilise les mentions par défaut (loi belge 02/08/2002, tribunaux Bruxelles, etc.)"
          />
          <div className="text-[10px] text-midnight-400 mt-0.5">
            Optionnel — laisse vide pour utiliser les mentions standard belges
          </div>
        </Field>
      </Section>

      {/* Save */}
      <div className="flex items-center justify-between sticky bottom-0 bg-white border-t border-midnight-200 -mx-4 px-4 py-3 z-10">
        <div className="text-xs text-midnight-500">
          Les changements impactent les PDFs générés <b>après</b> cet enregistrement.
        </div>
        <button onClick={submit} disabled={pending} className="btn-primary">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children
}: {
  icon: any;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="bg-indigoaccent/10 rounded-lg p-2">
          <Icon className="w-5 h-5 text-indigoaccent" />
        </div>
        <div>
          <h2 className="font-semibold text-midnight-900">{title}</h2>
          {subtitle && <p className="text-xs text-midnight-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
