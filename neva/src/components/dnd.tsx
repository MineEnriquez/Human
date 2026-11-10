// Reusable drag-and-drop components (dnd-kit). Mouse, touch and keyboard (Space to pick up, arrows, Space to drop).
import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RichInline } from "./Rich";

const useDndSensors = () =>
  useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

function shuffle<T>(a: T[], seed = 7): T[] {
  const r = [...a];
  let s = seed;
  for (let i = r.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  // never start already solved
  return r.every((x, i) => x === a[i]) ? [...r.slice(1), r[0]] : r;
}

export const DragHint = ({ children = "Drag to reorder · keyboard: Space, arrows, Space" }: { children?: ReactNode }) => <span className="dnd-hint">⠿ {children}</span>;

// ------------------------------------------------------------------ SortableSequence
type SeqItem = { id: string; label: string; why?: string };
function SortRow({ item, index, state }: { item: SeqItem; index: number; state?: "right" | "wrong" }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`drag ${isDragging ? "dragging" : ""} ${state || ""}`} {...attributes} {...listeners}>
      <span className="num">{index + 1}</span><span className="grip">⋮⋮</span><span style={{ flex: 1 }}><RichInline text={item.label} /></span>
      {state === "right" && <span aria-label="correct">✓</span>}
    </div>
  );
}

/** Learner drags items into the correct order. `items` is given in the correct order. */
export function SortableSequence({ items, onSolved, seed }: { items: SeqItem[]; onSolved: (attempts: number) => void; seed?: number }) {
  const [order, setOrder] = useState(() => shuffle(items.map(i => i.id), seed));
  const [checked, setChecked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(false);
  const sensors = useDndSensors();
  const byId = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);
  const correctAt = (id: string, i: number) => items[i].id === id;

  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setChecked(false);
    setOrder(o => arrayMove(o, o.indexOf(String(e.active.id)), o.indexOf(String(e.over!.id))));
  };
  const check = () => {
    const n = attempts + 1;
    setAttempts(n); setChecked(true);
    if (order.every(correctAt)) { setSolved(true); onSolved(n); }
  };
  const right = order.filter(correctAt).length;
  return (
    <div className="stack">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="sortlist">{order.map((id, i) => <SortRow key={id} item={byId[id]} index={i} state={checked ? (correctAt(id, i) ? "right" : "wrong") : undefined} />)}</div>
        </SortableContext>
      </DndContext>
      <div className="row">
        <button className="btn primary" onClick={check} disabled={solved}>{solved ? "Solved ✓" : "Check order"}</button>
        {checked && !solved && <span className="feedback bad">{right} of {items.length} in the right place. Green ones are locked in your head now; move the red ones.</span>}
        {solved && <span className="feedback good">Correct{attempts === 1 ? " on the first try" : ` after ${attempts} tries`}.</span>}
      </div>
      {solved && items.some(i => i.why) && (
        <ol className="read" style={{ fontSize: ".95rem" }}>{items.map(i => <li key={i.id}><RichInline text={`**${i.label.replace(/\*\*/g, "")}**: ${i.why}`} /></li>)}</ol>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Buckets (generic)
export type BucketDef = { id: string; title: string; hint?: string; capacity?: number };
type Placement = Record<string, string>; // itemId -> bucketId | "tray"

function Draggable({ id, children, state }: { id: string; children: ReactNode; state?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return <div ref={setNodeRef} className={`drag ${isDragging ? "dragging" : ""} ${state || ""}`} {...attributes} {...listeners}><span className="grip">⋮⋮</span><div style={{ flex: 1, minWidth: 0 }}>{children}</div></div>;
}
function Zone({ id, className, children }: { id: string; className: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`${className} ${isOver ? "over" : ""}`}>{children}</div>;
}

/** Controlled multi-bucket board with an unsorted tray. Optional per-bucket capacity by item weight. */
export function BucketBoard<T extends { id: string }>({
  items, buckets, value, onChange, render, weight, stateOf, columns = 2, trayLabel = "Unsorted",
}: {
  items: T[]; buckets: BucketDef[]; value: Placement; onChange: (p: Placement) => void;
  render: (item: T) => ReactNode; weight?: (item: T) => number; stateOf?: (item: T) => string | undefined; columns?: number; trayLabel?: string;
}) {
  const sensors = useDndSensors();
  const [active, setActive] = useState<string | null>(null);
  const [warn, setWarn] = useState("");
  const where = (id: string) => value[id] || "tray";
  const load = (b: string) => items.filter(i => where(i.id) === b).reduce((n, i) => n + (weight ? weight(i) : 1), 0);

  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    const to = e.over ? String(e.over.id) : null;
    const id = String(e.active.id);
    if (!to || to === where(id)) return;
    const b = buckets.find(x => x.id === to);
    const item = items.find(i => i.id === id)!;
    if (b?.capacity != null && load(to) + (weight ? weight(item) : 1) > b.capacity) {
      setWarn(`"${b.title}" is full. Take something out first.`);
      return;
    }
    setWarn("");
    onChange({ ...value, [id]: to });
  };
  const activeItem = items.find(i => i.id === active);
  return (
    <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActive(String(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
      <div className="stack">
        <Zone id="tray" className="tray">
          {items.filter(i => where(i.id) === "tray").map(i => <Draggable key={i.id} id={i.id}>{render(i)}</Draggable>)}
          {!items.some(i => where(i.id) === "tray") && <span className="muted" style={{ fontSize: ".85rem" }}>{trayLabel}: empty</span>}
        </Zone>
        <div className="buckets" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {buckets.map(b => {
            const used = load(b.id);
            return (
              <Zone key={b.id} id={b.id} className="bucket">
                <div className="bucket-h"><span>{b.title}</span>{b.capacity != null && <span className="mono">{used}/{b.capacity}</span>}</div>
                {b.capacity != null && <div className={`meter ${used >= b.capacity ? "full" : ""}`}><span style={{ width: `${Math.min(100, (used / b.capacity) * 100)}%` }} /></div>}
                {b.hint && <div className="muted" style={{ fontSize: ".8rem" }}>{b.hint}</div>}
                {items.filter(i => where(i.id) === b.id).map(i => <Draggable key={i.id} id={i.id} state={stateOf?.(i)}>{render(i)}</Draggable>)}
              </Zone>
            );
          })}
        </div>
        {warn && <div className="feedback bad">{warn}</div>}
      </div>
      <DragOverlay>{activeItem ? <div className="drag overlay"><span className="grip">⋮⋮</span><div>{render(activeItem)}</div></div> : null}</DragOverlay>
    </DndContext>
  );
}

/** Graded sorting exercise built on BucketBoard: every item has one correct bucket. */
export function SortIntoBuckets({ items, buckets, onSolved, columns }: {
  items: { id: string; label: string; bucket: string; why: string }[]; buckets: BucketDef[]; onSolved: (attempts: number) => void; columns?: number;
}) {
  const [place, setPlace] = useState<Placement>({});
  const [checked, setChecked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(false);
  const placed = items.filter(i => place[i.id] && place[i.id] !== "tray").length;
  const check = () => {
    const n = attempts + 1;
    setAttempts(n); setChecked(true);
    if (items.every(i => place[i.id] === i.bucket)) { setSolved(true); onSolved(n); }
  };
  return (
    <div className="stack">
      <BucketBoard items={items} buckets={buckets} value={place} columns={columns}
        onChange={p => { setPlace(p); setChecked(false); }}
        render={i => <RichInline text={i.label} />}
        stateOf={i => (checked ? (place[i.id] === i.bucket ? "right" : "wrong") : undefined)} />
      <div className="row">
        <button className="btn primary" onClick={check} disabled={solved || placed < items.length}>{solved ? "Solved ✓" : placed < items.length ? `Place all cards (${placed}/${items.length})` : "Check"}</button>
        {checked && !solved && <span className="feedback bad">{items.filter(i => place[i.id] === i.bucket).length} of {items.length} correct. Red cards are in the wrong bucket.</span>}
      </div>
      {(solved || (checked && attempts >= 2)) && (
        <ul className="read" style={{ fontSize: ".93rem" }}>{items.map(i => <li key={i.id}><RichInline text={`${i.label} → **${buckets.find(b => b.id === i.bucket)?.title}**. ${i.why}`} /></li>)}</ul>
      )}
    </div>
  );
}
