import { describe, it, expect } from "vitest";
import { parseNdjsonBuffer } from "./parse-stream";

describe("parseNdjsonBuffer", () => {
  it("parses complete NDJSON lines", () => {
    const input = '{"type":"meta","aiMode":"mock"}\n{"type":"done"}\n';
    const { events, remainder } = parseNdjsonBuffer(input);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("meta");
    expect(remainder).toBe("");
  });

  it("keeps partial line in remainder", () => {
    const { events, remainder } = parseNdjsonBuffer('{"type":"meta"');
    expect(events).toHaveLength(0);
    expect(remainder).toBe('{"type":"meta"');
  });
});