Add-Type -AssemblyName System.Drawing

$srcPath = "D:\poietik projects\bakery-demo\frontend\public\hero\cake-whole.png"
$heroDir = "D:\poietik projects\bakery-demo\frontend\public\hero"

$src = [System.Drawing.Bitmap]::FromFile($srcPath)
$w = $src.Width
$h = $src.Height

# Tier cuts directly from the single cake image:
# Top tier: Y 0 to 342 (height 343)
# Middle tier: Y 343 to 584 (height 242)
# Bottom tier: Y 585 to 945 (height 361)

function Export-Segment($name, $yStart, $yEnd) {
    $segH = $yEnd - $yStart + 1
    $rect = New-Object System.Drawing.Rectangle(0, $yStart, $w, $segH)
    $cropped = $src.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    
    # Also find tight horizontal bounding box
    $minX = $w; $maxX = 0
    for ($y = 0; $y -lt $segH; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            if ($cropped.GetPixel($x, $y).A -gt 20) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
            }
        }
    }
    
    $outPath = "$heroDir\$name"
    $cropped.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "Saved $name ($w x $segH), Cake X range: $minX to $maxX (Width: $($maxX - $minX))"
    $cropped.Dispose()
}

Export-Segment "real-tier-top.png" 0 342
Export-Segment "real-tier-middle.png" 343 584
Export-Segment "real-tier-bottom.png" 585 945

$src.Dispose()
