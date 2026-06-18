import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { getTestDetail } from "@/server/actions/tests";
import { domainLabel } from "@/lib/test-display";
import { EditQuestionsClient } from "./edit-client";

export const dynamic = "force-dynamic";

export default async function EditTestPage({ params }: { params: { id: string } }) {
  await requirePermission("tests.manage");
  const test = await getTestDetail(params.id);
  if (!test) notFound();

  // Format léger pour le client
  const questions = test.questions.map((q) => ({
    id: q.id,
    position: q.position,
    text: q.text,
    difficulty: q.difficulty,
    isScenario: q.isScenario,
    points: q.points,
    choices: q.choices.map((c) => ({
      id: c.id,
      position: c.position,
      text: c.text,
      isCorrect: c.isCorrect
    }))
  }));

  return (
    <div>
      <PageHeader
        title="Édition des questions"
        subtitle={`${test.title} · ${domainLabel(test.domain)} · ${questions.length} questions`}
        breadcrumb={[
          { label: "Tests", href: "/tests" },
          { label: test.title, href: `/tests/${test.id}` },
          { label: "Édition" }
        ]}
      />
      <div className="card p-4 mb-4 text-sm bg-amber-50/40 border-amber-200 text-amber-900">
        <p className="font-medium mb-1">⚠️ Édition d'un test en cours d'utilisation</p>
        <p>
          Les réponses déjà enregistrées par les candidats restent figées par un snapshot pris au démarrage de leur test. Tu peux donc modifier librement les questions sans casser les résultats existants.
        </p>
      </div>
      <EditQuestionsClient questions={questions} testId={test.id} />
    </div>
  );
}
