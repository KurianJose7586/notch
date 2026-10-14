; Uninstall: take the notch's hooks back out of every agent's config before the files go, or agents would keep
; calling an exe that no longer exists (agy fails every tool call when a hook can't run). Skipped on upgrades,
; where the new version keeps using the same hooks.
!macro customUnInit
  ${ifNot} ${isUpdated}
    ExecWait '"$INSTDIR\agent-notch.exe" --disconnect'
  ${endIf}
!macroend

; Closing the running app before files are replaced (installer and uninstaller). electron-builder's default starts
; PowerShell five or more times for this (1-2 s each, plus retry sleeps), and does it all again in the old version's
; uninstaller. taskkill takes 0.1 s. Every agent-notch.exe of this user is ours: the notch, and the hooks and
; team-message tools agents run with it, which would otherwise keep its files locked.
!macro customCheckAppRunning
  nsExec::Exec `"$SYSDIR\cmd.exe" /C taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`
  Pop $0
  Sleep 300 ; Windows lets go of a killed exe's files a moment later
!macroend
