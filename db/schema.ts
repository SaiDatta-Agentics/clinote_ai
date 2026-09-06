import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const patients = sqliteTable(
  "patients",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    initials: text("initials").notNull(),
    dateOfBirth: text("date_of_birth").notNull(),
    mrn: text("mrn").notNull(),
    sex: text("sex").notNull(),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    allergies: text("allergies", { mode: "json" }).$type<string[]>().notNull(),
    medications: text("medications", { mode: "json" }).$type<string[]>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_patients_owner_name").on(table.ownerId, table.name),
    uniqueIndex("idx_patients_owner_mrn").on(table.ownerId, table.mrn),
  ],
);

export const encounters = sqliteTable(
  "encounters",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    patientId: text("patient_id").notNull().references(() => patients.id),
    consultationType: text("consultation_type").notNull(),
    status: text("status").notNull(),
    clinicianName: text("clinician_name").notNull(),
    scheduledAt: text("scheduled_at").notNull(),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_encounters_owner_scheduled").on(table.ownerId, table.scheduledAt),
    index("idx_encounters_patient").on(table.patientId),
    index("idx_encounters_status").on(table.ownerId, table.status),
  ],
);

export const consentRecords = sqliteTable(
  "consent_records",
  {
    id: text("id").primaryKey(),
    encounterId: text("encounter_id").notNull().references(() => encounters.id),
    status: text("status").notNull(),
    method: text("method").notNull(),
    guardianName: text("guardian_name"),
    capturedAt: text("captured_at").notNull(),
    withdrawnAt: text("withdrawn_at"),
  },
  (table) => [uniqueIndex("idx_consent_encounter").on(table.encounterId)],
);

export const transcripts = sqliteTable(
  "transcripts",
  {
    id: text("id").primaryKey(),
    encounterId: text("encounter_id").notNull().references(() => encounters.id),
    segments: text("segments", { mode: "json" })
      .$type<Array<{ speaker: string; time: string; text: string; confidence: number }>>()
      .notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_transcripts_encounter").on(table.encounterId)],
);

export const clinicalNotes = sqliteTable(
  "clinical_notes",
  {
    id: text("id").primaryKey(),
    encounterId: text("encounter_id").notNull().references(() => encounters.id),
    status: text("status").notNull(),
    chiefComplaint: text("chief_complaint").notNull().default(""),
    subjective: text("subjective").notNull().default(""),
    objective: text("objective").notNull().default(""),
    assessment: text("assessment").notNull().default(""),
    plan: text("plan").notNull().default(""),
    patientSummary: text("patient_summary").notNull().default(""),
    medications: text("medications", { mode: "json" }).$type<string[]>().notNull(),
    allergies: text("allergies", { mode: "json" }).$type<string[]>().notNull(),
    uncertainties: text("uncertainties", { mode: "json" })
      .$type<Array<{ severity: "low" | "medium" | "critical"; text: string; source: string }>>()
      .notNull(),
    updatedAt: text("updated_at").notNull(),
    approvedAt: text("approved_at"),
  },
  (table) => [
    uniqueIndex("idx_notes_encounter").on(table.encounterId),
    index("idx_notes_status").on(table.status),
  ],
);

export const noteVersions = sqliteTable(
  "note_versions",
  {
    id: text("id").primaryKey(),
    noteId: text("note_id").notNull().references(() => clinicalNotes.id),
    version: integer("version").notNull(),
    snapshot: text("snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    changedBy: text("changed_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("idx_note_versions_note_version").on(table.noteId, table.version)],
);

export const audioAssets = sqliteTable(
  "audio_assets",
  {
    id: text("id").primaryKey(),
    encounterId: text("encounter_id").notNull().references(() => encounters.id),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [index("idx_audio_encounter").on(table.encounterId)],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    encounterId: text("encounter_id"),
    action: text("action").notNull(),
    detail: text("detail").notNull(),
    actor: text("actor").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_audit_owner_created").on(table.ownerId, table.createdAt)],
);
