import { describe, expect, it } from "vitest";
import { isValidPhaseTransition } from "../src/modules/events/phase.js";

describe("event phase machine", () => {
  it("allows single forward step", () => {
    expect(isValidPhaseTransition("planning", "pre_production")).toBe(true);
    expect(isValidPhaseTransition("pre_production", "production")).toBe(true);
    expect(isValidPhaseTransition("production", "post_production")).toBe(true);
    expect(isValidPhaseTransition("post_production", "closed")).toBe(true);
  });

  it("rejects skipping a phase", () => {
    expect(isValidPhaseTransition("planning", "production")).toBe(false);
  });

  it("rejects same phase", () => {
    expect(isValidPhaseTransition("planning", "planning")).toBe(false);
  });

  it("allows reset to planning from any non-planning phase (contract)", () => {
    expect(isValidPhaseTransition("closed", "planning")).toBe(true);
    expect(isValidPhaseTransition("production", "planning")).toBe(true);
    expect(isValidPhaseTransition("pre_production", "planning")).toBe(true);
  });
});
