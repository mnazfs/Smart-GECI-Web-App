import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import NlpServiceStatus from "@/features/nlp/NlpServiceStatus";
import RagManager from "@/features/nlp/RagManager";
import NlpChat from "@/features/nlp/NlpChat";
import type { HealthResponse } from "@/services/nlpService";

const NlpPage = () => {
  const { role } = useAuthStore();
  const isAdmin = role === "admin";

  const [serviceOnline, setServiceOnline] = useState(false);
  const [ragReady, setRagReady] = useState(false);

  const handleHealthChange = (health: HealthResponse | null) => {
    setServiceOnline(!!health?.success);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Back to map"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-accent" />
            <h1 className="text-base font-semibold text-foreground">
              GECI Assistant
            </h1>
          </div>
        </div>

        {/* Live service status badge */}
        <NlpServiceStatus onHealthChange={handleHealthChange} />
      </div>

      {/* Body: sidebar + chat */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar – RAG management */}
        <aside className="w-64 shrink-0 border-r border-border p-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Knowledge Base
            </p>
            <RagManager isAdmin={isAdmin} onReadyChange={setRagReady} />
          </div>

          {!serviceOnline && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              ❌ NLP service is unreachable. All NLP features are disabled.
            </div>
          )}
        </aside>

        {/* Main chat area */}
        <main className="flex-1 flex flex-col min-h-0">
          <NlpChat ragReady={ragReady} serviceOnline={serviceOnline} />
        </main>
      </div>
    </div>
  );
};

export default NlpPage;
