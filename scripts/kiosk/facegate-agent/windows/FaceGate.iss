; FaceGate Windows installer — built by .github/workflows/build-facegate.yml
; One FaceGateSetup.exe: no Python, no .bat. Asks the Device Key once and writes facegate.env.
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef SiteUrl
  #define SiteUrl "https://bngss.lovable.app"
#endif

[Setup]
AppId={{8C2F4D7A-5B1E-4E3A-9F21-FACE6A7E0001}
AppName=BNG FaceGate
AppVersion={#AppVersion}
AppPublisher=Bng Smart School
DefaultDirName={autopf}\BNG FaceGate
DefaultGroupName=BNG FaceGate
DisableProgramGroupPage=yes
OutputDir=..\..\..\..\dist-facegate
OutputBaseFilename=FaceGateSetup
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
UninstallDisplayName=BNG FaceGate
CloseApplications=force

[Files]
Source: "..\..\..\..\dist-facegate\FaceGate\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

Source: "optimize-kiosk.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "update-facegate.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\BNG FaceGate"; Filename: "{app}\FaceGate.exe"; WorkingDir: "{app}"
Name: "{group}\BNG FaceGate"; Filename: "{app}\FaceGate.exe"; WorkingDir: "{app}"
Name: "{group}\ถอนการติดตั้ง BNG FaceGate"; Filename: "{uninstallexe}"
Name: "{commonstartup}\BNG FaceGate"; Filename: "{app}\FaceGate.exe"; WorkingDir: "{app}"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\optimize-kiosk.ps1"""; StatusMsg: "กำลังปรับ Windows ให้เหมาะกับเครื่องสแกน (พลังงาน/ความเร็ว)..."; Flags: runhidden waituntilterminated
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""BNG FaceGate"" dir=in action=allow program=""{app}\FaceGate.exe"" enable=yes"; Flags: runhidden
Filename: "{app}\FaceGate.exe"; Description: "เปิดโปรแกรมสแกนหน้าตอนนี้"; Flags: nowait postinstall
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""$a=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File """"{app}\update-facegate.ps1""""'; $t=New-ScheduledTaskTrigger -Daily -At 3am; $p=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Highest; Register-ScheduledTask -TaskName 'BNG FaceGate Update' -Action $a -Trigger $t -Principal $p -Force"""; Flags: runhidden waituntilterminated

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM FaceGate.exe"; Flags: runhidden; RunOnceId: "KillFaceGate"
Filename: "{sys}\schtasks.exe"; Parameters: "/Delete /TN ""BNG FaceGate Update"" /F"; Flags: runhidden; RunOnceId: "RemoveUpdateTask"
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""BNG FaceGate"""; Flags: runhidden; RunOnceId: "FwFaceGate"

[Code]
var
  KeyPage: TInputQueryWizardPage;

function ExistingKey(): String;
var
  Lines: TArrayOfString;
  I: Integer;
begin
  Result := '';
  if LoadStringsFromFile(ExpandConstant('{app}\facegate.env'), Lines) then
    for I := 0 to GetArrayLength(Lines) - 1 do
      if Pos('FACEGATE_DEVICE_KEY=', Lines[I]) = 1 then
        Result := Copy(Lines[I], 21, Length(Lines[I]));
end;

procedure InitializeWizard();
begin
  KeyPage := CreateInputQueryPage(wpSelectDir, 'รหัสเครื่องสแกน',
    'ใส่รหัสเครื่อง (Device Key) จากหน้า ตั้งค่าเครื่องสแกน ในระบบหลังบ้าน',
    'ถ้าเว้นว่าง จะใช้เป็นเครื่องสแกนแบบออฟไลน์ (เก็บข้อมูลในเครื่องนี้)');
  KeyPage.Add('Device Key:', False);
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = KeyPage.ID) and (KeyPage.Values[0] = '') then
    KeyPage.Values[0] := ExistingKey();
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Key, Body: String;
  RC: Integer;
begin
  if CurStep = ssInstall then
    Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM FaceGate.exe', '', SW_HIDE, ewWaitUntilTerminated, RC);
  if CurStep = ssPostInstall then
  begin
    if FileExists(ExpandConstant('{app}\facegate.env')) then Exit;
    Key := Trim(KeyPage.Values[0]);
    Body := 'FACEGATE_SITE_URL={#SiteUrl}' + #13#10 + 'FACEGATE_CLOUD_URL=https://dlkyxvhnnffblerwedjz.supabase.co/functions/v1' + #13#10 + 'FACEGATE_AUTO_UPDATE=1' + #13#10;
    if Key = '' then
      Body := Body + 'FACEGATE_STANDALONE=1' + #13#10
    else
      Body := Body + 'FACEGATE_DEVICE_KEY=' + Key + #13#10;
    SaveStringToFile(ExpandConstant('{app}\facegate.env'), Body, False);
  end;
end;
