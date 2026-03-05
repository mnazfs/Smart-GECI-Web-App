import { useLayerStore } from "@/store/layerStore";
import { Lock, Unlock, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LayerNode } from "@/types/layer";

interface SortableLayerItemProps {
  layer: LayerNode;
  onToggleRestricted: (id: string) => void;
}

const SortableLayerItem = ({
  layer,
  onToggleRestricted,
}: SortableLayerItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: layer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg mb-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{layer.name}</p>
        <p className="text-xs text-muted-foreground">{layer.geoserverName}</p>
      </div>

      <button
        onClick={() => onToggleRestricted(layer.id)}
        className={`p-1.5 rounded-md transition-colors ${
          layer.restricted
            ? "bg-destructive/10 text-destructive"
            : "bg-success/10 text-success"
        }`}
        aria-label={layer.restricted ? "Make public" : "Make restricted"}
      >
        {layer.restricted ? (
          <Lock className="h-4 w-4" />
        ) : (
          <Unlock className="h-4 w-4" />
        )}
      </button>
    </div>
  );
};

const LayerHierarchyEditor = () => {
  const layerTree = useLayerStore((s) => s.layerTree);
  const moveLayer = useLayerStore((s) => s.moveLayer);
  const toggleRestricted = useLayerStore((s) => s.toggleRestricted);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      moveLayer(active.id as string, over.id as string);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Layer Hierarchy
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Drag to reorder layers. Click the lock icon to toggle access restriction.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={layerTree.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {layerTree.map((layer) => (
            <SortableLayerItem
              key={layer.id}
              layer={layer}
              onToggleRestricted={toggleRestricted}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default LayerHierarchyEditor;
