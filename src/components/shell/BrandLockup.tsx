import { BrandMark } from "./BrandMark";

type BrandLockupProps = {
  /** Header keeps the name to one line; the fuller form carries the local-language signature. */
  compact?: boolean;
  className?: string;
};

/** The reusable 4B lockup: civic navy, a warm-teal roofline, and a bilingual wordmark. */
export function BrandLockup({ compact = false, className = "" }: BrandLockupProps) {
  return (
    <div className={`brand-lockup${compact ? " brand-lockup--compact" : ""}${className ? ` ${className}` : ""}`}>
      <BrandMark />
      <span className="brand-wordmark">
        <span className="brand-wordmark__name"><span>Nagar</span><span>Sakhi</span></span>
        {!compact ? <span className="brand-wordmark__local">नगर साखी</span> : null}
      </span>
    </div>
  );
}
