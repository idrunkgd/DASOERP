import Link from "next/link";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GraduationCap, CheckCircle2, Clock, AlertCircle, Play } from "lucide-react";
import { getMyAssignments, domainLabel } from "@/server/actions/tests";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyTestsPage() {
  const session = await requireSession();
  const assignments = await getMyAssignments(session.user.id);

  return (
    <div>
      <PageHeader
        title="Mes tests techniques"
        subtitle="Évaluations qui vous ont été assignées. Pas de score affiché : vos réponses sont transmises à l'équipe."
        breadcrumb={[{ label: "Mon profil", href: "/me" }, { label: "Mes tests" }]}
      />
      {assignments.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={GraduationCap}
            title="Aucun test assigné pour le moment"
            description="Lorsqu'un test technique vous sera attribué, il apparaîtra ici avec un lien pour démarrer."
          />
        </div>
      ) : (
        <ul className="space-y-3 max-w-3xl">
          {assignments.map((a) => {
            const completed = a.status === "COMPLETED";
            const expired = a.status === "EXPIRED";
            const inProgress = a.status === "IN_PROGRESS";
            const Icon = completed ? CheckCircle2 : expired ? AlertCircle : inProgress ? Clock : Play;
            const colorCls = completed
              ? "text-emerald-700"
              : expired
                ? "text-red-700"
                : inProgress
                  ? "text-amber-700"
                  : "text-indigoaccent";
            const canStart = !completed && !expired;
            return (
              <li key={a.id} className="card p-5 flex items-start gap-4">
                <div className={"shrink-0 mt-1 " + colorCls}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-indigoaccent">
                    {domainLabel(a.test.domain)}
                  </div>
                  <h3 className="font-medium text-midnight-900">{a.test.title}</h3>
                  <p className="text-xs text-midnight-500 mt-0.5">
                    Assigné le {formatDate(a.assignedAt)}
                    {a.submission?.completedAt && (
                      <> · Soumis le {formatDate(a.submission.completedAt)}</>
                    )}
                  </p>
                </div>
                {canStart && (
                  <Link
                    href={`/tests/take/${a.magicToken}`}
                    className="btn-primary text-sm"
                  >
                    {inProgress ? "Reprendre" : "Démarrer"}
                  </Link>
                )}
                {completed && (
                  <span className="badge-success">Soumis</span>
                )}
                {expired && (
                  <span className="badge-danger">Expiré</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
