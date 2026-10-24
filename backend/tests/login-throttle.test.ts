import { describe, expect, it } from "vitest";
import { createLoginThrottle } from "../src/modules/auth/login-throttle.ts";

const WINDOW_MS = 15 * 60_000;

function throttleAt(start = 0) {
  let clock = start;
  const throttle = createLoginThrottle({ maxFailures: 3, windowMs: WINDOW_MS, now: () => clock });
  return {
    throttle,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("login throttle", () => {
  it("blocks an email once it reaches the failure limit, for the rest of the window", () => {
    const { throttle, advance } = throttleAt();

    throttle.recordFailure("a@x.com");
    throttle.recordFailure("a@x.com");
    expect(throttle.blockedForMs("a@x.com")).toBe(0);
    advance(60_000);
    throttle.recordFailure("a@x.com");

    expect(throttle.blockedForMs("a@x.com")).toBe(WINDOW_MS - 60_000);
  });

  it("reports the start of the block only once, so it is logged once", () => {
    const { throttle } = throttleAt();

    const reports = Array.from({ length: 5 }, () => throttle.recordFailure("a@x.com"));

    expect(reports).toEqual([false, false, true, false, false]);
  });

  it("unblocks when the window ends and starts counting from zero", () => {
    const { throttle, advance } = throttleAt();
    for (let i = 0; i < 3; i++) throttle.recordFailure("a@x.com");

    advance(WINDOW_MS + 1);

    expect(throttle.blockedForMs("a@x.com")).toBe(0);
    // Janela nova: só a terceira falha volta a bloquear.
    const reports = Array.from({ length: 3 }, () => throttle.recordFailure("a@x.com"));
    expect(reports).toEqual([false, false, true]);
  });

  it("forgets the failures after a successful login", () => {
    const { throttle } = throttleAt();
    throttle.recordFailure("a@x.com");
    throttle.recordFailure("a@x.com");

    throttle.reset("a@x.com");
    throttle.recordFailure("a@x.com");
    throttle.recordFailure("a@x.com");

    expect(throttle.blockedForMs("a@x.com")).toBe(0);
  });

  it("drops expired entries once many emails are tracked, so random emails cannot grow memory forever", () => {
    const { throttle, advance } = throttleAt();
    for (let i = 0; i < 10_000; i++) throttle.recordFailure(`random-${i}@x.com`);

    advance(WINDOW_MS + 1);
    throttle.recordFailure("a@x.com");

    expect(throttle.trackedEmails()).toBe(1);
  });

  it("counts each email separately", () => {
    const { throttle } = throttleAt();
    for (let i = 0; i < 3; i++) throttle.recordFailure("a@x.com");

    expect(throttle.blockedForMs("b@x.com")).toBe(0);
  });
});
