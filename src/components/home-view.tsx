"use client";

import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { courseStats, hasDecks } from '@/lib/outline';
import { findItemById, flattenIndex, splitNumberPrefix } from '@/lib/tree';
import type { CoursePosition, OutlineItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface HomeViewProps {
  outline: OutlineItem[];
  /** El temario mostrado es provisional (todavía no llega el real). */
  pending: boolean;
  lastVisited: CoursePosition | null;
  onSelect: (topicId: string, deck?: number) => void;
}

export function HomeView({ outline, pending, lastVisited, onSelect }: HomeViewProps) {
  const stats = useMemo(() => courseStats(outline), [outline]);
  const maxDecks = useMemo(
    () => Math.max(1, ...flattenIndex(outline).map((item) => item.decks?.length ?? 0)),
    [outline],
  );
  // Todas las gráficas comparten eje: el tema n queda alineado entre capítulos.
  const maxSections = useMemo(() => Math.max(1, ...outline.map((chapter) => chapter.children?.length ?? 0)), [outline]);
  const resume = lastVisited ? findItemById(outline, lastVisited.topicId) : null;
  const first = useMemo(() => flattenIndex(outline).find(hasDecks) ?? null, [outline]);

  return (
    <div className="scroll-slim h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-16 sm:px-8">
        <header className="max-w-3xl">
          <h1 className="font-display text-[clamp(2.25rem,5.5vw,3.5rem)] font-semibold leading-[1.02] tracking-tight">Señales y Sistemas</h1>
          <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
            Presentaciones interactivas para estudiar el libro de Oppenheim, Willsky y Nawab, capítulo por capítulo.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            {resume && lastVisited ? (
              <Button size="lg" onClick={() => onSelect(lastVisited.topicId, lastVisited.deck)} className="max-w-full">
                <span className="truncate">Continuar en {resume.title}</span>
                <ArrowRight aria-hidden="true" />
              </Button>
            ) : first ? (
              <Button size="lg" onClick={() => onSelect(first.id)} className="max-w-full">
                <span className="truncate">Empezar por {first.title}</span>
                <ArrowRight aria-hidden="true" />
              </Button>
            ) : null}
            {!pending && stats.decks > 0 && (
              <p className="text-sm text-muted-foreground">
                {stats.decks} presentaciones en {stats.topicsWithDecks} de {stats.topics} temas.
              </p>
            )}
          </div>
        </header>

        <section aria-labelledby="temario" className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b pb-3">
            <h2 id="temario" className="font-display text-xl font-semibold">
              Temario
            </h2>
            <p className="text-sm text-muted-foreground">
              Cada trazo es un tema y su altura, cuántas presentaciones tiene. Elige uno para abrirlo.
            </p>
          </div>

          <ol>
            {outline.map((chapter, index) => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                order={index}
                maxDecks={maxDecks}
                maxSections={maxSections}
                currentId={lastVisited?.topicId ?? null}
                onSelect={onSelect}
              />
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function ChapterRow({
  chapter,
  order,
  maxDecks,
  maxSections,
  currentId,
  onSelect,
}: {
  chapter: OutlineItem;
  order: number;
  maxDecks: number;
  maxSections: number;
  currentId: string | null;
  onSelect: (topicId: string, deck?: number) => void;
}) {
  const { number, text } = splitNumberPrefix(chapter.title);
  const sections = chapter.children ?? [];
  const ready = sections.filter(hasDecks);
  const entry = hasDecks(chapter) ? chapter : (ready[0] ?? null);

  const summary =
    sections.length === 0
      ? hasDecks(chapter)
        ? `${chapter.decks!.length} presentaciones`
        : 'Sin temas todavía'
      : ready.length === 0
        ? 'En preparación'
        : `${ready.length} de ${sections.length} temas con presentaciones`;

  return (
    <li className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b py-5 md:grid-cols-[3.5rem_minmax(0,1fr)_auto] md:gap-x-6">
      <span aria-hidden="true" className={cn('font-display text-4xl font-semibold leading-none tabular-nums md:text-5xl', ready.length > 0 || hasDecks(chapter) ? 'text-signal' : 'text-soft')}>
        {number ?? order + 1}
      </span>
      <div className="min-w-0">
        {entry ? (
          <button type="button" onClick={() => onSelect(entry.id)} className="block max-w-full rounded text-left hover:text-signal" title={`Abrir ${entry.title}`}>
            <h3 className="font-display text-xl font-semibold leading-snug md:text-2xl">{text}</h3>
          </button>
        ) : (
          <h3 className="font-display text-xl font-semibold leading-snug text-muted-foreground md:text-2xl">{text}</h3>
        )}
        <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
      </div>
      {sections.length > 0 && (
        <div className="scroll-none col-span-2 -mx-1 overflow-x-auto md:col-span-1 md:mx-0">
          <StemPlot sections={sections} maxDecks={maxDecks} slots={maxSections} currentId={currentId} baseDelay={order * 40} onSelect={onSelect} />
        </div>
      )}
    </li>
  );
}

const STEP = 30;
const TOP = 10;
const BASELINE = 62;
const HEIGHT = 84;

/**
 * Gráfica de secuencia discreta: n = tema, x[n] = número de presentaciones.
 * Un tema sin contenido se dibuja como la muestra nula (círculo hueco sobre el
 * eje), igual que en las figuras del libro.
 */
function StemPlot({
  sections,
  maxDecks,
  slots,
  currentId,
  baseDelay,
  onSelect,
}: {
  sections: OutlineItem[];
  maxDecks: number;
  /** Ancho del eje en temas (el capítulo más largo del curso). */
  slots: number;
  currentId: string | null;
  baseDelay: number;
  onSelect: (topicId: string, deck?: number) => void;
}) {
  const width = Math.max(slots, sections.length) * STEP + 8;
  const axisEnd = sections.length * STEP + 8;
  return (
    <svg
      width={width}
      height={HEIGHT}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      role="group"
      aria-label="Temas del capítulo"
      className="block overflow-visible"
    >
      <line x1={0} x2={axisEnd} y1={BASELINE} y2={BASELINE} className="stroke-border" strokeWidth={1.5} />
      {sections.map((section, i) => {
        const count = section.decks?.length ?? 0;
        const x = 4 + i * STEP + STEP / 2;
        const y = count > 0 ? BASELINE - 12 - ((BASELINE - TOP - 12) * (count - 1)) / Math.max(1, maxDecks - 1) : BASELINE;
        const { number } = splitNumberPrefix(section.title);
        const label = number ? number.split('.').pop() : String(i + 1);
        const isCurrent = section.id === currentId;
        const delay = `${baseDelay + i * 22}ms`;
        const description =
          count === 0 ? `${section.title}: en preparación` : `${section.title}: ${count === 1 ? '1 presentación' : `${count} presentaciones`}`;
        return (
          <a
            key={section.id}
            href={`#/t/${encodeURIComponent(section.id)}`}
            aria-label={description}
            onClick={(event) => {
              event.preventDefault();
              onSelect(section.id);
            }}
            className="group cursor-pointer outline-none"
          >
            <title>{description}</title>
            <rect
              x={x - STEP / 2}
              y={0}
              width={STEP}
              height={HEIGHT}
              rx={6}
              className="fill-transparent transition-colors group-hover:fill-signal/10 group-focus-visible:fill-signal/20"
            />
            {count > 0 ? (
              <>
                <line
                  x1={x}
                  x2={x}
                  y1={BASELINE}
                  y2={y}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  className="stem-line stroke-signal"
                  style={{ animationDelay: delay }}
                />
                {isCurrent && <circle cx={x} cy={y} r={9} className="fill-none stroke-control" strokeWidth={2} />}
                <circle cx={x} cy={y} r={5} className="stem-dot fill-signal" style={{ animationDelay: `calc(${delay} + 0.35s)` }} />
              </>
            ) : (
              <circle cx={x} cy={BASELINE} r={3.5} className="fill-background stroke-soft" strokeWidth={1.5} />
            )}
            <text
              x={x}
              y={BASELINE + 16}
              textAnchor="middle"
              className={cn('text-[11px] font-semibold tabular-nums', count > 0 ? 'fill-muted-foreground' : 'fill-soft')}
            >
              {label}
            </text>
          </a>
        );
      })}
    </svg>
  );
}
