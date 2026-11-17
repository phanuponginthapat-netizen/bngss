; BNG Safe Browser for Windows — built by .github/workflows/build-safe-browser.yml
; Uses installed Chrome (extension from ZIP) or bundled Chrome for Testing + the shipped extension; Wi-Fi native helper; kiosk full-screen at every Windows sign-in.
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{5B6E2C71-3A9D-4F0B-8E12-5AFEB0000001}
AppName=BNG Safe Browser
AppVersion={#AppVersion}
AppPublisher=Bng Smart School
DefaultDirName={autopf}\BNG Safe Browser
DisableProgramGroupPage=yes
OutputDir=..\..\..\..\dist-safebrowser
OutputBaseFilename=SafeBrowserSetup
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
UninstallDisplayName=BNG Safe Browser
CloseApplications=force

[Files]
Source: "..\..\..\..\dist-safebrowser\SafeBrowser\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\..\..\dist-safebrowser\chrome\*"; DestDir: "{app}\chrome"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\..\..\extension\*"; DestDir: "{app}\extension"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\..\..\dist-safebrowser\WifiHelper\*"; DestDir: "{app}\wifi"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\wifi\com.bngss.wifi.json"; DestDir: "{app}\wifi"; Flags: ignoreversion

[Registry]
; Wi-Fi helper for the school extension (Native Messaging) — Chrome, Chrome for Testing, Edge
Root: HKLM; Subkey: "Software\Google\Chrome\NativeMessagingHosts\com.bngss.wifi"; ValueType: string; ValueName: ""; ValueData: "{app}\wifi\com.bngss.wifi.json"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Google\Chrome for Testing\NativeMessagingHosts\com.bngss.wifi"; ValueType: string; ValueName: ""; ValueData: "{app}\wifi\com.bngss.wifi.json"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Chromium\NativeMessagingHosts\com.bngss.wifi"; ValueType: string; ValueName: ""; ValueData: "{app}\wifi\com.bngss.wifi.json"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Microsoft\Edge\NativeMessagingHosts\com.bngss.wifi"; ValueType: string; ValueName: ""; ValueData: "{app}\wifi\com.bngss.wifi.json"; Flags: uninsdeletekey

[Icons]
Name: "{autodesktop}\BNG Safe Browser"; Filename: "{app}\SafeBrowser.exe"; WorkingDir: "{app}"
Name: "{commonstartup}\BNG Safe Browser"; Filename: "{app}\SafeBrowser.exe"; WorkingDir: "{app}"

[Run]
; Power/sleep buttons do nothing; the program asks for a staff card instead
Filename: "{sys}\powercfg.exe"; Parameters: "/setacvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 0"; Flags: runhidden
Filename: "{sys}\powercfg.exe"; Parameters: "/setacvalueindex SCHEME_CURRENT SUB_BUTTONS SBUTTONACTION 0"; Flags: runhidden
Filename: "{sys}\powercfg.exe"; Parameters: "/setacvalueindex SCHEME_CURRENT SUB_BUTTONS UIBUTTON_ACTION 0"; Flags: runhidden
Filename: "{sys}\powercfg.exe"; Parameters: "/setdcvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 0"; Flags: runhidden
Filename: "{sys}\powercfg.exe"; Parameters: "/setdcvalueindex SCHEME_CURRENT SUB_BUTTONS SBUTTONACTION 0"; Flags: runhidden
Filename: "{sys}\powercfg.exe"; Parameters: "/setdcvalueindex SCHEME_CURRENT SUB_BUTTONS UIBUTTON_ACTION 0"; Flags: runhidden
Filename: "{sys}\powercfg.exe"; Parameters: "/setactive SCHEME_CURRENT"; Flags: runhidden
Filename: "{app}\SafeBrowser.exe"; Description: "เปิด BNG Safe Browser ตอนนี้"; Flags: nowait postinstall

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /T /IM SafeBrowser.exe"; Flags: runhidden; RunOnceId: "KillSafeBrowser"

[Code]
var
  KeyPage: TInputQueryWizardPage;
  ModePage: TInputOptionWizardPage;

procedure InitializeWizard();
begin
  KeyPage := CreateInputQueryPage(wpSelectDir, 'รหัสเครื่อง (ไม่บังคับ)',
    'ใส่รหัสเครื่อง (Device Key) จากหน้า ตั้งค่าเครื่องสแกน ในระบบหลังบ้าน — หรือเว้นว่างไว้',
    'เครื่องนักเรียนที่ยืมไปใช้งานไม่ต้องใส่: ลงทะเบียนทีหลังได้จากหน้าสแกนบัตรในโปรแกรม ด้วยบัตรผู้บริหาร/ผู้ดูแลระบบ');
  KeyPage.Add('Device Key (เว้นว่างได้):', False);
  ModePage := CreateInputOptionPage(KeyPage.ID, 'รูปแบบการเปิด', 'เลือกการแสดงผล', '', True, False);
  ModePage.Add('โหมดคีออส เต็มจอ ล็อกปุ่มลัด (แนะนำสำหรับเครื่องนักเรียน)');
  ModePage.Add('หน้าต่างปกติ (สำหรับทดสอบ)');
  ModePage.SelectedValueIndex := 0;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Body: String;
  RC: Integer;
begin
  if CurStep = ssInstall then
    Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /T /IM SafeBrowser.exe', '', SW_HIDE, ewWaitUntilTerminated, RC);
  if CurStep = ssPostInstall then
  begin
    Body := 'SAFEBROWSER_HOME_URL=https://bngss.online' + #13#10 +
            'SAFEBROWSER_CLOUD_URL=https://dlkyxvhnnffblerwedjz.supabase.co/functions/v1' + #13#10;
    if Trim(KeyPage.Values[0]) <> '' then
      Body := Body + 'SAFEBROWSER_DEVICE_KEY=' + Trim(KeyPage.Values[0]) + #13#10;
    if ModePage.SelectedValueIndex = 1 then Body := Body + 'SAFEBROWSER_KIOSK=0' + #13#10;
    SaveStringToFile(ExpandConstant('{app}\safebrowser.env'), Body, False);
  end;
end;
