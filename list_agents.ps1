
$envFile = "c:\Users\lgreg\.gemini\antigravity\playground\life-os\.env"
$url = ""
$token = ""

# Read from .env
Get-Content $envFile | ForEach-Object {
    if ($_ -match "VITE_HA_URL=(.*)") { $url = $matches[1] }
    if ($_ -match "VITE_HA_TOKEN=(.*)") { $token = $matches[1] }
}

if (-not $url -or -not $token) {
    Write-Host "Error: URL or TOKEN not found in .env"
    exit
}

Write-Host "Fetching Agents from $url..."

try {
    $response = Invoke-RestMethod -Uri "$url/api/conversation/agent/list" -Method Get -Headers @{ "Authorization" = "Bearer $token" }
    $response.agents | Format-Table -AutoSize
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader $_.Exception.Response.GetResponseStream()
        $reader.ReadToEnd()
    }
}
