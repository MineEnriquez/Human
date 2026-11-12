// A one-row carousel: native horizontal scrolling with snap points (so touch swipe and trackpads just work),
// previous/next buttons, page dots, and arrow keys when focused. Accessible as a labelled carousel region.
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export function Carousel({ label, children }: { label: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const slides = Children.toArray(children);
  const [state, setState] = useState({ index: 0, perView: 1, atStart: true, atEnd: false });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el || !el.firstElementChild) return;
    const slide = el.firstElementChild as HTMLElement;
    const step = slide.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0");
    const perView = Math.max(1, Math.round((el.clientWidth + parseFloat(getComputedStyle(el).columnGap || "0")) / step));
    const index = Math.round(el.scrollLeft / step);
    setState({ index, perView, atStart: el.scrollLeft <= 2, atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", measure); };
  }, [measure, slides.length]);

  const go = (i: number) => {
    const el = track.current;
    const target = el?.children[Math.max(0, Math.min(slides.length - 1, i))] as HTMLElement | undefined;
    if (el && target) el.scrollTo({ left: target.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };
  const pages = Math.max(1, slides.length - state.perView + 1);
  const scrollable = slides.length > state.perView;

  return (
    <section className="carousel" aria-roledescription="carousel" aria-label={label}>
      <div className="carousel-track" ref={track} tabIndex={0}
        onKeyDown={e => { if (e.key === "ArrowRight") { e.preventDefault(); go(state.index + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); go(state.index - 1); } }}>
        {slides.map((s, i) => (
          <div key={i} className="carousel-slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`}>{s}</div>
        ))}
      </div>
      {scrollable && (
        <>
          <button className="carousel-chevron left" onClick={() => go(state.index - 1)} disabled={state.atStart} aria-label="Previous"><Chevron dir="left" /></button>
          <button className="carousel-chevron right" onClick={() => go(state.index + 1)} disabled={state.atEnd} aria-label="Next"><Chevron dir="right" /></button>
          <div className="carousel-dots">
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} className={`carousel-dot ${Math.min(state.index, pages - 1) === i ? "on" : ""}`} onClick={() => go(i)} aria-label={`Go to slide ${i + 1}`} aria-current={Math.min(state.index, pages - 1) === i ? "true" : undefined} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);
