import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Sparkles, Download } from "lucide-react"
import { AiTutorChat } from "@/components/shared/AiTutorChat"
import { Link, useParams } from "react-router-dom"

export function FileViewer() {
    const { id } = useParams()

    // Mock file data
    const file = {
        id: id,
        name: "Introduction to Algorithms.pdf",
        subject: "Computer Science",
        uploadDate: "2024-01-15",
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/files">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">{file.name}</h1>
                        <p className="text-muted-foreground">{file.subject}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2 bg-transparent">
                        <Download className="w-4 h-4" />
                        Download
                    </Button>
                    <Button className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        Generate Quiz
                    </Button>
                </div>
            </div>

            <Card className="min-h-[600px]">
                <CardHeader>
                    <CardTitle>File Preview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="bg-muted rounded-lg p-8 min-h-[500px] flex items-center justify-center">
                        <div className="text-center space-y-4">
                            <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                                <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">Document Preview</h3>
                                <p className="text-muted-foreground max-w-md mx-auto">
                                    This is a dummy preview of your document. In a production environment, this would display the actual
                                    file content using a PDF viewer or document renderer.
                                </p>
                            </div>
                            <div className="pt-4 text-sm text-muted-foreground">
                                <p className="font-mono bg-background px-4 py-2 rounded inline-block">File ID: {id}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <AiTutorChat />
        </div>
    )
}
