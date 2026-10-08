// ชั่ วคราวสำหรับวัดตำแหน ่งป ุ่ ม logout ก ับฟอง AI (ลบท ิ้งท ี่หล ังตรวจ)
import "../index.css";

const avatar = `<span class="w-7 h-7 rounded-full bg-primary/10 ring-2 ring-primary/30 flex items-center justify-center flex-shrink-0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg></span>`;
const name = `<div class="text-[11px] font-semibold text-sidebar-foreground truncate leading-tight">ภานุพงษ ์ (Dennis)</div>`;
const badge = `<span class="inline-flex items-center rounded-md border border-transparent bg-destructive text-white text-[8px] h-3 px-1 leading-none font-medium">ผ ู้ด ูแลระบบ</span>`;
const logOutSvg = (cls: string) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

const sidebar = (inner: string) => `<div class="fixed inset-y-0 right-0 z-10 h-svh w-[15rem] bg-sidebar border-l border-sidebar-border flex flex-col">
  <div class="flex-1"></div>
  <div class="flex flex-col gap-1 border-t border-sidebar-border/70 bg-gradient-to-t from-sidebar-accent/25 to-transparent p-1.5">${inner}</div>
</div>`;

const oldLayout = sidebar(`<div class="flex items-center gap-1.5 min-w-0 px-1 py-0.5 rounded-lg hover:bg-sidebar-accent/40 transition-colors">
  ${avatar}
  <div class="min-w-0 flex-1">${name}<span class="mt-0.5 block">${badge}</span></div>
  <button data-role="logout" title="ออกจากระบบ" class="flex-shrink-0 w-6 h-6 rounded-md inline-flex items-center justify-center text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors">${logOutSvg("w-3.5 h-3.5")}</button>
</div>`);

const newLayout = sidebar(`<div class="flex items-center gap-1.5 min-w-0 px-1 py-0.5 rounded-lg hover:bg-sidebar-accent/40 transition-colors md:pr-[4.5rem]">
  ${avatar}
  <div class="min-w-0 flex-1">${name}<div class="mt-0.5 flex items-center gap-1">${badge}<button data-role="logout" title="ออกจากระบบ" aria-label="ออกจากระบบ" class="flex-shrink-0 w-6 h-4 rounded-[5px] border border-destructive/25 bg-destructive/5 inline-flex items-center justify-center text-destructive/80 hover:bg-destructive/15 hover:text-destructive transition-colors">${logOutSvg("w-3 h-3")}</button></div></div>
</div>`);

const bubble = `<button data-role="bubble" class="fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] right-3 md:bottom-[calc(env(safe-area-inset-bottom)+24px)] md:right-5 lg:bottom-[calc(env(safe-area-inset-bottom)+24px)] lg:right-6 z-40 group">
  <span class="relative block w-11 h-11 rounded-full bg-gradient-to-br from-pink-400 via-fuchsia-500 to-violet-500 border-2 border-white ring-2 ring-foreground/80 flex items-center justify-center overflow-hidden"></span>
  <span class="absolute -top-0.5 -right-0.5 w-3 h-3 bg-success rounded-full ring-2 ring-white animate-pulse"></span>
</button>`;

const layout = new URLSearchParams(window.location.search).get("layout") === "old" ? oldLayout : newLayout;
document.body.innerHTML = layout + bubble;
