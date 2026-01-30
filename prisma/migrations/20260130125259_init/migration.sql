/*
  Warnings:

  - You are about to drop the column `colorTheme` on the `Project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "attachments" JSONB;

-- AlterTable
ALTER TABLE "public"."Project" DROP COLUMN "colorTheme";
