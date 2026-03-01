import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { MessageCircle, X, Send, Sparkles, Loader2, FileText, RotateCcw, ExternalLink, History, Trash2, ChevronLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useDocuments } from "@/hooks/useDocuments"
import {
    useSendMessage,
    useConversations,
    useConversationMessages,
    useDeleteConversation,
    type SourceCitation,
    type ChatConversation,
} from "@/hooks/useAiTutor"
import { Link } from "react-router-dom"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DisplayMessage {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: string
    sources?: SourceCitation[]
    isLoading?: boolean
}

interface AiTutorChatProps {
    documentId?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiTutorChat({ documentId: propDocumentId }: AiTutorChatProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [inputMessage, setInputMessage] = useState("")
    const [bloomLevel, setBloomLevel] = useState("understand")
    const [conversationId, setConversationId] = useState<string | undefined>(undefined)
    const [selectedDocumentId, setSelectedDocumentId] = useState<string>("all")
    const [pendingMessages, setPendingMessages] = useState<DisplayMessage[]>([])
    const [error, setError] = useState<string | null>(null)
    const [showHistory, setShowHistory] = useState(false)
    const [hasAutoLoaded, setHasAutoLoaded] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)

    const sendMessage = useSendMessage()
    const deleteConversation = useDeleteConversation()
    const { data: conversations } = useConversations()
    const { data: dbMessages } = useConversationMessages(conversationId)
    const { data: documents } = useDocuments()

    const readyDocuments = documents?.filter(d => d.status === "ready") || []

    // Filter conversations by document scope if needed
    const filteredConversations = useMemo(() => {
        if (!conversations) return []
        if (propDocumentId) {
            return conversations.filter(c => c.document_id === propDocumentId)
        }
        return conversations
    }, [conversations, propDocumentId])

    // Auto-load the most recent conversation on first open
    useEffect(() => {
        if (
            isOpen &&
            !hasAutoLoaded &&
            !conversationId &&
            filteredConversations.length > 0
        ) {
            setConversationId(filteredConversations[0].id)
            setHasAutoLoaded(true)
        } else if (isOpen && !hasAutoLoaded && filteredConversations.length === 0) {
            setHasAutoLoaded(true)
        }
    }, [isOpen, hasAutoLoaded, conversationId, filteredConversations])

    // Derive display messages from DB + pending (no setState in effect)
    const dbDisplayMessages: DisplayMessage[] = useMemo(() => {
        if (!dbMessages || dbMessages.length === 0) return []
        return dbMessages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }))
    }, [dbMessages])

    const localMessages = dbDisplayMessages.length > 0 ? dbDisplayMessages : pendingMessages

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [localMessages, scrollToBottom])

    const effectiveDocumentId = propDocumentId
        ? propDocumentId
        : (selectedDocumentId === "all" ? undefined : selectedDocumentId)

    const handleSendMessage = async () => {
        const text = inputMessage.trim()
        if (!text || sendMessage.isPending) return

        setError(null)
        setInputMessage("")

        const userMsg: DisplayMessage = {
            id: `temp-user-${Date.now()}`,
            role: "user",
            content: text,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }

        const loadingMsg: DisplayMessage = {
            id: `temp-loading-${Date.now()}`,
            role: "assistant",
            content: "",
            timestamp: "",
            isLoading: true,
        }

        setPendingMessages(prev => [...prev, userMsg, loadingMsg])

        try {
            const response = await sendMessage.mutateAsync({
                message: text,
                bloomLevel,
                conversationId,
                documentId: effectiveDocumentId,
            })

            if (!conversationId && response.conversationId) {
                setConversationId(response.conversationId)
            }

            const aiMsg: DisplayMessage = {
                id: `ai-${Date.now()}`,
                role: "assistant",
                content: response.answer,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                sources: response.sources,
            }

            setPendingMessages(prev => prev.filter(m => !m.isLoading).concat(aiMsg))
        } catch (err) {
            setPendingMessages(prev => prev.filter(m => !m.isLoading))
            const message = err instanceof Error ? err.message : "Something went wrong"
            setError(message)
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    const handleNewConversation = () => {
        setConversationId(undefined)
        setPendingMessages([])
        setError(null)
        setShowHistory(false)
    }

    const handleSelectConversation = (conv: ChatConversation) => {
        setConversationId(conv.id)
        setPendingMessages([])
        setError(null)
        setShowHistory(false)
    }

    const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            await deleteConversation.mutateAsync(convId)
            // If we just deleted the active conversation, clear it
            if (conversationId === convId) {
                setConversationId(undefined)
                setPendingMessages([])
            }
        } catch (err) {
            console.error("Failed to delete conversation:", err)
        }
    }

    const formatConversationDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString([], { month: "short", day: "numeric" })
    }

    return (
        <>
            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform z-50"
                    size="icon"
                >
                    <MessageCircle className="w-6 h-6" />
                    <span className="sr-only">Ask EduCoach AI</span>
                </Button>
            )}

            {isOpen && (
                <Card className="fixed bottom-6 right-6 w-[calc(100vw-2rem)] sm:w-[420px] h-[500px] sm:h-[600px] shadow-2xl z-50 flex flex-col">
                    {/* Header */}
                    <CardHeader className="flex flex-row items-center justify-between bg-primary text-primary-foreground rounded-t-lg flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <img src="/images/educoach-logo.png" alt="EDUCOACH AI" className="w-6 h-6" />
                            <CardTitle className="text-lg">
                                {showHistory ? "Chat History" : "EDUCOACH AI Tutor"}
                            </CardTitle>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowHistory(!showHistory)}
                                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                                title={showHistory ? "Back to chat" : "Chat history"}
                            >
                                {showHistory ? (
                                    <ChevronLeft className="w-4 h-4" />
                                ) : (
                                    <History className="w-4 h-4" />
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleNewConversation}
                                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                                title="New conversation"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsOpen(false)}
                                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </CardHeader>

                    {/* ============================================================ */}
                    {/* HISTORY PANEL                                                 */}
                    {/* ============================================================ */}
                    {showHistory ? (
                        <CardContent className="flex-1 overflow-y-auto p-0">
                            {filteredConversations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-6">
                                    <History className="w-10 h-10 mb-3 opacity-40" />
                                    <p className="text-sm font-medium mb-1">No conversations yet</p>
                                    <p className="text-xs opacity-75">
                                        Start chatting with the AI Tutor and your conversations will appear here.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {filteredConversations.map((conv) => (
                                        <button
                                            key={conv.id}
                                            onClick={() => handleSelectConversation(conv)}
                                            className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex items-start gap-3 group ${conversationId === conv.id ? "bg-accent/30 border-l-2 border-primary" : ""
                                                }`}
                                        >
                                            <MessageCircle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{conv.title}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {formatConversationDate(conv.updated_at)}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-muted-foreground hover:text-destructive"
                                                onClick={(e) => handleDeleteConversation(conv.id, e)}
                                                title="Delete conversation"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    ) : (
                        <>
                            {/* Controls: Bloom level + Document scope */}
                            <div className="px-4 py-3 border-b bg-muted/30 flex-shrink-0 space-y-2">
                                <div>
                                    <Label htmlFor="bloom-level" className="text-xs font-medium mb-1 block">
                                        Learning Level
                                    </Label>
                                    <Select value={bloomLevel} onValueChange={setBloomLevel}>
                                        <SelectTrigger id="bloom-level" className="h-8 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="remember">Remember - Recall facts</SelectItem>
                                            <SelectItem value="understand">Understand - Explain concepts</SelectItem>
                                            <SelectItem value="apply">Apply - Use in new situations</SelectItem>
                                            <SelectItem value="analyze">Analyze - Break down information</SelectItem>
                                            <SelectItem value="evaluate">Evaluate - Make judgments</SelectItem>
                                            <SelectItem value="create">Create - Produce new work</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {!propDocumentId && readyDocuments.length > 0 && (
                                    <div>
                                        <Label htmlFor="doc-scope" className="text-xs font-medium mb-1 block">
                                            Search In
                                        </Label>
                                        <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
                                            <SelectTrigger id="doc-scope" className="h-8 text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Documents</SelectItem>
                                                {readyDocuments.map(doc => (
                                                    <SelectItem key={doc.id} value={doc.id}>
                                                        {doc.title}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            {/* Messages */}
                            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                                {localMessages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-4">
                                        <Sparkles className="w-10 h-10 mb-3 opacity-50" />
                                        <p className="text-sm font-medium mb-1">Ask me anything about your study materials!</p>
                                        <p className="text-xs opacity-75">
                                            {effectiveDocumentId
                                                ? "I'll answer from this document's content."
                                                : "I'll search across all your uploaded documents."}
                                        </p>
                                        {filteredConversations.length > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setShowHistory(true)}
                                                className="mt-4 text-xs"
                                            >
                                                <History className="w-3.5 h-3.5 mr-1.5" />
                                                View {filteredConversations.length} past conversation{filteredConversations.length !== 1 ? "s" : ""}
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {localMessages.map((message) => (
                                    <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                                        <div
                                            className={`flex gap-2 max-w-[85%] ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                                        >
                                            <Avatar className="w-8 h-8 flex-shrink-0">
                                                {message.role === "assistant" ? (
                                                    <AvatarFallback className="bg-primary text-primary-foreground">
                                                        <Sparkles className="w-4 h-4" />
                                                    </AvatarFallback>
                                                ) : (
                                                    <AvatarFallback className="bg-muted">You</AvatarFallback>
                                                )}
                                            </Avatar>
                                            <div className="min-w-0">
                                                {message.isLoading ? (
                                                    <div className="rounded-lg p-3 bg-muted text-foreground">
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            Thinking...
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div
                                                            className={`rounded-lg p-3 ${message.role === "user"
                                                                ? "bg-primary text-primary-foreground"
                                                                : "bg-muted text-foreground"
                                                                }`}
                                                        >
                                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                                        </div>

                                                        {/* Source citations */}
                                                        {message.sources && message.sources.length > 0 && (
                                                            <div className="mt-1.5 space-y-1">
                                                                <p className="text-xs text-muted-foreground px-1 font-medium">Sources:</p>
                                                                {message.sources.map((source, idx) => (
                                                                    <Link
                                                                        key={`${source.chunkId}-${idx}`}
                                                                        to={`/files/${source.documentId}`}
                                                                        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-background border hover:bg-accent/50 transition-colors"
                                                                    >
                                                                        <FileText className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                                                                        <span className="truncate">{source.documentTitle}</span>
                                                                        <span className="text-muted-foreground ml-auto flex-shrink-0">
                                                                            {Math.round(source.similarity * 100)}%
                                                                        </span>
                                                                        <ExternalLink className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {message.timestamp && (
                                                            <p className="text-xs text-muted-foreground mt-1 px-1">{message.timestamp}</p>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </CardContent>

                            {/* Error display */}
                            {error && (
                                <div className="px-4 py-2 border-t bg-destructive/10 text-destructive text-xs flex-shrink-0">
                                    {error}
                                </div>
                            )}

                            {/* Input */}
                            <div className="p-4 border-t bg-card flex-shrink-0">
                                <div className="flex gap-2">
                                    <Input
                                        value={inputMessage}
                                        onChange={(e) => setInputMessage(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        placeholder="Ask about your study materials..."
                                        className="flex-1"
                                        disabled={sendMessage.isPending}
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        size="icon"
                                        disabled={inputMessage.trim() === "" || sendMessage.isPending}
                                    >
                                        {sendMessage.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </Card>
            )}
        </>
    )
}
