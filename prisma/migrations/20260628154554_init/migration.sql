-- DropIndex
DROP INDEX "Job_messageId_key";

-- CreateIndex
CREATE INDEX "Job_messageId_createdAt_idx" ON "Job"("messageId", "createdAt");
