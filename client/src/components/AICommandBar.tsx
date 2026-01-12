import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Bot, Search, Loader2, Sparkles, ArrowRight, Command,
  FileText, Package, Users, DollarSign, Truck, ClipboardList,
  Send, X
} from "lucide-react";
import { useLocation } from "wouter";

interface AICommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: {
    type: string;
    id?: number | string;
    name?: string;
    data?: any;
  };
}

const quickActions = [
  { icon: FileText, label: "Summarize this contract", query: "Summarize the key terms and risks of this contract", context: ["contract"] },
  { icon: DollarSign, label: "Why did margins drop?", query: "Analyze why profit margins dropped last month and suggest improvements", context: ["dashboard", "finance"] },
  { icon: Package, label: "Check inventory levels", query: "Show me products with low stock that need reordering", context: ["inventory", "products"] },
  { icon: Truck, label: "Draft vendor delay response", query: "Draft a professional response to this vendor about their shipment delay", context: ["vendor", "po", "shipment"] },
  { icon: ClipboardList, label: "Generate PO from forecast", query: "Based on demand forecast, generate purchase orders for materials running low", context: ["procurement", "forecast"] },
  { icon: Users, label: "Find customer insights", query: "Analyze this customer's purchase history and suggest upsell opportunities", context: ["customer", "sales"] },
];

export function AICommandBar({ open, onOpenChange, context }: AICommandBarProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  const aiQuery = trpc.ai.query.useMutation({
    onSuccess: (data) => {
      setResponse(data.answer);
      setIsLoading(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsLoading(false);
    },
  });

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!open) {
      setQuery("");
      setResponse(null);
      setShowSuggestions(true);
    }
  }, [open]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const handleSubmit = useCallback((q: string) => {
    if (!q.trim()) return;
    setIsLoading(true);
    setShowSuggestions(false);
    setResponse(null);
    
    // Include context in the query if available
    let fullQuery = q;
    if (context) {
      fullQuery = `[Context: ${context.type}${context.name ? ` - ${context.name}` : ""}${context.id ? ` (ID: ${context.id})` : ""}]\n\n${q}`;
    }
    
    aiQuery.mutate({ question: fullQuery });
  }, [context, aiQuery]);

  const filteredActions = quickActions.filter(action => 
    !context || action.context.some(c => context.type.toLowerCase().includes(c))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        <div className="flex items-center border-b px-4 py-3">
          <Bot className="h-5 w-5 text-primary mr-3" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(query);
              }
            }}
            placeholder={context ? `Ask about ${context.name || context.type}...` : "Ask AI anything... (⌘K)"}
            className="border-0 focus-visible:ring-0 text-base flex-1"
          />
          {query && (
            <Button
              size="sm"
              onClick={() => handleSubmit(query)}
              disabled={isLoading}
              className="ml-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {context && (
          <div className="px-4 py-2 bg-muted/50 border-b flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {context.type}
            </Badge>
            {context.name && (
              <span className="text-sm text-muted-foreground">{context.name}</span>
            )}
          </div>
        )}

        <ScrollArea className="max-h-[60vh]">
          {isLoading && (
            <div className="p-6 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
              <span className="text-muted-foreground">Thinking...</span>
            </div>
          )}

          {response && !isLoading && (
            <div className="p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Streamdown>{response}</Streamdown>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setResponse(null);
                    setShowSuggestions(true);
                    setQuery("");
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(response);
                    toast.success("Copied to clipboard");
                  }}
                >
                  Copy response
                </Button>
              </div>
            </div>
          )}

          {showSuggestions && !isLoading && !response && (
            <div className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                <Sparkles className="h-3 w-3 inline mr-1" />
                Quick Actions
              </p>
              <div className="space-y-1">
                {filteredActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(action.query);
                      handleSubmit(action.query);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left transition-colors group"
                  >
                    <action.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    <span className="flex-1 text-sm">{action.label}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  <Command className="h-3 w-3 inline mr-1" />
                  Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘K</kbd> anywhere to open
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Floating AI button for pages
export function AIFloatingButton({ context }: { context?: AICommandBarProps["context"] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        variant="outline"
        className="fixed bottom-6 right-6 shadow-lg hover:shadow-xl transition-all z-50 gap-2"
      >
        <Bot className="h-4 w-4" />
        <span className="hidden sm:inline">Ask AI</span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 bg-muted rounded text-xs">⌘K</kbd>
      </Button>
      <AICommandBar open={open} onOpenChange={setOpen} context={context} />
    </>
  );
}

// Inline AI input for list views
export function AIInlineInput({ 
  context, 
  placeholder = "Ask AI about this data...",
  className = ""
}: { 
  context?: AICommandBarProps["context"];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div 
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${className}`}
      >
        <Bot className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground flex-1">{placeholder}</span>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs text-muted-foreground">⌘K</kbd>
      </div>
      <AICommandBar open={open} onOpenChange={setOpen} context={context} />
    </>
  );
}
