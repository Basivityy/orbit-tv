# Orbit TV end-to-end check on the CI runner: fake Xtream server + real app + keyboard/mouse,
# screenshots saved to ci-logs/screens (published on the ci-logs branch).
param([string]$Exe = "build\windows\x64\runner\Release\OrbitTV.exe")
$ErrorActionPreference = 'Continue'
$out = Join-Path (Get-Location) "ci-logs\screens"
New-Item -ItemType Directory -Force $out | Out-Null

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class W {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int d, int e);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

function Shot([string]$name) {
  try {
    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
    $bmp.Save((Join-Path $out "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Host "shot $name"
  } catch { Write-Host "shot $name failed: $_" }
}

$ws = New-Object -ComObject wscript.shell
function Focus-App { if ($script:app -and -not $script:app.HasExited) { $script:app.Refresh(); [W]::SetForegroundWindow($script:app.MainWindowHandle) | Out-Null; Start-Sleep -Milliseconds 300 } }
function Keys([string]$k, [int]$waitMs = 400) { Focus-App; $ws.SendKeys($k); Start-Sleep -Milliseconds $waitMs }
function Click-Rel([double]$x, [double]$y) {
  Focus-App
  $r = New-Object W+RECT
  [W]::GetWindowRect($script:app.MainWindowHandle, [ref]$r) | Out-Null
  [W]::SetCursorPos([int]($r.Left + $x), [int]($r.Top + $y)) | Out-Null
  Start-Sleep -Milliseconds 150
  [W]::mouse_event(0x0002, 0, 0, 0, 0); Start-Sleep -Milliseconds 60; [W]::mouse_event(0x0004, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 500
}

# Saved account → the app signs in by itself (same file shared_preferences uses).
$prefsDir = Join-Path $env:APPDATA "Orbitex FZE LLC\Orbit TV"
New-Item -ItemType Directory -Force $prefsDir | Out-Null
$account = '{"server":"http://127.0.0.1:8899","username":"ciuser","password":"cipass"}'
@{ "flutter.account" = $account; "flutter.deviceId" = "win-ci-test" } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $prefsDir "shared_preferences.json")

Write-Host "screen: $([System.Windows.Forms.Screen]::PrimaryScreen.Bounds)"
$script:app = Start-Process -FilePath $Exe -PassThru -RedirectStandardOutput "ci-logs\app-stdout.txt" -RedirectStandardError "ci-logs\app-stderr.txt"
Start-Sleep -Seconds 25
$app.Refresh()
[W]::ShowWindow($app.MainWindowHandle, 3) | Out-Null   # maximize
Start-Sleep -Seconds 3
Shot "01-home"

# Hero button "Gledaj uživo" has focus → Enter plays the channel.
Keys "{ENTER}" 12000
Shot "02-player-live"
Keys "{SCROLLLOCK}" 900
Shot "03-player-osd"
# Rewind with the arrow keys: preview bubble with frames while scrubbing.
Keys "{LEFT}" 120; Keys "{LEFT}" 120; Keys "{LEFT}" 120; Keys "{LEFT}" 120
Shot "04-scrub-preview"
Start-Sleep -Seconds 8
Keys "{SCROLLLOCK}" 800
Shot "05-after-rewind"
# Start over (archive) and back to live.
Keys "{HOME}" 12000
Keys "{SCROLLLOCK}" 800
Shot "06-start-over"
Keys "{LEFT}" 120; Keys "{LEFT}" 120; Keys "{LEFT}" 120
Shot "07-scrub-in-archive"
Start-Sleep -Seconds 6
Keys "{END}" 10000
Keys "{SCROLLLOCK}" 800
Shot "08-back-live"
# Channel list, zap to the interlaced channel.
Keys "{ENTER}" 1200
Shot "09-channel-drawer"
Keys "{DOWN}" 300; Keys "{DOWN}" 300; Keys "{ENTER}" 12000
Keys "{SCROLLLOCK}" 800
Shot "10-zap-interlaced"
Keys "{UP}" 9000
Shot "11-zap-up"
Keys "a" 1200
Shot "12-tracks"
Keys "{ESC}" 600
Keys "{ESC}" 2500
Shot "13-back-home"

# Sections from the sidebar (logical px; window maximized at its position).
$items = @{ "14-live" = 1; "15-guide" = 2; "16-movies" = 3; "17-series" = 4; "18-search" = 5 }
foreach ($k in ($items.Keys | Sort-Object)) {
  $i = $items[$k]
  Click-Rel 60 (142 + $i * 71)
  Start-Sleep -Seconds 6
  Shot $k
}
Click-Rel 60 ($([System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea.Height) - 60)
Start-Sleep -Seconds 3
Shot "19-settings"

# A movie from the movies grid.
Click-Rel 60 (142 + 3 * 71)
Start-Sleep -Seconds 3
Click-Rel 240 330
Start-Sleep -Seconds 4
Shot "20-movie-detail"
Keys "{ENTER}" 10000
Keys "{SCROLLLOCK}" 800
Shot "21-movie-playing"
Keys "{RIGHT}" 150; Keys "{RIGHT}" 150; Keys "{RIGHT}" 150
Shot "22-movie-scrub"
Start-Sleep -Seconds 5
Keys "{ESC}" 2000
Shot "23-movie-back"

if (-not $app.HasExited) { $app.CloseMainWindow() | Out-Null; Start-Sleep -Seconds 3 }
if (-not $app.HasExited) { Stop-Process -Id $app.Id -Force }
Start-Sleep -Seconds 1
Get-ChildItem $out | Format-Table Name, Length
