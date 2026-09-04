-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "stackTrace" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);
