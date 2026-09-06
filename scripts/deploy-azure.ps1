param(
  [string]$ResourceGroup = "clinote-rg",
  [string]$Location = "eastus2",
  [string]$AppName = "clinote-agent"
)

$ErrorActionPreference = "Stop"

az account show --output none
az extension add --name containerapp --upgrade --only-show-errors
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait
az group create --name $ResourceGroup --location $Location --output none

az containerapp up `
  --name $AppName `
  --resource-group $ResourceGroup `
  --location $Location `
  --source . `
  --ingress external `
  --target-port 8080 `
  --env-vars RUNTIME_PLATFORM=azure GROQ_CHAT_MODEL=llama-3.1-8b-instant GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo

$fqdn = az containerapp show --name $AppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn --output tsv
Write-Host "Clinote deployed: https://$fqdn"
Write-Host "Next: configure GROQ_API_KEY as an Azure secret using the README command."
