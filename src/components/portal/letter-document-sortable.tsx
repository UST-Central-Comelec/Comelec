"use client";

import { Children, isValidElement, useRef, useState, type ReactNode } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type Modifier } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useReducedMotion } from "motion/react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

export function LetterDocumentList({ ids, onMove, children }: { ids: string[]; onMove: (from: number, to: number) => void; children: ReactNode }) {
  const list = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const activeCard = Children.toArray(children).find(child => isValidElement<{ id: string; children: ReactNode }>(child) && child.props.id === activeId);
  const activeContent = isValidElement<{ children: ReactNode }>(activeCard) ? activeCard.props.children : null;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const constrain: Modifier = ({ transform, draggingNodeRect }) => {
    const bounds = list.current?.getBoundingClientRect();
    const y = bounds && draggingNodeRect
      ? Math.min(Math.max(transform.y, bounds.top - draggingNodeRect.top), Math.max(bounds.top - draggingNodeRect.top, bounds.bottom - draggingNodeRect.bottom))
      : transform.y;
    return { ...transform, x: 0, y, scaleX: 1, scaleY: 1 };
  };
  return <DndContext sensors={sensors} modifiers={[constrain]} collisionDetection={closestCenter} onDragStart={({ active }) => setActiveId(String(active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from !== -1 && to !== -1) onMove(from, to);
  }}><SortableContext items={ids} strategy={verticalListSortingStrategy}><div ref={list} className="portal-letter-document-list">{children}</div></SortableContext><DragOverlay dropAnimation={reducedMotion ? null : { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
    {activeId ? <div className="portal-letter-document-card is-dragging" aria-hidden="true">
      <div className="portal-letter-document-controls">
        <span className="portal-letter-document-handle"><GripVertical size={18} /></span>
        <span className="portal-letter-document-stepper"><ChevronUp size={14} /><ChevronDown size={14} /></span>
      </div>
      <fieldset disabled className="portal-letter-document-row" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>{activeContent}</fieldset>
    </div> : null}
  </DragOverlay></DndContext>;
}

export function LetterDocumentCard({ id, index, count, onMove, disabled, children }: { id: string; index: number; count: number; onMove: (from: number, to: number) => void; disabled: boolean; children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled, transition: reducedMotion ? null : { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" } });
  // Dnd-kit owns both sorting transforms and the overlay's drop animation.
  // Mixing Motion layout projection with these transforms moved the card twice on release.
  return <div ref={setNodeRef} className="portal-letter-document-card" style={{ transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined, transition, opacity: isDragging ? 0 : undefined }}>
    <div className="portal-letter-document-controls">
    <button ref={setActivatorNodeRef} type="button" className="portal-letter-document-handle" {...attributes} {...listeners} disabled={disabled} aria-label={`Reorder document ${index + 1}`} title="Drag to reorder"><GripVertical size={18} aria-hidden="true" /></button>
    <div className="portal-letter-document-stepper">
      <button type="button" className="portal-letter-document-step" disabled={disabled || isDragging || index === 0} aria-label={`Move document ${index + 1} up`} title="Move up" onClick={() => { if (!disabled && !isDragging && index > 0) onMove(index, index - 1); }}><ChevronUp size={14} aria-hidden="true" /></button>
      <button type="button" className="portal-letter-document-step" disabled={disabled || isDragging || index >= count - 1} aria-label={`Move document ${index + 1} down`} title="Move down" onClick={() => { if (!disabled && !isDragging && index < count - 1) onMove(index, index + 1); }}><ChevronDown size={14} aria-hidden="true" /></button>
    </div>
    </div>
    <div className="portal-letter-document-row">{children}</div>
  </div>;
}
