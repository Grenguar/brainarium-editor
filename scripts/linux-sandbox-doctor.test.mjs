import { describe, expect, it } from "vitest";

import {
  diagnoseLinuxSandbox,
  isRootSetuidSandboxHelper,
} from "./linux-sandbox-doctor.mjs";

describe("Linux sandbox doctor", () => {
  it("accepts a root-owned setuid sandbox helper", () => {
    expect(isRootSetuidSandboxHelper({ mode: 0o104755, uid: 0 })).toBe(true);
    expect(isRootSetuidSandboxHelper({ mode: 0o100755, uid: 0 })).toBe(false);
    expect(isRootSetuidSandboxHelper({ mode: 0o104755, uid: 1000 })).toBe(
      false,
    );
  });

  it("passes when the host permits unprivileged user namespaces", () => {
    const report = diagnoseLinuxSandbox({
      platform: "linux",
      userNamespacesAvailable: true,
    });

    expect(report.exitCode).toBe(0);
    expect(report.lines.join(" ")).toContain("user namespaces");
  });

  it("fails closed without a sandbox route", () => {
    const report = diagnoseLinuxSandbox({
      platform: "linux",
      sandboxHelper: { isRootSetuid: false, path: "/tmp/chrome-sandbox" },
      userNamespacesAvailable: false,
    });

    expect(report.exitCode).toBe(1);
    expect(report.lines.join(" ")).toContain("Do not use --no-sandbox");
  });
});
