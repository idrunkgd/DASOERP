/**
 * Callback OAuth-like appelé par GoCardless après que l'utilisateur ait
 * donné son consentement sur le portail de sa banque.
 *
 * Query params attendus :
 *   ?ref=<BankConnection.id>    (reference qu'on a passée à createRequisition)
 *   ?error=xxx&details=yyy      si l'utilisateur a refusé
 *
 * On finalise la connexion (récupération des accounts) et on redirige
 * vers la page /finance/bank avec un flash.
 */
import { NextRequest, NextResponse } from "next/server";
import { finalizeBankAuthorization } from "@/server/actions/bank";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  const error = req.nextUrl.searchParams.get("error");

  const base = new URL("/finance/bank", req.nextUrl.origin);

  if (error || !ref) {
    base.searchParams.set("bank_error", error ?? "missing_ref");
    return NextResponse.redirect(base);
  }

  try {
    const r = await finalizeBankAuthorization(ref);
    if (r.linked) {
      base.searchParams.set("bank_linked", "1");
      base.searchParams.set("bank_accounts", String(r.accountCount ?? 0));
    } else {
      base.searchParams.set("bank_pending", "1");
    }
    return NextResponse.redirect(base);
  } catch (e: any) {
    base.searchParams.set("bank_error", String(e?.message ?? e).slice(0, 200));
    return NextResponse.redirect(base);
  }
}
