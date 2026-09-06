"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Download,
  FileCheck2,
  FileClock,
  FileAudio,
  FileText,
  HeartPulse,
  History,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  LogOut,
  Menu,
  Mic,
  Moon,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
  WandSparkles,
  Zap,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ClinicalNote,
  demoAuditEvents,
  demoEncounters,
  demoPatients,
  Encounter,
  EncounterStatus,
  Patient,
  sampleNote,
  sampleTranscript,
  TranscriptSegment,
} from "@/lib/demo-data";

type View = "dashboard" | "patients" | "consultations" | "audit" | "safety" | "encounter";
type FlowStep = "consent" | "record" | "transcript" | "note" | "approved";
type RecordingState = "idle" | "recording" | "paused" | "processing" | "complete";
type CaptureMode = "live" | "upload" | "demo";
type LiveSpeaker = "Clinician" | "Patient";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "patients", label: "Patients", icon: Users },
  { id: "consultations", label: "Consultations", icon: FileText },
  { id: "audit", label: "Audit trail", icon: History },
  { id: "safety", label: "Safety centre", icon: ShieldCheck },
];

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

function createGroundedLocalDraft(segments: TranscriptSegment[], patient: Patient): ClinicalNote {
  const patientText = segments.filter((segment) => segment.speaker === "Patient").map((segment) => segment.text).join(" ");
  const clinicianText = segments.filter((segment) => segment.speaker === "Clinician").map((segment) => segment.text).join(" ");
  const firstPatientSentence = patientText.split(/[.!?]/)[0]?.trim();
  return {
    chiefComplaint: firstPatientSentence || "Chief complaint requires clinician entry.",
    subjective: patientText || "No patient-reported history was captured in the live transcript.",
    objective: clinicianText || "No clinician-spoken observations were captured in the live transcript.",
    assessment: "Assessment requires clinician review and entry. No diagnosis was inferred from the live transcript.",
    plan: "Plan requires clinician review and entry. No treatment recommendation was generated automatically.",
    patientSummary: "A clinician must complete and approve the consultation summary before it can be shared.",
    medications: patient.medications.map((item) => `${item} — existing fictional record context; verify against consultation`),
    allergies: patient.allergies.map((item) => `${item} — existing fictional record context; verify against consultation`),
    uncertainties: [{
      severity: "medium",
      text: "This local draft is a direct organisation of live speech and requires full clinician verification.",
      source: `Live transcript · ${segments.length} segment${segments.length === 1 ? "" : "s"}`,
    }],
  };
}

function exportFhirPreview(patient: Patient, note: ClinicalNote, clinicianName: string) {
  const generatedAt = new Date().toISOString();
  const bundle = {
    resourceType: "Bundle",
    type: "document",
    timestamp: generatedAt,
    entry: [
      {
        fullUrl: `urn:uuid:${patient.id}`,
        resource: {
          resourceType: "Patient",
          id: patient.id,
          identifier: [{ system: "https://example.test/mrn", value: patient.mrn }],
          name: [{ text: patient.name }],
        },
      },
      {
        fullUrl: "urn:uuid:approved-note",
        resource: {
          resourceType: "Composition",
          id: "approved-note",
          status: "final",
          type: { text: "Clinical consultation note" },
          date: generatedAt,
          title: `Clinical note — ${patient.name}`,
          author: [{ display: clinicianName }],
          subject: { reference: `urn:uuid:${patient.id}` },
          section: [
            { title: "Chief complaint", text: { status: "generated", div: `<div xmlns=\"http://www.w3.org/1999/xhtml\">${escapeXml(note.chiefComplaint)}</div>` } },
            { title: "Subjective", text: { status: "generated", div: `<div xmlns=\"http://www.w3.org/1999/xhtml\">${escapeXml(note.subjective)}</div>` } },
            { title: "Objective", text: { status: "generated", div: `<div xmlns=\"http://www.w3.org/1999/xhtml\">${escapeXml(note.objective)}</div>` } },
            { title: "Assessment", text: { status: "generated", div: `<div xmlns=\"http://www.w3.org/1999/xhtml\">${escapeXml(note.assessment)}</div>` } },
            { title: "Plan", text: { status: "generated", div: `<div xmlns=\"http://www.w3.org/1999/xhtml\">${escapeXml(note.plan)}</div>` } },
          ],
        },
      },
    ],
    meta: { tag: [{ code: "DEMO", display: "Fictional demonstration export — not for clinical use" }] },
  };
  const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/fhir+json" }));
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `clinote-${patient.mrn}-fhir-preview.json`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

async function exportClinicalPdf(patient: Patient, note: ClinicalNote, clinicianName: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 18) return;
    pdf.addPage();
    y = 20;
  };
  const addSection = (title: string, value: string) => {
    const lines = pdf.splitTextToSize(value || "Not documented.", contentWidth) as string[];
    ensureSpace(10 + lines.length * 5);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(49, 89, 216);
    pdf.text(title.toUpperCase(), margin, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(40, 48, 65);
    pdf.text(lines, margin, y, { lineHeightFactor: 1.45 });
    y += lines.length * 5 + 5;
  };

  pdf.setFillColor(23, 32, 51);
  pdf.rect(0, 0, pageWidth, 36, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("CLINOTE", margin, 16);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("Clinician-approved consultation note", margin, 25);
  y = 48;
  pdf.setTextColor(23, 32, 51);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text(patient.name, margin, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(101, 112, 134);
  pdf.text(`MRN ${patient.mrn}  |  DOB ${patient.dateOfBirth}  |  ${patient.sex}  |  ${patient.age} years`, margin, y);
  y += 7;
  pdf.text(`Signed by ${clinicianName}  |  ${new Date().toLocaleString()}`, margin, y);
  y += 12;

  addSection("Chief complaint", note.chiefComplaint);
  addSection("Subjective", note.subjective);
  addSection("Objective", note.objective);
  addSection("Assessment", note.assessment);
  addSection("Plan", note.plan);
  addSection("Patient summary", note.patientSummary);
  addSection("Medications", note.medications.join("\n"));
  addSection("Allergies", note.allergies.join("\n"));

  ensureSpace(16);
  pdf.setDrawColor(220, 226, 238);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 7;
  pdf.setFontSize(8);
  pdf.setTextColor(110, 120, 140);
  pdf.text("Fictional demonstration data only. Not certified for clinical use or connected to an EHR.", margin, y);
  pdf.save(`clinote-${patient.mrn}-approved-note.pdf`);
}

function StatusBadge({ status }: { status: EncounterStatus | "scheduled" }) {
  const styles: Record<string, string> = {
    scheduled: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
    draft_ready: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200",
    under_review: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  };
  const labels: Record<string, string> = {
    scheduled: "Scheduled",
    draft_ready: "Draft ready",
    under_review: "Needs review",
    approved: "Approved",
  };
  return <Badge variant="outline" className={classNames("rounded-full px-2.5 py-1 text-[11px] font-semibold", styles[status])}>{labels[status]}</Badge>;
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex size-10 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#6f8fff] to-[#4d6ce5] shadow-[0_8px_20px_rgba(71,99,213,.3)]">
        <HeartPulse className="size-5 text-white" strokeWidth={2.3} />
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-sidebar bg-[#56d5b3]" />
      </div>
      {!compact && (
        <div>
          <div className="text-lg font-bold tracking-[-0.04em] text-white">clinote</div>
          <div className="text-[10px] font-medium tracking-[0.16em] text-slate-400">CLINICAL SCRIBE</div>
        </div>
      )}
    </div>
  );
}

function Avatar({ initials, tone = "blue", size = "md" }: { initials: string; tone?: "blue" | "teal" | "violet"; size?: "sm" | "md" | "lg" }) {
  const tones = {
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
    teal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
  };
  const sizes = { sm: "size-8 text-[11px]", md: "size-10 text-xs", lg: "size-12 text-sm" };
  return <div className={classNames("flex shrink-0 items-center justify-center rounded-full font-bold", tones[tone], sizes[size])}>{initials}</div>;
}

function MetricCard({ label, value, note, icon: Icon, tone }: { label: string; value: string; note: string; icon: typeof Clock3; tone: "blue" | "teal" | "violet" | "amber" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-650 dark:bg-blue-950 dark:text-blue-300",
    teal: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  };
  return (
    <article className="group rounded-2xl border bg-card p-5 shadow-[0_8px_30px_rgba(32,49,82,.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(32,49,82,.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-[-0.04em]">{value}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
        </div>
        <div className={classNames("flex size-10 items-center justify-center rounded-xl", tones[tone])}><Icon className="size-5" /></div>
      </div>
    </article>
  );
}

export function ClinicalScribeApp({ clinicianName, userId, onSignOut }: { clinicianName: string; userId: string; onSignOut: () => void }) {
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [dark, setDark] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>("consent");
  const [patients] = useState<Patient[]>(demoPatients);
  const [encounters, setEncounters] = useState<Encounter[]>(demoEncounters);
  const [selectedPatientId, setSelectedPatientId] = useState(demoPatients[0].id);
  const [search, setSearch] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentMethod, setConsentMethod] = useState("Verbal");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("live");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [liveSegments, setLiveSegments] = useState<TranscriptSegment[]>([]);
  const [interimText, setInterimText] = useState("");
  const [liveSpeaker, setLiveSpeaker] = useState<LiveSpeaker>("Clinician");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [processingProvider, setProcessingProvider] = useState("Ready");
  const [agentFocus, setAgentFocus] = useState("Complete history");
  const [activeEncounterId, setActiveEncounterId] = useState(`enc-${crypto.randomUUID()}`);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>(sampleTranscript);
  const [note, setNote] = useState<ClinicalNote>(sampleNote);
  const [reviewed, setReviewed] = useState(false);
  const [activeNoteSection, setActiveNoteSection] = useState<keyof Pick<ClinicalNote, "subjective" | "objective" | "assessment" | "plan">>("subjective");
  const [toast, setToast] = useState<string | null>(null);
  const [micMessage, setMicMessage] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(2);
  const [localStorageReady, setLocalStorageReady] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const elapsedRef = useRef(0);
  const liveSpeakerRef = useRef<LiveSpeaker>("Clinician");

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];
  const currentEncounterId = activeEncounterId;
  const todayLabel = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const audioUrl = useMemo(() => audioBlob ? URL.createObjectURL(audioBlob) : null, [audioBlob]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(`clinote.encounters.${userId}`);
        if (saved) {
          const restored = JSON.parse(saved) as Encounter[];
          if (Array.isArray(restored) && restored.length) setEncounters(restored);
        }
      } catch {
        // Invalid local demo data is ignored and the fictional clinic list is restored.
      }
      setLocalStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userId]);

  useEffect(() => {
    if (!localStorageReady) return;
    window.localStorage.setItem(`clinote.encounters.${userId}`, JSON.stringify(encounters));
  }, [encounters, localStorageReady, userId]);

  useEffect(() => {
    liveSpeakerRef.current = liveSpeaker;
  }, [liveSpeaker]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  useEffect(() => {
    if (recordingState !== "recording") return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recordingState]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => () => {
    shouldListenRef.current = false;
    recognitionRef.current?.abort();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace", { headers: { "x-clinote-demo-user": userId } })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { encounters?: Array<Record<string, unknown>> } | null) => {
        if (cancelled || !payload?.encounters?.length) return;
        const restored = payload.encounters.flatMap((row): Encounter[] => {
          const patient = demoPatients.find((item) => item.id === row.patientId);
          if (!patient) return [];
          const status = String(row.status) as EncounterStatus;
          if (!["scheduled", "draft_ready", "under_review", "approved"].includes(status)) return [];
          const scheduledAt = String(row.scheduledAt ?? new Date().toISOString());
          return [{
            id: String(row.id),
            patientId: patient.id,
            patientName: patient.name,
            patientInitials: patient.initials,
            consultationType: String(row.consultationType ?? "General consultation"),
            status,
            scheduledAt,
            displayTime: new Date(scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            duration: `${Math.max(1, Math.ceil(Number(row.durationSeconds ?? 0) / 60))} min`,
            clinicianName: String(row.clinicianName ?? clinicianName),
          }];
        });
        setEncounters((current) => [...restored, ...current.filter((item) => !restored.some((saved) => saved.id === item.id))]);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [clinicianName, userId]);

  const postWorkspaceAction = useCallback(async (body: Record<string, unknown>) => {
    try {
      await fetch("/api/workspace", {
        method: "POST",
        headers: { "content-type": "application/json", "x-clinote-demo-user": userId },
        body: JSON.stringify(body),
      });
    } catch {
      // The interactive demo continues locally if persistence is unavailable.
    }
  }, [userId]);

  const beginConsultation = (patientId = selectedPatientId) => {
    setSelectedPatientId(patientId);
    setActiveEncounterId(`enc-${crypto.randomUUID()}`);
    setFlowStep("consent");
    setConsentAccepted(false);
    setCaptureMode("live");
    setRecordingState("idle");
    setElapsed(0);
    setAudioBlob(null);
    setLiveSegments([]);
    setInterimText("");
    setLiveSpeaker("Clinician");
    setProcessingProvider("Ready");
    setAgentFocus("Complete history");
    setReviewed(false);
    setMicMessage(null);
    setView("encounter");
    setMobileNav(false);
  };

  const continueAfterConsent = async () => {
    if (!consentAccepted) return;
    setFlowStep("record");
    await postWorkspaceAction({
      action: "save_consent",
      encounterId: currentEncounterId,
      patient: selectedPatient,
      method: consentMethod,
      clinicianName,
    });
  };

  const declineConsent = async () => {
    await postWorkspaceAction({ action: "decline_consent", encounterId: currentEncounterId, patient: selectedPatient, method: consentMethod, clinicianName });
    setToast("Consent declined. No audio was recorded.");
    setView("dashboard");
  };

  const stopLiveRecognition = () => {
    shouldListenRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    recognitionRef.current = null;
    setInterimText("");
  };

  const startLiveRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setMicMessage("Live browser transcription is not supported here. Audio recording still works; connect Groq for server transcription or use the guided demo.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-AU";
    recognition.onresult = (event) => {
      let interim = "";
      const finalSegments: TranscriptSegment[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;
        if (result.isFinal) {
          finalSegments.push({
            speaker: liveSpeakerRef.current,
            time: formatDuration(elapsedRef.current),
            text,
            confidence: result[0]?.confidence || 0.9,
          });
        } else {
          interim += `${text} `;
        }
      }
      if (finalSegments.length) setLiveSegments((current) => [...current, ...finalSegments]);
      setInterimText(interim.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        shouldListenRef.current = false;
        setMicMessage("Live transcription permission was blocked. Audio recording can continue, or you can use the guided demo.");
      }
    };
    recognition.onend = () => {
      if (!shouldListenRef.current) return;
      window.setTimeout(() => {
        try { recognition.start(); } catch { /* browser restart in progress */ }
      }, 180);
    };
    recognitionRef.current = recognition;
    shouldListenRef.current = true;
    try { recognition.start(); } catch { setMicMessage("Live transcription could not start, but audio recording is still active."); }
  };

  const startRecording = async () => {
    setMicMessage(null);
    if (!window.isSecureContext && location.hostname !== "localhost") {
      setMicMessage("Mobile microphone access requires HTTPS. Open the secure https:// Azure address, then try again.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicMessage("This mobile browser cannot record directly. Use Choose audio file to capture or select a recording from your phone.");
      setCaptureMode("upload");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/mp4;codecs=mp4a.40.2",
        "audio/mp4",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        mediaRecorderRef.current = null;
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
        if (!blob.size) {
          setRecordingState("idle");
          setMicMessage("The phone did not return recorded audio. Try again, keep the page open, or use Choose audio file.");
        } else {
          setRecordingState("complete");
          setProcessingProvider(`Mobile-ready audio · ${(blob.size / 1024).toFixed(0)} KB`);
        }
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecordingState("idle");
        setMicMessage("Recording stopped unexpectedly. Try the phone's built-in recorder and upload the audio file instead.");
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      startLiveRecognition();
      setProcessingProvider("Live browser transcript");
      setRecordingState("recording");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setMicMessage("Microphone permission is blocked. Allow microphone access in the browser site settings, reload this page and try again.");
      } else if (name === "NotFoundError") {
        setMicMessage("No microphone was detected. Connect a microphone or upload an audio recording.");
      } else {
        setMicMessage("Microphone recording is unavailable on this device. Use Choose audio file or the guided demo.");
      }
    }
  };

  const uploadAudioConversation = (file: File) => {
    const supportedTypes = ["audio/webm", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4", "audio/ogg"];
    const supportedExtension = /\.(webm|wav|mp3|m4a|mp4|ogg)$/i.test(file.name);
    if ((!supportedTypes.includes(file.type) && !supportedExtension) || !file.size) {
      setMicMessage("Choose a valid WEBM, WAV, MP3, M4A, MP4 or OGG audio file.");
      return;
    }
    if (file.size > 24 * 1024 * 1024) {
      setMicMessage("Audio uploads must be smaller than 24 MB.");
      return;
    }
    stopLiveRecognition();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setCaptureMode("upload");
    setAudioBlob(file);
    setLiveSegments([]);
    setInterimText("");
    setElapsed(0);
    setRecordingState("complete");
    setProcessingProvider(`Uploaded audio · ${(file.size / 1024 / 1024).toFixed(1)} MB`);
    setMicMessage(null);
    setToast(`${file.name} is ready for transcription.`);
  };

  const pauseRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    try {
      if (recordingState === "recording") {
        recorder.requestData();
        recorder.pause();
        stopLiveRecognition();
        setRecordingState("paused");
      } else if (recordingState === "paused") {
        recorder.resume();
        startLiveRecognition();
        setRecordingState("recording");
      }
    } catch {
      setMicMessage("Pause is not supported by this phone. End the consultation to keep the recording captured so far.");
    }
  };

  const stopRecording = () => {
    stopLiveRecognition();
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    try { recorder.requestData(); } catch { /* Some Safari versions flush automatically on stop. */ }
    window.setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, 120);
  };

  const withdrawConsent = async () => {
    stopLiveRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        setRecordingState("idle");
      };
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    chunksRef.current = [];
    setAudioBlob(null);
    setLiveSegments([]);
    await postWorkspaceAction({ action: "withdraw_consent", encounterId: currentEncounterId, patient: selectedPatient, method: consentMethod, clinicianName });
    setToast("Consent withdrawn. Captured audio and live transcript were discarded.");
    setView("dashboard");
  };

  const processConsultation = async (useSample = false) => {
    setRecordingState("processing");
    setMicMessage(null);
    let processedSegments = useSample ? sampleTranscript : liveSegments;
    try {
      const formData = new FormData();
      formData.set("encounterId", currentEncounterId);
      formData.set("patientName", selectedPatient.name);
      if (!useSample && audioBlob) {
        const extension = audioBlob.type.includes("mp4") ? "m4a" : audioBlob.type.includes("ogg") ? "ogg" : audioBlob.type.includes("wav") ? "wav" : "webm";
        formData.set("audio", audioBlob, `consultation.${extension}`);
      }
      const transcriptResponse = await fetch("/api/ai/transcribe", { method: "POST", body: formData });
      const transcriptPayload = await transcriptResponse.json() as { segments?: TranscriptSegment[]; provider?: string };
      if (useSample) {
        processedSegments = sampleTranscript;
        setProcessingProvider("Guided fictional demo");
      } else if (transcriptPayload.provider === "groq" && transcriptPayload.segments?.length) {
        processedSegments = transcriptPayload.segments;
        setProcessingProvider("Groq audio transcription");
      } else if (liveSegments.length) {
        processedSegments = liveSegments;
        setProcessingProvider("Live browser transcript");
      } else if (transcriptPayload.segments?.length) {
        processedSegments = transcriptPayload.segments;
        setProcessingProvider("Fictional fallback transcript");
      }
      setTranscript(processedSegments);

      const noteResponse = await fetch("/api/ai/note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ encounterId: currentEncounterId, patient: selectedPatient, segments: processedSegments, captureFocus: agentFocus }),
      });
      const notePayload = await noteResponse.json() as { note?: ClinicalNote; provider?: string };
      const generatedNote = !useSample && notePayload.provider === "demo" && processedSegments !== sampleTranscript
        ? createGroundedLocalDraft(processedSegments, selectedPatient)
        : notePayload.note ?? (useSample ? sampleNote : createGroundedLocalDraft(processedSegments, selectedPatient));
      setNote(generatedNote);
    } catch {
      processedSegments = useSample ? sampleTranscript : liveSegments.length ? liveSegments : sampleTranscript;
      setTranscript(processedSegments);
      setNote(useSample ? sampleNote : createGroundedLocalDraft(processedSegments, selectedPatient));
      setProcessingProvider(useSample ? "Guided fictional demo" : "Local grounded draft");
    }
    setRecordingState("complete");
    setFlowStep("transcript");
    await postWorkspaceAction({ action: "save_transcript", encounterId: currentEncounterId, patient: selectedPatient, segments: processedSegments, clinicianName });
    setToast("Transcript ready — uncertain wording is highlighted for review.");
  };

  const openNote = async () => {
    setFlowStep("note");
    await postWorkspaceAction({ action: "save_note", encounterId: currentEncounterId, patient: selectedPatient, note, clinicianName });
  };

  const updateNoteField = (field: keyof ClinicalNote, value: string) => {
    setNote((current) => ({ ...current, [field]: value }));
  };

  const resolveUncertainty = (index: number) => {
    setNote((current) => ({ ...current, uncertainties: current.uncertainties.filter((_, itemIndex) => itemIndex !== index) }));
    setToast("Review item marked as clarified.");
  };

  const approveNote = async () => {
    if (!reviewed) return;
    const now = new Date().toISOString();
    const newEncounter: Encounter = {
      id: currentEncounterId,
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      patientInitials: selectedPatient.initials,
      consultationType: "General consultation",
      status: "approved",
      scheduledAt: now,
      displayTime: "Just now",
      duration: `${Math.max(1, Math.ceil(elapsed / 60))} min`,
      clinicianName,
    };
    setEncounters((current) => [newEncounter, ...current.filter((item) => item.id !== currentEncounterId)]);
    await postWorkspaceAction({ action: "approve_note", encounterId: currentEncounterId, patient: selectedPatient, note, clinicianName, durationSeconds: elapsed });
    setFlowStep("approved");
    setToast("Clinical note approved and locked to this version.");
  };

  const pageTitle = {
    dashboard: "Clinical overview",
    patients: "Patient directory",
    consultations: "Consultations",
    audit: "Audit trail",
    safety: "Safety centre",
    encounter: selectedPatient.name,
  }[view];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={classNames("fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform lg:translate-x-0", mobileNav ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between px-2">
          <LogoMark />
          <Button variant="ghost" size="icon-sm" className="text-slate-300 hover:bg-sidebar-accent hover:text-white lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X /></Button>
        </div>
        <div className="mt-8 flex-1 space-y-1.5">
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] text-slate-500">WORKSPACE</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button key={item.id} onClick={() => { setView(item.id); setMobileNav(false); }} className={classNames("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition", active ? "bg-sidebar-accent text-white shadow-inner" : "text-slate-400 hover:bg-white/5 hover:text-white")}>
                <Icon className={classNames("size-[18px]", active && "text-[#91a7ff]")} />
                {item.label}
                {item.id === "consultations" && <span className="ml-auto rounded-full bg-[#34415c] px-2 py-0.5 text-[10px] text-slate-300">{encounters.length}</span>}
              </button>
            );
          })}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#8fa6ff]"><ShieldCheck className="size-4" /> Clinical safety</div>
          <p className="mt-2 text-[11px] leading-5 text-slate-400">Every note stays a draft until you review and approve it.</p>
        </div>
        <div className="mt-4 flex items-center gap-3 border-t border-white/10 px-1 pt-4">
          <Avatar initials="DR" tone="violet" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{clinicianName}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">General Practice</p>
          </div>
          <div className="flex items-center gap-1"><button onClick={() => { setView("safety"); setMobileNav(false); }} className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white" aria-label="Open safety settings"><Settings className="size-4" /></button><button onClick={onSignOut} className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white" aria-label="Sign out"><LogOut className="size-4" /></button></div>
        </div>
      </aside>

      {mobileNav && <button className="fixed inset-0 z-40 bg-black/45 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation backdrop" />}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b bg-background/92 px-4 backdrop-blur-xl sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu /></Button>
            {view === "encounter" && <Button variant="ghost" size="icon-sm" onClick={() => setView("dashboard")} aria-label="Back to overview"><ArrowLeft /></Button>}
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-[-0.025em] sm:text-lg">{pageTitle}</h1>
              <p className="hidden text-[11px] text-muted-foreground sm:block">{todayLabel} · Brisbane clinic</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={classNames("hidden rounded-full px-3 text-[10px] font-semibold sm:inline-flex", view === "encounter" && flowStep === "record" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200")}>{view === "encounter" && flowStep === "record" ? <Bot className="mr-1 size-3" /> : <Sparkles className="mr-1 size-3" />}{view === "encounter" && flowStep === "record" ? "Live agent workspace" : "Secure demo"}</Badge>
            <Button variant="ghost" size="icon" onClick={() => setDark((value) => !value)} aria-label={dark ? "Use light theme" : "Use dark theme"}>{dark ? <Sun /> : <Moon />}</Button>
            <div className="relative">
              <Button variant="ghost" size="icon" className="relative" onClick={() => setNotificationsOpen((value) => !value)} aria-label="Notifications"><Bell />{notificationCount > 0 && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-destructive" />}</Button>
              {notificationsOpen && <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border bg-card shadow-2xl"><div className="flex items-center justify-between border-b px-4 py-3"><p className="text-sm font-bold">Notifications</p><button onClick={() => setNotificationCount(0)} className="text-[10px] font-bold text-primary hover:underline">Mark all read</button></div><div className="divide-y"><div className="p-4"><p className="text-xs font-bold">2 notes await review</p><p className="mt-1 text-[11px] text-muted-foreground">Check the consultation list before the end of clinic.</p></div><div className="p-4"><p className="text-xs font-bold">Audio retention complete</p><p className="mt-1 text-[11px] text-muted-foreground">Temporary demo recordings were removed after processing.</p></div></div><button onClick={() => { setNotificationsOpen(false); setView("consultations"); }} className="w-full border-t px-4 py-3 text-left text-xs font-bold text-primary hover:bg-muted">Open consultations</button></div>}
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-72px)]">
          {view === "dashboard" && <Dashboard encounters={encounters} onStart={() => beginConsultation()} onOpenPatients={() => setView("patients")} onOpenConsultations={() => setView("consultations")} />}
          {view === "patients" && <PatientsPage patients={patients} search={search} setSearch={setSearch} onStart={beginConsultation} />}
          {view === "consultations" && <ConsultationsPage encounters={encounters} onStart={beginConsultation} onReview={(encounter) => { setSelectedPatientId(encounter.patientId); setFlowStep(encounter.status === "approved" ? "approved" : "note"); setView("encounter"); }} />}
          {view === "audit" && <AuditPage />}
          {view === "safety" && <SafetyPage />}
          {view === "encounter" && (
            <EncounterFlow
              step={flowStep}
              patient={selectedPatient}
              consentAccepted={consentAccepted}
              setConsentAccepted={setConsentAccepted}
              consentMethod={consentMethod}
              setConsentMethod={setConsentMethod}
              onConsentContinue={continueAfterConsent}
              onDeclineConsent={declineConsent}
              onWithdrawConsent={withdrawConsent}
              captureMode={captureMode}
              setCaptureMode={setCaptureMode}
              recordingState={recordingState}
              elapsed={elapsed}
              micMessage={micMessage}
              liveSegments={liveSegments}
              interimText={interimText}
              liveSpeaker={liveSpeaker}
              setLiveSpeaker={setLiveSpeaker}
              speechSupported={speechSupported}
              processingProvider={processingProvider}
              agentFocus={agentFocus}
              setAgentFocus={setAgentFocus}
              audioUrl={audioUrl}
              audioName={audioBlob && "name" in audioBlob ? String(audioBlob.name) : null}
              onUploadAudio={uploadAudioConversation}
              onStartRecording={startRecording}
              onPauseRecording={pauseRecording}
              onStopRecording={stopRecording}
              onProcess={() => processConsultation(false)}
              onUseSample={() => processConsultation(true)}
              transcript={transcript}
              onOpenNote={openNote}
              note={note}
              activeNoteSection={activeNoteSection}
              setActiveNoteSection={setActiveNoteSection}
              updateNoteField={updateNoteField}
              resolveUncertainty={resolveUncertainty}
              reviewed={reviewed}
              setReviewed={setReviewed}
              approveNote={approveNote}
              clinicianName={clinicianName}
              onClose={() => setView("dashboard")}
            />
          )}
        </main>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-5 right-5 z-[80] flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-200 bg-card px-4 py-3 text-sm shadow-2xl dark:border-emerald-800">
          <span className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Check className="size-4" /></span>
          <span className="font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}

function Dashboard({ encounters, onStart, onOpenPatients, onOpenConsultations }: { encounters: Encounter[]; onStart: () => void; onOpenPatients: () => void; onOpenConsultations: () => void }) {
  return (
    <div className="px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
      <section className="relative overflow-hidden rounded-[26px] border border-[#dce4f6] bg-gradient-to-br from-white via-white to-[#edf3ff] p-6 shadow-[0_16px_50px_rgba(42,67,132,.07)] dark:border-[#2d3e62] dark:from-[#18233a] dark:via-[#162138] dark:to-[#1c315c] sm:p-8">
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-[#c9d7ff]/45 blur-3xl dark:bg-[#385eb8]/20" />
        <div className="relative flex flex-col items-start justify-between gap-7 xl:flex-row xl:items-center">
          <div className="max-w-2xl">
            <Badge variant="outline" className="rounded-full border-[#cbd8ff] bg-white/75 px-3 py-1 text-[10px] font-bold tracking-[0.08em] text-[#3159d8] dark:border-[#4b6297] dark:bg-[#1b2a48] dark:text-[#9db1ff]">TODAY’S CLINIC</Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.045em] sm:text-[38px]">Focus on the patient.<br className="hidden sm:block" /> We’ll shape the note.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Capture a consultation with consent, review the source-linked draft, and approve only when it reflects your clinical record.</p>
          </div>
          <Button size="lg" onClick={onStart} className="h-12 rounded-xl bg-[#3159d8] px-6 shadow-[0_12px_25px_rgba(49,89,216,.25)] hover:bg-[#284dc1] dark:text-white"><Mic className="size-5" /> Start consultation</Button>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Consultations today" value="6" note="3 completed · 3 upcoming" icon={Activity} tone="blue" />
        <MetricCard label="Time returned" value="1h 24m" note="14 minutes saved per note" icon={Clock3} tone="teal" />
        <MetricCard label="Awaiting review" value="2" note="Both have low-risk flags" icon={FileClock} tone="amber" />
        <MetricCard label="Approval rate" value="98%" note="Last 30 clinician reviews" icon={ClipboardCheck} tone="violet" />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border bg-card shadow-[0_8px_30px_rgba(32,49,82,.04)]">
          <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
            <div><h3 className="text-sm font-bold">Today’s consultations</h3><p className="mt-1 text-xs text-muted-foreground">Your live clinic list</p></div>
            <Button variant="ghost" size="sm" onClick={onOpenConsultations} className="text-xs text-primary">View all <ChevronRight /></Button>
          </div>
          <div className="divide-y">
            {encounters.slice(0, 3).map((encounter, index) => (
              <button key={encounter.id} onClick={onOpenConsultations} className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-muted/55 sm:px-6">
                <div className="w-14 text-xs font-semibold text-muted-foreground">{encounter.displayTime}</div>
                <Avatar initials={encounter.patientInitials} tone={index === 1 ? "teal" : index === 2 ? "violet" : "blue"} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{encounter.patientName}</p><p className="mt-1 truncate text-xs text-muted-foreground">{encounter.consultationType} · {encounter.duration}</p></div>
                <StatusBadge status={encounter.status} />
                <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-[0_8px_30px_rgba(32,49,82,.04)] sm:p-6">
          <div className="flex items-center justify-between"><div><h3 className="text-sm font-bold">Documentation health</h3><p className="mt-1 text-xs text-muted-foreground">Current week</p></div><div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><ShieldCheck className="size-4" /></div></div>
          <div className="mt-6 flex items-end gap-2">
            {[58, 74, 67, 86, 72, 94, 82].map((height, index) => <div key={index} className="flex flex-1 flex-col items-center gap-2"><div className="relative h-28 w-full overflow-hidden rounded-md bg-muted"><div className="absolute inset-x-0 bottom-0 rounded-md bg-gradient-to-t from-[#3159d8] to-[#7392f4]" style={{ height: `${height}%` }} /></div><span className="text-[9px] font-semibold text-muted-foreground">{["M", "T", "W", "T", "F", "S", "S"][index]}</span></div>)}
          </div>
          <div className="mt-5 rounded-xl bg-muted/70 p-3.5"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Notes approved same day</span><span className="font-bold">94%</span></div><Progress value={94} className="mt-2 h-1.5" /></div>
          <Button variant="outline" className="mt-4 w-full rounded-xl" onClick={onOpenPatients}><Users /> Open patient directory</Button>
        </section>
      </div>

      <p className="mt-5 text-center text-[10px] text-muted-foreground"><LockKeyhole className="mr-1 inline size-3" /> Fictional demonstration data only. This prototype is not certified for real clinical use.</p>
    </div>
  );
}

function PatientsPage({ patients, search, setSearch, onStart }: { patients: Patient[]; search: string; setSearch: (value: string) => void; onStart: (patientId: string) => void }) {
  const filtered = patients.filter((patient) => `${patient.name} ${patient.mrn}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">Find a fictional patient and start a consent-first consultation.</p></div><Button onClick={() => onStart(patients[0].id)} className="rounded-xl"><Plus /> New consultation</Button></div>
      <div className="mt-6 rounded-2xl border bg-card shadow-[0_8px_30px_rgba(32,49,82,.04)]">
        <div className="border-b p-4 sm:p-5"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or MRN" className="h-10 rounded-xl pl-10" /></div></div>
        <div className="divide-y">
          {filtered.map((patient, index) => (
            <div key={patient.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:px-6">
              <Avatar initials={patient.initials} tone={index === 1 ? "teal" : index === 2 ? "violet" : "blue"} size="lg" />
              <div className="min-w-0 flex-1"><h3 className="font-bold">{patient.name}</h3><p className="mt-1 text-xs text-muted-foreground">{patient.age} years · {patient.sex} · MRN {patient.mrn}</p></div>
              <div className="grid grid-cols-2 gap-6 text-xs sm:w-80"><div><p className="font-semibold text-muted-foreground">Allergies</p><p className="mt-1 truncate">{patient.allergies.join(", ")}</p></div><div><p className="font-semibold text-muted-foreground">Current medication</p><p className="mt-1 truncate">{patient.medications[0]}</p></div></div>
              <Button variant="outline" className="rounded-xl" onClick={() => onStart(patient.id)}><Mic /> Start visit</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConsultationsPage({ encounters, onStart, onReview }: { encounters: Encounter[]; onStart: (patientId?: string) => void; onReview: (encounter: Encounter) => void }) {
  return (
    <div className="px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
      <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Review draft notes, approvals and scheduled sessions.</p><Button onClick={onStart} className="rounded-xl"><Mic /> Start consultation</Button></div>
      <div className="mt-6 grid gap-4">
        {encounters.map((encounter, index) => (
          <article key={encounter.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-[0_8px_30px_rgba(32,49,82,.04)] sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-center gap-4 sm:w-64"><Avatar initials={encounter.patientInitials} tone={index % 3 === 1 ? "teal" : index % 3 === 2 ? "violet" : "blue"} size="lg" /><div><h3 className="font-bold">{encounter.patientName}</h3><p className="mt-1 text-xs text-muted-foreground">{encounter.displayTime} · {encounter.duration}</p></div></div>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{encounter.consultationType}</p><p className="mt-1 text-xs text-muted-foreground">{encounter.clinicianName}</p></div>
            <StatusBadge status={encounter.status} />
            <Button variant={encounter.status === "scheduled" ? "default" : "outline"} className="rounded-xl" onClick={() => encounter.status === "scheduled" ? onStart(encounter.patientId) : onReview(encounter)}>{encounter.status === "scheduled" ? <><Mic /> Begin</> : <><FileText /> {encounter.status === "approved" ? "View note" : "Review"}</>}</Button>
          </article>
        ))}
      </div>
    </div>
  );
}

function AuditPage() {
  return (
    <div className="px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
      <div className="rounded-2xl border bg-card shadow-[0_8px_30px_rgba(32,49,82,.04)]">
        <div className="flex items-center justify-between border-b p-5 sm:px-6"><div><h2 className="font-bold">Immutable activity history</h2><p className="mt-1 text-xs text-muted-foreground">Consent, generation, editing, approval, export and deletion events.</p></div><Badge variant="outline" className="rounded-full"><LockKeyhole className="mr-1 size-3" /> Read only</Badge></div>
        <div className="divide-y">
          {demoAuditEvents.map((event) => {
            const tone = { blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" }[event.tone];
            return <div key={event.id} className="flex items-start gap-4 p-5 sm:px-6"><div className={classNames("mt-0.5 flex size-9 items-center justify-center rounded-xl", tone)}>{event.action.includes("approved") ? <CheckCircle2 className="size-4" /> : event.action.includes("deleted") ? <Trash2 className="size-4" /> : event.action.includes("Consent") ? <ShieldCheck className="size-4" /> : <FileText className="size-4" />}</div><div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-1 sm:flex-row"><p className="text-sm font-bold">{event.action}</p><p className="text-[11px] text-muted-foreground">{event.createdAt}</p></div><p className="mt-1 text-xs text-muted-foreground">{event.detail}</p><p className="mt-2 text-[10px] font-semibold text-muted-foreground">Actor: {event.actor}</p></div></div>;
          })}
        </div>
      </div>
    </div>
  );
}

function SafetyPage() {
  const checklist = ["Privacy impact assessment", "Clinical-safety review", "Data-residency approval", "Vendor processing agreement", "Retention schedule", "Regulatory classification"];
  const [completedControls, setCompletedControls] = useState<string[]>([]);
  const controls = [
    { title: "Consent gate", text: "The microphone cannot activate until patient consent is recorded.", icon: ShieldCheck, status: "Active" },
    { title: "Human approval", text: "Every generated note remains a draft until a clinician signs it.", icon: ClipboardCheck, status: "Required" },
    { title: "Source grounding", text: "Key statements link to transcript timestamps and uncertain wording is flagged.", icon: FileCheck2, status: "Active" },
    { title: "Temporary audio", text: "Recordings are marked for deletion immediately after processing in this demo.", icon: Trash2, status: "0 hours" },
  ];
  return (
    <div className="px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
      <section className="rounded-[26px] border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 dark:border-blue-800 dark:from-blue-950/65 dark:to-card sm:p-8"><Badge variant="outline" className="rounded-full border-blue-200 bg-white/70 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200"><ShieldCheck className="mr-1 size-3" /> Safety by design</Badge><h2 className="mt-4 text-2xl font-bold tracking-tight">The agent drafts. The clinician decides.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Clinote is intentionally restricted to documentation support. It does not diagnose, prescribe, place orders or finalise records autonomously.</p></section>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {controls.map((control) => <article key={control.title} className="rounded-2xl border bg-card p-5"><div className="flex items-start gap-4"><div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><control.icon className="size-5" /></div><div className="flex-1"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{control.title}</h3><Badge variant="outline" className="rounded-full text-[10px] text-emerald-700 dark:text-emerald-300">{control.status}</Badge></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{control.text}</p></div></div></article>)}
      </div>
      <div className="mt-6 rounded-2xl border bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">Deployment review checklist</h3><Badge variant="outline" className="rounded-full text-[10px]">{completedControls.length}/{checklist.length} complete</Badge></div><div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-3">{checklist.map((item) => { const checked = completedControls.includes(item); return <label key={item} className={classNames("flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-left transition", checked ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100" : "border-transparent bg-muted/70 hover:border-input")}><Checkbox checked={checked} onCheckedChange={(value) => setCompletedControls((current) => value === true ? [...new Set([...current, item])] : current.filter((entry) => entry !== item))} aria-label={item} />{item}</label>; })}</div><p className="mt-4 text-[11px] text-muted-foreground">This prototype does not claim compliance or certification. Complete organisational, legal and clinical review before using real patient information.</p></div>
    </div>
  );
}

type EncounterFlowProps = {
  step: FlowStep;
  patient: Patient;
  consentAccepted: boolean;
  setConsentAccepted: (value: boolean) => void;
  consentMethod: string;
  setConsentMethod: (value: string) => void;
  onConsentContinue: () => void;
  onDeclineConsent: () => void;
  onWithdrawConsent: () => void;
  captureMode: CaptureMode;
  setCaptureMode: (mode: CaptureMode) => void;
  recordingState: RecordingState;
  elapsed: number;
  micMessage: string | null;
  liveSegments: TranscriptSegment[];
  interimText: string;
  liveSpeaker: LiveSpeaker;
  setLiveSpeaker: (speaker: LiveSpeaker) => void;
  speechSupported: boolean;
  processingProvider: string;
  agentFocus: string;
  setAgentFocus: (focus: string) => void;
  audioUrl: string | null;
  audioName: string | null;
  onUploadAudio: (file: File) => void;
  onStartRecording: () => void;
  onPauseRecording: () => void;
  onStopRecording: () => void;
  onProcess: () => void;
  onUseSample: () => void;
  transcript: TranscriptSegment[];
  onOpenNote: () => void;
  note: ClinicalNote;
  activeNoteSection: keyof Pick<ClinicalNote, "subjective" | "objective" | "assessment" | "plan">;
  setActiveNoteSection: (section: keyof Pick<ClinicalNote, "subjective" | "objective" | "assessment" | "plan">) => void;
  updateNoteField: (field: keyof ClinicalNote, value: string) => void;
  resolveUncertainty: (index: number) => void;
  reviewed: boolean;
  setReviewed: (value: boolean) => void;
  approveNote: () => void;
  clinicianName: string;
  onClose: () => void;
};

function EncounterFlow(props: EncounterFlowProps) {
  const { step, patient } = props;
  const steps: Array<{ id: FlowStep; label: string }> = [{ id: "consent", label: "Consent" }, { id: "record", label: "Capture" }, { id: "transcript", label: "Transcript" }, { id: "note", label: "Review note" }, { id: "approved", label: "Complete" }];
  const stepIndex = steps.findIndex((item) => item.id === step);
  return (
    <div className="px-4 py-5 sm:px-7 lg:px-9 lg:py-7">
      <div className="mb-5 flex flex-col gap-4 rounded-2xl border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3"><Avatar initials={patient.initials} size="lg" /><div><h2 className="font-bold">{patient.name}</h2><p className="mt-1 text-xs text-muted-foreground">{patient.age} years · MRN {patient.mrn} · {patient.allergies[0]}</p></div></div>
        <div className="flex max-w-2xl flex-1 items-center justify-end overflow-x-auto">
          {steps.map((item, index) => <div key={item.id} className="flex items-center"><div className={classNames("flex items-center gap-2 whitespace-nowrap text-[10px] font-semibold sm:text-xs", index <= stepIndex ? "text-primary" : "text-muted-foreground")}><span className={classNames("flex size-6 items-center justify-center rounded-full border text-[10px]", index < stepIndex ? "border-primary bg-primary text-primary-foreground" : index === stepIndex ? "border-primary bg-secondary" : "bg-muted")}>{index < stepIndex ? <Check className="size-3" /> : index + 1}</span><span className="hidden sm:inline">{item.label}</span></div>{index < steps.length - 1 && <div className={classNames("mx-2 h-px w-5 sm:w-8", index < stepIndex ? "bg-primary" : "bg-border")} />}</div>)}
        </div>
      </div>
      {step === "consent" && <ConsentStep {...props} />}
      {step === "record" && <RecordingStep {...props} />}
      {step === "transcript" && <TranscriptStep {...props} />}
      {step === "note" && <NoteStep {...props} />}
      {step === "approved" && <ApprovedStep {...props} />}
    </div>
  );
}

function ConsentStep({ patient, consentAccepted, setConsentAccepted, consentMethod, setConsentMethod, onConsentContinue, onDeclineConsent }: EncounterFlowProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="overflow-hidden rounded-[24px] border bg-card shadow-[0_18px_55px_rgba(32,49,82,.07)]">
        <div className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 p-6 dark:from-blue-950/50 dark:to-indigo-950/40 sm:p-8"><div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><ShieldCheck className="size-6" /></div><h2 className="mt-4 text-2xl font-bold tracking-tight">Confirm patient consent</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Before the microphone can activate, explain how the consultation will be processed and record {patient.name}’s choice.</p></div>
        <div className="space-y-6 p-6 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-3">{[{ icon: Mic, title: "What is captured", text: "Consultation audio and a speaker-separated transcript." }, { icon: WandSparkles, title: "Why it is used", text: "To prepare a draft clinical note for clinician review." }, { icon: Trash2, title: "How long it is kept", text: "Audio is deleted after processing in this demonstration." }].map((item) => <div key={item.title} className="rounded-2xl border bg-muted/45 p-4"><item.icon className="size-5 text-primary" /><p className="mt-3 text-xs font-bold">{item.title}</p><p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{item.text}</p></div>)}</div>
          <div>
            <label htmlFor="consent-method" className="text-xs font-bold">Consent method</label>
            <select id="consent-method" value={consentMethod} onChange={(event) => setConsentMethod(event.target.value)} className="mt-2 h-10 w-full rounded-xl border bg-background px-3 text-sm sm:max-w-xs"><option>Verbal</option><option>Written</option><option>Guardian</option></select>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800 dark:bg-blue-950/35">
            <Checkbox checked={consentAccepted} onCheckedChange={(value) => setConsentAccepted(value === true)} className="mt-0.5" />
            <span><span className="block text-sm font-bold">Patient has given informed consent</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">I explained the AI documentation process, temporary audio handling, clinician review and the option to stop at any time.</span></span>
          </label>
          <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row"><Button variant="outline" className="rounded-xl" onClick={onDeclineConsent}>Patient declined</Button><Button onClick={onConsentContinue} disabled={!consentAccepted} className="rounded-xl px-6">Continue to recording <ChevronRight /></Button></div>
        </div>
      </div>
      <p className="mt-4 text-center text-[10px] text-muted-foreground"><LockKeyhole className="mr-1 inline size-3" /> No recording begins until consent is captured.</p>
    </div>
  );
}

function RecordingStep({ recordingState, elapsed, micMessage, onStartRecording, onPauseRecording, onStopRecording, onProcess, onUseSample, onWithdrawConsent, captureMode, setCaptureMode, liveSegments, interimText, liveSpeaker, setLiveSpeaker, speechSupported, processingProvider, audioUrl, audioName, onUploadAudio, agentFocus, setAgentFocus }: EncounterFlowProps) {
  const active = recordingState === "recording" || recordingState === "paused";
  const wordCount = liveSegments.reduce((total, segment) => total + segment.text.split(/\s+/).filter(Boolean).length, 0);
  const transcriptText = liveSegments.map((segment) => segment.text).join(" ").toLowerCase();
  const [agentEvents, setAgentEvents] = useState<Array<{ id: string; label: string; time: string }>>([]);
  const [agentInstruction, setAgentInstruction] = useState("");
  const [isDraggingAudio, setIsDraggingAudio] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const detectedSignals = [
    { label: "Symptoms or concerns", active: /(pain|dizz|cough|fever|headache|nause|vision|breath|concern|symptom)/i.test(transcriptText) },
    { label: "Medication context", active: /(medication|medicine|tablet|dose|taking|prescription)/i.test(transcriptText) },
    { label: "Allergy context", active: /(allerg|reaction|intoleran)/i.test(transcriptText) },
    { label: "Timing or duration", active: /(today|yesterday|day|week|month|since|ago|started)/i.test(transcriptText) },
  ];
  const addAgentEvent = (label: string) => setAgentEvents((current) => [{ id: crypto.randomUUID(), label, time: formatDuration(elapsed) }, ...current].slice(0, 6));
  const submitInstruction = () => {
    const instruction = agentInstruction.trim();
    if (!instruction) return;
    setAgentFocus(instruction);
    addAgentEvent(`Focus updated: ${instruction}`);
    setAgentInstruction("");
  };

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [liveSegments.length, interimText]);

  return (
    <div className="space-y-5">
      {recordingState === "idle" && <div className="grid gap-3 md:grid-cols-3">
        <button onClick={() => setCaptureMode("live")} className={classNames("rounded-2xl border p-4 text-left transition", captureMode === "live" ? "border-primary bg-secondary shadow-sm" : "bg-card hover:bg-muted/50")}><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-bold"><Mic className="size-4 text-primary" /> Live microphone</span><span className={classNames("size-3 rounded-full border", captureMode === "live" && "border-primary bg-primary ring-4 ring-primary/10")} /></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Record real audio and display speech as it is recognised. Use fictional information in this prototype.</p></button>
        <button onClick={() => setCaptureMode("upload")} className={classNames("rounded-2xl border p-4 text-left transition", captureMode === "upload" ? "border-primary bg-secondary shadow-sm" : "bg-card hover:bg-muted/50")}><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-bold"><UploadCloud className="size-4 text-primary" /> Upload conversation</span><span className={classNames("size-3 rounded-full border", captureMode === "upload" && "border-primary bg-primary ring-4 ring-primary/10")} /></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Upload a recorded WEBM, WAV, MP3, M4A, MP4 or OGG conversation up to 24 MB.</p></button>
        <button onClick={() => setCaptureMode("demo")} className={classNames("rounded-2xl border p-4 text-left transition", captureMode === "demo" ? "border-primary bg-secondary shadow-sm" : "bg-card hover:bg-muted/50")}><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-primary" /> Guided dummy demo</span><span className={classNames("size-3 rounded-full border", captureMode === "demo" && "border-primary bg-primary ring-4 ring-primary/10")} /></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Run the complete workflow instantly with a fictional patient conversation and note.</p></button>
      </div>}

      <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-4 dark:border-indigo-800 dark:from-indigo-950/60 dark:via-card dark:to-emerald-950/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><div className="relative flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg"><Bot className="size-5" />{active && <span className="absolute -right-1 -top-1 size-3 animate-pulse rounded-full border-2 border-card bg-emerald-500" />}</div><div><p className="text-sm font-bold">Clinote live agent</p><p className="mt-0.5 text-[11px] text-muted-foreground">{recordingState === "recording" ? `Listening to ${liveSpeaker} · organising the record as you speak` : recordingState === "paused" ? "Capture paused · working context preserved" : recordingState === "processing" ? "Converting the session into a grounded draft" : recordingState === "complete" ? "Capture complete · ready to build the clinical draft" : "Ready after patient consent"}</p></div></div>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full bg-card text-[10px]"><CircleDot className={classNames("mr-1 size-3", active && "text-emerald-600")} /> {active ? "Agent active" : "Agent standby"}</Badge><Badge variant="outline" className="rounded-full bg-card text-[10px]"><Zap className="mr-1 size-3 text-amber-500" /> Focus: {agentFocus}</Badge></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.82fr_1.18fr] 2xl:grid-cols-[.78fr_1.12fr_.7fr]">
        <section className="relative overflow-hidden rounded-[24px] border bg-card p-6 shadow-[0_18px_55px_rgba(32,49,82,.07)] sm:p-8">
          <div className="absolute inset-0 clinical-grid opacity-45" />
          <div className="relative flex min-h-[470px] flex-col items-center justify-center text-center">
            <Badge variant="outline" className={classNames("rounded-full px-3 py-1 text-[10px] font-bold", recordingState === "recording" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200" : "bg-card")}><span className={classNames("mr-2 size-2 rounded-full", recordingState === "recording" ? "animate-pulse bg-red-500" : recordingState === "paused" ? "bg-amber-500" : "bg-slate-400")} />{recordingState === "recording" ? "LIVE CAPTURE" : recordingState === "paused" ? "PAUSED" : recordingState === "complete" ? "CAPTURE COMPLETE" : recordingState === "processing" ? "PROCESSING" : captureMode === "demo" ? "DEMO READY" : captureMode === "upload" ? "UPLOAD READY" : "MICROPHONE READY"}</Badge>
            <div className={classNames("mt-7 flex size-24 items-center justify-center rounded-full border-[7px] shadow-xl transition", recordingState === "recording" ? "border-red-100 bg-red-500 text-white dark:border-red-950" : "border-blue-100 bg-primary text-primary-foreground dark:border-blue-950")}>{captureMode === "upload" ? <FileAudio className="size-9" /> : <Mic className="size-9" />}</div>
            <div className="mt-6 font-mono text-4xl font-semibold tracking-[-0.05em]">{formatDuration(elapsed)}</div>
            <p className="mt-2 text-xs text-muted-foreground">{captureMode === "demo" ? "Fictional data · no microphone required" : captureMode === "upload" ? "Existing recording · secure temporary processing" : speechSupported ? "Audio + live browser transcription" : "Audio recording with post-processing"}</p>
            {recordingState === "recording" && <div className="recording-wave mt-6 flex h-10 items-center gap-1.5" aria-hidden="true">{[18, 31, 42, 28, 37].map((height, index) => <span key={index} className="w-1.5 rounded-full bg-primary" style={{ height }} />)}</div>}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {recordingState === "idle" && captureMode === "live" && <Button size="lg" onClick={onStartRecording} className="h-12 rounded-xl px-7"><Mic /> Start live capture</Button>}
              {recordingState === "idle" && captureMode === "upload" && <Button size="lg" onClick={() => uploadInputRef.current?.click()} className="h-12 rounded-xl px-7"><UploadCloud /> Choose audio file</Button>}
              {recordingState === "idle" && captureMode === "demo" && <Button size="lg" onClick={onUseSample} className="h-12 rounded-xl px-7"><Sparkles /> Run guided demo</Button>}
              {active && <><Button variant="outline" size="lg" onClick={onPauseRecording} className="h-12 rounded-xl">{recordingState === "paused" ? <Play /> : <Pause />}{recordingState === "paused" ? "Resume" : "Pause"}</Button><Button size="lg" onClick={onStopRecording} className="h-12 rounded-xl bg-red-600 text-white hover:bg-red-700"><Square className="fill-current" /> End consultation</Button></>}
              {recordingState === "complete" && <Button size="lg" onClick={onProcess} className="h-12 rounded-xl px-7"><WandSparkles /> Build clinical draft</Button>}
            </div>
            <input ref={uploadInputRef} type="file" accept="audio/webm,audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/ogg,.m4a,.mp3" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadAudio(file); event.currentTarget.value = ""; }} />
            {recordingState === "idle" && captureMode === "upload" && <div onDragEnter={(event) => { event.preventDefault(); setIsDraggingAudio(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDraggingAudio(false)} onDrop={(event) => { event.preventDefault(); setIsDraggingAudio(false); const file = event.dataTransfer.files?.[0]; if (file) onUploadAudio(file); }} className={classNames("mt-5 w-full max-w-md rounded-2xl border-2 border-dashed p-4 text-center transition", isDraggingAudio ? "border-primary bg-secondary" : "border-input bg-card/70")}><p className="text-[11px] font-bold">Drop an audio conversation here</p><p className="mt-1 text-[10px] text-muted-foreground">Maximum 24 MB · audio is removed after transcription</p></div>}
            {audioUrl && recordingState === "complete" && <div className="mt-5 w-full max-w-sm rounded-2xl border bg-card/85 p-3 text-left"><div className="mb-2 flex items-center gap-2"><FileAudio className="size-4 text-primary" /><span className="min-w-0 flex-1 truncate text-[11px] font-bold">{audioName ?? "Recorded consultation"}</span><Badge variant="outline" className="rounded-full text-[9px]">Ready</Badge></div><audio controls src={audioUrl} className="w-full" aria-label="Recorded consultation audio" /></div>}
            {micMessage && <div className="mt-5 max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs leading-5 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"><AlertTriangle className="mr-2 inline size-4" />{micMessage}</div>}
            {recordingState === "processing" && <div className="mt-6 w-full max-w-sm"><div className="flex items-center justify-between text-xs"><span className="font-semibold">Preparing transcript and note</span><span className="text-muted-foreground">{processingProvider}</span></div><Progress value={72} className="mt-2" /></div>}
            <button onClick={onWithdrawConsent} className="mt-5 text-[11px] font-semibold text-destructive underline-offset-4 hover:underline">Withdraw consent and discard capture</button>
          </div>
        </section>

        <section className="flex min-h-[530px] flex-col overflow-hidden rounded-[24px] border bg-card shadow-[0_18px_55px_rgba(32,49,82,.05)]">
          <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><AudioLines className="size-4 text-primary" /><h3 className="text-sm font-bold">Live transcript</h3>{active && <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-[9px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Updating now</Badge>}</div><p className="mt-1 text-[10px] text-muted-foreground">Choose the current speaker before they talk.</p></div><div className="flex rounded-xl bg-muted p-1"><button onClick={() => setLiveSpeaker("Clinician")} disabled={!active} className={classNames("rounded-lg px-3 py-1.5 text-[10px] font-bold transition", liveSpeaker === "Clinician" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>Clinician</button><button onClick={() => setLiveSpeaker("Patient")} disabled={!active} className={classNames("rounded-lg px-3 py-1.5 text-[10px] font-bold transition", liveSpeaker === "Patient" ? "bg-card text-emerald-700 shadow-sm dark:text-emerald-300" : "text-muted-foreground")}>Patient</button></div></div>
          <div className="grid grid-cols-3 gap-px border-b bg-border text-center"><div className="bg-card p-3"><p className="text-lg font-bold">{liveSegments.length}</p><p className="text-[9px] text-muted-foreground">Segments</p></div><div className="bg-card p-3"><p className="text-lg font-bold">{wordCount}</p><p className="text-[9px] text-muted-foreground">Words</p></div><div className="bg-card p-3"><p className="text-lg font-bold">{formatDuration(elapsed)}</p><p className="text-[9px] text-muted-foreground">Elapsed</p></div></div>
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {captureMode === "demo" && recordingState === "idle" && <div className="flex h-full flex-col items-center justify-center text-center"><Sparkles className="size-8 text-primary" /><p className="mt-3 text-sm font-bold">Fictional consultation ready</p><p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">The demo includes symptoms, spoken observations, medication context, safety advice and uncertainty flags.</p></div>}
            {captureMode === "live" && liveSegments.length === 0 && !interimText && <div className="flex h-full flex-col items-center justify-center text-center"><AudioLines className="size-8 text-muted-foreground/60" /><p className="mt-3 text-sm font-bold">Speech will appear here</p><p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">Start live capture, then switch the speaker label between clinician and patient as the conversation changes.</p></div>}
            {captureMode === "upload" && liveSegments.length === 0 && <div className="flex h-full flex-col items-center justify-center text-center"><FileAudio className="size-8 text-primary" /><p className="mt-3 text-sm font-bold">{audioName ? "Uploaded conversation ready" : "Choose an audio conversation"}</p><p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{audioName ? "Review the audio, then build the clinical draft to transcribe and organise the conversation." : "The transcript will appear here after secure temporary processing."}</p></div>}
            {liveSegments.map((segment, index) => <div key={`${segment.time}-${index}`} className="rounded-xl border bg-muted/35 p-3"><div className="flex items-center justify-between"><span className={classNames("text-[10px] font-bold", segment.speaker === "Clinician" ? "text-primary" : "text-emerald-700 dark:text-emerald-300")}>{segment.speaker}</span><span className="font-mono text-[9px] text-muted-foreground">{segment.time}</span></div><p className="mt-1.5 text-xs leading-5">{segment.text}</p></div>)}
            {interimText && <div className="rounded-xl border border-dashed border-primary/40 bg-secondary/50 p-3"><div className="flex items-center gap-2 text-[10px] font-bold text-primary"><span className="size-1.5 animate-pulse rounded-full bg-primary" /> Listening to {liveSpeaker}</div><p className="mt-1.5 text-xs italic text-muted-foreground">{interimText}</p></div>}
            <div ref={transcriptEndRef} />
          </div>
          <div className="border-t bg-muted/30 px-5 py-3 text-[10px] text-muted-foreground"><ShieldCheck className="mr-1 inline size-3 text-emerald-600" /> Consent active · Documentation only · Clinician review required</div>
        </section>

        <aside className="space-y-5 xl:col-span-2 2xl:col-span-1">
          <section className="overflow-hidden rounded-[24px] border bg-card shadow-[0_18px_55px_rgba(32,49,82,.05)]">
            <div className="border-b p-5"><div className="flex items-center justify-between"><div><h3 className="flex items-center gap-2 text-sm font-bold"><Bot className="size-4 text-primary" /> Agent workspace</h3><p className="mt-1 text-[10px] text-muted-foreground">Updates from words already captured—never a diagnosis.</p></div>{active && <span className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300"><span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> LIVE</span>}</div></div>
            <div className="p-5">
              <p className="text-[10px] font-bold tracking-[.08em] text-muted-foreground">CAPTURE COVERAGE</p>
              <div className="mt-3 space-y-2">{detectedSignals.map((signal) => <div key={signal.label} className={classNames("flex items-center justify-between rounded-xl border px-3 py-2.5 text-[11px] transition", signal.active ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100" : "bg-muted/35 text-muted-foreground")}><span className="flex items-center gap-2">{signal.active ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <CircleDot className="size-3.5" />}{signal.label}</span><span className="text-[9px] font-bold">{signal.active ? "Captured" : "Listening"}</span></div>)}</div>
              <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 dark:border-indigo-800 dark:bg-indigo-950/50"><p className="text-[10px] font-bold text-indigo-800 dark:text-indigo-200">CURRENT CONTEXT</p><p className="mt-1.5 text-[11px] leading-5 text-indigo-950 dark:text-indigo-100">{liveSegments.length ? `${liveSegments.length} speaker-labelled segments organised. Latest: “${liveSegments[liveSegments.length - 1].text.slice(0, 92)}${liveSegments[liveSegments.length - 1].text.length > 92 ? "…" : ""}”` : "The agent will organise symptoms, medication context, timing and follow-up details as speech arrives."}</p></div>
            </div>
          </section>

          <section className="rounded-[24px] border bg-card p-5 shadow-[0_18px_55px_rgba(32,49,82,.05)]">
            <h3 className="flex items-center gap-2 text-sm font-bold"><Zap className="size-4 text-amber-500" /> Direct the agent</h3>
            <div className="mt-3 flex flex-wrap gap-2">{["Complete history", "Medication details", "Follow-up actions"].map((focus) => <button key={focus} onClick={() => { setAgentFocus(focus); addAgentEvent(`Focus changed: ${focus}`); }} className={classNames("rounded-full border px-3 py-1.5 text-[10px] font-bold transition", agentFocus === focus ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>{focus}</button>)}</div>
            <div className="mt-3 flex gap-2"><Input value={agentInstruction} onChange={(event) => setAgentInstruction(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitInstruction(); }} placeholder="e.g. Capture work impact" className="h-9 rounded-xl text-xs" /><Button size="icon-sm" onClick={submitInstruction} disabled={!agentInstruction.trim()} aria-label="Send instruction to agent"><Send /></Button></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={() => addAgentEvent("Clinical marker added")} className="rounded-xl text-[10px]"><CircleDot /> Add marker</Button><Button variant="outline" size="sm" onClick={() => addAgentEvent("Follow-up task captured")} className="rounded-xl text-[10px]"><ListTodo /> Add task</Button></div>
            <div className="mt-4 border-t pt-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold tracking-[.08em] text-muted-foreground">AGENT ACTIVITY</p><span className="text-[9px] text-muted-foreground">{agentEvents.length} actions</span></div><div className="mt-3 space-y-2">{agentEvents.length === 0 ? <p className="rounded-xl bg-muted/45 p-3 text-[10px] leading-4 text-muted-foreground">Focus changes, markers and tasks will appear here with timestamps.</p> : agentEvents.map((event) => <div key={event.id} className="flex items-start gap-2 rounded-xl bg-muted/45 p-2.5"><span className="mt-1 size-1.5 rounded-full bg-primary" /><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold">{event.label}</p><p className="mt-0.5 font-mono text-[9px] text-muted-foreground">{event.time}</p></div></div>)}</div></div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function TranscriptStep({ transcript, onOpenNote, processingProvider }: EncounterFlowProps) {
  const [query, setQuery] = useState("");
  const normalisedQuery = query.trim().toLowerCase();
  const filteredTranscript = transcript.filter((segment) => `${segment.speaker} ${segment.time} ${segment.text}`.toLowerCase().includes(normalisedQuery));
  const reviewCount = transcript.filter((segment) => segment.confidence < .97).length;
  return (
    <div className="grid gap-5 xl:grid-cols-[1.45fr_.55fr]">
      <section className="rounded-[24px] border bg-card shadow-[0_18px_55px_rgba(32,49,82,.06)]">
        <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center sm:px-6"><div><div className="flex items-center gap-2"><h2 className="font-bold">Speaker-separated transcript</h2><Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Processed</Badge></div><p className="mt-1 text-xs text-muted-foreground">Select any highlighted phrase before approving the note.</p></div><div className="relative"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search transcript" className="h-9 rounded-xl pl-9 text-xs" /></div></div>
        <div className="max-h-[610px] divide-y overflow-y-auto">
          {filteredTranscript.map((segment, index) => <div key={`${segment.time}-${index}`} className="grid gap-3 p-5 sm:grid-cols-[92px_1fr] sm:px-6"><div><div className={classNames("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold", segment.speaker === "Clinician" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200")}><UserRound className="size-3" />{segment.speaker}</div><p className="mt-2 pl-1 font-mono text-[10px] text-muted-foreground">{segment.time}</p></div><p className={classNames("text-sm leading-7", segment.confidence < .97 && "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100")}>{segment.text}{segment.confidence < .97 && <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300"><AlertTriangle className="size-3" /> Review wording</span>}</p></div>)}
          {filteredTranscript.length === 0 && <div className="p-10 text-center"><Search className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 text-sm font-bold">No matching transcript segments</p><button onClick={() => setQuery("")} className="mt-2 text-xs font-semibold text-primary hover:underline">Clear search</button></div>}
        </div>
        <div className="flex flex-col justify-between gap-3 border-t bg-muted/30 p-4 sm:flex-row sm:items-center sm:px-6"><p className="text-[11px] text-muted-foreground">{transcript.length} segments · {reviewCount} wording {reviewCount === 1 ? "review" : "reviews"} · {processingProvider}</p><Button onClick={onOpenNote} className="rounded-xl">Review generated note <ChevronRight /></Button></div>
      </section>
      <aside className="space-y-5">
        <div className="rounded-2xl border bg-card p-5"><h3 className="flex items-center gap-2 text-sm font-bold"><AudioLines className="size-4 text-primary" /> Transcript quality</h3><div className="mt-5 space-y-4">{[{ label: "Speaker separation", value: 98 }, { label: "Medical terminology", value: 96 }, { label: "Audio clarity", value: 94 }].map((item) => <div key={item.label}><div className="flex justify-between text-[11px]"><span className="text-muted-foreground">{item.label}</span><span className="font-bold">{item.value}%</span></div><Progress value={item.value} className="mt-2 h-1.5" /></div>)}</div><p className="mt-4 text-[10px] leading-4 text-muted-foreground">Quality scores prioritise review; they are not guarantees of clinical accuracy.</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/60"><h3 className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-100"><AlertTriangle className="size-4" /> One review item</h3><p className="mt-2 text-[11px] leading-5 text-amber-800 dark:text-amber-200">The patient was uncertain about one episode of blurry vision. The note preserves that uncertainty.</p></div>
      </aside>
    </div>
  );
}

function NoteStep({ note, activeNoteSection, setActiveNoteSection, updateNoteField, resolveUncertainty, reviewed, setReviewed, approveNote, clinicianName }: EncounterFlowProps) {
  const sections: Array<{ id: typeof activeNoteSection; label: string }> = [{ id: "subjective", label: "Subjective" }, { id: "objective", label: "Objective" }, { id: "assessment", label: "Assessment" }, { id: "plan", label: "Plan" }];
  const hasCritical = note.uncertainties.some((item) => item.severity === "critical");
  const [showVersions, setShowVersions] = useState(false);
  const [includePatientSummary, setIncludePatientSummary] = useState(true);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_.5fr]">
      <section className="rounded-[24px] border bg-card shadow-[0_18px_55px_rgba(32,49,82,.06)]">
        <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center sm:px-6"><div><div className="flex items-center gap-2"><h2 className="font-bold">Draft clinical note</h2><Badge variant="outline" className="rounded-full border-violet-200 bg-violet-50 text-[10px] text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200">AI draft · not final</Badge></div><p className="mt-1 text-xs text-muted-foreground">Edit the draft and resolve uncertainty before signing.</p></div><Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowVersions((value) => !value)} aria-expanded={showVersions}><FileText /> Version 1</Button></div>
        {showVersions && <div className="border-b bg-muted/35 px-5 py-3 text-[11px] sm:px-6"><div className="flex items-center justify-between"><span className="font-bold">Version 1 · Current draft</span><span className="text-muted-foreground">Edits are saved as the current working version</span></div></div>}
        <div className="border-b px-5 pt-4 sm:px-6"><div className="flex gap-5 overflow-x-auto">{sections.map((section) => <button key={section.id} onClick={() => setActiveNoteSection(section.id)} className={classNames("border-b-2 pb-3 text-xs font-semibold whitespace-nowrap", activeNoteSection === section.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{section.label}</button>)}</div></div>
        <div className="p-5 sm:p-6">
          <div className="mb-5 rounded-xl bg-muted/55 p-4"><p className="text-[10px] font-bold tracking-[0.08em] text-muted-foreground">CHIEF COMPLAINT</p><p className="mt-2 text-sm font-semibold">{note.chiefComplaint}</p></div>
          <label htmlFor="note-section" className="text-xs font-bold capitalize">{activeNoteSection}</label>
          <Textarea id="note-section" value={String(note[activeNoteSection])} onChange={(event) => updateNoteField(activeNoteSection, event.target.value)} className="mt-2 min-h-56 resize-y rounded-2xl border-input bg-background p-4 text-sm leading-7" />
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground"><span><Sparkles className="mr-1 inline size-3 text-primary" /> Generated from transcript and authorised record context</span><span>Autosaved locally</span></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-xl border p-4"><p className="text-xs font-bold">Medications mentioned</p>{note.medications.map((item) => <p key={item} className="mt-2 text-[11px] leading-5 text-muted-foreground">• {item}</p>)}</div><div className="rounded-xl border p-4"><p className="text-xs font-bold">Allergies</p>{note.allergies.map((item) => <p key={item} className="mt-2 text-[11px] leading-5 text-muted-foreground">• {item}</p>)}</div></div>
        </div>
      </section>
      <aside className="space-y-5">
        <div className="rounded-2xl border bg-card p-5"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="size-4 text-amber-600" /> Review items</h3><Badge variant="outline" className="rounded-full text-[10px]">{note.uncertainties.length}</Badge></div><div className="mt-4 space-y-3">{note.uncertainties.length === 0 ? <div className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><CheckCircle2 className="mr-1 inline size-4" /> All flagged items clarified</div> : note.uncertainties.map((item, index) => <div key={`${item.source}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/60"><div className="flex items-center justify-between"><Badge variant="outline" className="rounded-full border-amber-300 text-[9px] uppercase text-amber-700 dark:text-amber-300">{item.severity}</Badge><span className="text-[9px] text-amber-700 dark:text-amber-300">{item.source}</span></div><p className="mt-2 text-[11px] leading-5 text-amber-900 dark:text-amber-100">{item.text}</p><button onClick={() => resolveUncertainty(index)} className="mt-2 text-[10px] font-bold text-amber-800 underline-offset-4 hover:underline dark:text-amber-200">Mark clarified</button></div>)}</div></div>
        <div className="rounded-2xl border bg-card p-5"><h3 className="flex items-center gap-2 text-sm font-bold"><ClipboardCheck className="size-4 text-primary" /> Clinician sign-off</h3><label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/45 p-3"><Checkbox checked={reviewed} onCheckedChange={(value) => setReviewed(value === true)} className="mt-0.5" /><span className="text-[11px] leading-5">I have reviewed the transcript, edited this draft and confirm it reflects my clinical documentation.</span></label><Button onClick={approveNote} disabled={!reviewed || hasCritical} className="mt-4 w-full rounded-xl"><FileCheck2 /> Approve and sign</Button><p className="mt-3 text-center text-[10px] text-muted-foreground">Signed as {clinicianName}</p></div>
        <div className="rounded-2xl border bg-card p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold">Patient summary</p><p className="mt-1 text-[10px] text-muted-foreground">{includePatientSummary ? "Included in the patient handout" : "Excluded from the patient handout"}</p></div><Switch checked={includePatientSummary} onCheckedChange={setIncludePatientSummary} aria-label="Include patient summary" /></div>{includePatientSummary ? <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{note.patientSummary}</p> : <p className="mt-3 rounded-xl bg-muted/60 p-3 text-[11px] text-muted-foreground">Patient-facing summary hidden. The clinical note is unchanged.</p>}</div>
      </aside>
    </div>
  );
}

function ApprovedStep({ patient, note, clinicianName, onClose }: EncounterFlowProps) {
  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-[26px] border bg-card text-center shadow-[0_18px_55px_rgba(32,49,82,.07)]">
      <div className="bg-gradient-to-b from-emerald-50 to-card p-8 dark:from-emerald-950/60 dark:to-card sm:p-12"><div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"><CheckCircle2 className="size-8" /></div><Badge variant="outline" className="mt-5 rounded-full border-emerald-200 bg-white/70 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Clinician approved</Badge><h2 className="mt-4 text-3xl font-bold tracking-tight">Clinical note complete</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">The note for {patient.name} is locked to the clinician-approved version. Temporary audio is marked for deletion.</p></div>
      <div className="grid gap-px border-y bg-border text-left sm:grid-cols-3"><div className="bg-card p-5"><p className="text-[10px] font-bold tracking-wide text-muted-foreground">STATUS</p><p className="mt-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">Approved</p></div><div className="bg-card p-5"><p className="text-[10px] font-bold tracking-wide text-muted-foreground">SIGNED BY</p><p className="mt-2 truncate text-sm font-bold">{clinicianName}</p></div><div className="bg-card p-5"><p className="text-[10px] font-bold tracking-wide text-muted-foreground">REVIEW ITEMS</p><p className="mt-2 text-sm font-bold">{note.uncertainties.length} documented</p></div></div>
      <div className="flex flex-col justify-center gap-3 p-6 sm:flex-row"><Button className="rounded-xl" onClick={() => exportClinicalPdf(patient, note, clinicianName)}><Download /> Download PDF</Button><Button variant="outline" className="rounded-xl" onClick={() => exportFhirPreview(patient, note, clinicianName)}><FileText /> Export FHIR preview</Button><Button variant="outline" onClick={onClose} className="rounded-xl">Return to overview <ChevronRight /></Button></div>
      <p className="pb-6 text-[10px] text-muted-foreground">Demo export only — no real EHR connection is active.</p>
    </div>
  );
}
