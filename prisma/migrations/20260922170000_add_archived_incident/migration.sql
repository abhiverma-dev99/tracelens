-- Baseline for ArchivedIncident (already present in some environments)
CREATE TABLE IF NOT EXISTS "ArchivedIncident" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stackTrace" TEXT,
    "service" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivedIncident_pkey" PRIMARY KEY ("id")
);
