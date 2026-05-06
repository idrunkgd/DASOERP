import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "../profile-form";

export default async function NewProfile() {
  await requirePermission("offers.write");
  return (
    <div>
      <PageHeader title="Nouveau profil de service" breadcrumb={[{ label: "Profils", href: "/service-profiles" }, { label: "Nouveau" }]} />
      <ProfileForm />
    </div>
  );
}
