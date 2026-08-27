type BrandMarkProps = {
  className?: string;
};

/** The shared mark mirrors src/app/icon.svg so browser chrome and the app agree. */
export function BrandMark({ className = "brand-mark" }: BrandMarkProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="18" fill="#2d3c78" />
      <path d="M18 47V17h7.2l13.6 17.2V17H46v30h-7.1L25.2 29.7V47z" fill="#fff8ea" />
      <circle cx="50" cy="14" r="5" fill="#e0a526" />
    </svg>
  );
}
