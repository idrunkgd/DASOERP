"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { SEED_TESTS } from "@/lib/test-seed-data";
import type { TestAssignmentStatus, TestDifficulty } from "@prisma/client";

// ─── Seed : initialise les 5 tests si la table est vide ──────────────────
// Idempotent — exécuté une seule fois à la demande depuis la page /tests.
// On n'utilise pas un seed automatique au boot pour rester explicite.

export async function seedTestsIfMissing() {
  const session = await requirePermission("tests.manage");
  const existing = await prisma.test.count();
  if (existing >= SEED_TESTS.length) {
    return { ok: true, created: 0, message: "Les 5 tests sont déjà présents." };
  }
  let created = 0;
  for (const t of SEED_TESTS) {
    const already = await prisma.test.findUnique({ where: { domain: t.domain } });
    if (already) continue;
    await prisma.test.create({
      data: {
        domain: t.domain,
        title: t.title,
        description: t.description,
        questions: {
          create: t.questions.map((q, qi) => ({
            position: qi + 1,
            text: q.text,
            difficulty: q.difficulty,
            isScenario: q.isScenario ?? false,
            choices: {
              create: q.choices.map((c, ci) => ({
                position: ci + 1,
                text: c.text,
                isCorrect: c.isCorrect
              }))
            }
          }))
        }
      }
    });
    created++;
  }
  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Test",
    entityId: "seed",
    message: `Seed des ${created} test(s) techniques initialisé(s)`
  });
  revalidatePath("/tests");
  return { ok: true, created, message: `${created} test(s) créé(s).` };
}

// ─── Liste des tests (admin) ──────────────────────────────────────────────

export async function listTestsForAdmin() {
  await requirePermission("tests.manage");
  return prisma.test.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { questions: true, assignments: true } }
    }
  });
}

// ─── Détail d'un test (admin) ────────────────────────────────────────────

export async function getTestDetail(testId: string) {
  await requirePermission("tests.manage");
  return prisma.test.findUnique({
    where: { id: testId },
    include: {
      questions: {
        orderBy: { position: "asc" },
        include: { choices: { orderBy: { position: "asc" } } }
      },
      assignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
          submission: true
        }
      }
    }
  });
}

// ─── Assignation à un user ou à un candidat ─────────────────────────────

const AssignSchema = z.object({
  testId: z.string().min(1),
  userId: z.string().nullable().optional(),
  candidateId: z.string().nullable().optional(),
  expiresInDays: z.coerce.number().int().positive().max(180).default(14)
}).refine(d => !!d.userId !== !!d.candidateId, {
  message: "Renseigne soit un user, soit un candidat (exclusif)"
});

export async function assignTest(formData: FormData) {
  const session = await requirePermission("tests.manage");
  const raw = Object.fromEntries(formData);
  const data = AssignSchema.parse({
    ...raw,
    userId: raw.userId || null,
    candidateId: raw.candidateId || null
  });

  // Anti-doublon : pas deux assignations actives sur même test + même cible
  const exists = await prisma.testAssignment.findFirst({
    where: {
      testId: data.testId,
      userId: data.userId ?? undefined,
      candidateId: data.candidateId ?? undefined,
      status: { in: ["PENDING", "IN_PROGRESS"] }
    }
  });
  if (exists) {
    throw new Error("Une assignation est déjà en cours pour cette personne sur ce test.");
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + data.expiresInDays);

  const created = await prisma.testAssignment.create({
    data: {
      testId: data.testId,
      userId: data.userId ?? null,
      candidateId: data.candidateId ?? null,
      assignedById: session.user.id,
      expiresAt,
      status: "PENDING"
    },
    include: {
      test: { select: { title: true } },
      user: { select: { firstName: true, lastName: true } },
      candidate: { select: { firstName: true, lastName: true } }
    }
  });

  const target = created.user
    ? `${created.user.firstName} ${created.user.lastName}`
    : `${created.candidate?.firstName} ${created.candidate?.lastName}`;
  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "TestAssignment",
    entityId: created.id,
    message: `Test « ${created.test.title} » assigné à ${target}`
  });

  revalidatePath("/tests");
  revalidatePath(`/tests/${data.testId}`);
  if (data.candidateId) revalidatePath(`/candidates/${data.candidateId}`);
  if (data.userId) revalidatePath(`/users/${data.userId}`);
  return { ok: true, assignmentId: created.id, magicToken: created.magicToken };
}

// ─── Tests assignés à un user (perspective consultant /me/tests) ─────────

export async function getMyAssignments(userId: string) {
  await requirePermission("tests.take");
  return prisma.testAssignment.findMany({
    where: { userId },
    orderBy: { assignedAt: "desc" },
    include: {
      test: { select: { id: true, title: true, domain: true } },
      submission: { select: { completedAt: true } }
    }
  });
}

// ─── Récupération du test via token magique (candidat, sans auth) ────────
// Pas de check de permission : c'est le token qui authentifie.
// On retourne la liste des questions et choix SANS la flag isCorrect, jamais
// révélée au répondant.

export async function getAssignmentByToken(token: string) {
  if (!token || token.length < 8) return null;
  const assignment = await prisma.testAssignment.findUnique({
    where: { magicToken: token },
    include: {
      test: {
        include: {
          questions: {
            orderBy: { position: "asc" },
            include: {
              choices: {
                orderBy: { position: "asc" },
                select: { id: true, position: true, text: true }
                // isCorrect explicitement omis
              }
            }
          }
        }
      },
      submission: { include: { answers: true } },
      candidate: { select: { firstName: true, lastName: true } },
      user: { select: { firstName: true, lastName: true } }
    }
  });
  if (!assignment) return null;
  // Expiration
  if (assignment.expiresAt && assignment.expiresAt < new Date() && assignment.status !== "COMPLETED") {
    await prisma.testAssignment.update({
      where: { id: assignment.id },
      data: { status: "EXPIRED" }
    });
    return { ...assignment, status: "EXPIRED" as TestAssignmentStatus };
  }
  return assignment;
}

// ─── Sauvegarde d'une réponse (au fur et à mesure) ───────────────────────

const AnswerSchema = z.object({
  token: z.string().min(8),
  questionId: z.string().min(1),
  choiceId: z.string().min(1)
});

export async function saveAnswer(input: { token: string; questionId: string; choiceId: string }) {
  const data = AnswerSchema.parse(input);
  const assignment = await prisma.testAssignment.findUnique({
    where: { magicToken: data.token },
    include: { submission: true }
  });
  if (!assignment) throw new Error("Lien invalide");
  if (assignment.status === "COMPLETED") throw new Error("Ce test a déjà été soumis");
  if (assignment.expiresAt && assignment.expiresAt < new Date()) {
    throw new Error("Ce test a expiré");
  }

  // Vérifie que la question/choix appartiennent bien au test assigné
  const choice = await prisma.testChoice.findUnique({
    where: { id: data.choiceId },
    include: { question: { select: { testId: true, id: true } } }
  });
  if (!choice || choice.questionId !== data.questionId || choice.question.testId !== assignment.testId) {
    throw new Error("Réponse invalide pour ce test");
  }

  // Crée la submission si absente, sinon passe en IN_PROGRESS
  let submission = assignment.submission;
  if (!submission) {
    submission = await prisma.testSubmission.create({
      data: { assignmentId: assignment.id }
    });
    await prisma.testAssignment.update({
      where: { id: assignment.id },
      data: { status: "IN_PROGRESS" }
    });
  }

  await prisma.testAnswer.upsert({
    where: {
      submissionId_questionId: { submissionId: submission.id, questionId: data.questionId }
    },
    create: {
      submissionId: submission.id,
      questionId: data.questionId,
      choiceId: data.choiceId
    },
    update: { choiceId: data.choiceId, answeredAt: new Date() }
  });
  return { ok: true };
}

// ─── Soumission finale : calcule le score et le breakdown ───────────────

export async function submitTest(token: string) {
  if (!token) throw new Error("Lien manquant");
  const assignment = await prisma.testAssignment.findUnique({
    where: { magicToken: token },
    include: {
      submission: { include: { answers: true } },
      test: {
        include: {
          questions: {
            include: { choices: true }
          }
        }
      }
    }
  });
  if (!assignment) throw new Error("Lien invalide");
  if (assignment.status === "COMPLETED") throw new Error("Ce test a déjà été soumis");
  if (!assignment.submission) throw new Error("Aucune réponse enregistrée");

  // Build maps pour calcul score
  const choiceById = new Map<string, { isCorrect: boolean; questionId: string }>();
  const questionById = new Map<string, { difficulty: TestDifficulty; points: number }>();
  for (const qst of assignment.test.questions) {
    questionById.set(qst.id, { difficulty: qst.difficulty, points: qst.points });
    for (const ch of qst.choices) {
      choiceById.set(ch.id, { isCorrect: ch.isCorrect, questionId: qst.id });
    }
  }

  let score = 0, maxScore = 0;
  const buckets: Record<TestDifficulty, { score: number; max: number }> = {
    JUNIOR: { score: 0, max: 0 },
    MEDIOR: { score: 0, max: 0 },
    SENIOR: { score: 0, max: 0 },
    EXPERT: { score: 0, max: 0 }
  };
  // Max : on compte sur TOUTES les questions du test, même non répondues
  for (const qst of assignment.test.questions) {
    maxScore += qst.points;
    buckets[qst.difficulty].max += qst.points;
  }
  // Score : seulement sur les réponses enregistrées
  const answersByQuestion = new Map(
    assignment.submission.answers.map((a) => [a.questionId, a])
  );
  for (const [qid, ans] of answersByQuestion) {
    const ch = choiceById.get(ans.choiceId);
    const qst = questionById.get(qid);
    if (!ch || !qst) continue;
    if (ch.isCorrect) {
      score += qst.points;
      buckets[qst.difficulty].score += qst.points;
    }
  }

  await prisma.testSubmission.update({
    where: { id: assignment.submission.id },
    data: {
      completedAt: new Date(),
      score, maxScore,
      scoreJunior: buckets.JUNIOR.score, maxJunior: buckets.JUNIOR.max,
      scoreMedior: buckets.MEDIOR.score, maxMedior: buckets.MEDIOR.max,
      scoreSenior: buckets.SENIOR.score, maxSenior: buckets.SENIOR.max,
      scoreExpert: buckets.EXPERT.score, maxExpert: buckets.EXPERT.max
    }
  });
  await prisma.testAssignment.update({
    where: { id: assignment.id },
    data: { status: "COMPLETED" }
  });

  await logActivity({
    actorId: assignment.assignedById,
    action: "UPDATE",
    entityType: "TestSubmission",
    entityId: assignment.submission.id,
    message: `Test soumis (score ${score}/${maxScore})`
  });

  revalidatePath(`/tests/${assignment.testId}`);
  if (assignment.candidateId) revalidatePath(`/candidates/${assignment.candidateId}`);
  if (assignment.userId) revalidatePath(`/users/${assignment.userId}`);
  return { ok: true };
}

// ─── Tests d'un candidat ou user (vue admin sur fiche profil) ───────────

export async function getAssignmentsForCandidate(candidateId: string) {
  await requirePermission("tests.manage");
  return prisma.testAssignment.findMany({
    where: { candidateId },
    orderBy: { assignedAt: "desc" },
    include: {
      test: { select: { id: true, title: true, domain: true } },
      submission: true
    }
  });
}

export async function getAssignmentsForUser(userId: string) {
  await requirePermission("tests.manage");
  return prisma.testAssignment.findMany({
    where: { userId },
    orderBy: { assignedAt: "desc" },
    include: {
      test: { select: { id: true, title: true, domain: true } },
      submission: true
    }
  });
}

// ─── Helpers UI ───────────────────────────────────────────────────────────

export function domainLabel(domain: string) {
  switch (domain) {
    case "ELEC_INDUSTRIAL": return "Électricité industrielle";
    case "PLC": return "PLC Siemens & Schneider";
    case "DATA_MANAGER": return "Data Manager";
    case "IT_INDUSTRIAL": return "IT industriel";
    case "CYBERSEC_INDUSTRIAL": return "Cybersécurité OT";
    default: return domain;
  }
}

export function difficultyLabel(d: TestDifficulty) {
  return { JUNIOR: "Junior", MEDIOR: "Médior", SENIOR: "Senior", EXPERT: "Expert" }[d];
}

export function profileFromScores(s: {
  scoreJunior: number; maxJunior: number;
  scoreMedior: number; maxMedior: number;
  scoreSenior: number; maxSenior: number;
  scoreExpert: number; maxExpert: number;
}): string {
  // Heuristique simple : on regarde où la performance reste >= 70 %
  const pct = (sc: number, mx: number) => (mx > 0 ? sc / mx : 0);
  const J = pct(s.scoreJunior, s.maxJunior);
  const M = pct(s.scoreMedior, s.maxMedior);
  const S = pct(s.scoreSenior, s.maxSenior);
  const E = pct(s.scoreExpert, s.maxExpert);
  if (E >= 0.7 && S >= 0.7) return "Expert confirmé";
  if (S >= 0.7 && M >= 0.7) return "Senior confirmé";
  if (M >= 0.7 && J >= 0.7) return "Médior confirmé";
  if (J >= 0.7) return "Junior solide";
  return "Profil à conforter";
}
