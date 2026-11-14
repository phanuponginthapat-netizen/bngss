"""
Offline kiosk screen for the standalone build.
Same look as the online kiosk page (white/blue, big camera, live list),
but served by the program itself so it works with no internet.
"""

from local_admin_ui import ADMIN_HTML  # re-exported for agent.py  # noqa: F401

KIOSK_HTML = r"""<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FaceGate — ตู้สแกนใบหน้า</title>
<style>
  :root { --primary:#123b67; --accent:#2f76b7; --ink:#17263a; --success:#15965f; --danger:#dc3545; --soft:#eef4fa; --surface:#fff; }
  * { box-sizing:border-box; }
  html, body { height:100%; }
  body { margin:0; overflow:hidden; color:var(--ink); font-family:"Figtree","Noto Sans Thai","Segoe UI",system-ui,sans-serif; background:#f8fafc; }
  button,input { font:inherit; }
  .top { height:82px; display:flex; align-items:center; justify-content:space-between; gap:18px; padding:12px 24px; background:#fff; border-bottom:1px solid #dce8f5; }
  .brand { display:flex; align-items:center; gap:12px; min-width:0; }
  .brand img,.brandMark { width:48px;height:48px;border-radius:12px;object-fit:contain;background:var(--primary);color:#fff;display:grid;place-items:center;font-size:22px; }
  .brand b { display:block;font-family:Outfit,"Noto Sans Thai",sans-serif;font-size:1.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
  .brand span { display:block;color:#64748b;font-size:.76rem; }
  .today { border:1px solid #dce8f5;background:#f6f9fc;border-radius:999px;padding:10px 20px;font-weight:700;white-space:nowrap; }
  .today b { color:var(--primary);font-size:1.12rem; }
  .timebox { display:flex;align-items:center;gap:12px;text-align:right; }
  .clock { font-family:Outfit,sans-serif;font-size:1.7rem;font-weight:800;line-height:1; }
  .date { color:#64748b;font-size:.7rem;font-weight:600;margin-top:4px; }
  .adminBtn { border:0;cursor:pointer;background:#eef4fa;color:var(--primary);font-weight:800;padding:10px 14px;border-radius:10px; }
  .app { display:grid;grid-template-columns:3fr 2fr;height:calc(100vh - 82px);min-height:0; }
  .stage { position:relative;overflow:hidden;background:#111c2c; }
  video { position:absolute;left:50%;top:50%;translate:-50% -50%;width:100%;height:100%;object-fit:cover; }
  .stage { container-type:size; }
  .shade { position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,18,34,.42),transparent 42%,rgba(7,18,34,.48));pointer-events:none; }
  .live { position:absolute;top:20px;left:20px;display:flex;align-items:center;gap:8px;background:rgba(7,18,34,.72);color:#fff;border-radius:999px;padding:7px 12px;font-size:.72rem;font-weight:800; }
  .live i { width:8px;height:8px;border-radius:50%;background:#ef4444;animation:pulse 1.3s infinite; }
  .guide { position:absolute;left:50%;top:47%;transform:translate(-50%,-50%);width:min(60vh,66%);aspect-ratio:1;border:1px solid rgba(255,255,255,.15);border-radius:24px;color:#34d399; }
  .corner { position:absolute;width:46px;height:46px;filter:drop-shadow(0 0 7px currentColor); }
  .c1{left:-3px;top:-3px;border-left:4px solid;border-top:4px solid;border-radius:16px 0 0}.c2{right:-3px;top:-3px;border-right:4px solid;border-top:4px solid;border-radius:0 16px 0 0}.c3{left:-3px;bottom:-3px;border-left:4px solid;border-bottom:4px solid;border-radius:0 0 0 16px}.c4{right:-3px;bottom:-3px;border-right:4px solid;border-bottom:4px solid;border-radius:0 0 16px}
  .banner { position:absolute;bottom:22px;left:50%;transform:translateX(-50%);width:max-content;max-width:96%;white-space:normal;overflow-wrap:anywhere;text-align:center;padding:10px 18px;border-radius:12px;font-size:.9rem;font-weight:700;color:#fff;background:rgba(7,18,34,.75);border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(8px); }
  .banner.ok { background:rgba(12,107,66,.88); }.banner.bad { background:rgba(145,26,38,.9); }
  .side { display:flex;flex-direction:column;min-height:0;padding:24px 28px;background:#fff;border-left:1px solid #dce8f5; }
  .welcome { display:flex;align-items:center;gap:12px;font-family:Outfit,"Noto Sans Thai",sans-serif;font-size:1.55rem;font-weight:800; }.welcome i{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:#e8f0f8;color:var(--primary);font-style:normal}.profile{display:none;flex:1;min-height:0;flex-direction:column;align-items:center;padding-top:20px}.profile.show{display:flex;animation:rise .35s ease-out}.profile .avatar{width:136px;height:136px;border:7px solid #fff;box-shadow:0 0 0 4px #dce8f5,0 18px 35px rgba(18,59,103,.2);border-radius:50%;object-fit:cover;background:#e8eef5}.profile h2{font-family:Outfit,"Noto Sans Thai",sans-serif;text-align:center;font-size:1.65rem;margin:18px 0 4px}.profile .role{color:var(--primary);font-weight:700}.facts{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;margin-top:20px}.fact{padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.fact small{display:block;color:#64748b;font-weight:700}.fact b{display:block;margin-top:4px;font-size:1.1rem}.resultTime{width:100%;display:flex;justify-content:space-between;margin-top:auto;padding:14px;border-radius:12px;background:#eef4fa}.resultBar{width:100%;padding:16px;margin-top:12px;border-radius:14px;text-align:center;background:var(--success);color:#fff;font-size:1.15rem;font-weight:800}.resultBar.bad{background:var(--danger)}
  .waiting { flex:1;min-height:0;display:flex;flex-direction:column;margin-top:20px; }.ready{padding:18px;border-radius:16px;background:var(--primary);color:#fff}.ready h2{font-family:Outfit,"Noto Sans Thai",sans-serif;margin:4px 0;font-size:clamp(.8rem,1.7vw,1.3rem);white-space:nowrap}.ready p{margin:0;opacity:.8;font-size:.84rem}.waitingContent{display:flex;flex:1;min-height:0;flex-direction:column;margin-top:14px;gap:14px}.recentPanel{display:flex;flex:1;min-height:0;flex-direction:column}.listTitle{display:flex;justify-content:space-between;margin:0 0 10px;font-weight:800}.list { min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px; }.item{display:flex;align-items:center;gap:10px;border:1px solid #e2e8f0;border-radius:12px;padding:8px}.item img{width:42px;height:42px;border-radius:9px;object-fit:cover;background:#e6edf5}.item div{min-width:0;flex:1}.item b,.item span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.item span{font-size:.72rem;color:#64748b}.tag{font-size:.7rem;font-weight:800;color:var(--primary)}
  .news{position:static;height:40px;flex-shrink:0;overflow:hidden;white-space:nowrap;border-radius:10px;padding:8px;background:var(--primary);color:#fff;font-weight:700}.news div{display:inline-block;animation:run 30s linear infinite}@keyframes run{to{transform:translateX(-50%)}}@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes pulse{50%{opacity:.35}}
  :root{--saver-bg:210 30% 96%;--saver-surface:0 0% 100%;--saver-muted:214 16% 44%;--saver-line:212 25% 87%;--saver-good:153 64% 30%;--saver-good-soft:151 46% 94%;--saver-bad:352 66% 43%;--saver-bad-soft:352 70% 96%;--saver-media:216 28% 10%;--saver-gold:43 88% 55%;--saver-news:45 85% 95%;--saver-news-ink:30 60% 25%}
  .saver{position:fixed;inset:0;z-index:60;display:none;color:var(--ink);background:hsl(var(--saver-bg));letter-spacing:0}
  .saver.show{display:grid;grid-template-columns:minmax(0,44%) minmax(0,56%);grid-template-rows:auto minmax(0,1fr) auto}
  .saverBrand{grid-column:1/-1;grid-row:1;display:flex;align-items:center;gap:18px;padding:20px 28px;background:var(--primary);color:hsl(var(--saver-surface));border-bottom:4px solid hsl(var(--saver-gold));min-width:0}
  .saverBrand img{width:68px;height:68px;object-fit:contain;flex-shrink:0;background:hsl(var(--saver-surface));border-radius:50%;padding:5px}
  .saverIdentity{flex:1;min-width:0}.saverBrand h1{font-size:1.6rem;line-height:1.4;margin:2px 0 4px;overflow-wrap:anywhere;font-weight:800}.saverEyebrow{font-size:.72rem;opacity:.8;font-weight:700}.saverSub{font-size:.8rem;line-height:1.5;opacity:.85;overflow-wrap:anywhere}.saverSub:empty{display:none}
  .saverTime{text-align:right;flex-shrink:0;max-width:42%}.saverClock{font-size:3.2rem;line-height:1.1;font-weight:800;font-variant-numeric:tabular-nums}.saverTimeLabel{font-size:.7rem;opacity:.8}.saverDate{font-size:.8rem;line-height:1.6;margin-top:4px;overflow-wrap:anywhere}
  .saverMedia{grid-column:1;grid-row:2;position:relative;min-width:0;min-height:0;overflow:hidden;background:hsl(var(--saver-media))}
  .saverMedia img,.saverMedia video{position:absolute;inset:0;left:0;top:0;translate:none;transform:none;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;object-position:center}
  .saverPanel{grid-column:2;grid-row:2;display:flex;flex-direction:column;gap:12px;padding:20px;min-width:0;min-height:0;overflow:hidden}
  .saverMsg{grid-column:1/-1;grid-row:3;display:flex;gap:16px;align-items:center;min-width:0;background:hsl(var(--saver-news));border-top:1px solid hsl(var(--saver-gold));padding:18px 28px;color:hsl(var(--saver-news-ink))}
  .saverMsgIcon{width:44px;height:44px;flex-shrink:0;padding:10px;background:hsl(var(--saver-gold));border-radius:8px}.saverMsgContent{min-width:0}.saverMsg b{display:block;font-size:.8rem;margin-bottom:4px}.saverMsgText{display:block;font-size:1.1rem;line-height:1.6;overflow-wrap:anywhere;white-space:pre-wrap}
  .saverClasses{display:flex;flex:1;min-height:0;flex-direction:column;gap:6px}.saverTableTitle{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding-bottom:6px;font-size:1.05rem}.saverTableTitle span{font-size:.7rem;color:hsl(var(--saver-muted))}
  .saverRows{min-height:0;flex:1;overflow:hidden;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));align-content:start;gap:4px 10px}
  .saverRow{display:grid;grid-template-columns:minmax(68px,1.4fr) repeat(4,minmax(28px,.65fr)) minmax(54px,1fr) minmax(50px,1fr);gap:4px;align-items:center;background:hsl(var(--saver-surface));border:1px solid hsl(var(--saver-line));border-radius:6px;padding:6px 8px;font-size:.86rem;line-height:1.4;min-width:0}
  .saverRow[hidden]{display:none}.saverRow span{text-align:center;min-width:0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.saverRow span:first-child{text-align:left;font-weight:800;white-space:normal}.saverRow span:nth-child(2),.saverRow span:last-child{color:hsl(var(--saver-good));font-weight:800}.saverRow span:nth-child(5){color:hsl(var(--saver-bad))}.saverRow span:last-child{background:hsl(var(--saver-good-soft));border-radius:4px;padding:2px 0}.saverRow small{display:none}
  .saverRowHead{background:transparent;border:0;color:hsl(var(--saver-muted));font-size:.66rem;padding:0 8px 2px}.saverRowHead span:last-child{background:transparent;padding:0}.saverRowHead span{font-weight:600!important;color:inherit!important}
  .saverFooter{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;border-top:1px solid hsl(var(--saver-line));padding-top:8px;flex-shrink:0;font-size:.72rem;color:hsl(var(--saver-muted))}.saverReady{display:flex;align-items:center;gap:7px}.saverReady i{width:7px;height:7px;border-radius:50%;background:hsl(var(--saver-good))}.saverPages{font-variant-numeric:tabular-nums;color:var(--primary);font-weight:700}
  .saverGroup{padding:10px 0;border-bottom:1px solid hsl(var(--saver-line));min-height:0}.saverHead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.saverHead>span{font-size:.8rem;color:hsl(var(--saver-muted))}.saverGroup .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:8px}.saverGroup .grid div{background:hsl(var(--saver-good-soft));border-radius:6px;padding:12px}.saverGroup .grid div:last-child{background:hsl(var(--saver-bad-soft))}.saverGroup .grid b{display:block;font-size:2rem;color:hsl(var(--saver-good))}.saverGroup .grid div:last-child b{color:hsl(var(--saver-bad))}
  .saver.show.noMedia{grid-template-columns:minmax(0,1fr)}.saver.noMedia .saverMedia{display:none}.saver.noMedia .saverPanel{grid-column:1}
  @media(orientation:portrait){.saver.show{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto minmax(220px,32%)}.saverMedia{grid-column:1;grid-row:2}.saverMsg{grid-row:3}.saverPanel{grid-column:1;grid-row:4;padding:16px 22px}.saverBrand{padding:20px 22px;flex-wrap:wrap;gap:12px}.saverTime{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:0 16px;max-width:none;width:100%;text-align:left;border-top:1px solid hsl(var(--saver-surface)/.2);padding-top:12px}.saverTimeLabel{grid-column:1;grid-row:1}.saverClock{grid-column:1;grid-row:2;font-size:3.8rem}.saverDate{grid-column:2;grid-row:1/3;text-align:right;font-size:1rem}.saver.show.noMedia{grid-template-rows:auto auto minmax(0,1fr)}.saver.noMedia .saverMsg{grid-row:2}.saver.noMedia .saverPanel{grid-row:3}.saverGroup .grid{margin-top:4px}.saverGroup .grid div{padding:6px 10px}.saverGroup .grid b{font-size:1.5rem}}
  @media(orientation:portrait) and (min-width:600px){.saverRow{padding:3px 8px;font-size:.78rem}.saverRowHead{padding:0 8px;font-size:.65rem}.saverRow span:last-child{padding:0}.saverRows{gap:3px 10px}}
  @media(max-width:599px){.saverBrand{padding:12px 14px;gap:10px}.saverBrand h1{font-size:1.1rem}.saverBrand img{width:44px;height:44px}.saverSub{font-size:.65rem}.saverClock{font-size:2.8rem}.saverDate{font-size:.75rem}.saverTime{gap:0 10px;padding-top:8px}.saverPanel{padding:12px;gap:8px}.saverMsg{padding:12px 14px;gap:10px}.saverMsgIcon{width:32px;height:32px;padding:7px}.saverMsgText{font-size:.85rem}.saverTableTitle{font-size:.85rem}.saverTableTitle span{font-size:.6rem}.saverRow{font-size:.7rem;padding:4px;gap:2px}.saverRowHead{font-size:.56rem;padding:0 4px}.saverFooter{font-size:.6rem}.saver.show{grid-template-rows:auto minmax(0,1fr) auto minmax(205px,34%)}.saver.show.noMedia{grid-template-rows:auto auto minmax(0,1fr)}}
  @media(orientation:landscape) and (max-height:650px){.saverBrand{padding:12px 18px;gap:12px}.saverBrand h1{font-size:1.1rem}.saverBrand img{width:44px;height:44px}.saverClock{font-size:2.4rem}.saverDate{font-size:.7rem}.saverPanel{padding:12px;gap:8px}.saverMsg{padding:10px 18px}.saverMsgText{font-size:.85rem}.saverRow{padding:4px 6px;font-size:.75rem}}
  @media(max-width:850px){.today{display:none}.top{padding:10px 14px}.app{grid-template-columns:1fr;height:calc(100vh - 82px);overflow:auto}.stage{min-height:55vh}.side{min-height:45vh}.brand span{display:none}}
  @media(orientation:portrait){
    .top{height:122px;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;gap:7px 14px;padding:12px 20px}
    .brand{grid-column:1;grid-row:1}.brand span{display:block}.timebox{grid-column:2;grid-row:1}.clock{font-size:1.5rem}
    .today{display:block;grid-column:1/-1;grid-row:2;text-align:center;padding:7px 14px;min-width:0;overflow:hidden;text-overflow:ellipsis}
    .app{height:calc(100dvh - 122px);grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,54%) minmax(0,46%);overflow:hidden}
    .stage{min-height:0}.guide{width:min(38vh,66%);max-width:80cqh;top:47%}
    .side{min-height:0;border-left:0;border-top:1px solid #dce8f5;padding:18px 22px;overflow-y:auto}.welcome{font-size:1.25rem}.welcome span{min-width:0;overflow-wrap:anywhere}.ready h2{font-size:1rem;white-space:normal}.profile h2{font-size:1.3rem;overflow-wrap:anywhere}.facts,.fact{min-width:0}.fact b,.resultBar{overflow-wrap:anywhere}
    .waiting{margin-top:14px}.waitingContent{display:grid;grid-template-columns:minmax(0,1fr);gap:18px}.waitingContent:has(.visitorBox[style*="display: flex"]){grid-template-columns:repeat(2,minmax(0,1fr))}.visitorBox{margin:0;min-width:0;min-height:0;justify-content:center;overflow:hidden}.visitorBox img{width:118px;height:118px}.recentPanel{min-width:0}
    .profile.show{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:auto auto auto auto auto;column-gap:22px;padding-top:16px;align-items:center;align-content:start}
    .profile .avatar{grid-column:1;grid-row:1/4;justify-self:center;width:112px;height:112px}.profile h2{grid-column:1;grid-row:4;margin:10px 0 4px;align-self:start}.profile .role{grid-column:1;grid-row:5;align-self:start;text-align:center}
    .facts{grid-column:2;grid-row:1;margin-top:0}.resultTime{grid-column:2;grid-row:2;margin-top:10px}.resultBar{grid-column:2;grid-row:3;margin-top:10px;align-self:start}
  }
  @media(orientation:portrait) and (max-height:950px){.app{grid-template-rows:minmax(0,51%) minmax(0,49%)}.side{padding-block:14px}.visitorBox img{width:96px;height:96px}}
  @media(orientation:portrait) and (max-width:599px){
    .top{height:136px;padding:8px 12px;gap:6px}.brand{grid-column:1/-1}.brand b{white-space:normal;font-size:1rem}.brand span{display:none}.brandMark,.brand img{width:36px;height:36px}.timebox{grid-column:1/-1;grid-row:2;justify-content:space-between;text-align:left}.clock{font-size:1.25rem}.date{font-size:.65rem}.adminBtn{padding:8px 10px}.today{grid-row:3;font-size:.75rem;padding:4px}.today b{font-size:.9rem}
    .app{height:calc(100dvh - 136px)}.side{padding:12px}.welcome{font-size:1rem}.welcome i{width:32px;height:32px;flex-shrink:0}.profile.show{column-gap:12px}.profile .avatar{width:80px;height:80px}.profile h2{font-size:1.1rem}.fact{padding:8px}.fact b{font-size:.9rem}.resultTime{flex-wrap:wrap;padding:8px;gap:4px;font-size:.8rem}.resultBar{padding:10px;font-size:1rem}
  }
  @media(prefers-reduced-motion:reduce){*:not(.news):not(.news *){animation-duration:.001ms!important;transition-duration:.001ms!important}}
.visitorBox{margin-bottom:12px;padding:12px;border-radius:16px;border:2px solid rgba(37,99,235,.35);background:#fff;text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center}
.visitorBox b{color:#1d4ed8;font-size:1rem}
.visitorBox small{color:#64748b;font-size:.78rem}
.visitorBox img{width:150px;height:150px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;padding:6px}
body{display:flex;flex-direction:column}.top{flex-shrink:0}.app{flex:1;min-height:0;height:auto!important}.news{border-radius:0;padding:8px 20px}
</style>
</head>
<body>
<header class="top">
  <div class="brand"><div class="brandMark" id="logoFallback">✦</div><img id="logo" alt="" style="display:none"/><div><b id="school">FaceGate</b><span id="kioskTitle">ระบบสแกนใบหน้าเข้า-ออกโรงเรียน</span></div></div>
  <div class="today"><span id="todayLabel">วันนี้</span> · นักเรียน <b id="sStudents">0</b> คน · บุคลากร <b id="sStaff">0</b> คน</div>
<div class="timebox"><div><div class="clock" id="clock">--:--:--</div><div class="date" id="date"></div></div><button class="adminBtn" onclick="openAdmin()">หลังบ้าน (F9)</button></div>
</header>
<div class="app">
  <div class="stage" id="stage"><video id="cam" autoplay playsinline muted></video><div class="shade"></div><div class="live"><i></i><span id="liveLabel">กล้องสด</span></div><div class="guide"><i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i></div><div class="banner" id="banner">กรุณายืนให้ใบหน้าตรงกับกรอบใบหน้าบนหน้าจอ</div>
  </div>
  <aside class="side"><div class="welcome"><i>✦</i><span id="welcome">ยินดีต้อนรับเข้าสู่โรงเรียนของเรา</span></div>
    <div class="profile" id="profile"><img class="avatar" id="profileAvatar" alt=""/><h2 id="profileName">—</h2><div class="role" id="profileRole">—</div><div class="facts"><div class="fact"><small id="classLabel">ชั้นเรียน</small><b id="profileClass">—</b></div><div class="fact"><small id="idLabel">รหัส</small><b id="profileId">—</b></div></div><div class="resultTime"><span id="timeLabel">เวลาเข้า-ออก</span><b id="scanTime">--:--:-- น.</b></div><div class="resultBar" id="resultBar">บันทึกสำเร็จ</div></div>
    <div class="waiting" id="waiting"><div class="ready"><small>FACEGATE READY</small><h2 id="subtitle">กรุณายืนให้ใบหน้าตรงกับกรอบใบหน้าบนหน้าจอ</h2><p id="readyDetail">ระบบพร้อมสำหรับการสแกน</p></div><div class="waitingContent"><div class="visitorBox" id="visitorBox" style="display:none"><b>ผู้มาเยือน / บุคลากรภายนอก</b><small>สแกน QR code นี้เพื่อลงทะเบียนเข้าโรงเรียน</small><img id="visitorQr" alt="QR code ลงทะเบียนผู้มาเยือน"/><small id="visitorUrl"></small><small>วันนี้เข้าแล้ว <b id="visitorCount">0</b> คน</small></div><div class="recentPanel"><div class="listTitle"><span>สแกนเข้าล่าสุด</span><small>วันนี้</small></div><div class="list" id="list"></div></div></div></div>
  </aside>
</div>
<div id="powerWarning" role="alert" style="display:none;position:fixed;inset:0;z-index:100;background:var(--ink);color:var(--surface);align-items:center;justify-content:center;flex-direction:column;gap:20px"><h2 id="powerCountdown"></h2><button class="adminBtn" onclick="cancelPower()">ยกเลิกปิดเครื่อง</button></div>
<div class="news" id="newsBox" style="display:none"><div id="news"></div></div>
<div class="saver" id="saver" onclick="wake()"><div class="saverMedia" id="saverMedia"></div><header class="saverBrand"><img id="saverLogo" alt="" style="display:none"/><div class="saverIdentity"><small class="saverEyebrow">FACEGATE · ยินดีต้อนรับ</small><h1 id="saverSchool">โรงเรียนของเรา</h1><div id="saverSub" class="saverSub"></div></div><div class="saverTime"><small class="saverTimeLabel">เวลาประเทศไทย</small><div class="saverClock" id="saverClock"></div><div id="saverDate" class="saverDate"></div></div></header><div class="saverMsg" id="saverMsg" style="display:none"><svg class="saverMsgIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 10v4h4l12 5V5L7 10H3Z M7 14l2 6h3l-2-5 M22 9v6"/></svg><div class="saverMsgContent"><b>ข่าวประชาสัมพันธ์ · จากโรงเรียน</b><span class="saverMsgText" id="saverMsgText"></span></div></div><section class="saverPanel"><div class="saverClasses" id="saverClasses" style="display:none"></div><div class="saverGroup" id="studentGroup"><div class="saverHead"><b>นักเรียน</b><span>ในระบบ <b id="studentTotal">—</b> คน</span></div><div class="grid"><div>มาวันนี้<b id="studentPresent">—</b></div><div>ขาด<b id="studentAbsent">—</b></div></div></div><div class="saverGroup" id="staffGroup"><div class="saverHead"><b>บุคลากร</b><span>ในระบบ <b id="staffTotal">—</b> คน</span></div><div class="grid"><div>มาวันนี้<b id="staffPresent">—</b></div><div>ขาด<b id="staffAbsent">—</b></div></div></div><footer class="saverFooter"><span class="saverReady"><i></i>กล้องพร้อมสแกนตลอดเวลา</span><span id="saverPages" class="saverPages"></span></footer></section></div>
<script>
const $ = (id) => document.getElementById(id);
let lastVoiceTest = 0;
let display = { mirror: true, rotate: 0, voice_enabled: true, next_delay_seconds: 5 };
let broadcastMedia = [], broadcastIndex = 0, broadcastTimer = null;
let content = {};
function openAdmin() {
  if (window.pywebview && window.pywebview.api && window.pywebview.api.open_admin) {
    window.pywebview.api.open_admin();
  } else { location.href = '/admin'; }
}
window.addEventListener('keydown', (event) => {
  if (event.key === 'F9') { event.preventDefault(); openAdmin(); }
});
const emptyAvatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#eef4fa"/><circle cx="40" cy="28" r="14" fill="#123b67"/><path d="M12 78a28 28 0 0 1 56 0" fill="#123b67"/></svg>');
function applyAvatar(img, primary, fallback) {
  img.onerror = () => { img.onerror = () => { img.onerror = null; img.src = emptyAvatar; }; img.src = fallback || emptyAvatar; };
  img.src = primary || fallback || emptyAvatar;
}
let busy = false, pausedUntil = 0;

let nativeCam = false;
async function startCamera() {
  // Direct camera: the program reads the webcam itself (no browser camera).
  try {
    const st = await (await fetch('/camera/status')).json();
    if (st && st.native) {
      nativeCam = true;
      const img = document.createElement('img');
      img.id = 'camImg'; img.alt = ''; img.src = '/camera/stream';
      img.style.cssText = 'position:absolute;left:50%;top:50%;translate:-50% -50%;width:100%;height:100%;object-fit:cover';
      img.onerror = () => setTimeout(() => { img.src = '/camera/stream?t=' + Date.now(); }, 2000);
      const v = $('cam'); v.replaceWith(img); img.id = 'cam';
      applyCameraLook();
      return;
    }
  } catch (e) {}
  try { $('cam').srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } }); }
  catch (e) { say('ไม่พบกล้อง กรุณาตรวจสายกล้องแล้วเปิดโปรแกรมใหม่', 'bad'); }
}
var lastStatusText = '';
function say(text, kind) { const b = $('banner'); b.textContent = text; b.className = 'banner' + (kind ? ' ' + kind : ''); lastStatusText = text || ''; }
function applyCameraLook() {
  const rot = (((Number(display.rotate) || 0) % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const cam = $('cam'); if (!cam) return;
  cam.style.width = swap ? '100cqh' : '100%';
  cam.style.height = swap ? '100cqw' : '100%';
  cam.style.transform = `${display.mirror ? 'scaleX(-1) ' : ''}rotate(${rot}deg)`;
}
// Reflow the existing camera, not a new stream, when the monitor turns.
window.addEventListener('resize', applyCameraLook);
function showResult(d, captured) {
  const student = d.student || {};
  const ok = d.result === 'ok';
  $('waiting').style.display = 'none'; $('profile').className = 'profile show';
  applyAvatar($('profileAvatar'), d.avatar_url || student.avatar_url, d.snapshot_url || captured);
  $('profileName').textContent = student.full_name || d.name || d.message || 'ไม่พบข้อมูล';
  $('profileRole').textContent = student.person_type === 'staff'
    ? ['บุคลากร', student.department, student.position].filter(Boolean).join(' • ')
    : ['นักเรียน', student.class_room ? 'ชั้น ' + student.class_room : ''].filter(Boolean).join(' • ');
  $('profileClass').textContent = student.class_room || student.department || '—';
  $('profileId').textContent = student.student_code || '—';
  $('scanTime').textContent = serverNow().toLocaleTimeString('th-TH-u-ca-buddhist-nu-latn',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}) + ' น.';
  $('resultBar').className = 'resultBar' + (ok ? '' : ' bad');
  $('resultBar').textContent = ok ? (content.kiosk_success_label || 'บันทึกสำเร็จ') : d.message;
  setTimeout(() => { $('profile').className = 'profile'; $('waiting').style.display = ''; }, 2000);
}
let audioReady = false, thaiVoice = null, browserVoiceOk = false;
const clipCache = new Map();
let voiceBusy = false, pendingVoice = null;
const spokenPeople = new Map();
function scanSpeechText(d) {
  const name = d.name || (d.student || {}).full_name || '';
  const text = d.speak || (name ? `สแกนสำเร็จ ${name}` : '');
  return name && !text.includes(name) ? `${text} ${name}` : text;
}
function speakScan(d) {
  const text = scanSpeechText(d);
  const key = d.student_id || d.name || text;
  const now = Date.now();
  if (!text || now - (spokenPeople.get(key) || 0) < 10000) return;
  spokenPeople.set(key, now);
  if (spokenPeople.size > 200) spokenPeople.delete(spokenPeople.keys().next().value);
  speak(text);
}

function unlockAudio() {
  if (audioReady) return;
  audioReady = true;
  try { new AudioContext().resume(); } catch (e) {}
  if (window.speechSynthesis) speechSynthesis.resume();
}
document.addEventListener('click', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });

function pickVoice() {
  if (!window.speechSynthesis) return;
  const voices = speechSynthesis.getVoices() || [];
  thaiVoice = voices.find((v) => (v.lang || '').toLowerCase().startsWith('th')) || null;
  browserVoiceOk = !!thaiVoice;
}
if (window.speechSynthesis) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

function chime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    ctx.resume();
    osc.frequency.value = 880; gain.gain.value = 0.12;
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.18);
  } catch (e) {}
}

async function speakOnDevice(text) {
  try {
    let url = clipCache.get(text);
    if (!url) {
      const res = await fetch('/local/kiosk-api/tts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return false;
      url = URL.createObjectURL(await res.blob());
      if (clipCache.size > 60) { clipCache.forEach(value => URL.revokeObjectURL(value)); clipCache.clear(); }
      clipCache.set(text, url);
    }
    const audio = new Audio(url);
    audio.volume = Math.min(Math.max(Number(display.voice_volume ?? 1), 0), 1);
    audio.playbackRate = Math.min(Math.max(Number(display.voice_rate || 1), 0.5), 2);
    await new Promise((resolve, reject) => {
      audio.onended = resolve; audio.onerror = reject;
      audio.play().catch(reject);
    });
    return true;
  } catch (e) { return false; }
}

async function speak(text) {
  if (!display.voice_enabled || !text) return;
  if (voiceBusy) { pendingVoice = text; return; }
  voiceBusy = true;
  try {
    let played = false;
    if (browserVoiceOk) {
      try {
        await new Promise((resolve, reject) => {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'th-TH'; u.voice = thaiVoice;
          u.rate = Number(display.voice_rate || 1); u.volume = Number(display.voice_volume ?? 1);
          u.onend = resolve; u.onerror = reject;
          speechSynthesis.speak(u);
        });
        played = true;
      } catch (e) {}
    }
    if (!played) played = await speakOnDevice(text);
    if (!played) chime();
  } finally {
    voiceBusy = false;
    const next = pendingVoice; pendingVoice = null;
    if (next) speak(next);
  }
}

function drawRotated(v, c, w, h) {
  // Rotate the frame upright before the AI sees it, so a sideways camera still works.
  const rot = (((Number(display.rotate) || 0) % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  c.width = swap ? h : w; c.height = swap ? w : h;
  const ctx = c.getContext('2d');
  ctx.save(); ctx.translate(c.width / 2, c.height / 2); ctx.rotate(rot * Math.PI / 180);
  ctx.drawImage(v, -w / 2, -h / 2, w, h); ctx.restore();
}
function frame() {
  if (nativeCam) return 'native';
  const v = $('cam'); if (!v.videoWidth) return null;
  const c = document.createElement('canvas');
  drawRotated(v, c, 640, Math.round(640 * v.videoHeight / v.videoWidth));
  return c.toDataURL('image/jpeg', 0.82).split(',')[1];
}
// Live view: a small preview frame for the admin page, sent from the kiosk so
// staff can watch the queue over the school LAN. No video is stored.
function previewFrame(wide) {
  if (nativeCam) return null;  // the program sends its own preview while scanning
  const v = $('cam'); if (!v.videoWidth) return null;
  const w = wide ? 480 : 320;
  const c = document.createElement('canvas');
  drawRotated(v, c, w, Math.round(w * v.videoHeight / v.videoWidth));
  return c.toDataURL('image/jpeg', wide ? 0.6 : 0.5);
}
// While staff are watching the live page the server asks for many more frames
// per second, so the admin sees smooth motion instead of a slideshow.
let previewDelay = 2000, previewSending = false, previewOkAt = 0, previewLoops = 0;
async function sendPreview() {
  if (display.live_view === false || previewSending) return;
  previewSending = true;
  try {
    const v = $('cam');
    // A paused or stalled camera is the usual reason the picture freezes on the
    // admin screen, so nudge it back to life before grabbing the frame.
    if (v && v.paused) { try { await v.play(); } catch (e) {} }
    const image = previewFrame(previewDelay < 500);
    if (image) {
      const res = await fetch('/local/kiosk-api/live', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, status: lastStatusText }),
      });
      const d = await res.json();
      previewDelay = Math.min(Math.max(Number(d.interval_ms) || 2000, 100), 5000);
      previewOkAt = Date.now();
    }
  } catch (e) { previewDelay = 2000; }
  previewSending = false;
}
async function previewLoop() {
  const mine = ++previewLoops;
  for (;;) {
    if (mine !== previewLoops) return;  // a newer loop took over
    await sendPreview();
    await new Promise((r) => setTimeout(r, previewDelay));
  }
}
previewLoop();
// Watchdog: if no frame reached the server for a while (stalled camera, a
// hung request, a browser that froze our timer) start the sender again so the
// admin page never sits on a frozen picture.
setInterval(() => {
  if (display.live_view === false) return;
  if (previewOkAt && Date.now() - previewOkAt < 12000) return;
  previewSending = false;
  previewDelay = 1000;
  previewLoop();
}, 8000);

function visibleGuide() {
  const cam = $('cam'), stage = $('stage').getBoundingClientRect();
  const box = document.querySelector('.guide').getBoundingClientRect();
  let w = cam.videoWidth || cam.naturalWidth, h = cam.videoHeight || cam.naturalHeight;
  if (!w || !h || !stage.width || !stage.height) return null;
  const rot = (((Number(display.rotate) || 0) % 360) + 360) % 360;
  if (rot === 90 || rot === 270) [w, h] = [h, w];
  // object-fit:cover crops the upright picture around its centre.
  const scale = Math.max(stage.width / w, stage.height / h);
  const drawnW = w * scale, drawnH = h * scale;
  const left = stage.left + (stage.width - drawnW) / 2;
  const top = stage.top + (stage.height - drawnH) / 2;
  return { left: (box.left - left) / drawnW, top: (box.top - top) / drawnH,
    right: (box.right - left) / drawnW, bottom: (box.bottom - top) / drawnH };
}

async function tick() {
  if (busy || Date.now() < pausedUntil) return;
  let image = frame(); if (!image) return;
  const guide = visibleGuide(); if (!guide) return;
  busy = true;
  try {
    const res = await fetch('/scan', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(image === 'native' ? { native: true, rotate: Number(display.rotate) || 0, guide } : { image, guide }) });
    const d = await res.json();
    if (image === 'native') image = d.snapshot_b64 || '';
    // Any face at the screen counts as activity, so the stats board steps
    // aside and the camera keeps scanning without a manual touch.
    if (d.has_face || (d.result && d.result !== 'no_face')) wake();
    if (d.result === 'ok') {
      say(d.message, 'ok'); showResult(d, 'data:image/jpeg;base64,' + image); speakScan(d); loadRecent(); loadStats();
      pausedUntil = Date.now() + 2000;
    } else if (d.result === 'duplicate' || d.result === 'denied') {
      say(d.message, 'bad'); showResult(d, 'data:image/jpeg;base64,' + image); speakScan(d); pausedUntil = Date.now() + 2000;
    } else if (d.message && d.result !== 'no_face') { say(d.message); }
    else { say($('subtitle').textContent); }
  } catch (e) {}
  busy = false;
}
async function loadBrand() {
  try {
    const c = await (await fetch('/local/kiosk-api/content')).json(); content = c;
    document.documentElement.style.setProperty('--primary', c.theme_primary || '#1d6fe0');
    document.documentElement.style.setProperty('--accent', c.theme_accent || '#0ea5e9');
    document.documentElement.style.setProperty('--ink', c.theme_ink || '#132a4f');
    $('school').textContent = c.school_name || c.brand_name || 'FaceGate';
    $('kioskTitle').textContent = c.kiosk_title || 'ระบบสแกนใบหน้าเข้า-ออกโรงเรียน';
    let sub = c.kiosk_subtitle || 'กรุณายืนให้ใบหน้าตรงกับกรอบใบหน้าบนหน้าจอ';
    if (sub === 'กรุณามองกล้องในกรอบวงรี' || sub === 'ยืนให้ใบหน้าอยู่ในกรอบทีละคน') sub = 'กรุณายืนให้ใบหน้าตรงกับกรอบใบหน้าบนหน้าจอ';
    $('subtitle').textContent = sub;
    const school = c.school_name || c.brand_name || 'โรงเรียนของเรา';
    let welcome = c.kiosk_welcome || 'ยินดีต้อนรับเข้าสู่';
    if (welcome === 'ยินดีต้อนรับกลับโรงเรียน!' || welcome === 'ยินดีต้อนรับกลับโรงเรียน') welcome = 'ยินดีต้อนรับเข้าสู่';
    $('welcome').textContent = welcome.includes('{school}') ? welcome.replaceAll('{school}', school) : welcome + school;
    $('liveLabel').textContent = c.kiosk_live_label || 'กล้องสด';
    $('todayLabel').textContent = c.kiosk_today_label === 'เข้าเรียนวันนี้' ? 'วันนี้' : (c.kiosk_today_label || 'วันนี้');
    $('classLabel').textContent = c.kiosk_class_label || 'ชั้นเรียน'; $('idLabel').textContent = c.kiosk_id_label || 'รหัส'; $('timeLabel').textContent = c.kiosk_time_label || 'เวลาเข้า-ออก';
    $('saverSchool').textContent = school;
    $('saverSub').textContent = [c.school_name_en, c.school_motto].filter(Boolean).join(' · ');
    const msg = (c.kiosk_saver_message || '').trim(); $('saverMsg').style.display = msg ? 'flex' : 'none'; $('saverMsgText').textContent = msg;
    if (c.logo_url) { $('saverLogo').src = c.logo_url; $('saverLogo').style.display = ''; $('saverLogo').onerror = () => { $('saverLogo').style.display = 'none'; }; }
    if (c.logo_url) { $('logo').src = c.logo_url; $('logo').style.display = 'block'; $('logoFallback').style.display = 'none'; }
  } catch (e) {}
}
async function loadRecent() {
  try {
    const data = await (await fetch('/local/kiosk-api/recent')).json();
    if(data.voice_test_at && data.voice_test_at > lastVoiceTest){lastVoiceTest=data.voice_test_at; speak('ทดสอบเสียง สแกนสำเร็จ ยินดีต้อนรับ');}
    display = data.display || display;
    updateBroadcast(data.broadcast_media || []);
    applyCameraLook();
    if (display.news_enabled && display.news_text) {
      $('newsBox').style.display = 'block';
      $('news').textContent = (display.news_text + '   •   ').repeat(8);
    } else { $('newsBox').style.display = 'none'; }
    $('list').innerHTML = (display.show_recent ? (data.items || []) : []).map((i) => `
      <div class="item"><img alt="" />
        <div><b>${i.name}</b><span>${i.detail || ''} • ${new Date(i.scanned_at).toLocaleTimeString('th-TH-u-ca-buddhist-nu-latn',{hour:'2-digit',minute:'2-digit'})}</span></div>
        <div class="tag ${i.direction === 'out' ? 'out' : ''}">${i.direction === 'out' ? 'ออก' : 'เข้า'}</div></div>`).join('')
      || '<div style="color:#94a3b8;font-size:.9rem">ยังไม่มีการสแกนวันนี้</div>';
    document.querySelectorAll('#list .item img').forEach((img, index) => {
      const item = (data.items || [])[index];
      if (item) applyAvatar(img, item.avatar_url, item.snapshot_url);
    });
  } catch (e) {}
}
let serverOffset = 0; // real Thai time minus this PC's clock
function serverNow() { return new Date(Date.now() + serverOffset); }
async function loadStats() {
  try {
    const s = await (await fetch('/local/kiosk-api/today-stats')).json();
    if (s.server_time) { const t = Date.parse(s.server_time); if (!isNaN(t)) serverOffset = t - Date.now(); }
    $('sStudents').textContent = s.students_present || 0;
    $('sStaff').textContent = s.staff_present || 0;
    // Visitor QR code: only shown while the admin keeps the mode open.
    const vBox = $('visitorBox');
    if (s.visitor_register_enabled) {
      const url = s.visitor_url || (location.origin + '/visit');
      $('visitorQr').src = '/local/api/public/visit/qr.svg';
      $('visitorUrl').textContent = url;
      $('visitorCount').textContent = s.visitors_present || 0;
      vBox.style.display = 'flex';
    } else {
      vBox.style.display = 'none';
    }
    $('studentTotal').textContent = s.total_students ?? '—'; $('studentPresent').textContent = s.students_present ?? '—'; $('studentAbsent').textContent = s.absent_students ?? '—';
    $('staffTotal').textContent = s.total_staff ?? '—'; $('staffPresent').textContent = s.staff_present ?? '—'; $('staffAbsent').textContent = s.absent_staff ?? '—';
    // รายงานการมาโรงเรียนตามระดับชั้น — ชุดเดียวกับหน้าแรกโรงเรียน
    const classes = Array.isArray(s.classes) ? s.classes : [];
    const classBox = $('saverClasses');
    if (classes.length) {
      $('studentGroup').style.display = 'none'; $('staffGroup').style.display = 'none';
      classBox.style.display = 'flex';
      const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      const labels = ['ระดับชั้น', 'มา', 'สาย', 'ลา', 'ขาด', 'ยังไม่บันทึก', 'ร้อยละ'];
      classBox.innerHTML = '<div class="saverTableTitle"><b>การมาโรงเรียนรายระดับชั้น</b><span>มา รวมผู้มาสาย · หน่วย: คน</span></div><div class="saverRow saverRowHead">' + labels.map(label => '<span>' + label + '</span>').join('') + '</div><div class="saverRows" id="saverRows">' + classes.map((c) => {
        const came = (Number(c.present) || 0) + (Number(c.late) || 0);
        const pct = c.evidence && Number(c.total) > 0 ? ((came / Number(c.total)) * 100).toFixed(1) + '%' : '—';
        const values = [c.name, came, Number(c.late) || 0, Number(c.leave) || 0, Number(c.absent) || 0, c.unrecorded ?? '—', pct];
        return '<div class="saverRow">' + values.map((value, i) => '<span>' + (i ? '<small>' + labels[i] + '</small>' : '') + esc(value) + '</span>').join('') + '</div>';
      }).join('') + '</div>';
      requestAnimationFrame(layoutSaverPages);
    } else {
      classBox.style.display = 'none'; classBox.innerHTML = '';
      $('studentGroup').style.display = ''; $('staffGroup').style.display = '';
    }
    $('saverSchool').textContent = s.school_name || content.school_name || content.brand_name || 'โรงเรียนของเรา';
    checkinOnly = !!s.checkin_only;
    idleMinutes = Number(s.idle_stats_minutes || 0);
    statsMode = s.screensaver_mode === 'stats';
    windowsClosed = !!s.windows_closed;
    applySaver();
    // CCTV mode: the screen may rest, but the camera keeps watching and keeps
    // feeding the live page, so make sure the video never pauses.
    const v = $('cam');
    if (v && v.paused) { try { await v.play(); } catch (e) {} }
  } catch (e) {}
}
// Paginate by measured row heights; every grade remains visible without scrolling.
let saverPage = 0, saverPageCount = 1;
function layoutSaverPages() {
  const box = $('saverRows');
  if (!box || !$('saver').classList.contains('show')) { $('saverPages').textContent = ''; return; }
  const rows = Array.from(box.children);
  rows.forEach(row => { row.hidden = false; });
  const available = box.clientHeight;
  const cols = Math.max(1, getComputedStyle(box).gridTemplateColumns.split(' ').filter(Boolean).length);
  const h = rows.length ? rows[0].getBoundingClientRect().height + 4 : 40;
  const perPage = Math.max(cols, Math.floor((available + 4) / h) * cols);
  let page = 0;
  rows.forEach((row, i) => { page = Math.floor(i / perPage); row.dataset.page = String(page); });
  saverPageCount = page + 1; saverPage %= saverPageCount;
  rows.forEach(row => { row.hidden = Number(row.dataset.page) !== saverPage; });
  $('saverPages').textContent = saverPageCount > 1 ? 'หน้า ' + (saverPage + 1) + ' / ' + saverPageCount : '';
}
new ResizeObserver(() => requestAnimationFrame(layoutSaverPages)).observe(document.querySelector('.saverPanel'));

setInterval(() => { if ($('saver').classList.contains('show')) { saverPage = (saverPage + 1) % saverPageCount; layoutSaverPages(); } }, 8000);
let remoteSaver = false;
let statsMode = true, windowsClosed = false, checkinOnly = false, idleMinutes = 0;
let lastActivity = Date.now();
let lastPresence = 0;
function bumpActivity() { lastActivity = Date.now(); lastPresence = lastActivity; applySaver(); }
function applySaver() {
  const idle = idleMinutes > 0 && Date.now() - lastActivity > idleMinutes * 60000;
  const active = lastPresence > 0 && Date.now() - lastPresence < 15000;
  const show = !active && (remoteSaver || (statsMode && (windowsClosed || idle)));
  $('saver').className = 'saver' + (show ? ' show' : '') + (broadcastMedia.length ? '' : ' noMedia');
  if (show) requestAnimationFrame(layoutSaverPages);
  if (show) showBroadcast(); else {
    stopBroadcast();
    $('saverMedia').replaceChildren();
  }
}
function stopBroadcast() {
  if (broadcastTimer) clearTimeout(broadcastTimer);
  broadcastTimer = null;
  const video = $('saverMedia').querySelector('video');
  if (video) {
    video.onended = video.onerror = video.onwaiting = video.onplaying = null;
    video.pause(); video.removeAttribute('src'); video.load();
  }
}
function updateBroadcast(items) {
  const old = broadcastMedia[broadcastIndex % Math.max(1, broadcastMedia.length)];
  broadcastMedia = items.filter(item => item.url && item.is_active !== false);
  $('saver').classList.toggle('noMedia', !broadcastMedia.length);
  requestAnimationFrame(layoutSaverPages);
  const index = old ? broadcastMedia.findIndex(item => item.id === old.id) : -1;
  broadcastIndex = index >= 0 ? index : 0;
  // Refresh signed URLs without interrupting the current clip on each poll.
  if (old && index < 0 || !broadcastMedia.length) {
    stopBroadcast(); $('saverMedia').replaceChildren();
  }
  showBroadcast();
}
function broadcastWait(ms) {
  if (broadcastTimer) clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(nextBroadcast, ms);
}
function showBroadcast() {
  const box = $('saverMedia'); if (!box || !broadcastMedia.length || broadcastTimer || box.querySelector('video') || !$('saver').classList.contains('show')) return;
  const item = broadcastMedia[broadcastIndex % broadcastMedia.length];
  box.replaceChildren();
  if (item.media_type === 'video') {
    const video = document.createElement('video'); video.src=item.url; video.autoplay=true; video.muted=true; video.volume=1; video.playsInline=true; video.loop=false;
    video.onended=nextBroadcast;
    video.onerror=()=>broadcastWait(3000);
    video.onwaiting=()=>broadcastWait(15000);
    video.onplaying=()=>{if(broadcastTimer)clearTimeout(broadcastTimer);broadcastTimer=null;};
    box.append(video); broadcastWait(15000);
    const play = video.play();
    if(play) play.catch(()=>{ if(box.contains(video)) broadcastWait(3000); });
  } else { const img=document.createElement('img');img.src=item.url;img.alt=item.title||'';img.onerror=()=>broadcastWait(3000);box.append(img); broadcastWait(Math.max(3,item.duration_seconds||10)*1000); }
}
function nextBroadcast(){ stopBroadcast(); $('saverMedia').replaceChildren(); broadcastIndex=(broadcastIndex+1)%Math.max(1,broadcastMedia.length); showBroadcast(); }

function wake() { if(remoteSaver){remoteSaver=false;fetch('/power/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command:'screen_on'})}).catch(()=>{});} bumpActivity(); }
window.addEventListener('pointerdown', bumpActivity);
window.addEventListener('keydown', bumpActivity);
function clock() {
  const now = serverNow();
  const thaiOptions = { timeZone:'Asia/Bangkok', weekday:'long',day:'numeric',month:'long',year:'numeric' };
  $('saverClock').textContent = now.toLocaleTimeString('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'});
  $('saverDate').textContent = now.toLocaleDateString('th-TH-u-ca-buddhist-nu-latn',thaiOptions);
  $('clock').textContent = now.toLocaleTimeString('th-TH-u-ca-buddhist-nu-latn', { hour: '2-digit', minute: '2-digit', second:'2-digit', hour12:false });
  $('date').textContent = now.toLocaleDateString('th-TH-u-ca-buddhist-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
async function cancelPower(){await fetch('/power/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command:'cancel'})});await loadPower();}
async function loadPower(){try{const p=await (await fetch('/power/status')).json();const pending=p.pending;const rs=!!p.screen_off;if(rs!==remoteSaver){remoteSaver=rs;if(!rs)lastActivity=Date.now();applySaver();}$('powerWarning').style.display=pending?'flex':'none';if(pending)$('powerCountdown').textContent=(pending.action==='sleep'?'พักเครื่อง':'ปิดเครื่อง')+' ใน '+Math.max(0,Math.ceil(pending.at-Date.now()/1000))+' วินาที';}catch(e){}}
setInterval(loadPower,1000);
loadBrand(); startCamera(); loadRecent(); loadStats(); clock();
setInterval(tick, 300); setInterval(loadRecent, 15000); setInterval(loadStats, 60000);
setInterval(applySaver, 5000);
setInterval(clock, 1000); setInterval(loadBrand, 120000);
</script>
</body>
</html>
"""


VISIT_HTML = r"""<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>ลงทะเบียนผู้มาเยือน</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:"Noto Sans Thai",system-ui,sans-serif;background:#f1f5f9;color:#0f172a}
.wrap{max-width:520px;margin:0 auto;padding:18px}
h1{font-size:1.3rem;margin:.2rem 0}
p.lead{color:#64748b;font-size:.9rem;margin-top:0}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;margin-bottom:14px}
label{display:block;font-size:.82rem;color:#475569;margin:10px 0 4px}
input,select,textarea{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:12px;font:inherit}
video,canvas,img#shot{width:100%;border-radius:14px;background:#0f172a;aspect-ratio:4/3;object-fit:cover}
button{width:100%;padding:13px;border:0;border-radius:14px;background:#1d4ed8;color:#fff;font:inherit;font-weight:700;margin-top:12px}
button.ghost{background:#e2e8f0;color:#0f172a}
.msg{margin-top:10px;font-size:.88rem}
.bad{color:#dc2626}
.ok{background:#dcfce7;border:1px solid #16a34a;border-radius:14px;padding:14px;text-align:center}
.code{font-size:1.6rem;font-weight:800;color:#15803d;letter-spacing:1px}
</style>
</head>
<body>
<div class="wrap">
  <h1 id="title">ลงทะเบียนเข้าโรงเรียน</h1>
  <p class="lead">สำหรับผู้มาเยือนและบุคลากรภายนอก ใช้ได้เฉพาะวันนี้</p>
  <div id="closed" class="card" style="display:none">ขณะนี้ยังไม่เปิดรับลงทะเบียนผู้มาเยือน กรุณาติดต่อเจ้าหน้าที่</div>
  <div id="done" class="card" style="display:none">
    <div class="ok"><div>ลงทะเบียนสำเร็จ</div><div class="code" id="doneCode"></div>
    <div id="doneName"></div><small>กรุณาไปสแกนใบหน้าที่ตู้สแกนหน้าโรงเรียน</small></div>
  </div>
  <form id="form" class="card" style="display:none" onsubmit="return submitForm(event)">
    <label>ชื่อ-นามสกุล *</label><input id="full_name" required maxlength="120"/>
    <label>เพศ</label>
    <select id="gender"><option value="">ไม่ระบุ</option><option value="male">ชาย</option><option value="female">หญิง</option></select>
    <label>สังกัด / อาชีพ</label><input id="affiliation" maxlength="120"/>
    <label>เหตุผลในการเข้าโรงเรียน</label><textarea id="reason" rows="2" maxlength="300"></textarea>
    <label>ภาพใบหน้า *</label>
    <video id="cam" autoplay playsinline muted></video>
    <img id="shot" style="display:none" alt="ภาพใบหน้าที่ถ่าย"/>
    <button type="button" class="ghost" id="shotBtn" onclick="takePhoto()">ถ่ายภาพใบหน้า</button>
    <button type="submit" id="send">ลงทะเบียน</button>
    <div class="msg bad" id="msg"></div>
  </form>
</div>
<canvas id="canvas" style="display:none"></canvas>
<script>
const $ = (id) => document.getElementById(id);
let photo = null;
async function boot() {
  try {
    const s = await (await fetch('/local/api/public/visit/status')).json();
    if (s.school_name) { $('title').textContent = 'ลงทะเบียนเข้า' + s.school_name; document.title = 'ลงทะเบียนผู้มาเยือน · ' + s.school_name; }
    if (!s.enabled) { $('closed').style.display = 'block'; return; }
  } catch (e) {}
  $('form').style.display = 'block';
  try { $('cam').srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } }); }
  catch (e) { $('msg').textContent = 'ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง'; }
}
function takePhoto() {
  const cam = $('cam'), c = $('canvas');
  c.width = cam.videoWidth || 640; c.height = cam.videoHeight || 480;
  c.getContext('2d').drawImage(cam, 0, 0, c.width, c.height);
  photo = c.toDataURL('image/jpeg', 0.9);
  $('shot').src = photo; $('shot').style.display = 'block'; $('cam').style.display = 'none';
  $('shotBtn').textContent = 'ถ่ายใหม่';
  $('cam').style.display = 'none';
}
async function submitForm(e) {
  e.preventDefault();
  $('msg').textContent = '';
  if (!photo) { $('msg').textContent = 'กรุณาถ่ายภาพใบหน้าก่อนลงทะเบียน'; return false; }
  $('send').disabled = true; $('send').textContent = 'กำลังลงทะเบียน…';
  try {
    const res = await fetch('/local/api/public/visit/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        full_name: $('full_name').value, gender: $('gender').value,
        affiliation: $('affiliation').value, reason: $('reason').value, photo,
      }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.detail || 'ลงทะเบียนไม่สำเร็จ');
    $('form').style.display = 'none';
    $('doneCode').textContent = d.code; $('doneName').textContent = d.full_name;
    $('done').style.display = 'block';
    const cam = $('cam');
    if (cam.srcObject) cam.srcObject.getTracks().forEach((t) => t.stop());
  } catch (err) {
    $('msg').textContent = err.message || 'ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่';
    $('send').disabled = false; $('send').textContent = 'ลงทะเบียน';
  }
  return false;
}
boot();
</script>
</body>
</html>
"""
