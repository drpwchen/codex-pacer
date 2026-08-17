# resume-runner.ps1 — executed by the Codex-Pacer-Resume scheduled task.
# Runs `codex exec resume --last` driven by handoff.md, then removes the task.
# Set $WorkDir to the project the resumed work should run in, and make sure
# `codex` must be on PATH for the task's user.
$dir = if ($env:CODEX_PACER_DIR) { $env:CODEX_PACER_DIR } else { "$env:USERPROFILE\.codex\codex-pacer" }
$log = "$dir\resume-log.txt"
$handoff = "$dir\handoff.md"
$WorkDir = "$env:USERPROFILE"   # <-- change to your project directory

"=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') resume fired ===" | Add-Content $log

if (-not (Test-Path $handoff)) {
  "ABORT: handoff.md missing" | Add-Content $log
} else {
  Set-Location $WorkDir
  $prompt = "Read $handoff and continue that work, following its instructions exactly. " +
            "When finished (or blocked), append a '## Result $(Get-Date -Format 'yyyy-MM-dd HH:mm')' section to that same handoff file " +
            "summarizing what was done and what remains."
  codex exec resume --last $prompt *>> $log
  "=== exit code: $LASTEXITCODE ===" | Add-Content $log
}

schtasks /delete /tn "Codex-Pacer-Resume" /f 2>$null | Out-Null
