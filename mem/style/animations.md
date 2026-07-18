---
name: Animation system
description: Tailwind + CSS animations (fade-in, scale, slide, hover-lift, stagger) ทั่วระบบ
type: design
---
- Tailwind: animate-fade-in, fade-in-up, scale-in, slide-in-right/left, float, pulse-soft, gradient-shift, enter
- CSS utilities: hover-lift, hover-scale, hover-glow, story-link, stagger-children, page-enter
- DashboardLayout: wrap Outlet ด้วย `<div key={pathname} className="animate-fade-in-up">` → page transition
- Card: `transition-all hover:shadow-md` global; Button: `hover:scale-[1.02] active:scale-[0.97]`
