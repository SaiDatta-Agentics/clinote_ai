export const dynamic = "force-dynamic";

export async function GET() {
  const required = {
    azureOpenAI: ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_API_KEY"],
    azureSpeech: ["AZURE_SPEECH_REGION", "AZURE_SPEECH_KEY"],
    azureBlob: ["AZURE_STORAGE_ACCOUNT", "AZURE_STORAGE_KEY", "AZURE_BLOB_AUDIO_CONTAINER", "AZURE_BLOB_PDF_CONTAINER"],
    azureSql: ["AZURE_SQL_CONNECTION_STRING"],
    applicationInsights: ["APPLICATIONINSIGHTS_CONNECTION_STRING"],
    microsoftLogin: ["ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "ENTRA_REDIRECT_URI"],
    googleLogin: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  };
  const services = Object.fromEntries(Object.entries(required).map(([name, keys]) => [
    name,
    {
      configured: keys.every((key) => Boolean(process.env[key])),
      missing: keys.filter((key) => !process.env[key]),
    },
  ]));
  return Response.json({
    ok: true,
    service: "clinote-clinical-scribe",
    runtime: process.env.RUNTIME_PLATFORM ?? "cloudflare",
    services,
    timestamp: new Date().toISOString(),
  });
}
