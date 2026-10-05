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
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\src\deploy\standalone\install-windows.ps1"" -Mode {code:GetMode} -DataDir ""{code:GetDataDir}"" -AdminEmail ""{code:GetAdminEmail}"" -AdminPassword ""{code:GetAdminPass}"" -KeysFile ""{code:GetKeysFile}"" -SchoolName ""{code:GetSchoolName}"" -SchoolNameEn ""{code:GetSchoolNameEn}"" -SchoolAddress ""{code:GetSchoolAddr}"" -SchoolPhone ""{code:GetSchoolPhone}"" -LogoFile ""{code:GetLogo}"" -Domain ""{code:GetDomain}"" -TunnelToken ""{code:GetTunnel}"" -StaticIp ""{code:GetStaticIp}"" -Prefix ""{code:GetPrefix}"" -Gateway ""{code:GetGateway}"" -Dns ""{code:GetDns}"""; StatusMsg: "กำลังติดตั้งฐานข้อมูลและระบบ (10–30 นาที)..."; Flags: waituntilterminated

[Code]
var
  ModePage: TInputOptionWizardPage;
  DirPage: TInputDirWizardPage;
  AdminPage: TInputQueryWizardPage;
  KeysPage: TInputQueryWizardPage;
  GooglePage: TInputQueryWizardPage;
  SchoolPage: TInputQueryWizardPage;
  LogoPage: TInputFileWizardPage;
  NetModePage: TInputOptionWizardPage;
  NetPage: TInputQueryWizardPage;
  DomainPage: TInputQueryWizardPage;
  TunnelPage: TInputQueryWizardPage;

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

  SchoolPage := CreateInputQueryPage(DirPage.ID, 'ข้อมูลโรงเรียน', 'ชื่อนี้จะแสดงบนหน้าเว็บ แดชบอร์ด และบัตรนักเรียน', '');
  SchoolPage.Add('ชื่อโรงเรียน (ภาษาไทย):', False);
  SchoolPage.Add('ชื่อโรงเรียน (ภาษาอังกฤษ ไม่บังคับ):', False);
  SchoolPage.Add('ที่อยู่ (ไม่บังคับ):', False);
  SchoolPage.Add('เบอร์โทร (ไม่บังคับ):', False);

  LogoPage := CreateInputFilePage(SchoolPage.ID, 'โลโก้โรงเรียน', 'เลือกไฟล์โลโก้ (PNG/JPG แนะนำพื้นโปร่งใส ขนาด 512x512)', 'เว้นว่างได้ เปลี่ยนภายหลังได้ในเมนูตั้งค่าหน้าเว็บ');
  LogoPage.Add('ไฟล์โลโก้:', 'รูปภาพ|*.png;*.jpg;*.jpeg|ทุกไฟล์|*.*', '.png');

  NetModePage := CreateInputOptionPage(LogoPage.ID, 'ที่อยู่เครื่องในวง LAN', 'เครื่องแม่ข่ายควรมี IP คงที่ เพื่อให้ทุกเครื่องในโรงเรียนชี้มาได้ตลอด', '', True, False);
  NetModePage.Add('ตั้ง IP คงที่ให้เครื่องนี้ (แนะนำ)');
  NetModePage.Add('ใช้ IP ที่ได้อยู่ตอนนี้ (ตั้งจองที่เราเตอร์เอง)');
  NetModePage.SelectedValueIndex := 0;

  NetPage := CreateInputQueryPage(NetModePage.ID, 'ตั้งค่า IP คงที่', 'ถามค่าจากผู้ดูแลเครือข่าย ถ้าไม่แน่ใจใช้ค่าที่เติมไว้ให้', 'ตัวอย่าง: IP 192.168.1.10, Gateway 192.168.1.1');
  NetPage.Add('IP ของเครื่องนี้:', False);
  NetPage.Add('Subnet prefix (24 = 255.255.255.0):', False);
  NetPage.Add('Gateway (เราเตอร์):', False);
  NetPage.Add('DNS:', False);
  NetPage.Values[0] := '192.168.1.10';
  NetPage.Values[1] := '24';
  NetPage.Values[2] := '192.168.1.1';
  NetPage.Values[3] := '8.8.8.8';

  DomainPage := CreateInputQueryPage(NetPage.ID, 'โดเมน (ไม่บังคับ)', 'ให้ผู้ปกครอง/ครูเข้าจากนอกโรงเรียนผ่านโดเมน เช่น school.ac.th', 'ต้องชี้ DNS (A record) ของโดเมนมาที่ IP สาธารณะของโรงเรียน และเปิดพอร์ต 80, 443 ที่เราเตอร์มาที่เครื่องนี้ ระบบจะขอ HTTPS ให้อัตโนมัติ เว้นว่างได้');
  DomainPage.Add('โดเมน:', False);

  TunnelPage := CreateInputQueryPage(DomainPage.ID, 'เข้าจากนอกโรงเรียนด้วย Cloudflare Tunnel (ไม่บังคับ)', 'ไม่ต้องเปิดพอร์ต และไม่ต้องมี IP สาธารณะ', 'ที่ dash.cloudflare.com > Zero Trust > Networks > Tunnels > Create tunnel (Cloudflared) คัดลอกคำสั่งติดตั้งมาวางทั้งบรรทัดได้เลย แล้วตั้ง Public Hostname ชี้ไปที่ http://localhost:80 — ถ้าใช้ Tunnel ไม่ต้องเปิดพอร์ต 80/443 ที่เราเตอร์ เว้นว่างได้');
  TunnelPage.Add('รหัส Tunnel (token):', False);

  AdminPage := CreateInputQueryPage(TunnelPage.ID, 'ผู้ดูแลระบบคนแรก', 'บัญชีนี้ใช้เข้าระบบครั้งแรกและตั้งค่าทั้งหมด', '');
  AdminPage.Add('อีเมล:', False);
  AdminPage.Add('รหัสผ่าน (อย่างน้อย 10 ตัว):', True);

  KeysPage := CreateInputQueryPage(AdminPage.ID, 'กุญแจ LINE และ AI (ไม่บังคับ)',
    'ใส่เฉพาะที่มี เว้นว่างได้ แก้ภายหลังได้ที่เมนู Start > ใส่กุญแจบริการ',
    'กุญแจเก็บบน HDD ของเครื่องนี้ ใช้เฉพาะตอนส่ง LINE / เรียก AI');
  KeysPage.Add('LINE Channel Access Token:', False);
  KeysPage.Add('LINE Channel Secret:', False);
  KeysPage.Add('Gemini API Key (ผู้ช่วย AI):', False);
  KeysPage.Add('OpenAI API Key (สำรอง):', False);
  GooglePage := CreateInputQueryPage(KeysPage.ID, 'กุญแจ Google (ไม่บังคับ)',
    'ใช้สำหรับเข้าสู่ระบบด้วย Google และสำรองขึ้น Google Drive',
    'เว้นว่างได้ แก้ภายหลังได้ที่เมนู Start > ใส่กุญแจบริการ');
  GooglePage.Add('Google OAuth Client ID:', False);
  GooglePage.Add('Google OAuth Client Secret:', False);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := (PageID = NetPage.ID) and (NetModePage.SelectedValueIndex = 1);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = SchoolPage.ID) and (Trim(SchoolPage.Values[0]) = '') then
  begin
    MsgBox('กรุณาใส่ชื่อโรงเรียน', mbError, MB_OK); Result := False;
  end;
  if (CurPageID = NetPage.ID) and ((Trim(NetPage.Values[0]) = '') or (Trim(NetPage.Values[2]) = '')) then
  begin
    MsgBox('กรุณาใส่ IP และ Gateway', mbError, MB_OK); Result := False;
  end;
  if (CurPageID = AdminPage.ID) and ((Pos('@', AdminPage.Values[0]) = 0) or (Length(AdminPage.Values[1]) < 10)) then
  begin
    MsgBox('กรุณาใส่อีเมลให้ถูกต้อง และรหัสผ่านอย่างน้อย 10 ตัวอักษร', mbError, MB_OK);
    Result := False;
  end;
end;

function Q(S: String): String;
begin
  StringChangeEx(S, '"', '', True);
  Result := Trim(S);
end;
function GetSchoolName(Param: String): String; begin Result := Q(SchoolPage.Values[0]); end;
function GetSchoolNameEn(Param: String): String; begin Result := Q(SchoolPage.Values[1]); end;
function GetSchoolAddr(Param: String): String; begin Result := Q(SchoolPage.Values[2]); end;
function GetSchoolPhone(Param: String): String; begin Result := Q(SchoolPage.Values[3]); end;
function GetLogo(Param: String): String; begin Result := Q(LogoPage.Values[0]); end;
function GetStaticIp(Param: String): String;
begin
  if NetModePage.SelectedValueIndex = 0 then Result := Q(NetPage.Values[0]) else Result := '';
end;
function GetDomain(Param: String): String; begin Result := Q(DomainPage.Values[0]); end;
function GetTunnel(Param: String): String; begin Result := Q(TunnelPage.Values[0]); end;
function GetPrefix(Param: String): String; begin Result := Q(NetPage.Values[1]); end;
function GetGateway(Param: String): String; begin Result := Q(NetPage.Values[2]); end;
function GetDns(Param: String): String; begin Result := Q(NetPage.Values[3]); end;
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
