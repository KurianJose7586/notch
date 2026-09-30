# Long-lived Win32 helper for the notch. Reads commands on stdin, one reply line each:
#   find <pid>                   -> "<hwnd> <agentPid> <console|app> [appName]"  (walks up from pid to the agent exe, returns the window hosting it)
#   focus <hwnd>                 -> "ok"
#   fg                           -> "<hwnd>"  (top-level window you're currently in)
#   title <pid> <base64>         -> "True"    (sets that agent's terminal title; agents that set their own title will override it)
#   grid <x> <y> <w> <h> <h1,h2> -> "ok"      (tiles the windows inside that physical-pixel rect)
#   screen <pid>                 -> base64 of the visible text in that agent's terminal
#   enter <pid>                  -> "True"    (presses Enter inside that agent's terminal only)
Add-Type @"
using System; using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
[StructLayout(LayoutKind.Sequential)] public struct COORD { public short X, Y; }
[StructLayout(LayoutKind.Sequential)] public struct SMALL_RECT { public short Left, Top, Right, Bottom; }
[StructLayout(LayoutKind.Sequential)] public struct CSBI { public COORD Size; public COORD Cursor; public ushort Attr; public SMALL_RECT Window; public COORD MaxSize; }
[StructLayout(LayoutKind.Explicit)] public struct KEY_INPUT {  // INPUT_RECORD holding a KEY_EVENT_RECORD
  [FieldOffset(0)] public ushort EventType; [FieldOffset(4)] public int KeyDown; [FieldOffset(8)] public ushort Repeat;
  [FieldOffset(10)] public ushort VKey; [FieldOffset(12)] public ushort Scan; [FieldOffset(14)] public char Char; [FieldOffset(16)] public uint Ctrl;
}
public static class W {
  [DllImport("kernel32", CharSet = CharSet.Unicode)] public static extern IntPtr CreateFile(string name, uint access, uint share, IntPtr sec, uint disp, uint flags, IntPtr tmpl);
  [DllImport("kernel32")] public static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32")] public static extern bool GetConsoleScreenBufferInfo(IntPtr h, out CSBI info);
  [DllImport("kernel32", CharSet = CharSet.Unicode)] public static extern bool ReadConsoleOutputCharacter(IntPtr h, System.Text.StringBuilder s, uint len, COORD at, out uint read);
  [DllImport("kernel32", EntryPoint = "WriteConsoleInputW")] public static extern bool WriteConsoleInput(IntPtr h, KEY_INPUT[] recs, uint n, out uint written);
  [DllImport("kernel32")] public static extern bool AttachConsole(uint pid);
  [DllImport("kernel32")] public static extern bool FreeConsole();
  [DllImport("kernel32")] public static extern IntPtr GetConsoleWindow();
  [DllImport("kernel32", CharSet = CharSet.Unicode)] public static extern bool SetConsoleTitle(string title);
  [DllImport("user32")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32")] public static extern bool SetProcessDpiAwarenessContext(IntPtr ctx);
  [DllImport("dwmapi")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
  [DllImport("user32")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
}
"@
[W]::SetProcessDpiAwarenessContext([IntPtr]-4) | Out-Null  # per-monitor v2: grid coordinates are physical pixels
$out = [Console]::Out  # bind stdout to our pipe before any AttachConsole

function Find($p) {
  for ($i = 0; $i -lt 8 -and $p; $i++) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$p"
    if (-not $proc) { break }
    # CLI agents, plus the editors whose built-in agents report too (VS Code Copilot, Antigravity IDE)
    if ($proc.Name -match '^(claude|agy|opencode|kilo|code|antigravity)') {
      [W]::FreeConsole() | Out-Null
      $h = [IntPtr]::Zero
      if ([W]::AttachConsole($p)) { $h = [W]::GetConsoleWindow(); [W]::FreeConsole() | Out-Null }
      if ($h -ne [IntPtr]::Zero) { return "$([W]::GetAncestor($h, 3)) $p console" }  # GA_ROOTOWNER: pseudo-console -> Windows Terminal window
      # No console: the agent lives inside a GUI app (Claude desktop, VS Code, Antigravity IDE). Its window belongs to
      # the nearest ancestor that has one; editors nest helper processes a level or two deep.
      $up = Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.ParentProcessId)"  # the agent itself may own hidden windows
      for ($j = 0; $j -lt 4 -and $up; $j++) {
        $gp = Get-Process -Id $up.ProcessId -ErrorAction SilentlyContinue
        if ($gp -and $gp.MainWindowHandle -ne 0 -and [W]::IsWindowVisible($gp.MainWindowHandle)) { return "$($gp.MainWindowHandle) $p app $($gp.ProcessName)" }
        $up = Get-CimInstance Win32_Process -Filter "ProcessId=$($up.ParentProcessId)"
      }
      return "0 $p"
    }
    $p = $proc.ParentProcessId
  }
  "0 0"
}

function Focus($h) {
  if ([W]::IsIconic($h)) { [W]::ShowWindow($h, 9) | Out-Null }  # SW_RESTORE
  [W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)  # Alt tap unlocks SetForegroundWindow
  [W]::SetForegroundWindow($h) | Out-Null
}

# Opens another process's console device (CONIN$ / CONOUT$) while attached to it. Caller frees the console.
function Con($p, $name) {
  [W]::FreeConsole() | Out-Null
  if (-not [W]::AttachConsole([uint32]$p)) { return [IntPtr]::Zero }
  [W]::CreateFile($name, [uint32]3221225472, 3, [IntPtr]::Zero, 3, 0, [IntPtr]::Zero)  # GENERIC_READ|WRITE (0xC0000000; PS reads that literal as negative), shared, OPEN_EXISTING
}

function Screen($p) { # the visible text of that agent's terminal
  $h = Con $p 'CONOUT$'; $text = ''
  $info = New-Object CSBI
  if ($h -ne [IntPtr]-1 -and $h -ne [IntPtr]::Zero -and [W]::GetConsoleScreenBufferInfo($h, [ref]$info)) {
    $w = $info.Window.Right - $info.Window.Left + 1
    $lines = for ($y = $info.Window.Top; $y -le $info.Window.Bottom; $y++) {
      $sb = New-Object Text.StringBuilder $w; $at = New-Object COORD; $at.X = $info.Window.Left; $at.Y = $y; $n = 0
      [W]::ReadConsoleOutputCharacter($h, $sb, $w, $at, [ref]$n) | Out-Null; $sb.ToString().TrimEnd()
    }
    $text = $lines -join "`n"
  }
  if ($h -ne [IntPtr]-1) { [W]::CloseHandle($h) | Out-Null }
  [W]::FreeConsole() | Out-Null
  [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text))
}

function Enter($p) { # types Enter into that agent's own input queue: no focus change, nothing reaches other windows
  $h = Con $p 'CONIN$'; $ok = $false
  if ($h -ne [IntPtr]-1 -and $h -ne [IntPtr]::Zero) {
    $keys = foreach ($isDown in 1, 0) {
      $k = New-Object KEY_INPUT; $k.EventType = 1; $k.KeyDown = $isDown; $k.Repeat = 1; $k.VKey = 0x0D; $k.Scan = 0x1C; $k.Char = [char]13; $k
    }
    $n = 0; $ok = [W]::WriteConsoleInput($h, [KEY_INPUT[]]$keys, 2, [ref]$n)
    [W]::CloseHandle($h) | Out-Null
  }
  [W]::FreeConsole() | Out-Null
  "$ok"
}

function Grid($x, $y, $w, $h, $list) {
  $hs = $list -split ',' | ForEach-Object { [IntPtr][int64]$_ }
  $n = $hs.Count; $cols = [Math]::Ceiling([Math]::Sqrt($n)); $rows = [Math]::Ceiling($n / $cols); $gap = 10
  $ch = [int](($h - $gap * ($rows + 1)) / $rows)
  for ($i = 0; $i -lt $n; $i++) {
    $r = [Math]::Floor($i / $cols); $c = $i % $cols
    $inRow = [Math]::Min($cols, $n - $r * $cols)  # last row stretches to fill the width
    $cw = [int](($w - $gap * ($inRow + 1)) / $inRow)
    $hw = $hs[$i]
    [W]::ShowWindow($hw, 9) | Out-Null  # restore minimized / maximized so it can be moved
    # Windows 10/11 windows carry invisible resize borders; size the visible frame, not the raw rect.
    $wr = New-Object RECT; $fr = New-Object RECT
    [W]::GetWindowRect($hw, [ref]$wr) | Out-Null
    if ([W]::DwmGetWindowAttribute($hw, 9, [ref]$fr, 16) -ne 0) { $fr = $wr }  # DWMWA_EXTENDED_FRAME_BOUNDS
    $l = $fr.Left - $wr.Left; $t = $fr.Top - $wr.Top; $rr = $wr.Right - $fr.Right; $b = $wr.Bottom - $fr.Bottom
    $px = $x + $gap + $c * ($cw + $gap); $py = $y + $gap + $r * ($ch + $gap)
    [W]::SetWindowPos($hw, [IntPtr]::Zero, $px - $l, $py - $t, $cw + $l + $rr, $ch + $t + $b, 0x14) | Out-Null  # NOZORDER | NOACTIVATE
  }
  foreach ($hw in $hs) { Focus $hw }  # raise them all above whatever was on screen
}

while ($null -ne ($line = [Console]::In.ReadLine())) {
  $cmd, $arg = $line -split ' ', 2
  try {
    switch ($cmd) {
      'find'  { $out.WriteLine((Find ([uint32]$arg))) }
      'focus' { Focus ([IntPtr][int64]$arg); $out.WriteLine('ok') }
      'fg'    { $out.WriteLine([W]::GetAncestor([W]::GetForegroundWindow(), 3)) }
      'title' { # title <pid> <base64 utf8>: rename that agent's terminal tab
        $p, $b64 = $arg -split ' ', 2
        [W]::FreeConsole() | Out-Null
        $ok = [W]::AttachConsole([uint32]$p) -and [W]::SetConsoleTitle([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64)))
        [W]::FreeConsole() | Out-Null
        $out.WriteLine("$ok")
      }
      'screen' { $out.WriteLine((Screen $arg)) }
      'enter' { $out.WriteLine((Enter $arg)) }
      'grid'  { $a = $arg -split ' '; Grid ([int]$a[0]) ([int]$a[1]) ([int]$a[2]) ([int]$a[3]) $a[4]; $out.WriteLine('ok') }
      default { $out.WriteLine('?') }
    }
  } catch { [Console]::Error.WriteLine("$cmd failed: $_"); $out.WriteLine('0 0') }
  $out.Flush()
}
