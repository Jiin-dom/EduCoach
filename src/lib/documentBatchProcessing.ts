export type ClientDocumentStatusKey =
  | "pending"
  | "queued"
  | "processing"
  | "ready"
  | "error"

export interface ProcessableDocumentLike {
  id: string
  status: "pending" | "processing" | "ready" | "error"
}

export interface ClientDocumentStatus {
  key: ClientDocumentStatusKey
  label: "Pending" | "Queued" | "Processing" | "Ready" | "Error"
}

export type UploadProcessingMode = "process_immediately" | "defer_processing"

export type UploadItemStatus = "ready" | "uploading" | "uploaded" | "error"

export function getDefaultDocumentTitle(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "") || fileName
}

export function getUploadProcessingMode(uploadableCount: number): UploadProcessingMode {
  return uploadableCount === 1 ? "process_immediately" : "defer_processing"
}

export function getUploadItemStatusLabel(
  status: UploadItemStatus,
  uploadMode: UploadProcessingMode,
): "Ready to upload" | "Uploading..." | "Uploaded and processing started" | "Uploaded as pending" | "Needs attention" {
  switch (status) {
    case "ready":
      return "Ready to upload"
    case "uploading":
      return "Uploading..."
    case "uploaded":
      return uploadMode === "process_immediately"
        ? "Uploaded and processing started"
        : "Uploaded as pending"
    case "error":
    default:
      return "Needs attention"
  }
}

export function selectNextPendingDocuments<T extends ProcessableDocumentLike>(
  documents: T[],
  claimedIds: string[],
  limit: number,
): T[] {
  if (limit <= 0) return []

  const claimed = new Set(claimedIds)
  const next: T[] = []

  for (const document of documents) {
    if (document.status !== "pending" || claimed.has(document.id)) {
      continue
    }

    next.push(document)
    if (next.length >= limit) {
      break
    }
  }

  return next
}

export function getClientDocumentStatus(
  document: ProcessableDocumentLike,
  claimedIds: string[],
  activeIds: string[],
): ClientDocumentStatus {
  if (activeIds.includes(document.id)) {
    return { key: "processing", label: "Processing" }
  }

  if (document.status === "pending" && claimedIds.includes(document.id)) {
    return { key: "queued", label: "Queued" }
  }

  switch (document.status) {
    case "processing":
      return { key: "processing", label: "Processing" }
    case "ready":
      return { key: "ready", label: "Ready" }
    case "error":
      return { key: "error", label: "Error" }
    case "pending":
    default:
      return { key: "pending", label: "Pending" }
  }
}
