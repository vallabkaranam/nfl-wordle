const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type AnalyticsEvent = {
  name: string;
  puzzle_date?: string;
  mode?: string;
  outcome?: "won" | "lost";
  guess_count?: number;
  metadata?: Record<string, unknown>;
};

export function trackEvent(event: AnalyticsEvent) {
  if (typeof window === "undefined") {
    return;
  }

  const payload = JSON.stringify({
    ...event,
    metadata: {
      ...event.metadata,
      path: window.location.pathname,
    },
  });

  try {
    void fetch(`${BACKEND_URL}/api/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
      keepalive: true,
    });
  } catch (error) {
    console.error("Analytics event failed", error);
  }
}
