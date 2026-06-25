import { describe, it, expect } from "vitest";
import { planStreamMetaEvents, planPostFetchMetaEvents } from "./stream-meta";

describe("planStreamMetaEvents", () => {
  it("returns one meta when final equals initial", () => {
    expect(planStreamMetaEvents("oauth", "oauth")).toEqual([
      { type: "meta", aiMode: "live", source: "oauth" },
    ]);
  });

  it("returns one meta when final is omitted (unrecoverable fail path)", () => {
    expect(planStreamMetaEvents("oauth")).toEqual([
      { type: "meta", aiMode: "live", source: "oauth" },
    ]);
  });

  it("returns two metas when recovery changes source", () => {
    expect(planStreamMetaEvents("oauth", "key")).toEqual([
      { type: "meta", aiMode: "live", source: "oauth" },
      { type: "meta", aiMode: "live", source: "key" },
    ]);
  });

  it("planPostFetchMetaEvents yields only recovery meta", () => {
    expect(planPostFetchMetaEvents("oauth", "key")).toEqual([
      { type: "meta", aiMode: "live", source: "key" },
    ]);
    expect(planPostFetchMetaEvents("key", "key")).toEqual([]);
  });
});