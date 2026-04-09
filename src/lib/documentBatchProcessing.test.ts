import { describe, expect, it } from "vitest"

import {
  getClientDocumentStatus,
  getDefaultDocumentTitle,
  selectNextPendingDocuments,
} from "@/lib/documentBatchProcessing"

describe("getDefaultDocumentTitle", () => {
  it("strips the final file extension and preserves the rest of the filename", () => {
    expect(getDefaultDocumentTitle("Midterm Notes.pdf")).toBe("Midterm Notes")
    expect(getDefaultDocumentTitle("chapter.v2.final.docx")).toBe("chapter.v2.final")
    expect(getDefaultDocumentTitle("README")).toBe("README")
  })
})

describe("selectNextPendingDocuments", () => {
  it("returns only unclaimed pending documents up to the concurrency limit", () => {
    const result = selectNextPendingDocuments(
      [
        { id: "doc-1", status: "pending" },
        { id: "doc-2", status: "processing" },
        { id: "doc-3", status: "pending" },
        { id: "doc-4", status: "error" },
        { id: "doc-5", status: "pending" },
      ],
      ["doc-3"],
      2,
    )

    expect(result.map((doc) => doc.id)).toEqual(["doc-1", "doc-5"])
  })
})

describe("getClientDocumentStatus", () => {
  it("maps claimed pending documents to queued while preserving active processing work", () => {
    expect(
      getClientDocumentStatus(
        { id: "doc-1", status: "pending" },
        ["doc-1", "doc-2"],
        ["doc-2"],
      ),
    ).toEqual({ key: "queued", label: "Queued" })

    expect(
      getClientDocumentStatus(
        { id: "doc-2", status: "pending" },
        ["doc-1", "doc-2"],
        ["doc-2"],
      ),
    ).toEqual({ key: "processing", label: "Processing" })

    expect(
      getClientDocumentStatus(
        { id: "doc-3", status: "ready" },
        ["doc-1", "doc-2"],
        ["doc-2"],
      ),
    ).toEqual({ key: "ready", label: "Ready" })
  })
})
