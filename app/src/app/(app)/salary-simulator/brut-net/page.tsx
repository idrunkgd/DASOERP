import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { BrutNetCalculator } from "./calculator";

export const dynamic = "force-dynamic";

export default async function BrutNetPage() {
  await requirePermission("consulting.read");

  return (
    <div>
      <PageHeader
        title="Calculateur Brut ↔ Net"
        subtitle="Conversion bidirectionnelle pour salarié belge"
        breadcrumb={[
          { label: "Simulateur package", href: "/salary-simulator" },
          { label: "Brut ↔ Net" }
        ]}
      />
      <BrutNetCalculator />
    </div>
  );
}
