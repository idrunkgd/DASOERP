import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { CostCenterForm } from "../cost-center-form";

export default async function NewCC() {
  await requirePermission("settings.manage");
  return (
    <div>
      <PageHeader title="Nouveau centre de coût" breadcrumb={[{ label: "Centres de coût", href: "/cost-centers" }, { label: "Nouveau" }]} />
      <CostCenterForm />
    </div>
  );
}
