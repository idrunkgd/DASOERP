// Page publique pour répondre à un test via lien magique.
// Pas de login Dasohub requis : le token authentifie. La page est en dehors
// du segment (app) pour échapper au layout sidebar/topbar et au middleware
// d'auth. Le candidat ne voit jamais son score, seulement un remerciement
// à la fin.

import { notFound } from "next/navigation";
import { getAssignmentByToken, domainLabel } from "@/server/actions/tests";
import { TakeTestClient } from "./take-client";

export const dynamic = "force-dynamic";

export default async function TakeTestPage({ params }: { params: { token: string } }) {
  const assignment = await getAssignmentByToken(params.token);
  if (!assignment) notFound();

  const target = assignment.candidate
    ? `${assignment.candidate.firstName} ${assignment.candidate.lastName}`
    : assignment.user
      ? `${assignment.user.firstName} ${assignment.user.lastName}`
      : "Vous";

  // Statut COMPLETED ou EXPIRED → message dédié, pas de form
  if (assignment.status === "COMPLETED") {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-semibold mb-3">Merci {target.split(" ")[0]} !</h1>
          <p className="text-midnight-600 mb-2">
            Ce test a déjà été soumis. Vos réponses ont bien été enregistrées et transmises à l'équipe Dasolabs.
          </p>
          <p className="text-sm text-midnight-500">Vous pouvez fermer cette fenêtre.</p>
        </div>
      </Layout>
    );
  }
  if (assignment.status === "EXPIRED") {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-semibold mb-3">Lien expiré</h1>
          <p className="text-midnight-600">
            Ce lien d'évaluation n'est plus valide. Contactez Dasolabs pour en recevoir un nouveau.
          </p>
        </div>
      </Layout>
    );
  }

  // Pré-remplir avec les réponses déjà enregistrées (reprise si IN_PROGRESS)
  const existingAnswers = new Map(
    assignment.submission?.answers.map((a) => [a.questionId, a.choiceId]) ?? []
  );

  const questions = assignment.test.questions.map((q) => ({
    id: q.id,
    text: q.text,
    position: q.position,
    isScenario: q.isScenario,
    choices: q.choices.map((c) => ({ id: c.id, position: c.position, text: c.text }))
  }));

  return (
    <Layout>
      <header className="mb-8">
        <div className="text-xs uppercase tracking-wider text-indigoaccent font-semibold mb-1">
          {domainLabel(assignment.test.domain)}
        </div>
        <h1 className="text-2xl font-semibold text-midnight-900 mb-1">
          {assignment.test.title}
        </h1>
        <p className="text-sm text-midnight-500">
          Bonjour <strong>{target}</strong>, voici votre évaluation Dasolabs. {questions.length} questions à choix unique.
          Vos réponses sont enregistrées automatiquement, vous pouvez fermer la fenêtre et revenir plus tard.
        </p>
        {assignment.expiresAt && (
          <p className="text-xs text-amber-700 mt-2">
            Lien valide jusqu'au {assignment.expiresAt.toLocaleDateString("fr-BE")}.
          </p>
        )}
      </header>
      <TakeTestClient
        token={params.token}
        questions={questions}
        initialAnswers={Object.fromEntries(existingAnswers)}
      />
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-midnight-50 to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white border border-border rounded-xl shadow-sm p-6 sm:p-10">
          {children}
        </div>
        <p className="text-center text-[11px] text-midnight-400 mt-6">
          Dasohub · Évaluation technique
        </p>
      </div>
    </div>
  );
}
