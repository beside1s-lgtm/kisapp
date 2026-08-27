Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\KOREAN\.gemini\antigravity\brain\8ce55897-03e7-4dd6-8759-22f41a45440e\.user_uploaded\media_1787805401736.png"
$dstPath = "C:\myapp\kisapp\public\images\original_copy_stamp.png"

$img = [System.Drawing.Image]::FromFile($srcPath)
$bmp = New-Object System.Drawing.Bitmap($img)

$minX = $bmp.Width
$minY = $bmp.Height
$maxX = 0
$maxY = 0

for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -lt 220 -or $c.G -lt 220 -or $c.B -lt 220) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Host "Bounding box: $minX, $minY, $maxX, $maxY"
$width = $maxX - $minX + 1
$height = $maxY - $minY + 1

$cropped = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($cropped)
$rectDest = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
$rectSrc = New-Object System.Drawing.Rectangle($minX, $minY, $width, $height)
$g.DrawImage($bmp, $rectDest, $rectSrc, [System.Drawing.GraphicsUnit]::Pixel)

$cropped.MakeTransparent([System.Drawing.Color]::White)
$cropped.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$cropped.Dispose()
$bmp.Dispose()
$img.Dispose()

Write-Host "Success! Created $dstPath ($width x $height)"
