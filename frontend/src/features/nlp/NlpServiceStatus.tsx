import { useEffect, useRef, useState } from "react";
import { fetchNlpHealth, type HealthResponse } from "@/services/nlpService";

type ServiceState = "checking" | "offline" | "online" | "degraded";

interface StatusBadgeProps {
  state: ServiceState;
}

const StatusBadge = ({ state }: StatusBadgeProps) => {
  const map: Record<ServiceState, { icon: string; label: string; cls: string }> = {
    checking: {
      icon: "⏳",
      label: "Checking…",
      cls: "text-muted-foreground bg-muted",
    },
    offline: {
      icon: "❌",
      label: "Service offline",
      cls: "text-destructive bg-destructive/10",
    },
    online: {
      icon: "✅",
      label: "Service online",
      cls: "text-green-600 dark:text-green-400 bg-green-500/10",
    },
    degraded: {
      icon: "⚠️",
      label: "Knowledge base not ready",
      cls: "text-yellow-600 dark:text-yellow-400 bg-yellow-500/10",
    },
  };

  const { icon, label, cls } = map[state];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}
    >
      <span>{icon}</span>
      {label}
    </span>
  );
};

interface NlpServiceStatusProps {
  /** Called whenever health data updates so parent can react. */
  onHealthChange?: (health: HealthResponse | null) => void;
  /** Poll interval in ms (default 10 000). */
  pollInterval?: number;
}

const NlpServiceStatus = ({
  onHealthChange,
  pollInterval = 10_000,
}: NlpServiceStatusProps) => {
  const [state, setState] = useState<ServiceState>("checking");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = async () => {
    try {
      const health = await fetchNlpHealth();
      if (!health.success) {
        setState("offline");
        onHealthChange?.(null);
        return;
      }
      setState(health.vector_store_ready ? "online" : "degraded");
      onHealthChange?.(health);
    } catch {
      setState("offline");
      onHealthChange?.(null);
    }
  };

  useEffect(() => {
    check();
    timerRef.current = setInterval(check, pollInterval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollInterval]);

  return <StatusBadge state={state} />;
};

export default NlpServiceStatus;
