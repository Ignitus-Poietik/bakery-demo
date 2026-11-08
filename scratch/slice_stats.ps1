Add-Type -AssemblyName System.Drawing

$file = "D:\poietik projects\bakery-demo\frontend\public\hero\cake-whole.png"
$bmp = [System.Drawing.Bitmap]::FromFile($file)
$w = $bmp.Width
$h = $bmp.Height
Write-Output "Dimensions: $w x $h"

# Find width of the cake at each row (min X and max X where alpha > 30)
$rowStats = @()
for ($y = 0; $y -lt $h; $y += 2) {
    $minX = 9999
    $maxX = -1
    for ($x = 0; $x -lt $w; $x += 2) {
        $pixel = $bmp.GetPixel($x, $y)
        if ($pixel.A -gt 30) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
        }
    }
    if ($maxX -ge $minX) {
        $rowStats += [PSCustomObject]@{ Y = $y; Width = ($maxX - $minX); MinX = $minX; MaxX = $maxX }
    }
}

Write-Output "First visible row: $($rowStats[0].Y), Last visible row: $($rowStats[-1].Y)"

# Sample every 50 pixels in height to see tier boundaries (steps in width!)
for ($i = 0; $i -lt $rowStats.Count; $i += 15) {
    $r = $rowStats[$i]
    Write-Output "Y: $($r.Y) -> Width: $($r.Width) (X: $($r.MinX) to $($r.MaxX))"
}

$bmp.Dispose()
