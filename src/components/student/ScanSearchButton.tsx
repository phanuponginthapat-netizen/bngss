import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScanLine } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";

interface Props {
  onScan: (code: string) => void;
  title?: string;
  className?: string;
}

/** Compact scan button to place next to a student search input. */
export const ScanSearchButton = ({ onScan, title = "สแกนบัตรนักเรียน", className }: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        title={title}
        className={`shrink-0 ${className ?? ""}`}
      >
        <ScanLine className="h-4 w-4" />
      </Button>
      <BarcodeScanner
        open={open}
        onClose={() => setOpen(false)}
        onScan={(code) => {
          const c = (code || "").trim();
          if (c) onScan(c);
        }}
        title={title}
      />
    </>
  );
};

export default ScanSearchButton;
