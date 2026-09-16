CREATE TYPE "NotificationType" AS ENUM (
  'EXPENSE_SUBMITTED','EXPENSE_APPROVED','EXPENSE_REJECTED','EXPENSE_PAID',
  'LEAVE_SUBMITTED','LEAVE_APPROVED','LEAVE_REJECTED',
  'SICK_LEAVE_DECLARED',
  'TIMESHEET_SUBMITTED','TIMESHEET_APPROVED','TIMESHEET_REJECTED',
  'POLICY_TO_SIGN','CONTRACT_READY',
  'MISSION_ENDING','MISSION_ASSIGNED','MENTIONED','OTHER'
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "href" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId","read","createdAt" DESC);
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId","createdAt" DESC);

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
