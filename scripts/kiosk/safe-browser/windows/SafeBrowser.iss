; BNG Safe Browser for Windows — built by .github/workflows/build-safe-browser.yml
; Bundles Chrome for Testing + the school extension; kiosk full-screen at every Windows sign-in.
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

[Icons]
Name: "{autodesktop}\BNG Safe Browser"; Filename: "{app}\SafeBrowser.exe"; WorkingDir: "{app}"
Name: "{commonstartup}\BNG Safe Browser"; Filename: "{app}\SafeBrowser.exe"; WorkingDir: "{app}"

[Run]
Filename: "{app}\SafeBrowser.exe"; Description: "เปิด BNG Safe Browser ตอนนี้"; Flags: nowait postinstall

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /T /IM SafeBrowser.exe"; Flags: runhidden; RunOnceId: "KillSafeBrowser"

[Code]
var
  KeyPage: TInputQueryWizardPage;
  ModePage: TInputOptionWizardPage;

procedure InitializeWizard();
begin
  KeyPage := CreateInputQueryPage(wpSelectDir, 'รหัสเครื่อง',
    'ใส่รหัสเครื่อง (Device Key) จากหน้า ตั้งค่าเครื่องสแกน ในระบบหลังบ้าน',
    'จำเป็นสำหรับการสแกนบัตรบุคลากรเพื่อออกจากโปรแกรม และการสั่งปิดเครื่องจากระบบหลัก');
  KeyPage.Add('Device Key:', False);
  ModePage := CreateInputOptionPage(KeyPage.ID, 'รูปแบบการเปิด', 'เลือกการแสดงผล', '', True, False);
  ModePage.Add('โหมดคีออส เต็มจอ ล็อกปุ่มลัด (แนะนำสำหรับเครื่องนักเรียน)');
  ModePage.Add('หน้าต่างปกติ (สำหรับทดสอบ)');
  ModePage.SelectedValueIndex := 0;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = KeyPage.ID) and (Trim(KeyPage.Values[0]) = '') and not FileExists(ExpandConstant('{app}\safebrowser.env')) then
  begin
    MsgBox('กรุณาใส่ Device Key — หากไม่มีจะออกจากโปรแกรมด้วยบัตรไม่ได้', mbError, MB_OK);
    Result := False;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Body: String;
  RC: Integer;
begin
  if CurStep = ssInstall then
    Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /T /IM SafeBrowser.exe', '', SW_HIDE, ewWaitUntilTerminated, RC);
  if (CurStep = ssPostInstall) and (Trim(KeyPage.Values[0]) <> '') then
  begin
    Body := 'SAFEBROWSER_HOME_URL=https://bngss.online' + #13#10 +
            'SAFEBROWSER_CLOUD_URL=https://dlkyxvhnnffblerwedjz.supabase.co/functions/v1' + #13#10 +
            'SAFEBROWSER_DEVICE_KEY=' + Trim(KeyPage.Values[0]) + #13#10;
    if ModePage.SelectedValueIndex = 1 then Body := Body + 'SAFEBROWSER_KIOSK=0' + #13#10;
    SaveStringToFile(ExpandConstant('{app}\safebrowser.env'), Body, False);
  end;
end;
