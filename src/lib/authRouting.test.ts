import { describe, expect, it } from "vitest"

import { getPostLoginDestination } from "./authRouting"

describe("getPostLoginDestination", () => {
  it("always routes admin users to admin landing", () => {
    expect(
      getPostLoginDestination({
        role: "admin",
        hasCompletedProfiling: false,
        fromPath: "/dashboard",
        oauthReturnPath: "/analytics",
      })
    ).toBe("/admin/users")
  })

  it("routes student users without profiling to profiling", () => {
    expect(
      getPostLoginDestination({
        role: "student",
        hasCompletedProfiling: false,
        fromPath: "/dashboard",
      })
    ).toBe("/profiling")
  })

  it("uses oauth return path for profiled students when non-default", () => {
    expect(
      getPostLoginDestination({
        role: "student",
        hasCompletedProfiling: true,
        fromPath: "/dashboard",
        oauthReturnPath: "/files",
      })
    ).toBe("/files")
  })

  it("falls back to intended path when oauth return path is default dashboard", () => {
    expect(
      getPostLoginDestination({
        role: "student",
        hasCompletedProfiling: true,
        fromPath: "/learning-path",
        oauthReturnPath: "/dashboard",
      })
    ).toBe("/learning-path")
  })

  it("falls back to intended path when oauth return path is missing", () => {
    expect(
      getPostLoginDestination({
        role: "student",
        hasCompletedProfiling: true,
        fromPath: "/quizzes",
      })
    ).toBe("/quizzes")
  })
})
