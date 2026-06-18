import Link from "next/link";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GraduationCap, Plus } from "lucide-react";
import { listTestsForAdmin, domainLabel } from "@/server/actions/tests";
import { SeedButton } from "./seed-button";

export const dynamic = "force-dynamic";

export default async function TestsPage() {
  await requirePermission("tests.manage");
  const tests = await listTestsForAdmin();
  const empty = tests.length === 0;
  return (
    <div>
      <PageHeader
        title="Tests techniques"
        subtitle="Évaluation des candidats et consultants — 5 tests métier avec cartographie de niveau (Junior → Expert)."
        actions={empty ? <SeedButton /> : null}
      />
      {empty ? (
        <div className="card">
          <EmptyState
            icon={GraduationCap}
            title="Aucun test en base"
            description="Clique « Initialiser les 5 tests » pour créer les questionnaires Électricité, PLC, Data Manager, IT et Cybersécurité (130 questions au total)."
            action={<SeedButton />}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tests.map((t) => {
            const assignedCount = t._count.assignments;
            return (
              <Link
                key={t.id}
                href={`/tests/${t.id}`}
                className="card p-5 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-indigoaccent">
                    {domainLabel(t.domain)}
                  </span>
                  <GraduationCap className="w-4 h-4 text-midnight-400 group-hover:text-indigoaccent transition-colors" />
                </div>
                <h2 className="font-semibold text-midnight-900 mb-1">{t.title}</h2>
                {t.description && (
                  <p className="text-xs text-midnight-500 line-clamp-3 mb-3">{t.description}</p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-midnight-500 mt-3 pt-3 border-t border-border">
                  <span>{t._count.questions} questions</span>
                  <span>·</span>
                  <span>{assignedCount} assignation{assignedCount > 1 ? "s" : ""}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
