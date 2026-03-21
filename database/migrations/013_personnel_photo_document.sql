-- Personnel profile photo: references uploaded document (category photo, image mime).

ALTER TABLE personnel ADD COLUMN IF NOT EXISTS photo_document_id UUID;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personnel_photo_document_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'documents'
  ) THEN
    ALTER TABLE personnel
      ADD CONSTRAINT personnel_photo_document_id_fkey
      FOREIGN KEY (photo_document_id) REFERENCES documents (id) ON DELETE SET NULL;
  END IF;
END
$do$;

CREATE INDEX IF NOT EXISTS idx_personnel_tenant_photo_document
  ON personnel (tenant_id, photo_document_id)
  WHERE deleted_at IS NULL AND photo_document_id IS NOT NULL;
