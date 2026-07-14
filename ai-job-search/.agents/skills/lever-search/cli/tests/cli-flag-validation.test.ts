import { describe, test, expect } from "bun:test"
import { runCLI } from "./helpers"

function parsedStderr(stderr: string): { error?: string; code?: string } {
  try {
    return JSON.parse(stderr)
  } catch {
    return {}
  }
}

describe("Lever CLI flag validation", () => {
  describe("numeric flag validation", () => {
    test("--jobage non-numeric exits 1 with BAD_ARG", async () => {
      const result = await runCLI(["search", "--jobage", "foo"])
      expect(result.exitCode).not.toBe(0)
      expect(parsedStderr(result.stderr).code).toBe("BAD_ARG")
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
  })

  describe("command validation", () => {
    test("detail without a ref exits 1 with NO_ID", async () => {
      const result = await runCLI(["detail"])
      expect(result.exitCode).not.toBe(0)
      expect(parsedStderr(result.stderr).code).toBe("NO_ID")
    })
    test("detail with an unparseable ref exits 1 with BAD_ID", async () => {
      const result = await runCLI(["detail", "not-an-id"])
      expect(result.exitCode).not.toBe(0)
      expect(parsedStderr(result.stderr).code).toBe("BAD_ID")
    })
    test("unknown command exits 1 with BAD_CMD", async () => {
      const result = await runCLI(["frobnicate"])
      expect(result.exitCode).not.toBe(0)
      expect(parsedStderr(result.stderr).code).toBe("BAD_CMD")
    })
    test("search --company with an unknown token exits 1 with UNKNOWN_COMPANY", async () => {
      const result = await runCLI(["search", "-c", "not-a-real-token"])
      expect(result.exitCode).not.toBe(0)
      expect(parsedStderr(result.stderr).code).toBe("UNKNOWN_COMPANY")
    })
  })

  describe("company command", () => {
    test("lists the registry as JSON with >=1 entry", async () => {
      const result = await runCLI(["company"])
      expect(result.exitCode).toBe(0)
      const out = JSON.parse(result.stdout)
      expect(out.results.length).toBeGreaterThanOrEqual(1)
      expect(out.results[0]).toHaveProperty("token")
      expect(out.results[0]).toHaveProperty("name")
    })
  })
})
