import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import type { Concept } from '@/hooks/useConcepts'

interface KeyTermsGroupProps {
    concepts: Concept[]
    keywords: string[]
}

export function KeyTermsGroup({ concepts, keywords }: KeyTermsGroupProps) {
    const [expanded, setExpanded] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [search, setSearch] = useState('')

    // Group terms by category from concepts
    const groups = new Map<string, string[]>()
    for (const concept of concepts) {
        const cat = concept.category || 'General'
        const existing = groups.get(cat) || []
        if (!existing.includes(concept.name)) {
            existing.push(concept.name)
        }
        for (const kw of concept.keywords || []) {
            if (kw && kw.length >= 3 && !existing.includes(kw)) {
                existing.push(kw)
            }
        }
        groups.set(cat, existing)
    }

    // If no concept grouping available, show flat keywords
    if (groups.size === 0 && keywords.length > 0) {
        groups.set('Key Terms', keywords.slice(0, 15))
    }

    const topTerms = keywords.slice(0, 10)
    const allTerms = keywords

    if (topTerms.length === 0 && groups.size === 0) return null

    const filteredAll = search
        ? allTerms.filter(t => t.toLowerCase().includes(search.toLowerCase()))
        : allTerms

    return (
        <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top Terms</span>
                <div className="flex gap-1">
                    {allTerms.length > 10 && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setDialogOpen(true)}>
                            Show all ({allTerms.length})
                        </Button>
                    )}
                    {groups.size > 1 && (
                        <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setExpanded(p => !p)}>
                            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </Button>
                    )}
                </div>
            </div>

            {!expanded ? (
                <div className="flex flex-wrap gap-1.5">
                    {topTerms.map((term) => (
                        <Badge key={term} variant="secondary" className="text-xs">{term}</Badge>
                    ))}
                </div>
            ) : (
                <div className="space-y-3">
                    {Array.from(groups.entries()).map(([category, terms]) => (
                        <div key={category}>
                            <span className="text-xs font-medium text-muted-foreground mb-1 block">{category}</span>
                            <div className="flex flex-wrap gap-1.5">
                                {terms.slice(0, 8).map((term) => (
                                    <Badge key={term} variant="secondary" className="text-xs">{term}</Badge>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>All Key Terms ({allTerms.length})</DialogTitle>
                    </DialogHeader>
                    <div className="relative mb-3">
                        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search terms..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-[300px] overflow-y-auto">
                        {filteredAll.map((term) => (
                            <Badge key={term} variant="secondary" className="text-xs">{term}</Badge>
                        ))}
                        {filteredAll.length === 0 && (
                            <p className="text-sm text-muted-foreground py-4 text-center w-full">No matching terms</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
