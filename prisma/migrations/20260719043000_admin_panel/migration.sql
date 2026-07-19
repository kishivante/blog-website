ALTER TABLE "User" ADD COLUMN "suspendedUntil" TIMESTAMP(3);
CREATE INDEX "User_accountStatus_suspendedUntil_idx" ON "User"("accountStatus", "suspendedUntil");

ALTER TABLE "SiteSetting"
  ADD COLUMN "shortName" TEXT,
  ADD COLUMN "contentRules" JSONB;

ALTER TABLE "ThemeSetting"
  ADD COLUMN "linkColor" TEXT NOT NULL DEFAULT '#3a8dde';

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_immutable"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
