/**
 * Client minimal pour GoCardless Bank Account Data (ex-Nordigen).
 *
 * Documentation : https://developer.gocardless.com/bank-account-data/overview
 *
 * Flow d'authentification (une fois par banque connectée) :
 *   1. accessToken() → obtient / rafraîchit un token OAuth (cache mémoire)
 *   2. listInstitutions("BE") → renvoie les banques disponibles pour la Belgique
 *      (on cherche "ING" pour trouver son institution_id, ex. "ING_BBRUBEBB")
 *   3. createRequisition(institutionId, redirectUri) → renvoie une URL vers
 *      laquelle rediriger l'utilisateur pour qu'il consente sur son portail
 *      bancaire (login ING). Sauvegarder le requisitionId côté BankConnection.
 *   4. Après retour du user, getRequisition(id) → contient la liste des
 *      account_ids liés (créer un BankAccount par entrée).
 *   5. getAccountDetails(accountId), getAccountTransactions(accountId) →
 *      utilisés pour peupler et rafraîchir BankAccount + BankTransaction.
 *
 * Variables d'environnement requises (production) :
 *   GOCARDLESS_SECRET_ID     = ton secret_id (dashboard GoCardless)
 *   GOCARDLESS_SECRET_KEY    = ton secret_key
 *   GOCARDLESS_REDIRECT_URI  = ex. "https://hub.dasolabs.be/api/bank/callback"
 *
 * Ces credentials sont GRATUITS (100 requêtes/institution/jour). Créer un
 * compte sur bankaccountdata.gocardless.com et générer les secrets.
 */

const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";

type Token = { value: string; expiresAt: number };
let cachedToken: Token | null = null;

async function accessToken(): Promise<string> {
  // Réutilise le token tant qu'il reste au moins 60s de validité
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error(
      "GoCardless non configuré : GOCARDLESS_SECRET_ID / GOCARDLESS_SECRET_KEY manquants dans les variables d'environnement."
    );
  }
  const res = await fetch(`${BASE_URL}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey })
  });
  if (!res.ok) {
    throw new Error(`GoCardless token error (${res.status}) : ${await res.text()}`);
  }
  const json = await res.json();
  cachedToken = {
    value: json.access as string,
    // access_expires est en secondes (typiquement 24h)
    expiresAt: Date.now() + Number(json.access_expires ?? 3600) * 1000
  };
  return cachedToken.value;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    throw new Error(`GoCardless ${path} (${res.status}) : ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// ─── Institutions ─────────────────────────────────────────────

export type Institution = {
  id: string;              // ex. "ING_BBRUBEBB"
  name: string;            // ex. "ING"
  bic: string;
  transaction_total_days: string;   // "90" pour ING BE
  countries: string[];
  logo: string;
};

/**
 * Liste les banques disponibles pour un pays (code ISO 3166-1 alpha-2).
 * Passer "BE" pour la Belgique. Utile pour trouver l'institution_id à
 * envoyer dans createRequisition.
 */
export async function listInstitutions(country: string = "BE"): Promise<Institution[]> {
  return req<Institution[]>(`/institutions/?country=${country}`);
}

// ─── Requisition (consentement d'accès) ──────────────────────

export type Requisition = {
  id: string;
  status: "CR" | "GC" | "UA" | "RJ" | "SA" | "GA" | "LN" | "SU" | "EX";
  // CR: created, GC: giving consent, UA: undergoing authentication,
  // RJ: rejected, SA: selecting accounts, GA: granting access,
  // LN: linked, SU: suspended, EX: expired
  agreements: string[];
  accounts: string[];
  reference: string;
  user_language: string;
  link: string;   // URL vers laquelle rediriger l'utilisateur pour login
  redirect: string;
  institution_id: string;
};

/**
 * Crée une nouvelle requisition (autorisation d'accès à une banque).
 * @param institutionId ex. "ING_BBRUBEBB"
 * @param redirectUri URL de callback dans notre app (ex. .../api/bank/callback)
 * @param reference identifiant côté nous (BankConnection.id typiquement)
 */
export async function createRequisition(opts: {
  institutionId: string;
  redirectUri: string;
  reference: string;
}): Promise<Requisition> {
  return req<Requisition>("/requisitions/", {
    method: "POST",
    body: JSON.stringify({
      redirect: opts.redirectUri,
      institution_id: opts.institutionId,
      reference: opts.reference,
      user_language: "FR"
    })
  });
}

/**
 * Récupère l'état d'une requisition — utilisé au callback pour lire les
 * account_ids liés une fois l'utilisateur redirigé.
 */
export async function getRequisition(id: string): Promise<Requisition> {
  return req<Requisition>(`/requisitions/${id}/`);
}

// ─── Comptes bancaires ───────────────────────────────────────

export type AccountDetails = {
  account: {
    resourceId?: string;
    iban?: string;
    currency?: string;
    ownerName?: string;
    name?: string;
    product?: string;
    cashAccountType?: string;
  };
};

export async function getAccountDetails(accountId: string): Promise<AccountDetails> {
  return req<AccountDetails>(`/accounts/${accountId}/details/`);
}

// ─── Transactions ────────────────────────────────────────────

export type GcTransaction = {
  internalTransactionId?: string;      // clé de dédup (mais parfois manquante)
  transactionId?: string;               // fallback
  bookingDate: string;                  // ISO YYYY-MM-DD
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };  // amount signé
  creditorName?: string;
  debtorName?: string;
  creditorAccount?: { iban?: string };
  debtorAccount?: { iban?: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
};

export type AccountTransactionsResponse = {
  transactions: {
    booked: GcTransaction[];
    pending?: GcTransaction[];
  };
};

/**
 * Récupère toutes les transactions d'un compte. On ne renvoie que les
 * transactions BOOKED (comptabilisées) pour éviter les pending qui
 * peuvent disparaître ensuite.
 */
export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string,   // ISO YYYY-MM-DD, optionnel
  dateTo?: string
): Promise<GcTransaction[]> {
  const qs = new URLSearchParams();
  if (dateFrom) qs.set("date_from", dateFrom);
  if (dateTo) qs.set("date_to", dateTo);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await req<AccountTransactionsResponse>(
    `/accounts/${accountId}/transactions/${suffix}`
  );
  return res.transactions.booked ?? [];
}

/**
 * Utilitaire : renvoie l'ID de dédup à utiliser côté BankTransaction.
 * Priorité : internalTransactionId → transactionId → hash déterministe
 * du triplet (bookingDate, amount, counterparty).
 */
export function transactionDedupeId(tx: GcTransaction): string {
  if (tx.internalTransactionId) return tx.internalTransactionId;
  if (tx.transactionId) return tx.transactionId;
  const counterparty = tx.creditorName ?? tx.debtorName ?? "?";
  return `synth-${tx.bookingDate}-${tx.transactionAmount.amount}-${counterparty}`
    .replace(/\s+/g, "_");
}
