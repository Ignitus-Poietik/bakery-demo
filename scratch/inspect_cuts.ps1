Add-Type -AssemblyName System.Drawing

$file = "D:\poietik projects\bakery-demo\frontend\public\hero\cake-whole.png"
$bmp = [System.Drawing.Bitmap]::FromFile($file)
$w = $bmp.Width
$h = $bmp.Height

# Print rows around tier 1 to tier 2 transition (around Y: 300 - 360)
Write-Output "--- Transition 1 (Top -> Middle) ---"
for ($y = 295; $y -le 355; $y += 3) {
    $minX = 9999; $maxX = -1
    for ($x = 0; $x -lt $w; $x++) {
        if ($bmp.GetPixel($x, $y).A -gt 30) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
        }
    }
    Write-Output "Y: $y -> Width: $($maxX - $minX) (X: $minX to $maxX)"
}

Write-Output "--- Transition 2 (Middle -> Bottom) ---"
for ($y = 570; $y -le 630; $y += 3) {
    $minX = 9999; $maxX = -1
    for ($x = 0; $x -lt $w; $x++) {
        if ($bmp.GetPixel($x, $y).A -gt 30) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
        }
    }
    Write-Output "Y: $y -> Width: $($maxX - $minX) (X: $minX to $maxX)"
}

$bmp.Dispose()
