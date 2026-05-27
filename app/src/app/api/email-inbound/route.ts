// Webhook email entrant — reçoit les emails forwardés depuis Skwarel via Mailgun.
//
// Setup côté Mailgun (free tier 5k/mois) :
//   1. Crée un compte sur https://mailgun.com
//   2. Ajoute ton domaine (ou utilise le sandbox xyz.mailgun.org pour tester)
//   3. Configure DNS : MX records pointent vers Mailgun
//   4. Crée une "Route" :
//        Expression Type: Match Recipient
//        Recipient: .* (capture tout) OU "factures-skwarel@mg.dasolabs.com"
//        Actions: forward("https://<your-app>.vercel.app/api/email-inbound")
//        ☑ stop()
//   5. Récupère ton "HTTP webhook signing key" → env Vercel : MAILGUN_WEBHOOK_KEY
//
// Setup côté Skwarel :
//   - Dans tes notifications Skwarel, configure l'envoi automatique d'un email
//     vers ton adresse Mailgun à chaque nouvelle facture Peppol reçue.
//
// Format Mailgun (multipart form-data) :
//   - signature, token, timestamp (pour vérif HMAC)
//   - sender, recipient, subject
//   - body-plain, body-html
//   - attachment-count, attachment-1, attachment-2, ...
//   - attachment-N est un fichier (multipart binary)

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { parseSupplierInvoice } from "@/server/actions/supplier-invoices";

export const dynamic = "force-dynamic";

function verifyMailgunSignature(
  signingKey: string,
  timestamp: string,
  token: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha256", signingKey)
    .update(`${timestamp}${token}`)
    .digest("hex");
  // timing-safe compare
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const signingKey = process.env.MAILGUN_WEBHOOK_KEY;
  if (!signingKey) {
    return NextResponse.json(
      { error: "MAILGUN_WEBHOOK_KEY non configurée" },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const signature = String(formData.get("signature") ?? "");
  const timestamp = String(formData.get("timestamp") ?? "");
  const token = String(formData.get("token") ?? "");
  if (!verifyMailgunSignature(signingKey, timestamp, token, signature)) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  // Sécurité supplémentaire : rejette si timestamp > 5 min
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return NextResponse.json({ error: "Timestamp expiré" }, { status: 401 });
  }

  const sender = String(formData.get("sender") ?? "");
  const subject = String(formData.get("subject") ?? "");
  const attachmentCount = parseInt(String(formData.get("attachment-count") ?? "0"), 10);

  if (attachmentCount === 0) {
    return NextResponse.json({ message: "Pas d'attachement, ignoré" });
  }

  const created: string[] = [];
  const errors: string[] = [];

  for (let i = 1; i <= attachmentCount; i++) {
    const file = formData.get(`attachment-${i}`);
    if (!(file instanceof Blob)) continue;
    const contentType = file.type || "application/pdf";
    if (!contentType.includes("pdf") && !contentType.startsWith("image/")) continue;

    try {
      // Convertit en data URI pour passer à l'OCR
      const buf = Buffer.from(await file.arrayBuffer());
      const dataUri = `data:${contentType};base64,${buf.toString("base64")}`;

      const parseResult = await parseSupplierInvoice(dataUri);
      if (!parseResult.ok || !parseResult.data) {
        errors.push(`Attachement ${i} : ${parseResult.error ?? "OCR échoué"}`);
        continue;
      }
      const d = parseResult.data;
      if (!d.supplierName || d.amountHt == null) {
        errors.push(`Attachement ${i} : données minimales manquantes (supplier / amountHt)`);
        continue;
      }

      // Match auto le fournisseur
      const matchedCompany = await prisma.company.findFirst({
        where: { name: { contains: d.supplierName, mode: "insensitive" } },
        select: { id: true }
      });

      const vatRate = d.vatRate ?? 21;
      const vatAmount = d.vatAmount ?? (d.amountHt * vatRate) / 100;
      const amountTtc = d.amountTtc ?? d.amountHt + vatAmount;
      const invoiceDate = d.invoiceDate ? new Date(d.invoiceDate) : new Date();

      const inv = await prisma.supplierInvoice.create({
        data: {
          supplierName: d.supplierName,
          supplierCompanyId: matchedCompany?.id ?? null,
          invoiceNumber: d.invoiceNumber,
          invoiceDate,
          dueDate: d.dueDate ? new Date(d.dueDate) : null,
          amountHt: d.amountHt,
          vatRate,
          vatAmount,
          amountTtc,
          currency: d.currency ?? "EUR",
          pdfUrl: dataUri,
          ocrPayload: d as any,
          status: "PENDING",
          source: "email",
          notes: `Reçu de ${sender} — sujet: ${subject.slice(0, 100)}`
        }
      });
      created.push(inv.id);

      await logActivity({
        action: "CREATE",
        entityType: "SupplierInvoice",
        entityId: inv.id,
        message: `Facture fournisseur auto-créée depuis email (${d.supplierName})`
      });
    } catch (e: any) {
      errors.push(`Attachement ${i} : ${String(e?.message ?? e).slice(0, 200)}`);
    }
  }

  return NextResponse.json({
    received: attachmentCount,
    created: created.length,
    errors
  });
}
