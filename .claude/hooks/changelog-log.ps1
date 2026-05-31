# Avto-zhurnal dlya CHANGELOG.md (novye sverhu, pod datoy).
# Obsluzhivaet DVA hooka odnim faylom:
#   1. UserPromptSubmit            -> stroka "### HH:MM - <<zapros>>" + pleysholder "_(recap...)_"
#   2. PostToolUse / AskUserQuestion -> blok "uchnyayushchie voprosy" s polnymi voprosami i otvetami
# Nikogda ne pishet v stdout i vsegda exit 0, chtoby ne vmeshivat'sya v rabotu.
# Spec-simvoly cherez [char], chtoby ne zaviset' ot kodirovki samogo skripta.
$ErrorActionPreference = 'Stop'

$laquo = [char]0x00AB   # <<
$raquo = [char]0x00BB   # >>
$mdash = [char]0x2014   # em dash
$hell  = [char]0x2026   # ...
$qmark = [char]0x2753   # crasnyy znak voprosa
# Russkie literaly cherez [char], chtoby ne zaviset' ot kodirovki skripta (PS 5.1 chitaet .ps1 bez BOM kak ANSI)
$labV = [char]0x0412    # V (vopros)
$labO = [char]0x041E    # O (otvet)
$utochnenie = -join (@(0x0443,0x0442,0x043E,0x0447,0x043D,0x0435,0x043D,0x0438,0x0435) | ForEach-Object { [char]$_ })  # "uchnyayushchee" slovo

function Read-StdinUtf8 {
    $s  = [Console]::OpenStandardInput()
    $ms = New-Object System.IO.MemoryStream
    $s.CopyTo($ms)
    return [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
}

function Get-Prop($obj, [string]$name) {
    if ($null -eq $obj) { return $null }
    $p = $obj.PSObject.Properties[$name]
    if ($p) { return $p.Value }
    return $null
}

function Clean-Text([string]$t, [int]$max) {
    if ([string]::IsNullOrWhiteSpace($t)) { return '' }
    $t = $t.Trim() -replace '\s+', ' '
    # max <= 0 => bez obrezki (zapros pishem celikom)
    if ($max -gt 0 -and $t.Length -gt $max) { $t = $t.Substring(0, $max) + $hell }
    return $t
}

# Vstavlyaet gotovye stroki sverhu pod zagolovkom segodnyashney daty.
function Insert-Entry([string[]]$entryLines) {
    $projectDir = $env:CLAUDE_PROJECT_DIR
    if ([string]::IsNullOrWhiteSpace($projectDir)) { $projectDir = (Get-Location).Path }
    $file = Join-Path $projectDir 'CHANGELOG.md'
    if (-not (Test-Path -LiteralPath $file)) { return }

    $date = (Get-Date).ToString('yyyy-MM-dd')

    $content = Get-Content -LiteralPath $file -Raw -Encoding UTF8
    if ($null -eq $content) { $content = '' }
    if ($content.Contains("`r`n")) { $nl = "`r`n" } else { $nl = "`n" }

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.AddRange([string[]]($content -split [regex]::Escape($nl)))

    $hi = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i].Trim() -eq "## $date") { $hi = $i; break }
    }

    if ($hi -ge 0) {
        $insertIdx = $hi + 1
        if ($insertIdx -lt $lines.Count -and $lines[$insertIdx].Trim() -eq '') { $insertIdx++ }
        $lines.InsertRange($insertIdx, [string[]]$entryLines)
    } else {
        $si = -1
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i].Trim() -eq '---') { $si = $i; break }
        }
        $block = @("## $date", "") + $entryLines
        if ($si -ge 0) {
            $insertIdx = $si + 1
            if ($insertIdx -lt $lines.Count -and $lines[$insertIdx].Trim() -eq '') { $insertIdx++ }
            $lines.InsertRange($insertIdx, [string[]]$block)
        } else {
            $lines.InsertRange(0, [string[]]$block)
        }
    }

    $out = [string]::Join($nl, $lines)
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($file, $out, $enc)
}

try {
    $stdin = Read-StdinUtf8
    if ([string]::IsNullOrWhiteSpace($stdin)) { exit 0 }
    $data = $stdin | ConvertFrom-Json

    $time = (Get-Date).ToString('HH:mm')

    $toolInput = Get-Prop $data 'tool_input'
    $questions = Get-Prop $toolInput 'questions'

    if ($null -ne $questions) {
        # ---- Rezhim Q&A (AskUserQuestion) ----
        # Otvety: { "<polnyy vopros>": "<otvet>" }. Ishchem v neskol'kih mestah.
        $toolResp = Get-Prop $data 'tool_response'
        $answers = Get-Prop $toolInput 'answers'
        if ($null -eq $answers) { $answers = Get-Prop $toolResp 'answers' }
        if ($null -eq $answers) { $answers = Get-Prop $data 'answers' }
        if ($null -eq $answers) { exit 0 }   # net otvetov (otmena) - nichego ne pishem

        $annotations = Get-Prop $toolInput 'annotations'
        if ($null -eq $annotations) { $annotations = Get-Prop $toolResp 'annotations' }

        $body = New-Object System.Collections.Generic.List[string]
        foreach ($prop in $answers.PSObject.Properties) {
            $q = Clean-Text ([string]$prop.Name)  500
            $a = Clean-Text ([string]$prop.Value) 400
            if ([string]::IsNullOrWhiteSpace($q)) { continue }
            $note = $null
            if ($annotations) {
                $ann = $annotations.PSObject.Properties[$prop.Name]
                if ($ann) { $note = Clean-Text ([string](Get-Prop $ann.Value 'notes')) 300 }
            }
            $body.Add("**$labV`:** $q")
            if ($note) { $body.Add("**$labO`:** $a _($note)_") } else { $body.Add("**$labO`:** $a") }
            $body.Add("")
        }
        if ($body.Count -eq 0) { exit 0 }

        $entry = New-Object System.Collections.Generic.List[string]
        $entry.Add("### $time $mdash $qmark $utochnenie")
        $entry.AddRange($body)
        Insert-Entry ([string[]]$entry)
        exit 0
    }

    # ---- Rezhim zaprosa (UserPromptSubmit) ----
    $prompt = $null
    foreach ($name in 'prompt', 'user_prompt', 'message', 'text') {
        $v = Get-Prop $data $name
        if ($v) { $prompt = [string]$v; break }
    }
    if (-not $prompt) { exit 0 }

    # Zapros pishem celikom: vsyo soobshchenie (mnogostrochnoe skl=eivaetsya v odnu stroku), bez obrezki.
    $p = Clean-Text $prompt 0
    if ([string]::IsNullOrWhiteSpace($p)) { exit 0 }

    $entryLines = @(
        "### $time $mdash $laquo$p$raquo",
        "_(recap$hell)_",
        ""
    )
    Insert-Entry $entryLines
} catch {
    # Tiho: zhurnal ne dolzhen lomat' rabotu
}
exit 0
