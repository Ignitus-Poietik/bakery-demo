Add-Type -AssemblyName System.Drawing

$heroDir = "D:\poietik projects\bakery-demo\frontend\public\hero"

# Create a test composite by stacking the 3 slices together onto a 631 x 946 canvas
$canvas = New-Object System.Drawing.Bitmap(631, 946, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($canvas)

$top = [System.Drawing.Bitmap]::FromFile("$heroDir\real-tier-top.png")
$mid = [System.Drawing.Bitmap]::FromFile("$heroDir\real-tier-middle.png")
$bot = [System.Drawing.Bitmap]::FromFile("$heroDir\real-tier-bottom.png")

# Draw bottom at Y=585
$g.DrawImage($bot, 0, 585, $bot.Width, $bot.Height)
# Draw middle at Y=343
$g.DrawImage($mid, 0, 343, $mid.Width, $mid.Height)
# Draw top at Y=0
$g.DrawImage($top, 0, 0, $top.Width, $top.Height)

$canvas.Save("D:\poietik projects\bakery-demo\scratch\reconstructed-cake.png", [System.Drawing.Imaging.ImageFormat]::Png)

$top.Dispose(); $mid.Dispose(); $bot.Dispose(); $g.Dispose(); $canvas.Dispose()
Write-Output "Saved scratch\reconstructed-cake.png"
