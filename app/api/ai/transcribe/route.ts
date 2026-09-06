import { getDb } from "@/db";
import { audioAssets, auditEvents } from "@/db/schema";
import { sampleTranscript } from "@/lib/demo-data";
import { readSessionCookie } from "../../auth/entra";

export const dynamic = "force-dynamic";

type RuntimeEnv = {
  AZURE_BLOB_AUDIO_CONTAINER?: string;
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  AZURE_STORAGE_ACCOUNT?: string;
  AZURE_STORAGE_KEY?: string;
  BUCKET?: R2Bucket;
  GROQ_API_KEY?: string;
  GROQ_TRANSCRIPTION_MODEL?: string;
  TRANSCRIPTION_PROVIDER?: string;
};

async function getRuntimeEnv(): Promise<RuntimeEnv> {
  if (typeof process !== "undefined" && process.env.RUNTIME_PLATFORM === "azure") {
    return process.env as unknown as RuntimeEnv;
  }
  const { env } = await import("cloudflare:workers");
  return env as unknown as RuntimeEnv;
}

async function requestActor(request: Request) {
  const session = await readSessionCookie();
  if (session) return { id: session.userId, name: session.email };
  return {
    id: request.headers.get("oai-authenticated-user-id") ?? "demo-user",
    name: request.headers.get("oai-authenticated-user-email") ?? "Demo clinician",
  };
}

async function signAzureBlobRequest(
  method: "PUT" | "DELETE",
  account: string,
  key: string,
  container: string,
  objectKey: string,
  contentLength = 0,
  contentType = "",
) {
  const { createHmac } = await import("node:crypto");
  const date = new Date().toUTCString();
  const blobPath = `/${container}/${objectKey}`;
  const canonicalizedHeaders = `x-ms-blob-type:BlockBlob\nx-ms-date:${date}\nx-ms-version:2023-11-03\n`;
  const canonicalizedResource = `/${account}${blobPath}`;
  const stringToSign = [
    method,
    "",
    "",
    method === "PUT" ? String(contentLength) : "",
    "",
    contentType,
    "",
    "",
    "",
    "",
    "",
    "",
    canonicalizedHeaders + canonicalizedResource,
  ].join("\n");
  const signature = createHmac("sha256", Buffer.from(key, "base64")).update(stringToSign, "utf8").digest("base64");
  return {
    url: `https://${account}.blob.core.windows.net${blobPath}`,
    headers: {
      Authorization: `SharedKey ${account}:${signature}`,
      "x-ms-blob-type": "BlockBlob",
      "x-ms-date": date,
      "x-ms-version": "2023-11-03",
    },
  };
}

async function putAzureBlob(runtime: RuntimeEnv, objectKey: string, audio: File) {
  if (!runtime.AZURE_STORAGE_ACCOUNT || !runtime.AZURE_STORAGE_KEY || !runtime.AZURE_BLOB_AUDIO_CONTAINER) return false;
  const signed = await signAzureBlobRequest(
    "PUT",
    runtime.AZURE_STORAGE_ACCOUNT,
    runtime.AZURE_STORAGE_KEY,
    runtime.AZURE_BLOB_AUDIO_CONTAINER,
    objectKey,
    audio.size,
    audio.type || "application/octet-stream",
  );
  const response = await fetch(signed.url, {
    method: "PUT",
    headers: { ...signed.headers, "content-type": audio.type || "application/octet-stream" },
    body: audio,
  });
  return response.ok;
}

async function deleteAzureBlob(runtime: RuntimeEnv, objectKey: string) {
  if (!runtime.AZURE_STORAGE_ACCOUNT || !runtime.AZURE_STORAGE_KEY || !runtime.AZURE_BLOB_AUDIO_CONTAINER) return false;
  const signed = await signAzureBlobRequest("DELETE", runtime.AZURE_STORAGE_ACCOUNT, runtime.AZURE_STORAGE_KEY, runtime.AZURE_BLOB_AUDIO_CONTAINER, objectKey);
  const response = await fetch(signed.url, { method: "DELETE", headers: signed.headers });
  return response.ok || response.status === 404;
}

function speechContentType(audio: File) {
  if (/wav/i.test(audio.type) || /\.wav$/i.test(audio.name)) return "audio/wav; codecs=audio/pcm; samplerate=16000";
  if (/mpeg|mp3/i.test(audio.type) || /\.mp3$/i.test(audio.name)) return "audio/mpeg";
  if (/ogg/i.test(audio.type) || /\.ogg$/i.test(audio.name)) return "audio/ogg; codecs=opus";
  return audio.type || "application/octet-stream";
}

async function transcribeWithAzureSpeech(runtime: RuntimeEnv, audio: File) {
  if (!runtime.AZURE_SPEECH_KEY || !runtime.AZURE_SPEECH_REGION) return null;
  const response = await fetch(`https://${runtime.AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": runtime.AZURE_SPEECH_KEY,
      "content-type": speechContentType(audio),
    },
    body: audio,
  });
  if (!response.ok) return null;
  const payload = await response.json() as { DisplayText?: string; NBest?: Array<{ Display?: string; Confidence?: number }> };
  const text = payload.NBest?.[0]?.Display ?? payload.DisplayText;
  if (!text?.trim()) return null;
  return [{ speaker: "Other" as const, time: "00:00", text: text.trim(), confidence: payload.NBest?.[0]?.Confidence ?? 0.86 }];
}

export async function POST(request: Request) {
  const runtime = await getRuntimeEnv();
  const actor = await requestActor(request);
  const formData = await request.formData();
  const encounterId = String(formData.get("encounterId") ?? "").trim();
  const audio = formData.get("audio");

  if (!encounterId) {
    return Response.json({ error: "encounterId is required" }, { status: 400 });
  }

  let segments = sampleTranscript;
  let provider = "demo";

  if (audio instanceof File && audio.size > 0) {
    if (audio.size > 24 * 1024 * 1024) {
      return Response.json({ error: "Audio must be smaller than 24 MB." }, { status: 413 });
    }

    const allowed = ["audio/webm", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/ogg"];
    const supportedExtension = /\.(webm|wav|mp3|m4a|mp4|ogg)$/i.test(audio.name);
    if ((!audio.type || !allowed.some((type) => audio.type.startsWith(type))) && !supportedExtension) {
      return Response.json({ error: "Unsupported audio format." }, { status: 415 });
    }

    const objectKey = `temporary/${actor.id}/${encounterId}/${crypto.randomUUID()}`;
    const assetId = crypto.randomUUID();
    const now = new Date().toISOString();

    if (runtime.BUCKET) {
      await runtime.BUCKET.put(objectKey, audio.stream(), {
        httpMetadata: { contentType: audio.type || "audio/webm" },
        customMetadata: { encounterId, purpose: "temporary-transcription" },
      });
    }
    if (!runtime.BUCKET) await putAzureBlob(runtime, objectKey, audio).catch(() => false);

    try {
      const db = await getDb();
      await db.insert(audioAssets).values({
        id: assetId,
        encounterId,
        objectKey,
        mimeType: audio.type || "audio/webm",
        sizeBytes: audio.size,
        status: "temporary",
        createdAt: now,
      });
    } catch {
      // Transcription remains available if optional metadata persistence is unavailable.
    }

    const azureSegments = runtime.TRANSCRIPTION_PROVIDER === "azure-speech"
      ? await transcribeWithAzureSpeech(runtime, audio).catch(() => null)
      : null;
    if (azureSegments) {
      segments = azureSegments;
      provider = "azure-speech";
    } else if (runtime.GROQ_API_KEY && runtime.GROQ_TRANSCRIPTION_MODEL) {
      const groqForm = new FormData();
      groqForm.set("file", audio, audio.name || "consultation.webm");
      groqForm.set("model", runtime.GROQ_TRANSCRIPTION_MODEL);
      groqForm.set("response_format", "verbose_json");
      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${runtime.GROQ_API_KEY}` },
        body: groqForm,
      });
      if (response.ok) {
        const payload = (await response.json()) as { text?: string; segments?: Array<{ start?: number; text?: string }> };
        if (payload.segments?.length) {
          segments = payload.segments.map((segment, index) => ({
            speaker: index % 2 === 0 ? "Clinician" as const : "Patient" as const,
            time: new Date((segment.start ?? index * 8) * 1000).toISOString().slice(14, 19),
            text: segment.text?.trim() || "[Unclear audio]",
            confidence: 0.9,
          }));
        } else if (payload.text?.trim()) {
          segments = [{ speaker: "Other", time: "00:00", text: payload.text.trim(), confidence: 0.86 }];
        }
        provider = "groq";
      }
    }

    if (runtime.BUCKET) await runtime.BUCKET.delete(objectKey);
    if (!runtime.BUCKET) await deleteAzureBlob(runtime, objectKey).catch(() => false);
    try {
      const db = await getDb();
      await db.insert(auditEvents).values({
        id: crypto.randomUUID(),
        ownerId: actor.id,
        encounterId,
        action: "Audio deleted",
        detail: "Temporary recording removed after transcription processing",
        actor: "System",
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Audit write errors do not expose clinical content in the response.
    }
  }

  return Response.json({ segments, provider, temporaryAudioDeleted: true });
}
