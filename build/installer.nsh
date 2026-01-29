!macro customInstall
  Section -SetEnv
    WriteRegStr HKCU "Environment" "GH_TOKEN" "__REPLACE_WITH_GH_TOKEN__"
    SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
  SectionEnd
!macroend
