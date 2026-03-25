export interface Annotation {
    id: string
    text: string
    note: string
    color: string
    page: number
    rects: { x: number, y: number, width: number, height: number }[]
    createdAt: number
}
