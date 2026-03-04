import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useLayerStore } from '@/store/layerStore';
import { updateLayerRestricted } from '@/services/layerService';
import type { LayerNode } from '@/types/layer';
import { flattenTree } from '@/features/layers/layerUtils';

type FlatLayerEditable = {
  id: string;
  name: string;
  geoserverName: string;
  parentId: string | null;
  restricted: boolean;
  depth: number;
};

/**
 * Admin: tabular view of all registered layers.
 * Allows toggling the `restricted` flag and persisting to backend.
 */
export default function LayerRegistryPage() {
  const layerTree    = useLayerStore(state => state.layerTree);
  const fetchLayers  = useLayerStore(state => state.fetchLayers);
  const setLayerTree = useLayerStore(state => state.setLayerTree);

  const [editedTree, setEditedTree] = useState<LayerNode[]>(layerTree);
  const [isSaving, setIsSaving]     = useState(false);

  const flatRows: FlatLayerEditable[] = flattenTree(editedTree).map(n => ({
    id:            n.id,
    name:          n.name,
    geoserverName: n.geoserverName,
    parentId:      n.parentId,
    restricted:    n.restricted,
    depth:         n.depth ?? 0,
  }));

  // Collect original flat map for diff
  const originalFlat = flattenTree(layerTree);
  const originalById = Object.fromEntries(originalFlat.map(n => [n.id, n.restricted]));

  // Toggle restricted flag locally
  const toggleRestricted = useCallback(
    (id: string) => {
      function patchTree(nodes: LayerNode[]): LayerNode[] {
        return nodes.map(node =>
          node.id === id
            ? { ...node, restricted: !node.restricted }
            : { ...node, children: patchTree(node.children ?? []) },
        );
      }
      setEditedTree(prev => patchTree(prev));
    },
    [],
  );

  const handleApply = async () => {
    // Only PUT layers whose restricted flag actually changed
    const changed = flatRows.filter(r => r.restricted !== originalById[r.id]);
    if (changed.length === 0) return;

    setIsSaving(true);
    try {
      await Promise.all(changed.map(r => updateLayerRestricted(r.id, r.restricted)));
      toast.success(`Updated ${changed.length} layer(s).`);
      // Optimistically update store, then refetch for consistency
      setLayerTree(editedTree);
      await fetchLayers();
      setEditedTree(useLayerStore.getState().layerTree);
    } catch {
      toast.error('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setEditedTree(layerTree);
  };

  const hasChanges = JSON.stringify(
    flatRows.map(r => ({ id: r.id, restricted: r.restricted })),
  ) !== JSON.stringify(originalFlat.map(n => ({ id: n.id, restricted: n.restricted })));

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Layer Registry</h2>
          <p className="text-sm text-slate-600 mt-1">
            {flatRows.length} layers registered · Toggle restricted access per layer
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
              disabled={isSaving}
              className="text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 transition-all duration-200 font-medium shadow-sm hover:shadow-md disabled:shadow-none"
            >
              {isSaving ? 'Saving…' : 'Apply Changes'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden shadow-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200">
              <th className="text-left px-5 py-3.5 text-slate-700 font-bold text-xs uppercase tracking-wider">Layer Name</th>
              <th className="text-left px-5 py-3.5 text-slate-700 font-bold text-xs uppercase tracking-wider">GeoServer Name</th>
              <th className="text-left px-5 py-3.5 text-slate-700 font-bold text-xs uppercase tracking-wider">Parent ID</th>
              <th className="text-center px-5 py-3.5 text-slate-700 font-bold text-xs uppercase tracking-wider">Restricted</th>
            </tr>
          </thead>
          <tbody>
            {flatRows.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b border-slate-100 last:border-0 transition-all duration-150 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                } hover:bg-blue-50/30`}
              >
                <td className="px-5 py-3.5">
                  <span
                    className="font-semibold text-slate-800"
                    style={{ paddingLeft: `${row.depth * 20}px` }}
                  >
                    {row.depth > 0 && (
                      <span className="text-slate-300 mr-2">{'└'}</span>
                    )}
                    {row.name}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-600">
                  {row.geoserverName}
                </td>
                <td className="px-5 py-3.5 text-slate-500 text-xs font-medium">
                  {row.parentId ?? <span className="text-slate-400 italic">root</span>}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <button
                    onClick={() => toggleRestricted(row.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 shadow-sm ${
                      row.restricted ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-slate-300'
                    }`}
                    aria-label={`Toggle restricted for ${row.name}`}
                    title={row.restricted ? 'Restricted — click to allow public' : 'Public — click to restrict'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                        row.restricted ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-4 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Changes are saved to the backend via PUT /api/layers/:id/restricted.
      </p>
    </div>
  );
}
