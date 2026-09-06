import { sampleNote, type ClinicalNote, type TranscriptSegment } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

type RuntimeEnv = {
  AI_PROVIDER?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_OPENAI_API_VERSION?: string;
  AZURE_OPENAI_DEPLOYMENT?: string;
  AZURE_OPENAI_ENDPOINT?: string;
  GROQ_API_KEY?: string;
  GROQ_CHAT_MODEL?: string;
};

async function getRuntimeEnv(): Promise<RuntimeEnv> {
  if (typeof process !== "undefined" && process.env.RUNTIME_PLATFORM === "azure") {
    return process.env;
  }
  const { env } = await import("cloudflare:workers");
  return env as unknown as RuntimeEnv;
}

function isClinicalNote(value: unknown): value is ClinicalNote {
  if (!value || typeof value !== "object") return false;
  const note = value as Record<string, unknown>;
  return ["chiefComplaint", "subjective", "objective", "assessment", "plan", "patientSummary"].every((key) => typeof note[key] === "string")
    && Array.isArray(note.medications)
    && Array.isArray(note.allergies)
    && Array.isArray(note.uncertainties);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    patient?: { name?: string; allergies?: string[]; medications?: string[] };
    segments?: TranscriptSegment[];
    captureFocus?: string;
  };
  if (!Array.isArray(body.segments) || body.segments.length === 0) {
    return Response.json({ error: "Transcript segments are required." }, { status: 400 });
  }

  const runtime = await getRuntimeEnv();
  const transcript = body.segments.map((segment) => `[${segment.time}] ${segment.speaker}: ${segment.text}`).join("\n");
  const systemPrompt = `You create draft clinical documentation for clinician review. Use only the supplied transcript and authorised record context. Never diagnose, prescribe, recommend treatment, place orders, or turn uncertainty into fact. Preserve negations and speaker attribution. A clinician must verify every output. Return one JSON object with camelCase keys: chiefComplaint, subjective, objective, assessment, plan, patientSummary, medications (string array), allergies (string array), uncertainties (array of objects with severity low|medium|critical, text, source). No markdown.`;
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Clinician-requested documentation focus (use only to organise supplied facts; never invent missing data): ${body.captureFocus ?? "Complete history"}\n\nAuthorised record context:\n${JSON.stringify(body.patient ?? {})}\n\nTranscript:\n${transcript}` },
  ];

  const useAzure = runtime.AI_PROVIDER === "azure-openai" && runtime.AZURE_OPENAI_ENDPOINT && runtime.AZURE_OPENAI_DEPLOYMENT && runtime.AZURE_OPENAI_API_KEY;
  const response = useAzure
    ? await fetch(`${runtime.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "")}/openai/deployments/${runtime.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${runtime.AZURE_OPENAI_API_VERSION ?? "2024-10-21"}`, {
      method: "POST",
      headers: { "api-key": runtime.AZURE_OPENAI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ temperature: 0.1, response_format: { type: "json_object" }, messages }),
    })
    : runtime.GROQ_API_KEY && runtime.GROQ_CHAT_MODEL
      ? await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${runtime.GROQ_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ model: runtime.GROQ_CHAT_MODEL, temperature: 0.1, response_format: { type: "json_object" }, messages }),
      })
      : null;

  if (!response) {
    return Response.json({ note: sampleNote, provider: "offline", warning: "AI provider is not configured." });
  }

  if (!response.ok) {
    return Response.json({ note: sampleNote, provider: "demo", warning: "AI provider unavailable; fictional sample returned." });
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  try {
    const note = JSON.parse(payload.choices?.[0]?.message?.content ?? "null") as unknown;
    if (!isClinicalNote(note)) throw new Error("Invalid clinical note schema");
    return Response.json({ note, provider: useAzure ? "azure-openai" : "groq" });
  } catch {
    return Response.json({ note: sampleNote, provider: "demo", warning: "Generated output failed schema validation." });
  }
}
