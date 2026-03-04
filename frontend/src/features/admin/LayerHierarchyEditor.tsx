import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useLayerStore } from '@/store/layerStore';
import type { LayerNode } from '@/types/layer';
import { flattenTree, buildTree } from '@/features/layers/layerUtils';
import type { FlatLayer } from '@/types/layer';

// ─── SortableRow ─────────────────────────────────────────────────────────────

interface SortableRowProps {
  row: FlatLayer;
  allLayers: FlatLayer[];
  onParentChange: (id: string, newParentId: string | null) => void;
  onRestrictedChange: (id: string, restricted: boolean) => void;
}

function SortableRow({ row, allLayers, onParentChange, onRestrictedChange }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex:  isDragging ? 10 : undefined,
  };

  // Possible parents: any layer that is not itself and not its descendant
  const possibleParents = allLayers.filter(l => l.id !== row.id);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-slate-100 last:border-0 bg-white hover:bg-blue-50/30 transition-all duration-150 ${
        isDragging ? 'shadow-2xl ring-2 ring-blue-400 bg-blue-50' : ''
      }`}
    >
      {/* drag handle */}
      <td className="px-4 py-3.5 w-10">
        <button
          {...attributes}
          {...listeners}
          className="text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing text-lg transition-colors"
          aria-label={`Drag ${row.name}`}
        >
          ⠿
        </button>
      </td>

      {/* name */}
      <td className="px-4 py-3.5">
        <span
          className="text-sm font-semibold text-slate-800"
          style={{ paddingLeft: `${(row.depth ?? 0) * 18}px` }}
        >
          {(row.depth ?? 0) > 0 && <span className="text-slate-300 mr-2">└</span>}
          {row.name}
        </span>
      </td>

      {/* parent selector */}
      <td className="px-4 py-3.5">
        <select
          value={row.parentId ?? ''}
          onChange={e => onParentChange(row.id, e.target.value || null)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 max-w-40 font-medium"
        >
          <option value="">— root —</option>
          {possibleParents.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </td>

      {/* restricted toggle */}
      <td className="px-4 py-3.5 text-center">
        <button
          onClick={() => onRestrictedChange(row.id, !row.restricted)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 shadow-sm ${
            row.restricted ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-slate-300'
          }`}
          aria-label={`Toggle restricted for ${row.name}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
              row.restricted ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </td>
    </tr>
  );
}

// ─── LayerHierarchyEditor ────────────────────────────────────────────────────

export default function LayerHierarchyEditor() {
  const layerTree    = useLayerStore(state => state.layerTree);
  const setLayerTree = useLayerStore(state => state.setLayerTree);

  // Work on a flat representation; rebuild tree when saving
  const [flatLayers, setFlatLayers] = useState<FlatLayer[]>(() => flattenTree(layerTree));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setFlatLayers(prev => {
      const oldIndex = prev.findIndex(l => l.id === active.id);
      const newIndex = prev.findIndex(l => l.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleParentChange = useCallback((id: string, newParentId: string | null) => {
    setFlatLayers(prev =>
      prev.map(l => (l.id === id ? { ...l, parentId: newParentId } : l)),
    );
  }, []);

  const handleRestrictedChange = useCallback((id: string, restricted: boolean) => {
    setFlatLayers(prev =>
      prev.map(l => (l.id === id ? { ...l, restricted } : l)),
    );
  }, []);

  const handleApply = () => {
    const newTree: LayerNode[] = buildTree(flatLayers);
    setLayerTree(newTree);
    // Re-flatten to reflect rebuilt depths
    setFlatLayers(flattenTree(newTree));
  };

  const handleReset = () => {
    setFlatLayers(flattenTree(layerTree));
  };

  const hasChanges =
    JSON.stringify(flatLayers) !== JSON.stringify(flattenTree(layerTree));

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Hierarchy Editor</h2>
          <p className="text-sm text-slate-600 mt-1">
            Drag rows to reorder · Change parent relationships · Toggle restricted access
          </p>
        </div>
        {hasChanges && (
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all duration-200 font-medium"
            >
              Reset
            </button>
            <button
              onClick={handleApply}
              className="text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
            >
              Apply Hierarchy
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden shadow-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200">
              <th className="px-4 py-3.5 w-10" />
              <th className="text-left px-4 py-3.5 text-slate-700 font-bold text-xs uppercase tracking-wider">Layer Name</th>
              <th className="text-left px-4 py-3.5 text-slate-700 font-bold text-xs uppercase tracking-wider">Parent Layer</th>
              <th className="text-center px-4 py-3.5 text-slate-700 font-bold text-xs uppercase tracking-wider">Restricted</th>
            </tr>
          </thead>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={flatLayers.map(l => l.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {flatLayers.map(row => (
                  <SortableRow
                    key={row.id}
                    row={row}
                    allLayers={flatLayers}
                    onParentChange={handleParentChange}
                    onRestrictedChange={handleRestrictedChange}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-4 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Changes are applied locally. Backend persistence will be added in a future release.
      </p>
    </div>
  );
}
