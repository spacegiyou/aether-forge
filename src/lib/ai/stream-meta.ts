import type { CredentialSource } from "./credentials";
import type { ExecuteStreamEvent } from "./stream-events";

type LiveMetaEvent = Extract<ExecuteStreamEvent, { type: "meta" }>;

/**
 * Plan live meta events: always one for initial source; second only when recovery changes source.
 */
export function planStreamMetaEvents(
  initialSource: CredentialSource,
  finalSource?: CredentialSource
): LiveMetaEvent[] {
  const events: LiveMetaEvent[] = [
    { type: "meta", aiMode: "live", source: initialSource },
  ];
  if (finalSource !== undefined && finalSource !== initialSource) {
    events.push({ type: "meta", aiMode: "live", source: finalSource });
  }
  return events;
}

/** Meta events after a successful fetch (excludes initial — caller yields pre-fetch meta separately). */
export function planPostFetchMetaEvents(
  initialSource: CredentialSource,
  finalSource: CredentialSource
): LiveMetaEvent[] {
  return planStreamMetaEvents(initialSource, finalSource).slice(1);
}