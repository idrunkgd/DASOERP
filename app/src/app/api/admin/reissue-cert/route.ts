// Rattrapage certificat pour un consultant.
// Réservé aux admins (users.manage OU role SUPERADMIN).
//
// GET /api/admin/reissue-cert?email=<email>&slug=<courseSlug>&score=<int?>
//   - email : email du user (obligatoire)
//   - slug  : slug du cours (obligatoire, ex ba4-securite-electrique)
//   - score : score en % (optionnel). Sinon on prend la dernière tentative
//             sur le QUIZ FINAL du cours.
//
// Réponse JSON : { ok, action, documentId, scorePercent, threshold, reason? }
//
// Cas d'usage : la génération auto a échoué (erreur silencieuse dans le
// try/catch de saveQuizAttempt), on remet le certificat en 30 secondes.

import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { issueCertificateForUser } from "@/server/services/certificate-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireSession();
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const isAdmin = session.user.role === "SUPERADMIN" || perms.includes("users.manage");
  if (!isAdmin) return Response.json({ ok: false, reason: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim();
  const slug  = url.searchParams.get("slug")?.trim();
  const scoreArg = url.searchParams.get("score");
  if (!email || !slug) return Response.json({ ok: false, reason: "email + slug requis" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, lastName: true, email: true }
  });
  if (!user) return Response.json({ ok: false, reason: `User introuvable : ${email}` }, { status: 404 });

  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true, title: true, isCertifying: true, passThreshold: true }
  });
  if (!course) return Response.json({ ok: false, reason: `Cours introuvable : ${slug}` }, { status: 404 });
  if (!course.isCertifying) {
    return Response.json({
      ok: false,
      reason: `Le cours ${slug} n'est pas isCertifying=true. Vérifier le seed ou forcer via SQL.`,
      hint: `UPDATE "Course" SET "isCertifying"=true, "passThreshold"=70 WHERE slug='${slug}';`
    }, { status: 400 });
  }

  // Score : arg > dernière tentative > erreur
  let scorePercent: number | null = scoreArg ? parseInt(scoreArg, 10) : null;
  let scoreSource = scoreArg ? "arg" : "attempt";
  if (scorePercent == null) {
    const lastQuiz = await prisma.courseSlide.findFirst({
      where: { courseId: course.id, kind: "QUIZ" },
      orderBy: { position: "desc" },
      select: { id: true, quiz: true }
    });
    if (!lastQuiz) return Response.json({ ok: false, reason: "Aucun quiz trouvé pour ce cours" }, { status: 404 });
    const totalQ = ((lastQuiz.quiz as any)?.questions?.length) ?? 10;
    const att = await prisma.userQuizAttempt.findFirst({
      where: { slideId: lastQuiz.id, userId: user.id },
      orderBy: { createdAt: "desc" }
    });
    if (!att) return Response.json({ ok: false, reason: "Aucune tentative sur le quiz final trouvée. Fournir ?score=<int>" }, { status: 404 });
    scorePercent = Math.round((att.score / totalQ) * 100);
  }
  const threshold = course.passThreshold ?? 70;
  if (scorePercent < threshold) {
    return Response.json({ ok: false, reason: `Score ${scorePercent}% < seuil ${threshold}%.`, scorePercent, threshold, scoreSource }, { status: 400 });
  }

  try {
    const r = await issueCertificateForUser({ userId: user.id, courseId: course.id, scorePercent });
    return Response.json({
      ok: true,
      action: r.newlyIssued ? "created" : "already-existed",
      documentId: r.documentId,
      scorePercent,
      threshold,
      scoreSource,
      user: `${user.firstName} ${user.lastName} <${user.email}>`,
      course: course.title
    });
  } catch (err: any) {
    return Response.json({
      ok: false,
      reason: "Émission a levé une exception — regarde les logs Coolify pour la trace complète",
      error: err?.message ?? String(err)
    }, { status: 500 });
  }
}
