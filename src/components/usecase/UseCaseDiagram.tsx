"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import {
  actors,
  packageActors,
  packages,
  type Actor,
  type ActorId,
} from "./useCaseData";

type Box = { x: number; y: number; w: number; h: number };
type Geometry = {
  w: number;
  h: number;
  actors: Partial<Record<ActorId, Box>>;
  packages: Record<string, Box>;
};

const leftActors = actors.filter((a) => a.side === "left");
const rightActors = actors.filter((a) => a.side === "right");
const actorById = Object.fromEntries(actors.map((a) => [a.id, a])) as Record<
  ActorId,
  Actor
>;

/** Оролцогч бүрийн холбогдох багцууд — шугам зурахад */
const links = actors.flatMap((actor) =>
  packages
    .filter((pkg) => pkg.cases.some((c) => c.actors.includes(actor.id)))
    .map((pkg) => ({ actor: actor.id, pkg: pkg.id }))
);

function StickFigure({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 40 56"
      className="h-12 w-9"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="20" cy="9" r="6.5" />
      <path d="M20 16v20M8 24h24M20 36l-9 16M20 36l9 16" />
    </svg>
  );
}

export default function UseCaseDiagram() {
  const [selected, setSelected] = useState<ActorId | null>(null);
  const [geom, setGeom] = useState<Geometry | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const actorRefs = useRef<Partial<Record<ActorId, HTMLElement | null>>>({});
  const pkgRefs = useRef<Record<string, HTMLElement | null>>({});

  const measure = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const box = (el: HTMLElement | null | undefined): Box | undefined => {
      if (!el) return undefined;
      const r = el.getBoundingClientRect();
      // Жижиг дэлгэцэд нуугдсан (display:none) элемент — шугамгүй
      if (r.width === 0 && r.height === 0) return undefined;
      return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    };

    const next: Geometry = { w: base.width, h: base.height, actors: {}, packages: {} };
    for (const a of actors) {
      const b = box(actorRefs.current[a.id]);
      if (b) next.actors[a.id] = b;
    }
    for (const p of packages) {
      const b = box(pkgRefs.current[p.id]);
      if (b) next.packages[p.id] = b;
    }
    setGeom(next);
  }, []);

  useLayoutEffect(() => {
    measure();
    const root = containerRef.current;
    if (!root) return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [measure]);

  const toggle = (id: ActorId | null) =>
    setSelected((cur) => (cur === id ? null : id));

  /** Багц/use case сонгосон оролцогчид хамаатай эсэх */
  const pkgActive = (pkgId: string) =>
    !selected || links.some((l) => l.actor === selected && l.pkg === pkgId);

  const selectedActor = selected ? actorById[selected] : null;
  const selectedCount = selected
    ? packages.reduce(
        (n, p) => n + p.cases.filter((c) => c.actors.includes(selected)).length,
        0
      )
    : packages.reduce((n, p) => n + p.cases.length, 0);

  /** Оролцогчоос багц хүртэлх муруй — оролцогчийн талын ирмэгт залгана */
  function path(actorId: ActorId, pkgId: string): string | null {
    const a = geom?.actors[actorId];
    const p = geom?.packages[pkgId];
    if (!a || !p) return null;
    const left = actorById[actorId].side === "left";
    // Дүрсний голоос (толгой-бие) гарна
    const x1 = left ? a.x + a.w : a.x;
    const y1 = a.y + 28;
    const x2 = left ? p.x : p.x + p.w;
    const y2 = p.y + Math.min(p.h / 2, 40);
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.45);
    const c1 = left ? x1 + dx : x1 - dx;
    const c2 = left ? x2 - dx : x2 + dx;
    return `M${x1},${y1} C${c1},${y1} ${c2},${y2} ${x2},${y2}`;
  }

  const renderActor = (actor: Actor) => {
    const active = !selected || selected === actor.id;
    return (
      <button
        key={actor.id}
        type="button"
        ref={(el) => {
          actorRefs.current[actor.id] = el;
        }}
        onClick={() => toggle(actor.id)}
        aria-pressed={selected === actor.id}
        className={`flex w-full flex-col items-center rounded-lg px-1 py-2 text-center transition-opacity duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
          active ? "opacity-100" : "opacity-35 hover:opacity-70"
        }`}
      >
        <StickFigure
          color={selected === actor.id ? actor.color : "rgba(255,255,255,0.55)"}
        />
        <span
          className="mt-1 text-[13px] font-semibold"
          style={{ color: selected === actor.id ? actor.color : "#fff" }}
        >
          {actor.label}
        </span>
        {actor.sub.map((line) => (
          <span key={line} className="text-[10.5px] leading-snug text-white/55">
            {line}
          </span>
        ))}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        Зүүн талд системийг ашигладаг хүмүүс, баруун талд удирдлага ба системтэй
        холбогддог гадаад үйлчилгээ байна. Оролцогч дээр дарж зөвхөн түүний use
        case-ийг харна. Дээд эрх доод эрхийн бүх use case-ийг өвлөнө: Супер админ ⊃
        Админ ⊃ Гишүүн, Харуулын аймаг ⊃ Аймгийн гишүүн.
      </p>

      {/* Шүүлтүүр */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Оролцогчоор шүүх">
        {actors.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => toggle(a.id)}
            aria-pressed={selected === a.id}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
              selected === a.id
                ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-400 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/40"
            }`}
          >
            <span className="size-2.5 rounded-[3px]" style={{ background: a.color }} />
            {a.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSelected(null)}
          aria-pressed={selected === null}
          className={`rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
            selected === null
              ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-400 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/40"
          }`}
        >
          Бүгд
        </button>
      </div>

      {/* Диаграм */}
      <div className="overflow-hidden rounded-2xl bg-[#232a5e] p-3 shadow-sm ring-1 ring-black/5 sm:p-5">
        <div
          ref={containerRef}
          className="relative grid grid-cols-1 gap-4 lg:grid-cols-[150px_minmax(0,1fr)_150px] lg:gap-6 xl:grid-cols-[170px_minmax(0,1fr)_170px]"
        >
          {/* Холбоос шугамууд — картуудын ард */}
          {geom && (
            <svg
              className="pointer-events-none absolute inset-0 z-0 hidden lg:block"
              width={geom.w}
              height={geom.h}
              aria-hidden
            >
              {links.map((l) => {
                const d = path(l.actor, l.pkg);
                if (!d) return null;
                const on = selected === l.actor;
                if (selected && !on) return null;
                return (
                  <path
                    key={`${l.actor}-${l.pkg}`}
                    d={d}
                    fill="none"
                    stroke={on ? actorById[l.actor].color : "rgba(255,255,255,0.09)"}
                    strokeWidth={on ? 1.6 : 1}
                  />
                );
              })}
            </svg>
          )}

          <div className="relative z-10 hidden flex-col justify-around gap-6 lg:flex">
            {leftActors.map(renderActor)}
          </div>

          {/* Системийн хил */}
          <div className="relative z-10 rounded-xl border border-dashed border-white/25 p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[13px] font-semibold text-white">
                dash.bbuchmongol.com · ББУЧ удирдлагын систем
              </span>
              <span className="text-[11px] text-white/55">
                {selectedActor ? `${selectedActor.label}: ` : "Нийт "}
                {selectedCount} use case
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {packages.map((pkg) => {
                const active = pkgActive(pkg.id);
                const highlight = !!selected && active;
                return (
                  <section
                    key={pkg.id}
                    ref={(el) => {
                      pkgRefs.current[pkg.id] = el;
                    }}
                    className={`rounded-lg border p-3 transition-[border-color,background-color] duration-200 ${
                      highlight ? "bg-[#1b2150]" : active ? "border-white/10 bg-[#2a3270]" : "border-white/5 bg-[#252c63]"
                    }`}
                    style={highlight ? { borderColor: selectedActor!.color } : undefined}
                  >
                    <div className={`transition-opacity duration-200 ${active ? "opacity-100" : "opacity-30"}`}>
                    <header className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="text-[12.5px] font-semibold leading-snug text-white">
                        {pkg.title}
                      </h3>
                      <span className="mt-1 flex shrink-0 gap-1" aria-hidden>
                        {packageActors(pkg).map((id) => (
                          <span
                            key={id}
                            className="size-1.5 rounded-full"
                            style={{ background: actorById[id].color }}
                            title={actorById[id].label}
                          />
                        ))}
                      </span>
                    </header>
                    <ul className="flex flex-col gap-1.5">
                      {pkg.cases.map((uc) => {
                        const mine = !!selected && uc.actors.includes(selected);
                        const dim = !!selected && !mine;
                        return (
                          <li
                            key={uc.label}
                            className={`rounded-full border px-3 py-1 text-center text-[11px] leading-snug transition-colors duration-200 ${
                              mine
                                ? "border-transparent bg-white text-[#1b2150]"
                                : "border-white/25 text-white/80"
                            } ${dim ? "opacity-45" : ""}`}
                            style={mine ? { boxShadow: `inset 0 0 0 1.5px ${selectedActor!.color}` } : undefined}
                          >
                            {uc.label}
                          </li>
                        );
                      })}
                    </ul>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          <div className="relative z-10 hidden flex-col justify-around gap-6 lg:flex">
            {rightActors.map(renderActor)}
          </div>
        </div>
      </div>
    </div>
  );
}
