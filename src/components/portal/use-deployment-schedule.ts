"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DeploymentValues, PendingDeployment } from "@/lib/events/deployment";
import { toast } from "./toast";
import type { EventDeploymentState } from "@/lib/portal/event-actions";

const secondsLeft = (schedule: PendingDeployment | null) => schedule ? Math.max(0, Math.ceil((Date.parse(schedule.applyAt) - Date.now()) / 1000)) : 0;

/** Requests persist immediately. The browser timer only displays the database's deadline. */
export function useDeploymentSchedule(eventId: string, live: DeploymentValues, initial: PendingDeployment | null, editable: boolean) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial?.values ?? live);
  const current = useRef(draft);
  const baseline = useRef(live);
  const [scheduled, setScheduled] = useState(initial);
  const [remaining, setRemaining] = useState(() => secondsLeft(initial));
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<EventDeploymentState>(initial?.error ? { error: "Scheduled changes couldn’t be applied. Edit the settings or try again." } : {});
  const clientId = useRef<string | null>(null);
  const revision = useRef(0);
  const lastRefresh = useRef(0);

  const persist = useCallback(async (values: DeploymentValues) => {
    if (!editable) return;
    clientId.current ??= crypto.randomUUID();
    const requestRevision = ++revision.current;
    setSaving(true);
    setState({});
    try {
      const response = await fetch(`/portal/events/${encodeURIComponent(eventId)}/deployment/schedule`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({ values, clientId: clientId.current, revision: requestRevision }),
      });
      const result: EventDeploymentState = await response.json();
      if (requestRevision !== revision.current) return;
      if (!response.ok || !result.success || !result.scheduled) {
        setState({ ...result, error: result.error ?? "Couldn’t schedule changes. Check the highlighted fields and try again." });
        return;
      }
      setScheduled(result.scheduled);
      setRemaining(secondsLeft(result.scheduled));
      current.current = result.scheduled.values;
      setDraft(result.scheduled.values);
    } catch {
      if (requestRevision === revision.current) setState({ error: "Couldn’t schedule changes. Check your connection and try again." });
    } finally {
      if (requestRevision === revision.current) setSaving(false);
    }
  }, [editable, eventId]);

  const change = useCallback(<K extends keyof DeploymentValues>(key: K, value: DeploymentValues[K]) => {
    if (!editable) return;
    const next = { ...current.current, [key]: value };
    current.current = next;
    setDraft(next);
    void persist(next);
  }, [editable, persist]);

  const discard = useCallback(async () => {
    if (!editable || saving || !scheduled) return;
    const requestRevision = ++revision.current;
    setSaving(true);
    try {
      const response = await fetch(`/portal/events/${encodeURIComponent(eventId)}/deployment/schedule`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        keepalive: true, body: JSON.stringify({ cancelVersion: scheduled.version }),
      });
      const result: EventDeploymentState = await response.json();
      if (requestRevision !== revision.current) return;
      if (!response.ok || !result.success) { setState({ error: result.error ?? "Couldn’t discard the scheduled changes. Try again." }); return; }
      setScheduled(null);
      setState({});
      toast("Scheduled changes discarded.");
      current.current = baseline.current;
      setDraft(baseline.current);
      router.refresh();
    } catch {
      if (requestRevision === revision.current) setState({ error: "Couldn’t discard the scheduled changes. Try again." });
    } finally {
      if (requestRevision === revision.current) setSaving(false);
    }
  }, [editable, saving, scheduled, eventId, router]);

  useEffect(() => {
    if (!scheduled) return;
    const interval = setInterval(() => {
      const seconds = secondsLeft(scheduled);
      setRemaining(seconds);
      if (seconds === 0 && Date.now() - lastRefresh.current >= 5000) {
        lastRefresh.current = Date.now();
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [scheduled, router]);

  return { draft, scheduled, remaining, saving, state, change, discard, retry: () => { void persist(current.current); } };
}
