# Авто-журнал CHANGELOG — как устроен хук и скрипт

Документ для переноса механизма в другую среду. Если воспроизвести три части ниже **точно** —
запись в `CHANGELOG.md` будет одинаковой и структурно, и механически.

Глобальной копии в `~/.claude` нет — весь механизм живёт **внутри проекта**, в папке `.claude/`.
Чтобы перенести: скопируй два файла (`settings.json` и `changelog-log.ps1`) и заведи `CHANGELOG.md`
с правильной шапкой. Больше ничего не нужно.

---

## Из чего состоит механизм (3 части)

| # | Файл | Роль |
|---|------|------|
| 1 | `.claude/settings.json` | Подключает два хука и указывает, какой скрипт запускать |
| 2 | `.claude/hooks/changelog-log.ps1` | Сам PowerShell-скрипт: читает событие из stdin и пишет строку в журнал |
| 3 | `CHANGELOG.md` (в корне проекта) | Файл-журнал. Скрипт ищет в нём шапку даты и вставляет запись |

Условие среды: **Windows + PowerShell** (скрипт на `.ps1`). Хук вызывается через `bash`-обёртку,
поэтому в среде должен быть доступен и `bash` (в Claude Code на Windows он есть).

---

## Часть 1. `.claude/settings.json` — подключение хуков

Два события Claude Code запускают **один и тот же** скрипт:

- **`UserPromptSubmit`** — срабатывает на каждый твой запрос → пишет строку запроса.
- **`PostToolUse`** с matcher **`AskUserQuestion`** — срабатывает, когда Claude задал уточняющий
  вопрос и получил ответ → пишет блок «вопрос/ответ».

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "shell": "bash",
            "command": "powershell -NoProfile -ExecutionPolicy Bypass -File \"${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/changelog-log.ps1\" >/dev/null 2>&1 || true",
            "statusMessage": "Журналирую запрос в CHANGELOG",
            "timeout": 15
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "AskUserQuestion",
        "hooks": [
          {
            "type": "command",
            "shell": "bash",
            "command": "powershell -NoProfile -ExecutionPolicy Bypass -File \"${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/changelog-log.ps1\" >/dev/null 2>&1 || true",
            "statusMessage": "Журналирую уточнения в CHANGELOG",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

Ключевые детали команды:
- `${CLAUDE_PROJECT_DIR:-.}` — Claude Code подставляет сюда корень проекта; скрипт всегда находится по
  относительному пути от него.
- `>/dev/null 2>&1 || true` — глушит любой вывод и не даёт хуку «уронить» работу, даже если скрипт упал.
- `-NoProfile -ExecutionPolicy Bypass` — скрипт запускается без профиля и без блокировки политикой.

> Если в проекте есть и другие настройки (например, `permissions`), просто добавь блок `"hooks"`
> рядом, не затирая остальное.

---

## Часть 2. `.claude/hooks/changelog-log.ps1` — сам скрипт

Положи файл **ровно** с этим содержимым. Менять кодировку/символы вручную не нужно — спецсимволы
(`«» — … ❓`, русские «В/О/уточнение») собираются через `[char]`, чтобы не зависеть от кодировки `.ps1`.

```powershell
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
    if ($t.Length -gt $max) { $t = $t.Substring(0, $max) + $hell }
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

    $p = ($prompt -split "\r?\n")[0]
    $p = Clean-Text $p 200
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
```

### Как скрипт работает по шагам

1. **Читает stdin сырыми байтами как UTF-8** (`Read-StdinUtf8`). Это критично: при обычном чтении
   PowerShell ломает кириллицу. Claude Code передаёт событие хука как JSON в stdin.
2. **Парсит JSON** и определяет режим по наличию поля `tool_input.questions`:
   - есть `questions` → это `AskUserQuestion` → **режим Q&A**;
   - нет → **режим запроса** (`UserPromptSubmit`).
3. **Режим запроса:** берёт первую строку промпта, чистит пробелы, обрезает до 200 символов и собирает:
   ```
   ### HH:MM — «текст запроса»
   _(recap…)_

   ```
4. **Режим Q&A:** достаёт ответы (`answers` ищется в `tool_input` → `tool_response` → корне),
   опционально примечание (`annotations[...].notes`), и собирает на каждый вопрос:
   ```
   ### HH:MM — ❓ уточнение
   **В:** полный текст вопроса
   **О:** выбранный ответ _(примечание, если есть)_

   ```
5. **`Insert-Entry` вставляет блок в `CHANGELOG.md`:**
   - ищет шапку сегодняшней даты `## ГГГГ-ММ-ДД` и вставляет **сразу под ней** (новые записи сверху);
   - если шапки даты ещё нет — создаёт `## ГГГГ-ММ-ДД` сразу после строки-разделителя `---`
     (а если и `---` нет — в самое начало файла);
   - сохраняет файл как **UTF-8 без BOM**, сохраняя исходный стиль переноса строк (`\r\n` или `\n`).
6. **Всегда `exit 0` и молчит в stdout** — если что-то пошло не так, журнал просто не пишется, но
   работа Claude не ломается.

---

## Часть 3. `CHANGELOG.md` — формат файла

Скрипт опирается на две вещи в файле: строку-разделитель `---` и шапки дат `## ГГГГ-ММ-ДД`.
Заведи файл с такой шапкой (содержимое примеров можно своё):

```markdown
# CHANGELOG — бортовой журнал

> Хроника работы: **дата · время · запрос · recap (что сделано)**.
> Новые записи добавляются сверху.

---
```

Дальше скрипт сам наращивает блоки дат и записи под ними. Пример итогового вида:

```markdown
## 2026-05-31

### 12:35 — «Текст запроса»
_(recap…)_

### 12:15 — ❓ уточнение
**В:** Полный текст вопроса
**О:** Выбранный ответ
```

---

## Разделение труда: что пишет хук, а что Claude

- **Хук пишет автоматически:** строку запроса `### HH:MM — «…»` с плейсхолдером `_(recap…)_`
  и блоки уточнений `❓ уточнение` с `**В:**`/`**О:**`.
- **Claude дописывает recap:** в конце осмысленного блока работы заменяет свежий `_(recap…)_`
  на выжимку «что сделано». Тривиальные запросы можно оставлять без recap.

---

## Чек-лист переноса в другую среду

1. Создать `.claude/hooks/changelog-log.ps1` с кодом из Части 2.
2. Создать/дополнить `.claude/settings.json` блоком `"hooks"` из Части 1.
3. Создать `CHANGELOG.md` в корне проекта с шапкой и строкой `---` из Части 3.
4. Перезапустить чат Claude Code (хуки подхватываются при старте сессии).
5. Проверить: отправить любой запрос → под датой появится `### HH:MM — «…» / _(recap…)_`;
   ответить на `AskUserQuestion` → появится блок `❓ уточнение` с `**В:**`/`**О:**`.
```
