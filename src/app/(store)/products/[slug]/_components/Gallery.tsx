"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { IconBox } from "@/components/ui";
import { cx } from "@/components/ui";

/**
 * Product image gallery. Hero = imageUrls[0] (LCP image, `priority`),
 * thumbnail strip for multi-image products. Mobile-first: the hero
 * responds to horizontal touch swipes (delta > 40px); thumbnails are real
 * buttons, so keyboard users switch images with Tab + Enter.
 *
 * Client-only interactivity (active index + swipe) — all props are
 * serializable (string arrays).
 */
export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const hero = images[0];
  const count = images.length;

  if (!hero) {
    return (
      <div
        aria-hidden="true"
        className="flex aspect-square items-center justify-center rounded-xl border border-stone-200 bg-stone-100 text-stone-300"
      >
        <IconBox className="size-16" />
      </div>
    );
  }

  // Single-image products: no swipe/thumbs machinery to keep in the DOM.
  if (count <= 1) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
        <Image
          src={hero}
          alt={name}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
    );
  }

  const showNext = () => setActive((i) => (i + 1) % count);
  const showPrev = () => setActive((i) => (i - 1 + count) % count);

  return (
    <div>
      <div
        className="relative aspect-square touch-pan-y overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          const end = event.changedTouches[0]?.clientX;
          touchStartX.current = null;
          if (start == null || end == null) return;
          const delta = end - start;
          if (Math.abs(delta) > 40) {
            (delta < 0 ? showNext : showPrev)();
          }
        }}
      >
        <Image
          key={active}
          src={images[active]}
          alt={`${name} — image ${active + 1} of ${count}`}
          fill
          priority={active === 0}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
        {/* Screen readers hear the active image; sighted users see a counter. */}
        <span className="sr-only" aria-live="polite">
          Image {active + 1} of {count}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-white">
          {active + 1} / {count}
        </span>
      </div>

      <div
        role="group"
        aria-label="Product images"
        className="mt-3 flex gap-2 overflow-x-auto pb-1"
      >
        {images.map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => setActive(index)}
            aria-label={`Show image ${index + 1}`}
            aria-current={index === active ? "true" : undefined}
            className={cx(
              "relative size-16 shrink-0 overflow-hidden rounded-lg border-2 bg-stone-100 transition-colors sm:size-20",
              index === active
                ? "border-brand-700"
                : "border-transparent hover:border-stone-300",
            )}
          >
            <Image src={src} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
