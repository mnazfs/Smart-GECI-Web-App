import { useState } from 'react';
import { useLayerStore } from '@/store/layerStore';
import { useAuthStore } from '@/store/authStore';
import LayerTree from './LayerTree';

/**
 * Collapsible left-side panel showing the layer tree.
 * Layer visibility is filtered by user role inside the layerStore selector.
 */
export default function LayerPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const role        = useAuthStore(state => state.role);
  const getVisible  = useLayerStore(state => state.getVisibleLayers);
  const activeCount = useLayerStore(state => state.activeLayerIds.length);
  const isLoading   = useLayerStore(state => state.isLoading);
  const error       = useLayerStore(state => state.error);

  // Filtering happens here via the store selector — NOT in JSX
  const visibleLayers = getVisible(role);

  return (
    <div
      className={`flex flex-col bg-white border-r border-slate-200/50 shadow-lg transition-all duration-300 ease-in-out shrink-0 ${
        isCollapsed ? 'w-12' : 'w-72'
      }`}
      style={{ minHeight: 0 }}
    >
      {/* ── header ── */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white shrink-0">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="text-slate-800 text-sm font-bold truncate">Map Layers</span>
            {activeCount > 0 && (
              <span className="text-xs bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-2 py-0.5 rounded-full font-medium shrink-0 shadow-sm">
                {activeCount}
              </span>
            )}
            {isLoading && (
              <span className="text-xs text-slate-400 shrink-0 animate-spin">⟳</span>
            )}
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(prev => !prev)}
          className="text-slate-400 hover:text-slate-600 transition-all duration-200 p-1.5 rounded-lg hover:bg-slate-100 shrink-0 ml-auto"
          aria-label={isCollapsed ? 'Expand layer panel' : 'Collapse layer panel'}
          title={isCollapsed ? 'Expand layer panel' : 'Collapse layer panel'}
        >
          {isCollapsed ? '»' : '«'}
        </button>
      </div>

      {/* ── layer tree or error ── */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-3">
          {error && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3 border border-amber-200">
              {error}
            </p>
          )}
          <LayerTree nodes={visibleLayers} />
        </div>
      )}

      {/* ── footer ── */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-t border-slate-100 shrink-0 bg-gradient-to-t from-slate-50 to-white">
          <p className="text-xs text-slate-500">
            {role === 'guest'
              ? 'Login to access restricted layers'
              : `Role: ${role}`}
          </p>
        </div>
      )}
    </div>
  );
}
