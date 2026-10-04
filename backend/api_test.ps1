$ErrorActionPreference = "Stop"

# Login
$loginBody = "username=admin@labtrack.edu&password=admin123"
$login = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/auth/login' -Method POST -Body $loginBody -ContentType 'application/x-www-form-urlencoded'
$token = $login.access_token
Write-Host "TOKEN acquired: $($token.Substring(0,20))..."

$headers = @{ Authorization = "Bearer $token" }

Write-Host "`n=== /auth/me ==="
try {
    $me = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/auth/me' -Headers $headers
    $me | ConvertTo-Json -Depth 3
} catch { Write-Host "ERROR: $_" }

Write-Host "`n=== /auth/users ==="
try {
    $users = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/auth/users' -Headers $headers
    $users | ConvertTo-Json -Depth 3
} catch { Write-Host "ERROR: $_" }

Write-Host "`n=== /departments/ ==="
try {
    $depts = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/departments/' -Headers $headers
    $depts | ConvertTo-Json -Depth 3
} catch { Write-Host "ERROR: $_" }

Write-Host "`n=== /labs/ ==="
try {
    $labs = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/labs/' -Headers $headers
    $labs | ConvertTo-Json -Depth 3
} catch { Write-Host "ERROR: $_" }

Write-Host "`n=== /inventory/models ==="
try {
    $models = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/inventory/models' -Headers $headers
    $models | ConvertTo-Json -Depth 3
} catch { Write-Host "ERROR: $_" }

Write-Host "`n=== /inventory/units ==="
try {
    $units = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/inventory/units' -Headers $headers
    $units | ConvertTo-Json -Depth 3
} catch { Write-Host "ERROR: $_" }

Write-Host "`n=== /borrowing/requests ==="
try {
    $reqs = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/borrowing/requests' -Headers $headers
    $reqs | ConvertTo-Json -Depth 3
} catch { Write-Host "ERROR: $_" }

Write-Host "`n=== /borrowing/transactions ==="
try {
    $txns = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/borrowing/transactions' -Headers $headers
    $txns | ConvertTo-Json -Depth 3
} catch { Write-Host "ERROR: $_" }

# Test reject endpoint (should 404 or 405 since not implemented)
Write-Host "`n=== /borrowing/requests/9999/reject (expect error) ==="
try {
    Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/borrowing/requests/9999/reject' -Method POST -Headers $headers -ContentType 'application/json' -Body '{"reason":"test"}'
} catch {
    Write-Host "Expected error: $($_.Exception.Response.StatusCode) - $_"
}

# Test departments GET without auth (should succeed since no auth guard)
Write-Host "`n=== /departments/ (no auth) ==="
try {
    $deptsNoAuth = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/departments/'
    Write-Host "Returned $($deptsNoAuth.Count) departments WITHOUT auth"
} catch { Write-Host "ERROR: $_" }

# Test labs GET without auth
Write-Host "`n=== /labs/ (no auth) ==="
try {
    $labsNoAuth = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/labs/'
    Write-Host "Returned $($labsNoAuth.Count) labs WITHOUT auth"
} catch { Write-Host "ERROR: $_" }

# Test inventory/models GET without auth
Write-Host "`n=== /inventory/models (no auth) ==="
try {
    $modelsNoAuth = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/inventory/models'
    Write-Host "Returned $($modelsNoAuth.Count) models WITHOUT auth"
} catch { Write-Host "ERROR: $_" }

# Test inventory/units GET without auth
Write-Host "`n=== /inventory/units (no auth) ==="
try {
    $unitsNoAuth = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/inventory/units'
    Write-Host "Returned $($unitsNoAuth.Count) units WITHOUT auth"
} catch { Write-Host "ERROR: $_" }

# Test student login + borrowing limit
Write-Host "`n=== Student login ==="
try {
    $stuLogin = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/auth/login' -Method POST -Body "username=24CE001@charusat.edu.in&password=stu123" -ContentType 'application/x-www-form-urlencoded'
    $stuToken = $stuLogin.access_token
    $stuHeaders = @{ Authorization = "Bearer $stuToken" }
    $stuMe = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/auth/me' -Headers $stuHeaders
    Write-Host "Student: $($stuMe.name), Role: $($stuMe.role)"
    
    # Student should only see their own requests
    $stuReqs = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/borrowing/requests' -Headers $stuHeaders
    Write-Host "Student sees $($stuReqs.Count) request(s)"
} catch { Write-Host "ERROR: $_" }

# Test registration without role guard (security issue?)
Write-Host "`n=== Register attempt without auth ==="
try {
    $regBody = @{
        email = "hacker@test.com"
        password = "hack123"
        name = "Hacker"
        role = "ADMIN"
    } | ConvertTo-Json
    $reg = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/auth/register' -Method POST -Body $regBody -ContentType 'application/json'
    Write-Host "SECURITY ISSUE: Registered admin without auth: $($reg | ConvertTo-Json)"
} catch { Write-Host "Registration blocked or failed: $_" }

Write-Host "`nAll tests complete."
