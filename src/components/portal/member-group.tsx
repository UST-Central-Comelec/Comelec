"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition, type RefObject } from "react";
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { MemberBody } from "@/lib/data/types";
import { reorderMembers } from "@/lib/portal/member-actions";
import { MemberAvatar } from "./member-avatar";

/** What a directory card shows: `subtitle` is the position and college line under the name. */
export type DirectoryMember = { id: string; name: string; subtitle: string; photoUrl: string | null };
type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

/**
 * One group of the Directory, in the order the About page shows it. Drag any card to
 * move it: with a mouse, just drag (a plain click still opens the member); on touch, press and hold
 * first so swiping still scrolls; with the keyboard, focus a card, press Space, move with the arrow
 * keys and press Space again (Enter still opens it). The order saves straight away.
 * `college` limits it to one college's Local Comelec.
 */
export function MemberGroup({ body, college, members }: { body: MemberBody; college?: string; members: DirectoryMember[] }) {
  const [items, setItems] = useState(members);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const dndId = useId();
  // The click that ends a mouse drag mustn't open the card that was dropped.
  const justDragged = useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] } }),
  );
  const nameOf = (id: string | number) => items.find((item) => item.id === id)?.name ?? "member";
  const placeOf = (id: string | number | undefined) => items.findIndex((item) => item.id === id) + 1;

  const settle = () => {
    setTimeout(() => (justDragged.current = false), 0);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    settle();
    if (!over || active.id === over.id) return;
    const before = items;
    const next = arrayMove(items, placeOf(active.id) - 1, placeOf(over.id) - 1);
    setItems(next);
    setStatus({ kind: "saving" });
    startTransition(async () => {
      const result = await reorderMembers(body, next.map((item) => item.id), college);
      if (result.error) {
        setItems(before);
        setStatus({ kind: "error", message: result.error });
      } else {
        setStatus({ kind: "saved" });
      }
    });
  };

  return (
    <>
      <p className={`directory-status is-${status.kind}`} role="status">
        {status.kind === "saving" ? "Saving order…" : status.kind === "saved" ? "Order saved" : status.kind === "error" ? status.message : ""}
      </p>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => {
          justDragged.current = true;
        }}
        onDragEnd={onDragEnd}
        onDragCancel={settle}
        accessibility={{
          screenReaderInstructions: { draggable: "To reorder, press Space to pick up this member, use the arrow keys to move them, then press Space to drop or Escape to cancel. Press Enter to open them." },
          announcements: {
            onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, position ${placeOf(active.id)} of ${items.length}.`,
            onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} is now at position ${placeOf(over.id)} of ${items.length}.` : undefined),
            onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} dropped at position ${placeOf(over.id)} of ${items.length}.` : `${nameOf(active.id)} dropped.`),
            onDragCancel: ({ active }) => `Reordering cancelled. ${nameOf(active.id)} is back where it was.`,
          },
        }}
      >
        <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
          <ul className="portal-members directory-grid">
            {items.map((member) => <MemberCard key={member.id} member={member} justDragged={justDragged} />)}
          </ul>
        </SortableContext>
      </DndContext>
    </>
  );
}

function MemberCard({ member, justDragged }: { member: DirectoryMember; justDragged: RefObject<boolean> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: member.id });

  return (
    <li ref={setNodeRef} className={`directory-card${isDragging ? " is-dragging" : ""}`} style={{ transform: CSS.Translate.toString(transform), transition }}>
      {/* The whole card is the drag handle, but stays a link (its role isn't swapped for "button"). */}
      <Link
        href={`/portal/members/${member.id}`}
        aria-roledescription={attributes["aria-roledescription"]}
        aria-describedby={attributes["aria-describedby"]}
        onClickCapture={(event) => {
          if (justDragged.current) event.preventDefault();
        }}
        {...listeners}
      >
        <GripVertical className="directory-grip" size={16} strokeWidth={1.8} aria-hidden="true" />
        <MemberAvatar photoUrl={member.photoUrl} />
        <span><strong>{member.name}</strong><small>{member.subtitle}</small></span>
        <span className="portal-muted">Edit</span>
      </Link>
    </li>
  );
}
