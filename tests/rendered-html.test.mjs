import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("publishes Clinote metadata and social preview", async () => {
  const layout = await readFile(new URL("app/layout.tsx", root), "utf8");
  const socialCard = await readFile(new URL("public/og.png", root));

  assert.match(layout, /Clinote — AI Clinical Scribe/);
  assert.match(layout, /Consent-first clinical documentation/);
  assert.match(layout, /codex-preview/);
  assert.match(layout, /\/og\.png/);
  assert.ok(socialCard.byteLength > 10_000);
});

test("enforces consent before recording in the product flow", async () => {
  const app = await readFile(new URL("app/clinical-scribe-app.tsx", root), "utf8");

  assert.match(app, /disabled=\{!consentAccepted\}/);
  assert.match(app, /No recording begins until consent is captured/);
  assert.match(app, /Approve and sign/);
  assert.match(app, /AI draft · not final/);
});

test("keeps clinical AI output grounded and clinician reviewed", async () => {
  const route = await readFile(new URL("app/api/ai/note/route.ts", root), "utf8");

  assert.match(route, /Use only the supplied transcript/);
  assert.match(route, /Never diagnose, prescribe/);
  assert.match(route, /A clinician must verify every output/);
  assert.match(route, /isClinicalNote/);
});

test("supports realtime browser capture and a guided dummy workflow", async () => {
  const app = await readFile(new URL("app/clinical-scribe-app.tsx", root), "utf8");

  assert.match(app, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(app, /Live transcript/);
  assert.match(app, /Guided dummy demo/);
  assert.match(app, /processedSegments = liveSegments/);
  assert.match(app, /Recorded consultation audio/);
});

test("wires interactive review controls and consent outcomes", async () => {
  const app = await readFile(new URL("app/clinical-scribe-app.tsx", root), "utf8");
  const workspace = await readFile(new URL("app/api/workspace/route.ts", root), "utf8");

  assert.match(app, /value=\{query\} onChange=\{\(event\) => setQuery/);
  assert.match(app, /onClick=\{\(\) => setShowVersions/);
  assert.match(app, /checked=\{includePatientSummary\}/);
  assert.match(app, /completedControls\.length/);
  assert.match(workspace, /decline_consent/);
  assert.match(workspace, /withdraw_consent/);
  assert.match(workspace, /Consent withdrawn/);
});

test("provides an interactive realtime agent workspace", async () => {
  const app = await readFile(new URL("app/clinical-scribe-app.tsx", root), "utf8");
  const noteRoute = await readFile(new URL("app/api/ai/note/route.ts", root), "utf8");

  assert.match(app, /Clinote live agent/);
  assert.match(app, /CAPTURE COVERAGE/);
  assert.match(app, /Direct the agent/);
  assert.match(app, /Add marker/);
  assert.match(app, /Add task/);
  assert.match(app, /scrollIntoView/);
  assert.match(app, /captureFocus: agentFocus/);
  assert.match(noteRoute, /Clinician-requested documentation focus/);
  assert.match(noteRoute, /never invent missing data/);
});

test("supports uploaded audio conversations and Azure container deployment", async () => {
  const app = await readFile(new URL("app/clinical-scribe-app.tsx", root), "utf8");
  const transcribeRoute = await readFile(new URL("app/api/ai/transcribe/route.ts", root), "utf8");
  const dockerfile = await readFile(new URL("Dockerfile", root), "utf8");
  const azureScript = await readFile(new URL("scripts/deploy-azure.ps1", root), "utf8");

  assert.match(app, /Upload conversation/);
  assert.match(app, /onUploadAudio/);
  assert.match(app, /Drop an audio conversation here/);
  assert.match(app, /24 \* 1024 \* 1024/);
  assert.match(transcribeRoute, /audio\/x-m4a/);
  assert.match(transcribeRoute, /RUNTIME_PLATFORM === "azure"/);
  assert.match(dockerfile, /AZURE_BUILD=1 npx vinext build/);
  assert.match(dockerfile, /EXPOSE 8080/);
  assert.match(azureScript, /az containerapp up/);
});

test("adds login, mobile recording safeguards, PDF export and fifteen fictional patients", async () => {
  const app = await readFile(new URL("app/clinical-scribe-app.tsx", root), "utf8");
  const portal = await readFile(new URL("app/clinote-portal.tsx", root), "utf8");
  const data = await readFile(new URL("lib/demo-data.ts", root), "utf8");

  assert.match(portal, /Create your account/);
  assert.match(portal, /Continue as demo doctor/);
  assert.match(portal, /clinote\.demo\.session\.v2/);
  assert.match(app, /MediaRecorder\.isTypeSupported/);
  assert.match(app, /Mobile microphone access requires HTTPS/);
  assert.match(app, /recorder\.requestData/);
  assert.match(app, /Download PDF/);
  assert.match(app, /jsPDF/);
  assert.equal((data.match(/id: "patient-/g) ?? []).length, 15);
  assert.doesNotMatch(`${app}\n${portal}\n${data}`, /Sandhya|Kontham/i);
});
