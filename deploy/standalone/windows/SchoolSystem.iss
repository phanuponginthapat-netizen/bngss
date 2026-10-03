; ตัวติดตั้ง setup.exe สำหรับระบบโรงเรียนแบบติดตั้งในโรงเรียน (Inno Setup 6)
; สร้างอัตโนมัติด้วย GitHub Actions: .github/workflows/build-standalone-installer.yml
#define AppName "ระบบสารสนเทศโรงเรียน (ติดตั้งในโรงเรียน)"
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{B6F7C1E2-6D3A-4E8B-9C1A-5BNGSS0001}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={autopf}\SchoolSystem
DefaultGroupName=ระบบโรงเรียน
OutputBaseFilename=school-system-setup
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\..\..\stage\*"; DestDir: "{app}\src"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\เปิดระบบโรงเรียน"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\src\deploy\standalone\windows\tools.ps1"" -Action open"
Name: "{group}\สำรองข้อมูล"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\src\deploy\standalone\windows\tools.ps1"" -Action backup"
Name: "{group}\กู้คืนข้อมูล"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\src\deploy\standalone\windows\tools.ps1"" -Action restore"
Name: "{group}\อัปเดตระบบ"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\src\deploy\standalone\windows\tools.ps1"" -Action update"
Name: "{group}\ตั้งผู้ดูแลระบบ"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\src\deploy\standalone\windows\tools.ps1"" -Action make-admin"
Name: "{group}\ถอนการติดตั้ง"; Filename: "{uninstallexe}"
Name: "{commondesktop}\ระบบโรงเรียน"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\src\deploy\standalone\windows\tools.ps1"" -Action open"

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\src\deploy\standalone\install-windows.ps1"" -Mode {code:GetMode} -DataDir ""{code:GetDataDir}"""; StatusMsg: "กำลังติดตั้งฐานข้อมูลและระบบ (10–30 นาที)..."; Flags: waituntilterminated
Filename: "cmd.exe"; Parameters: "/c mkdir ""{commonappdata}\SchoolSystem"" & copy /y ""{code:GetDataDir}\server-ip.txt"" ""{commonappdata}\SchoolSystem\"""; Flags: runhidden

[Code]
var
  ModePage: TInputOptionWizardPage;
  DirPage: TInputDirWizardPage;

procedure InitializeWizard;
begin
  ModePage := CreateInputOptionPage(wpSelectDir, 'รูปแบบการใช้งาน', 'เลือกว่าจะใช้ระบบอย่างไร', '', True, False);
  ModePage.Add('ใช้ในโรงเรียนอย่างเดียว (ไม่ใช้ Cloud)');
  ModePage.Add('แบบผสม (ใช้ในโรงเรียน + สำรองขึ้น Cloud เมื่อมีเน็ต)');
  ModePage.SelectedValueIndex := 0;
  DirPage := CreateInputDirPage(ModePage.ID, 'ที่เก็บข้อมูล', 'เลือกโฟลเดอร์บน HDD สำหรับเก็บฐานข้อมูล ไฟล์ และไฟล์สำรอง', 'แนะนำไดรฟ์ที่มีพื้นที่ว่างอย่างน้อย 50 GB', False, '');
  DirPage.Add('');
  DirPage.Values[0] := 'C:\SchoolData';
end;

function GetMode(Param: String): String;
begin
  if ModePage.SelectedValueIndex = 1 then Result := 'hybrid' else Result := 'standalone';
end;

function GetDataDir(Param: String): String;
begin
  Result := DirPage.Values[0];
end;
