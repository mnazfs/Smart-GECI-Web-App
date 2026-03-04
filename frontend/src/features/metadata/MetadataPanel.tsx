import { useMetadata } from './useMetadata';

/**
 * Slide-in panel that shows facility metadata after a map click.
 * Visible to all user roles.
 */
export default function MetadataPanel() {
  const { metadata, isLoading, error, clickedLocation, close, refetch } = useMetadata();

  return (
    <div className="slide-in-right w-96 h-full bg-white shadow-2xl border-l border-slate-200/50 flex flex-col">
      {/* ── header ── */}
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-br from-slate-800 to-slate-900 text-white shrink-0">
        <div>
          <h2 className="text-sm font-bold">Facility Info</h2>
          {clickedLocation && (
            <p className="text-xs text-slate-400 mt-1 font-mono">
              {clickedLocation.lat.toFixed(5)}, {clickedLocation.lng.toFixed(5)}
            </p>
          )}
        </div>
        <button
          onClick={close}
          className="text-slate-400 hover:text-white transition-all duration-200 text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
          aria-label="Close metadata panel"
        >
          ✕
        </button>
      </div>

      {/* ── body ── */}
      <div className="flex-1 overflow-y-auto p-5">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Loading facility data…</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-red-700 font-medium">{error}</p>
            <button
              onClick={refetch}
              className="text-sm text-red-600 hover:text-red-700 font-medium mt-2 transition-colors"
            >
              → Retry
            </button>
          </div>
        )}

        {!isLoading && !error && metadata === null && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <p className="text-3xl">📍</p>
            </div>
            <p className="text-sm text-slate-600 font-medium">No facility found at this location.</p>
            <button
              onClick={refetch}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium mt-3 transition-colors"
            >
              → Retry
            </button>
          </div>
        )}

        {!isLoading && !error && metadata && (
          <div className="flex flex-col gap-5 fade-in">
            {/* facility name */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-4 border border-slate-200/50">
              <h3 className="text-lg font-bold text-slate-900">{metadata.name}</h3>
              <span className="inline-block text-xs px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-full mt-2 font-semibold shadow-sm">
                {metadata.type}
              </span>
            </div>

            {/* description */}
            {metadata.description && (
              <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed">{metadata.description}</p>
              </div>
            )}

            {/* properties table */}
            {Object.keys(metadata.properties).length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Properties
                </h4>
                <div className="bg-white rounded-xl border border-slate-200/50 overflow-hidden shadow-sm">
                  {Object.entries(metadata.properties).map(([key, value], idx) => (
                    <div
                      key={key}
                      className={`flex items-start justify-between gap-3 px-4 py-3 ${
                        idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'
                      }`}
                    >
                      <span className="text-xs text-slate-600 capitalize shrink-0 font-medium">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-800 text-right font-semibold">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── footer ── */}
      <div className="px-5 py-3.5 border-t border-slate-200 bg-gradient-to-t from-slate-50 to-white shrink-0">
        <p className="text-xs text-slate-500">Click anywhere on the map to inspect a facility</p>
      </div>
    </div>
  );
}
