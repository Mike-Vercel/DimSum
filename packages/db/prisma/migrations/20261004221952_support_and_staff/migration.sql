-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SUPPORT_REQUEST';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "disabledAt" TIMESTAMP(3);
