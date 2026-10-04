; ตัวติดตั้ง setup.exe สำหรับระบบโรงเรียนแบบติดตั้งในโรงเรียน (Inno Setup 6)
; สร้างอัตโนมัติด้วย GitHub Actions: .github/workflows/build-standalone-installer.yml
#define AppName "ระบบสารสนเทศโรงเรียน (ติดตั้งในโรงเรียน)"
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{B6F7C1E2-6D3A-4E8B-9C1A-5B0C55000001}
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
Name: "{group}\ใส่กุญแจบริการ (LINE-AI-Google)"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\src\deploy\standalone\windows\tools.ps1"" -Action keys"
Name: "{group}\ตั้งผู้ดูแลระบบ"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\src\deploy\standalone\windows\tools.ps1"" -Action make-admin"
Name: "{group}\ถอนการติดตั้ง"; Filename: "{uninstallexe}"
Name: "{commondesktop}\ระบบโรงเรียน"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\src\deploy\standalone\windows\tools.ps1"" -Action open"

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\src\deploy\standalone\install-windows.ps1"" -Mode {code:GetMode} -DataDir ""{code:GetDataDir}"" -AdminEmail ""{code:GetAdminEmail}"" -AdminPassword ""{code:GetAdminPass}"" -KeysFile ""{code:GetKeysFile}"""; StatusMsg: "กำลังติดตั้งฐานข้อมูลและระบบ (10–30 นาที)..."; Flags: waituntilterminated

[Code]
var
  ModePage: TInputOptionWizardPage;
  DirPage: TInputDirWizardPage;
  AdminPage: TInputQueryWizardPage;
  KeysPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  ModePage := CreateInputOptionPage(wpSelectDir, 'รูปแบบการใช้งาน', 'เลือกว่าจะใช้ระบบอย่างไร', '', True, False);
  ModePage.Add('ใช้ในโรงเรียนอย่างเดียว (ไม่ใช้ Cloud)');
  ModePage.Add('แบบผสม (ใช้ในโรงเรียน + สำรองขึ้น Cloud เมื่อมีเน็ต)');
  ModePage.SelectedValueIndex := 0;
  DirPage := CreateInputDirPage(ModePage.ID, 'ที่เก็บข้อมูล', 'เลือกโฟลเดอร์บน HDD สำหรับเก็บฐานข้อมูล ไฟล์ และไฟล์สำรอง', 'แนะนำไดรฟ์ที่มีพื้นที่ว่างอย่างน้อย 50 GB', False, '');
  DirPage.Add('');
  DirPage.Values[0] := 'D:\SchoolData';
  if not DirExists('D:\') then DirPage.Values[0] := 'C:\SchoolData';

  AdminPage := CreateInputQueryPage(DirPage.ID, 'ผู้ดูแลระบบคนแรก', 'บัญชีนี้ใช้เข้าระบบครั้งแรกและตั้งค่าทั้งหมด', '');
  AdminPage.Add('อีเมล:', False);
  AdminPage.Add('รหัสผ่าน (อย่างน้อย 10 ตัว):', True);

  KeysPage := CreateInputQueryPage(AdminPage.ID, 'กุญแจบริการที่ต้องต่อเน็ต (ไม่บังคับ)',
    'ใส่เฉพาะที่มี เว้นว่างได้ — แก้ภายหลังได้ที่เมนู Start > ใส่กุญแจบริการ หรือในระบบ ตั้งค่า > API Keys',
    'กุญแจเก็บในฐานข้อมูลบน HDD ของเครื่องนี้ ใช้เฉพาะตอนส่ง LINE / เรียก AI / สำรองขึ้น Google เท่านั้น');
  KeysPage.Add('LINE Channel Access Token:', False);
  KeysPage.Add('LINE Channel Secret:', False);
  KeysPage.Add('Gemini API Key (ผู้ช่วย AI):', False);
  KeysPage.Add('OpenAI API Key (สำรอง):', False);
  KeysPage.Add('Google OAuth Client ID:', False);
  KeysPage.Add('Google OAuth Client Secret:', False);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = AdminPage.ID) and ((Pos('@', AdminPage.Values[0]) = 0) or (Length(AdminPage.Values[1]) < 10)) then
  begin
    MsgBox('กรุณาใส่อีเมลให้ถูกต้อง และรหัสผ่านอย่างน้อย 10 ตัวอักษร', mbError, MB_OK);
    Result := False;
  end;
end;

function GetAdminEmail(Param: String): String; begin Result := AdminPage.Values[0]; end;
function GetAdminPass(Param: String): String; begin Result := AdminPage.Values[1]; end;

function GetKeysFile(Param: String): String;
var
  L: TStringList;
  N: array[0..5] of String;
  i: Integer;
begin
  N[0] := 'LINE_CHANNEL_ACCESS_TOKEN'; N[1] := 'LINE_CHANNEL_SECRET'; N[2] := 'GEMINI_API_KEY';
  N[3] := 'OPENAI_API_KEY'; N[4] := 'GOOGLE_OAUTH_CLIENT_ID'; N[5] := 'GOOGLE_OAUTH_CLIENT_SECRET';
  L := TStringList.Create;
  try
    for i := 0 to 5 do
      if Trim(KeysPage.Values[i]) <> '' then L.Add(N[i] + '=' + Trim(KeysPage.Values[i]));
    Result := ExpandConstant('{tmp}\keys.env');
    L.SaveToFile(Result);
  finally
    L.Free;
  end;
end;

function GetMode(Param: String): String;
begin
  if ModePage.SelectedValueIndex = 1 then Result := 'hybrid' else Result := 'standalone';
end;

function GetDataDir(Param: String): String;
begin
  Result := DirPage.Values[0];
end;
