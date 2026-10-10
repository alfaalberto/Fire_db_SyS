import { cn } from '@/lib/utils';

/** Secuencia discreta x[n]: el dibujo que abre el curso. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-7 w-7', className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-signal" />
      <g className="stroke-primary-foreground" strokeWidth="2" strokeLinecap="round">
        <path d="M6 23.5h20" opacity=".55" />
        <path d="M9 23.5V17M14 23.5V9.5M19 23.5V13M24 23.5V19" />
      </g>
      <g className="fill-primary-foreground">
        <circle cx="9" cy="16" r="2" />
        <circle cx="14" cy="8.5" r="2" />
        <circle cx="19" cy="12" r="2" />
        <circle cx="24" cy="18" r="2" />
      </g>
    </svg>
  );
}
