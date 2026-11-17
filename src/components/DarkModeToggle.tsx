import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sun, Moon, Monitor } from "lucide-react";

export default function DarkModeToggle() {
  const { theme, setTheme } = useTheme();
  const selected = theme || "system";
  const Icon = selected === "system" ? Monitor : selected === "dark" ? Moon : Sun;
  const label = selected === "system" ? "ตามระบบ" : selected === "dark" ? "มืด" : "สว่าง";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`เลือกโหมดสี: ${label}`} title={`โหมด${label}`} className="relative rounded-lg border border-border/60 bg-background/60 text-foreground hover:bg-accent">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-lg">
        <DropdownMenuLabel className="text-xs text-muted-foreground">โหมดสี</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={selected} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light" className="gap-2 py-2.5"><Sun className="h-4 w-4" />สว่าง</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="gap-2 py-2.5"><Moon className="h-4 w-4" />มืด</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="gap-2 py-2.5"><Monitor className="h-4 w-4" />ตามระบบ</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
