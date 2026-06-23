import { describe, it, expect } from "vitest";
import { generateParticlePositions } from "./generate-positions";

describe("generateParticlePositions", () => {
  it("returns deterministic positions for the same seed", () => {
    const a = generateParticlePositions(10, 99);
    const b = generateParticlePositions(10, 99);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("returns correct array length", () => {
    const arr = generateParticlePositions(100);
    expect(arr.length).toBe(300);
  });
});