import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import LayerRegistryPage from '@/features/admin/LayerRegistryPage';
import LayerHierarchyEditor from '@/features/admin/LayerHierarchyEditor';

type AdminTab = 'registry' | 'hierarchy';

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'registry',  label: 'Layer Registry',    icon: '🗂️' },
  { id: 'hierarchy', label: 'Hierarchy Editor',   icon: '⚙️' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('registry');
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50">
      <Navbar />

      <div className="flex-1 overflow-y-auto">
        {/* ── page header ── */}
        <div className="bg-white border-b border-slate-200/50 px-8 py-6 shadow-sm">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Admin Console</h1>
              <p className="text-sm text-slate-600 mt-1.5">
                Manage GIS layer configuration and hierarchy
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-slate-600 hover:text-slate-900 transition-all duration-200 flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-100 font-medium"
            >
              ← Back to Map
            </button>
          </div>

          {/* ── tabs ── */}
          <div className="flex gap-2 mt-6 max-w-7xl mx-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span className="text-base">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── tab content ── */}
        <div className="p-8 max-w-7xl mx-auto">
          {activeTab === 'registry'  && <LayerRegistryPage />}
          {activeTab === 'hierarchy' && <LayerHierarchyEditor />}
        </div>
      </div>
    </div>
  );
}
