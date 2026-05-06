import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { AccessGroupForm } from "../group-form";

export default async function NewAccessGroup() {
  await requirePermission("users.manage");
  return (
    <div>
      <PageHeader title="Nouveau groupe d'accès" breadcrumb={[{ label: "Accès", href: "/access" }, { label: "Nouveau" }]} />
      <AccessGroupForm />
    </div>
  );
}
