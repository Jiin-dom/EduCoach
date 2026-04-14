import { describe, expect, it } from "vitest"

import {
  buildOfficePreviewUrl,
  getDocumentPreviewMode,
  isOfficePreviewableType,
} from "./documentPreview"

describe("documentPreview", () => {
  it("marks docx files as office-previewable", () => {
    expect(isOfficePreviewableType("docx")).toBe(true)
    expect(isOfficePreviewableType("pdf")).toBe(false)
    expect(isOfficePreviewableType("md")).toBe(false)
  })

  it("returns the correct preview mode per file type", () => {
    expect(getDocumentPreviewMode("pdf")).toBe("pdf")
    expect(getDocumentPreviewMode("docx")).toBe("office")
    expect(getDocumentPreviewMode("txt")).toBe("download")
  })

  it("encodes the full signed URL when building the office viewer URL", () => {
    const signedUrl =
      "https://example.supabase.co/storage/v1/object/sign/documents/user/file.docx?token=a=b&expires=123"

    expect(buildOfficePreviewUrl(signedUrl)).toBe(
      `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`
    )
  })
})
