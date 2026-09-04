$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $nodeRuntime = $nodeCommand.Source
} else {
    $nodeRuntime = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (-not (Test-Path -LiteralPath $nodeRuntime)) {
        throw 'Instala Node.js 24 o posterior y vuelve a ejecutar este archivo.'
    }
}
Write-Host 'Lulos estará disponible en http://127.0.0.1:8787. Mantén esta terminal abierta.'
& $nodeRuntime server/server.mjs
