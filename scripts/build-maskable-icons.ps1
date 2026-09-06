# Deterministic rasterization of the existing favicon.svg artwork.
# Only canvas/background/scale change; normal icons and favicon remain intact.
Add-Type -AssemblyName System.Drawing
$iconDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../src/icons'))
foreach ($size in 192, 512) {
    $bitmap = [Drawing.Bitmap]::new($size, $size)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#164e63'))
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    # Logo bounds in favicon coordinates: x=11..53, y~=13.3..54.
    # Centre the artwork, then scale to fit well inside the radius-40% safe zone.
    $scale = [single]($size / 64 * 0.72)
    $graphics.TranslateTransform([single]($size / 2), [single]($size / 2))
    $graphics.ScaleTransform($scale, $scale)
    $graphics.TranslateTransform(-32, -33.65)
    $ink = [Drawing.ColorTranslator]::FromHtml('#f8fafc')
    $outline = [Drawing.Drawing2D.GraphicsPath]::new()
    $outline.AddBezier(13,17,20,14,26,15,32,20)
    $outline.AddBezier(32,20,38,15,44,14,51,17)
    $outline.AddLine(51,17,51,49)
    $outline.AddBezier(51,49,44,46,38,47,32,52)
    $outline.AddBezier(32,52,26,47,20,46,13,49)
    $outline.CloseFigure()
    $pen = [Drawing.Pen]::new($ink, 4)
    $pen.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
    $graphics.DrawPath($pen, $outline)
    $pen.Dispose()
    $route = [Drawing.Drawing2D.GraphicsPath]::new()
    $route.AddLine(32,20,32,52)
    $route.StartFigure()
    $route.AddBezier(19,41,23,31,27,37,32,28)
    $route.AddBezier(32,28,37,37,41,31,45,41)
    $pen = [Drawing.Pen]::new($ink, 3)
    $pen.StartCap = $pen.EndCap = [Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawPath($pen, $route)
    $orange = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#fb923c'))
    $graphics.FillEllipse($orange, 15,37,8,8)
    $graphics.FillEllipse($orange, 41,37,8,8)
    $bitmap.Save((Join-Path $iconDirectory "trailbook-maskable-$size.png"), [Drawing.Imaging.ImageFormat]::Png)
    $orange.Dispose(); $pen.Dispose(); $outline.Dispose(); $route.Dispose()
    $graphics.Dispose(); $bitmap.Dispose()
}
