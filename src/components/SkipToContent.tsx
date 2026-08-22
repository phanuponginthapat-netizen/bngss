export default function SkipToContent() {
  return (
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:p-4 focus:bg-primary focus:text-primary-foreground focus:top-0 focus:left-0">
      Skip to main content
    </a>
  );
}
