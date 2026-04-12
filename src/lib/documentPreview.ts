export type DocumentPreviewMode = "pdf" | "office" | "download"

export function isOfficePreviewableType(fileType: string): boolean {
  return fileType === "docx"
}

export function getDocumentPreviewMode(fileType: string): DocumentPreviewMode {
  if (fileType === "pdf") {
    return "pdf"
  }

  if (isOfficePreviewableType(fileType)) {
    return "office"
  }

  return "download"
}

export function buildOfficePreviewUrl(sourceUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(sourceUrl)}`
}
