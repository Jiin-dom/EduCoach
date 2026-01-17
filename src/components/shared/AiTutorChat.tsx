import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { MessageCircle, X, Send, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface Message {
    id: number
    sender: "user" | "ai"
    text: string
    timestamp: string
}

export function AiTutorChat() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            sender: "ai",
            text: "Hello! I'm your AI tutor. How can I help you study today?",
            timestamp: "10:30 AM",
        },
        {
            id: 2,
            sender: "user",
            text: "Can you explain photosynthesis?",
            timestamp: "10:31 AM",
        },
        {
            id: 3,
            sender: "ai",
            text: "Of course! Photosynthesis is the process by which plants convert light energy into chemical energy. It occurs in the chloroplasts and involves two main stages: the light-dependent reactions and the Calvin cycle. Would you like me to explain each stage in detail?",
            timestamp: "10:31 AM",
        },
    ])
    const [inputMessage, setInputMessage] = useState("")
    const [bloomLevel, setBloomLevel] = useState("understand")
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSendMessage = () => {
        if (inputMessage.trim() === "") return

        const newMessage: Message = {
            id: messages.length + 1,
            sender: "user",
            text: inputMessage,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }

        setMessages([...messages, newMessage])
        setInputMessage("")

        setTimeout(() => {
            const aiResponse: Message = {
                id: messages.length + 2,
                sender: "ai",
                text: "I understand your question. Let me help you with that based on your selected Bloom level...",
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            }
            setMessages((prev) => [...prev, aiResponse])
        }, 1000)
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
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
                    <CardHeader className="flex flex-row items-center justify-between bg-primary text-primary-foreground rounded-t-lg flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <img src="/images/educoach-logo.png" alt="EDUCOACH AI" className="w-6 h-6" />
                            <CardTitle className="text-lg">EDUCOACH AI Tutor</CardTitle>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsOpen(false)}
                            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </CardHeader>

                    <div className="px-4 py-3 border-b bg-muted/30 flex-shrink-0">
                        <Label htmlFor="bloom-level" className="text-xs font-medium mb-1 block">
                            Learning Level
                        </Label>
                        <Select value={bloomLevel} onValueChange={setBloomLevel}>
                            <SelectTrigger id="bloom-level" className="h-9 text-sm">
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

                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((message) => (
                            <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                                <div
                                    className={`flex gap-2 max-w-[85%] ${message.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
                                >
                                    <Avatar className="w-8 h-8 flex-shrink-0">
                                        {message.sender === "ai" ? (
                                            <AvatarFallback className="bg-primary text-primary-foreground">
                                                <Sparkles className="w-4 h-4" />
                                            </AvatarFallback>
                                        ) : (
                                            <AvatarFallback className="bg-muted">JD</AvatarFallback>
                                        )}
                                    </Avatar>
                                    <div>
                                        <div
                                            className={`rounded-lg p-3 ${message.sender === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                                                }`}
                                        >
                                            <p className="text-sm leading-relaxed">{message.text}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 px-1">{message.timestamp}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </CardContent>

                    <div className="p-4 border-t bg-card flex-shrink-0">
                        <div className="flex gap-2">
                            <Input
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Ask me anything..."
                                className="flex-1"
                            />
                            <Button onClick={handleSendMessage} size="icon" disabled={inputMessage.trim() === ""}>
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
        </>
    )
}
