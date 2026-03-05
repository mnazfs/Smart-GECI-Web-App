import type { LayerNode as LayerNodeType } from "@/types/layer";
import LayerNode from "./LayerNode";

interface LayerTreeProps {
  layers: LayerNodeType[];
}

const LayerTree = ({ layers }: LayerTreeProps) => {
  return (
    <div className="space-y-0.5">
      {layers.map((layer) => (
        <LayerNode key={layer.id} node={layer} depth={0} />
      ))}
    </div>
  );
};

export default LayerTree;
