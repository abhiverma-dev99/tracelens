-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "aiRootCause" TEXT,
ADD COLUMN     "aiSolution" TEXT;

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "commitHash" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);
