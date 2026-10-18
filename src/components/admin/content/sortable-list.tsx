"use client";

import * as React from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortableRenderArgs = { handle: React.ReactNode; isDragging: boolean; index: number };

/**
 * Generic keyboard-accessible sortable list built on dnd-kit. `getId` must return
 * a stable, unique string per item. Use `layout="grid"` for image grids.
 */
export function SortableList<T>({ items, getId, onReorder, renderItem, layout = "list", className, disabled }: { items: T[]; getId: (item: T, index: number) => string; onReorder: (items: T[], from: number, to: number) => void; renderItem: (item: T, args: SortableRenderArgs) => React.ReactNode; layout?: "list" | "grid"; className?: string; disabled?: boolean }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = items.map(getId);
  const dndId = React.useId();
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to), from, to);
  };
  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy} disabled={disabled}>
        <div className={className}>
          {items.map((item, i) => (
            <SortableItem key={ids[i]} id={ids[i]} index={i} disabled={disabled}>
              {(args) => renderItem(item, args)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id, index, children, disabled }: { id: string; index: number; disabled?: boolean; children: (args: SortableRenderArgs) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined };
  const handle = (
    <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} className={cn("grid h-7 w-6 shrink-0 cursor-grab touch-none place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600 active:cursor-grabbing", disabled && "invisible")} aria-label="Drag to reorder (space to pick up, arrow keys to move)">
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-80 shadow-elev")}>
      {children({ handle, isDragging, index })}
    </div>
  );
}
