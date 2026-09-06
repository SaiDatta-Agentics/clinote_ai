import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { readSessionCookie } from "../auth/entra";
import {
  auditEvents,
  clinicalNotes,
  consentRecords,
  encounters,
  noteVersions,
  patients,
  transcripts,
} from "@/db/schema";
import type { ClinicalNote, Patient, TranscriptSegment } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

async function actorFrom(request: Request) {
  const session = await readSessionCookie();
  if (session) return { id: session.userId, email: session.email };
  const demoId = request.headers.get("x-clinote-demo-user")?.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80);
  const id = request.headers.get("oai-authenticated-user-id") ?? demoId ?? "demo-user";
  const email = request.headers.get("oai-authenticated-user-email") ?? "demo.clinician@example.test";
  return { id, email };
}

async function ensurePatientAndEncounter(
  ownerId: string,
  encounterId: string,
  patient: Patient,
  clinicianName: string,
  status: string,
) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.insert(patients).values({
    id: patient.id,
    ownerId,
    name: patient.name,
    initials: patient.initials,
    dateOfBirth: patient.dateOfBirth,
    mrn: patient.mrn,
    sex: patient.sex,
    phone: patient.phone,
    email: patient.email,
    allergies: patient.allergies,
    medications: patient.medications,
    createdAt: now,
  }).onConflictDoNothing();
  await db.insert(encounters).values({
    id: encounterId,
    ownerId,
    patientId: patient.id,
    consultationType: "General consultation",
    status,
    clinicianName,
    scheduledAt: now,
    durationSeconds: 0,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: encounters.id,
    set: { status, clinicianName, updatedAt: now },
  });
}

export async function GET(request: Request) {
  try {
    const actor = await actorFrom(request);
    const db = await getDb();
    const [patientRows, encounterRows, noteRows, auditRows] = await Promise.all([
      db.select().from(patients).where(eq(patients.ownerId, actor.id)).limit(50),
      db.select().from(encounters).where(eq(encounters.ownerId, actor.id)).orderBy(desc(encounters.scheduledAt)).limit(50),
      db.select().from(clinicalNotes).orderBy(desc(clinicalNotes.updatedAt)).limit(50),
      db.select().from(auditEvents).where(eq(auditEvents.ownerId, actor.id)).orderBy(desc(auditEvents.createdAt)).limit(100),
    ]);
    return Response.json({ patients: patientRows, encounters: encounterRows, notes: noteRows, auditEvents: auditRows });
  } catch {
    return Response.json({ error: "Workspace data is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const actor = await actorFrom(request);
  const body = (await request.json()) as {
    action?: string;
    encounterId?: string;
    patient?: Patient;
    method?: string;
    clinicianName?: string;
    segments?: TranscriptSegment[];
    note?: ClinicalNote;
    durationSeconds?: number;
  };
  if (!body.action || !body.encounterId || !body.patient || !body.clinicianName) {
    return Response.json({ error: "Incomplete workspace action." }, { status: 400 });
  }

  try {
    const db = await getDb();
    const now = new Date().toISOString();
    if (body.action === "decline_consent" || body.action === "withdraw_consent") {
      const withdrawn = body.action === "withdraw_consent";
      const status = withdrawn ? "consent_withdrawn" : "consent_declined";
      await ensurePatientAndEncounter(actor.id, body.encounterId, body.patient, body.clinicianName, status);
      await db.insert(consentRecords).values({
        id: crypto.randomUUID(),
        encounterId: body.encounterId,
        status: withdrawn ? "withdrawn" : "declined",
        method: body.method ?? "Verbal",
        capturedAt: now,
        withdrawnAt: withdrawn ? now : null,
      }).onConflictDoUpdate({
        target: consentRecords.encounterId,
        set: { status: withdrawn ? "withdrawn" : "declined", method: body.method ?? "Verbal", withdrawnAt: withdrawn ? now : null },
      });
      await db.insert(auditEvents).values({
        id: crypto.randomUUID(),
        ownerId: actor.id,
        encounterId: body.encounterId,
        action: withdrawn ? "Consent withdrawn" : "Consent declined",
        detail: `${body.patient.name} · Recording ${withdrawn ? "discarded" : "not started"}`,
        actor: body.clinicianName,
        createdAt: now,
      });
      return Response.json({ ok: true, status });
    }

    if (body.action === "save_consent") {
      await ensurePatientAndEncounter(actor.id, body.encounterId, body.patient, body.clinicianName, "consent_captured");
      await db.insert(consentRecords).values({
        id: crypto.randomUUID(),
        encounterId: body.encounterId,
        status: "accepted",
        method: body.method ?? "Verbal",
        capturedAt: now,
      }).onConflictDoUpdate({
        target: consentRecords.encounterId,
        set: { status: "accepted", method: body.method ?? "Verbal", capturedAt: now, withdrawnAt: null },
      });
      await db.insert(auditEvents).values({ id: crypto.randomUUID(), ownerId: actor.id, encounterId: body.encounterId, action: "Consent captured", detail: `${body.patient.name} · ${body.method ?? "Verbal"} consent`, actor: body.clinicianName, createdAt: now });
      return Response.json({ ok: true, status: "consent_captured" });
    }

    if (body.action === "save_transcript" && body.segments) {
      await ensurePatientAndEncounter(actor.id, body.encounterId, body.patient, body.clinicianName, "draft_ready");
      await db.insert(transcripts).values({ id: crypto.randomUUID(), encounterId: body.encounterId, segments: body.segments, createdAt: now });
      await db.insert(auditEvents).values({ id: crypto.randomUUID(), ownerId: actor.id, encounterId: body.encounterId, action: "Transcript generated", detail: `${body.patient.name} · ${body.segments.length} source segments`, actor: "System", createdAt: now });
      return Response.json({ ok: true, status: "draft_ready" });
    }

    if ((body.action === "save_note" || body.action === "approve_note") && body.note) {
      const approved = body.action === "approve_note";
      await ensurePatientAndEncounter(actor.id, body.encounterId, body.patient, body.clinicianName, approved ? "approved" : "under_review");
      const noteId = `note-${body.encounterId}`;
      const noteValues = {
        status: approved ? "approved" : "draft",
        chiefComplaint: body.note.chiefComplaint,
        subjective: body.note.subjective,
        objective: body.note.objective,
        assessment: body.note.assessment,
        plan: body.note.plan,
        patientSummary: body.note.patientSummary,
        medications: body.note.medications,
        allergies: body.note.allergies,
        uncertainties: body.note.uncertainties,
        updatedAt: now,
        approvedAt: approved ? now : null,
      };
      await db.insert(clinicalNotes).values({ id: noteId, encounterId: body.encounterId, ...noteValues }).onConflictDoUpdate({ target: clinicalNotes.encounterId, set: noteValues });
      const existingVersions = await db.select({ version: noteVersions.version }).from(noteVersions).where(eq(noteVersions.noteId, noteId));
      const nextVersion = Math.max(0, ...existingVersions.map((row) => row.version)) + 1;
      await db.insert(noteVersions).values({ id: crypto.randomUUID(), noteId, version: nextVersion, snapshot: body.note as unknown as Record<string, unknown>, changedBy: body.clinicianName, createdAt: now });
      if (approved) {
        await db.update(encounters).set({ status: "approved", durationSeconds: body.durationSeconds ?? 0, updatedAt: now }).where(eq(encounters.id, body.encounterId));
      }
      await db.insert(auditEvents).values({ id: crypto.randomUUID(), ownerId: actor.id, encounterId: body.encounterId, action: approved ? "Note approved" : "Draft saved", detail: `${body.patient.name} · Version ${nextVersion}`, actor: body.clinicianName, createdAt: now });
      return Response.json({ ok: true, status: approved ? "approved" : "draft", version: nextVersion });
    }

    return Response.json({ error: "Unsupported workspace action." }, { status: 400 });
  } catch {
    return Response.json({ error: "The action could not be saved." }, { status: 503 });
  }
}
