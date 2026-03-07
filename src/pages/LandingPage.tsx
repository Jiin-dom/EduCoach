import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    Brain,
    Target,
    TrendingUp,
    BookOpen,
    Clock,
    Award,
    Users,
    Sparkles,
    ArrowRight,
    CheckCircle2,
    Menu,
    X,
} from "lucide-react"

export default function LandingPage() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="md:hidden"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            >
                                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </Button>
                            <Link to="/" className="flex items-center gap-3">
                                <img src="/images/educoach-logo.png" alt="EduCoach" className="w-10 h-10" />
                                <span className="text-2xl font-bold">EduCoach</span>
                            </Link>
                        </div>
                        <nav className="hidden md:flex items-center gap-6">
                            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">
                                Features
                            </a>
                            <a href="#how-it-works" className="text-sm font-medium hover:text-primary transition-colors">
                                How It Works
                            </a>
                            <a href="#benefits" className="text-sm font-medium hover:text-primary transition-colors">
                                Benefits
                            </a>
                        </nav>
                        <div className="hidden md:flex items-center gap-3">
                            <Button variant="ghost" asChild>
                                <Link to="/login">Log In</Link>
                            </Button>
                            <Button asChild>
                                <Link to="/register">Get Started</Link>
                            </Button>
                        </div>
                    </div>

                    {/* Mobile Navigation */}
                    {isMobileMenuOpen && (
                        <nav className="md:hidden py-4 border-t mt-4 flex flex-col gap-4">
                            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-medium hover:text-primary transition-colors px-2">
                                Features
                            </a>
                            <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-medium hover:text-primary transition-colors px-2">
                                How It Works
                            </a>
                            <a href="#benefits" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-medium hover:text-primary transition-colors px-2">
                                Benefits
                            </a>
                            <div className="flex flex-col gap-2 pt-4 border-t">
                                <Button variant="outline" className="w-full" asChild>
                                    <Link to="/login">Log In</Link>
                                </Button>
                                <Button className="w-full" asChild>
                                    <Link to="/register">Get Started</Link>
                                </Button>
                            </div>
                        </nav>
                    )}
                </div>
            </header>

            {/* Hero Section */}
            <section className="container mx-auto px-4 py-20 md:py-32">
                <div className="max-w-4xl mx-auto text-center space-y-8">
                    <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                        <Sparkles className="w-4 h-4" />
                        AI-Powered Learning for Filipino Students
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold leading-tight text-balance">
                        Your Personal Study Coach, Powered by AI
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
                        EduCoach helps Filipino college students achieve academic excellence through personalized learning paths,
                        automated assessments, and intelligent performance analytics.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button size="lg" className="text-lg px-8" asChild>
                            <Link to="/register">
                                Start Learning Free <ArrowRight className="ml-2 w-5 h-5" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" className="text-lg px-8 bg-transparent" asChild>
                            <a href="#how-it-works">See How It Works</a>
                        </Button>
                    </div>
                    <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground pt-8">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                            <span>No credit card required</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                            <span>Free forever</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="bg-muted/50 py-20">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Excel</h2>
                        <p className="text-lg text-muted-foreground">
                            Powerful AI-driven features designed specifically for Filipino college students
                        </p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card className="border-2 hover:border-primary/50 transition-colors">
                            <CardContent className="pt-6">
                                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                                    <Brain className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">AI-Powered Learning Paths</h3>
                                <p className="text-muted-foreground">
                                    Personalized study plans that adapt to your learning style, pace, and academic goals.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-2 hover:border-primary/50 transition-colors">
                            <CardContent className="pt-6">
                                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                                    <Target className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Automated Quiz Generation</h3>
                                <p className="text-muted-foreground">
                                    Generate custom quizzes from your study materials with adjustable difficulty and question types.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-2 hover:border-primary/50 transition-colors">
                            <CardContent className="pt-6">
                                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                                    <TrendingUp className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Performance Analytics</h3>
                                <p className="text-muted-foreground">
                                    Track your progress with detailed insights, identify weak topics, and measure your readiness.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-2 hover:border-primary/50 transition-colors">
                            <CardContent className="pt-6">
                                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                                    <BookOpen className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Smart Study Materials</h3>
                                <p className="text-muted-foreground">
                                    Upload and organize your notes, PDFs, and documents with AI-powered content analysis.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-2 hover:border-primary/50 transition-colors">
                            <CardContent className="pt-6">
                                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                                    <Clock className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Deadline Management</h3>
                                <p className="text-muted-foreground">
                                    Never miss a deadline with intelligent reminders and automated study schedule optimization.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-2 hover:border-primary/50 transition-colors">
                            <CardContent className="pt-6">
                                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                                    <Award className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">AI Tutor Assistant</h3>
                                <p className="text-muted-foreground">
                                    Get instant help with your questions through our intelligent AI tutor available 24/7.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="py-20">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">How EduCoach Works</h2>
                        <p className="text-lg text-muted-foreground">Get started in minutes and transform your study habits</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-primary">
                                1
                            </div>
                            <h3 className="text-xl font-semibold">Create Your Profile</h3>
                            <p className="text-muted-foreground">
                                Tell us about your year level, course, and study preferences so we can personalize your experience.
                            </p>
                        </div>
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-primary">
                                2
                            </div>
                            <h3 className="text-xl font-semibold">Upload Study Materials</h3>
                            <p className="text-muted-foreground">
                                Add your notes, PDFs, and documents. Our AI analyzes them to create personalized quizzes and insights.
                            </p>
                        </div>
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-primary">
                                3
                            </div>
                            <h3 className="text-xl font-semibold">Learn & Improve</h3>
                            <p className="text-muted-foreground">
                                Follow your personalized learning path, take quizzes, and track your progress with detailed analytics.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section id="benefits" className="bg-muted/50 py-20">
                <div className="container mx-auto px-4">
                    <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
                        <div className="space-y-6">
                            <h2 className="text-3xl md:text-4xl font-bold">Built for Filipino Students</h2>
                            <p className="text-lg text-muted-foreground">
                                EduCoach understands the unique challenges of Filipino college students and provides tools to help you
                                succeed.
                            </p>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold mb-1">Personalized Learning</h4>
                                        <p className="text-muted-foreground">
                                            AI adapts to your learning style and creates custom study plans that fit your schedule.
                                        </p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold mb-1">Save Time</h4>
                                        <p className="text-muted-foreground">
                                            Automated quiz generation and smart scheduling help you study more efficiently.
                                        </p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold mb-1">Track Progress</h4>
                                        <p className="text-muted-foreground">
                                            Detailed analytics show your strengths, weaknesses, and readiness for exams.
                                        </p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold mb-1">Always Available</h4>
                                        <p className="text-muted-foreground">
                                            Study anytime, anywhere with 24/7 access to your materials and AI tutor.
                                        </p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                        <div className="relative">
                            <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-8 border-2 border-primary/20">
                                <div className="space-y-6">
                                    <div className="bg-background rounded-lg p-6 shadow-lg">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                                <TrendingUp className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Readiness Score</p>
                                                <p className="text-2xl font-bold">78%</p>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-primary w-[78%]" />
                                        </div>
                                    </div>
                                    <div className="bg-background rounded-lg p-6 shadow-lg">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                                <Users className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Study Streak</p>
                                                <p className="text-2xl font-bold">5 Days</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-background rounded-lg p-6 shadow-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                                <Award className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Quizzes Completed</p>
                                                <p className="text-2xl font-bold">24</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20">
                <div className="container mx-auto px-4">
                    <div className="max-w-4xl mx-auto text-center space-y-8 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-12 border-2 border-primary/20">
                        <h2 className="text-3xl md:text-4xl font-bold">Ready to Transform Your Study Habits?</h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Join thousands of Filipino students who are achieving academic excellence with EduCoach.
                        </p>
                        <Button size="lg" className="text-lg px-8" asChild>
                            <Link to="/register">
                                Get Started for Free <ArrowRight className="ml-2 w-5 h-5" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t py-12 bg-muted/30">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-4 gap-8">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <img src="/images/educoach-logo.png" alt="EduCoach" className="w-8 h-8" />
                                <span className="text-xl font-bold">EduCoach</span>
                            </div>
                            <p className="text-sm text-muted-foreground">AI-powered study companion for Filipino college students.</p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Product</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>
                                    <a href="#features" className="hover:text-foreground transition-colors">
                                        Features
                                    </a>
                                </li>
                                <li>
                                    <a href="#how-it-works" className="hover:text-foreground transition-colors">
                                        How It Works
                                    </a>
                                </li>
                                <li>
                                    <a href="#benefits" className="hover:text-foreground transition-colors">
                                        Benefits
                                    </a>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Company</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>
                                    <a href="#" className="hover:text-foreground transition-colors">
                                        About Us
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-foreground transition-colors">
                                        Contact
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-foreground transition-colors">
                                        Privacy Policy
                                    </a>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Get Started</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>
                                    <Link to="/register" className="hover:text-foreground transition-colors">
                                        Sign Up
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/login" className="hover:text-foreground transition-colors">
                                        Log In
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
                        <p>&copy; 2025 EduCoach. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
