# Авто-коммит раз в 10 минут, если есть изменения

$interval = 600
$repo = "C:\Users\arman\barber-crm"

Set-Location $repo

Write-Host "Авто-бэкап запущен. Интервал: $interval сек. Ctrl+C для остановки." -ForegroundColor Green

while ($true) {
    Start-Sleep -Seconds $interval

    $status = git status --porcelain

    if ($status) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
        git add -A
        git commit -m "autobackup: $timestamp" 2>$null | Out-Null

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$timestamp] Авто-коммит сделан" -ForegroundColor Yellow
        }
    }
}