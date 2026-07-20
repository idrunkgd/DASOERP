// Le module Notes de frais a été promu en production sur /expenses.
// Cette page reste pour éviter les liens cassés depuis un bookmark
// éventuel — elle redirige immédiatement.
import { redirect } from "next/navigation";

export default function LegacyExpensesRedirect() {
  redirect("/expenses");
}
