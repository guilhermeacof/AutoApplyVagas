import { describe, test, expect } from "bun:test"
import { runCLI } from "./helpers"

function parsedStderr(stderr: string): { error?: string; code?: string } {
  try {
    return JSON.parse(stderr)
  } catch {
    return {}
  }
}

describe("workday CLI flag validation", () => {
  test("--jobage non-numeric exits 1 with BAD_ARG", async () => {
    const result = await runCLI(["search", "--jobage", "foo"])
    expect(result.exitCode).not.toBe(0)
    const err = parsedStderr(result.stderr)
    expect(err.code).toBe("BAD_ARG")
    expect(err.error).toMatch(/jobage/)
  })

  test("--page non-numeric exits 1 with BAD_ARG", async () => {
    const result = await runCLI(["search", "--page", "abc"])
    expect(result.exitCode).not.toBe(0)
    expect(parsedStderr(result.stderr).code).toBe("BAD_ARG")
  })

  test("--limit non-numeric exits 1 with BAD_ARG", async () => {
    const result = await runCLI(["search", "--limit", "xyz"])
    expect(result.exitCode).not.toBe(0)
    expect(parsedStderr(result.stderr).code).toBe("BAD_ARG")
  })

  test("unknown -c company exits 1 with UNKNOWN_COMPANY", async () => {
    const result = await runCLI(["search", "-q", "x", "-c", "nonexistent-co", "--limit", "1"])
    expect(result.exitCode).not.toBe(0)
    expect(parsedStderr(result.stderr).code).toBe("UNKNOWN_COMPANY")
  })

  test("detail without a target exits 1 with NO_TARGET", async () => {
    const result = await runCLI(["detail"])
    expect(result.exitCode).not.toBe(0)
    expect(parsedStderr(result.stderr).code).toBe("NO_TARGET")
  })

  test("detail with an unparseable target exits 1 with BAD_TARGET", async () => {
    const result = await runCLI(["detail", "not-a-target", "--format", "json"])
    expect(result.exitCode).not.toBe(0)
    expect(parsedStderr(result.stderr).code).toBe("BAD_TARGET")
  })

  test("unknown command exits 1 with BAD_CMD", async () => {
    const result = await runCLI(["frobnicate"])
    expect(result.exitCode).not.toBe(0)
    expect(parsedStderr(result.stderr).code).toBe("BAD_CMD")
  })

  test("company command lists the registry", async () => {
    const result = await runCLI(["company"])
    expect(result.exitCode).toBe(0)
    const out = JSON.parse(result.stdout) as { companies: any[] }
    expect(out.companies.length).toBeGreaterThan(0)
    expect(out.companies[0]).toHaveProperty("tenant")
  })
})
