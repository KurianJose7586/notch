; Uninstall: take the notch's hooks back out of every agent's config before the files go, or agents would keep
; calling an exe that no longer exists (agy fails every tool call when a hook can't run). Skipped on upgrades,
; where the new version keeps using the same hooks.
!macro customUnInit
  ${ifNot} ${isUpdated}
    ExecWait '"$INSTDIR\agent-notch.exe" --disconnect'
  ${endIf}
!macroend
