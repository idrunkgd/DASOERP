CREATE TYPE "CourseSlideKind" AS ENUM ('CONTENT','QUIZ');

CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "level" TEXT,
    "duration" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");
CREATE INDEX "Course_active_idx" ON "Course"("active");
ALTER TABLE "Course"
  ADD CONSTRAINT "Course_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CourseSlide" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "CourseSlideKind" NOT NULL DEFAULT 'CONTENT',
    "section" TEXT,
    "title" TEXT NOT NULL,
    "bodyMd" TEXT NOT NULL,
    "notes" TEXT,
    "quiz" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseSlide_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CourseSlide_courseId_position_key" ON "CourseSlide"("courseId","position");
CREATE INDEX "CourseSlide_courseId_kind_idx" ON "CourseSlide"("courseId","kind");
ALTER TABLE "CourseSlide"
  ADD CONSTRAINT "CourseSlide_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserCourseProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lastSlide" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCourseProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserCourseProgress_userId_courseId_key" ON "UserCourseProgress"("userId","courseId");
CREATE INDEX "UserCourseProgress_userId_idx" ON "UserCourseProgress"("userId");
ALTER TABLE "UserCourseProgress"
  ADD CONSTRAINT "UserCourseProgress_userId_fkey"   FOREIGN KEY ("userId")   REFERENCES "User"("id")   ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserCourseProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserQuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserQuizAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserQuizAttempt_userId_courseId_idx" ON "UserQuizAttempt"("userId","courseId");
CREATE INDEX "UserQuizAttempt_slideId_idx" ON "UserQuizAttempt"("slideId");
ALTER TABLE "UserQuizAttempt"
  ADD CONSTRAINT "UserQuizAttempt_userId_fkey"   FOREIGN KEY ("userId")   REFERENCES "User"("id")        ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserQuizAttempt_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id")      ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserQuizAttempt_slideId_fkey"  FOREIGN KEY ("slideId")  REFERENCES "CourseSlide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
