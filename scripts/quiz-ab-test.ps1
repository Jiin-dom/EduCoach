param(
    [Parameter(Mandatory = $true)] [string]$SupabaseUrl,
    [Parameter(Mandatory = $true)] [string]$SupabaseKey, # Prefer service-role for clean access
    [Parameter(Mandatory = $true)] [string]$BaselineDocumentId,
    [Parameter(Mandatory = $true)] [string]$CandidateDocumentId,
    [int]$Runs = 5,
    [int]$QuestionCount = 10,
    [ValidateSet("easy","medium","hard","mixed")] [string]$Difficulty = "easy"
)

$ErrorActionPreference = "Stop"

$Headers = @{
    "apikey"        = $SupabaseKey
    "Authorization" = "Bearer $SupabaseKey"
    "Content-Type"  = "application/json"
}

function Normalize-Text([string]$s) {
    if (-not $s) { return "" }
    $x = $s.ToLowerInvariant()
    $x = [regex]::Replace($x, "https?://\S+", " ")
    $x = [regex]::Replace($x, "[^a-z0-9\s]", " ")
    $x = [regex]::Replace($x, "\s+", " ").Trim()
    return $x
}

function Get-Jaccard([string]$a, [string]$b) {
    $na = Normalize-Text $a
    $nb = Normalize-Text $b
    if (-not $na -or -not $nb) { return 0.0 }

    $setA = New-Object 'System.Collections.Generic.HashSet[string]'
    $setB = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($t in $na.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)) { [void]$setA.Add($t) }
    foreach ($t in $nb.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)) { [void]$setB.Add($t) }

    if ($setA.Count -eq 0 -and $setB.Count -eq 0) { return 0.0 }

    $intersection = 0
    foreach ($t in $setA) { if ($setB.Contains($t)) { $intersection++ } }

    $unionSet = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($t in $setA) { [void]$unionSet.Add($t) }
    foreach ($t in $setB) { [void]$unionSet.Add($t) }

    if ($unionSet.Count -eq 0) { return 0.0 }
    return [double]$intersection / [double]$unionSet.Count
}

function Test-HasVerbIndicator([string]$text) {
    if (-not $text) { return $false }
    return [regex]::IsMatch($text, '\b(is|are|was|were|has|have|had|can|could|will|would|may|might|shall|should|must|means|refers|involves|includes|uses|provides|allows|enables|requires|represents|defines|describes|contains|supports)\b', 'IgnoreCase')
}

function Get-ConceptMetrics([string]$documentId) {
    $uri = "$SupabaseUrl/rest/v1/concepts?select=name,description&document_id=eq.$documentId"
    $concepts = Invoke-RestMethod -Method Get -Uri $uri -Headers $Headers

    $total = @($concepts).Count
    if ($total -eq 0) {
        return [PSCustomObject]@{
            totalConcepts = 0
            shortDescPct = 0
            noVerbPct = 0
            nearDupPct = 0
        }
    }

    $short = 0
    $noVerb = 0
    $nearDup = 0

    foreach ($c in $concepts) {
        $name = [string]$c.name
        $desc = [string]$c.description

        if ($desc.Trim().Length -lt 40) { $short++ }
        if (-not (Test-HasVerbIndicator $desc)) { $noVerb++ }
        if ((Get-Jaccard $desc $name) -gt 0.7) { $nearDup++ }
    }

    return [PSCustomObject]@{
        totalConcepts = $total
        shortDescPct  = [math]::Round(($short / $total) * 100, 2)
        noVerbPct     = [math]::Round(($noVerb / $total) * 100, 2)
        nearDupPct    = [math]::Round(($nearDup / $total) * 100, 2)
    }
}

function Invoke-GenerateQuiz([string]$documentId) {
    $payload = @{
        documentId       = $documentId
        questionCount    = $QuestionCount
        difficulty       = $Difficulty
        questionTypes    = @("multiple_choice","identification","true_false","fill_in_blank")
        enhanceWithLlm   = $true
        questionTypeTargets = @{}
    }

    $resp = Invoke-RestMethod `
        -Method Post `
        -Uri "$SupabaseUrl/functions/v1/generate-quiz" `
        -Headers $Headers `
        -Body ($payload | ConvertTo-Json -Depth 10)

    if (-not $resp.success -or -not $resp.quizId) {
        throw "generate-quiz failed for document $documentId. Response: $($resp | ConvertTo-Json -Depth 6)"
    }

    return $resp
}

function Get-QuizQuestions([string]$quizId) {
    $uri = "$SupabaseUrl/rest/v1/quiz_questions?select=question_type,question_text,correct_answer,explanation,difficulty_level&quiz_id=eq.$quizId"
    return Invoke-RestMethod -Method Get -Uri $uri -Headers $Headers
}

function Get-QuizMetrics($questions) {
    $qs = @($questions)
    $total = $qs.Count
    if ($total -eq 0) {
        return [PSCustomObject]@{
            total = 0; shortStemPct = 0; labelOnlyPct = 0; badTfFormPct = 0
            mcqPct = 0; tfPct = 0; fibPct = 0; idPct = 0
        }
    }

    $shortStem = 0
    $labelOnly = 0
    $badTfForm = 0

    $counts = @{
        multiple_choice = 0
        true_false = 0
        fill_in_blank = 0
        identification = 0
    }

    foreach ($q in $qs) {
        $qt = [string]$q.question_type
        $text = ([string]$q.question_text).Trim()

        if ($counts.ContainsKey($qt)) { $counts[$qt]++ }

        if ($text.Length -lt 20) { $shortStem++ }

        $wordCount = @($text.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)).Count
        $hasVerb = Test-HasVerbIndicator $text
        if (($wordCount -lt 6 -and -not $hasVerb) -or (-not $hasVerb -and $text.Length -lt 45)) {
            $labelOnly++
        }

        if ($qt -eq "true_false") {
            $interrogativeStart = [regex]::IsMatch($text, '^(how|what|why|when|where|who|which|can|could|should|would|is|are|do|does|did|will|has|have)\b', 'IgnoreCase')
            if ($text.EndsWith("?") -or $interrogativeStart) { $badTfForm++ }
        }
    }

    return [PSCustomObject]@{
        total        = $total
        shortStemPct = [math]::Round(($shortStem / $total) * 100, 2)
        labelOnlyPct = [math]::Round(($labelOnly / $total) * 100, 2)
        badTfFormPct = [math]::Round(($badTfForm / [math]::Max(1, $counts.true_false)) * 100, 2)
        mcqPct       = [math]::Round(($counts.multiple_choice / $total) * 100, 2)
        tfPct        = [math]::Round(($counts.true_false / $total) * 100, 2)
        fibPct       = [math]::Round(($counts.fill_in_blank / $total) * 100, 2)
        idPct        = [math]::Round(($counts.identification / $total) * 100, 2)
    }
}

function Invoke-Scenario([string]$name, [string]$documentId) {
    Write-Host "`n=== Running scenario: $name ($documentId) ===" -ForegroundColor Cyan

    $conceptMetrics = Get-ConceptMetrics $documentId
    Write-Host "Concepts: total=$($conceptMetrics.totalConcepts), short=$($conceptMetrics.shortDescPct)%, noVerb=$($conceptMetrics.noVerbPct)%, nearDup=$($conceptMetrics.nearDupPct)%"

    # PowerShell variables are case-insensitive: keep names distinct from script params.
    $runCount = $Runs
    $runResults = @()
    for ($i = 1; $i -le $runCount; $i++) {
        Write-Host "  [$i/$runCount] generating quiz..."
        $resp = Invoke-GenerateQuiz $documentId
        $qs = Get-QuizQuestions $resp.quizId
        $m = Get-QuizMetrics $qs

        $runResults += [PSCustomObject]@{
            run = $i
            quizId = $resp.quizId
            total = $m.total
            shortStemPct = $m.shortStemPct
            labelOnlyPct = $m.labelOnlyPct
            badTfFormPct = $m.badTfFormPct
            mcqPct = $m.mcqPct
            tfPct = $m.tfPct
            fibPct = $m.fibPct
            idPct = $m.idPct
        }

        Start-Sleep -Milliseconds 600
    }

    $avg = [PSCustomObject]@{
        scenario = $name
        runs = $runCount
        avgQuestions = [math]::Round((($runResults | Measure-Object total -Average).Average), 2)
        avgShortStemPct = [math]::Round((($runResults | Measure-Object shortStemPct -Average).Average), 2)
        avgLabelOnlyPct = [math]::Round((($runResults | Measure-Object labelOnlyPct -Average).Average), 2)
        avgBadTfFormPct = [math]::Round((($runResults | Measure-Object badTfFormPct -Average).Average), 2)
        avgMcqPct = [math]::Round((($runResults | Measure-Object mcqPct -Average).Average), 2)
        avgTfPct = [math]::Round((($runResults | Measure-Object tfPct -Average).Average), 2)
        avgFibPct = [math]::Round((($runResults | Measure-Object fibPct -Average).Average), 2)
        avgIdPct = [math]::Round((($runResults | Measure-Object idPct -Average).Average), 2)
        conceptTotal = $conceptMetrics.totalConcepts
        conceptShortDescPct = $conceptMetrics.shortDescPct
        conceptNoVerbPct = $conceptMetrics.noVerbPct
        conceptNearDupPct = $conceptMetrics.nearDupPct
    }

    return [PSCustomObject]@{
        name = $name
        documentId = $documentId
        conceptMetrics = $conceptMetrics
        runs = $runResults
        average = $avg
    }
}

$baseline = Invoke-Scenario -name "baseline" -documentId $BaselineDocumentId
$candidate = Invoke-Scenario -name "candidate" -documentId $CandidateDocumentId

$summary = @($baseline.average, $candidate.average)
Write-Host "`n=== A/B Summary ===" -ForegroundColor Green
$summary | Format-Table -AutoSize

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = "quiz_ab_report_$timestamp.json"
$result = [PSCustomObject]@{
    config = @{
        difficulty = $Difficulty
        questionCount = $QuestionCount
        runs = $Runs
    }
    baseline = $baseline
    candidate = $candidate
}
$result | ConvertTo-Json -Depth 8 | Out-File -FilePath $outFile -Encoding utf8
Write-Host "`nSaved detailed report to $outFile" -ForegroundColor Yellow