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
  Send, X, CheckCircle, Clock
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

// Task types that can be created via AI Command Bar
type TaskType = "generate_po" | "send_rfq" | "send_quote_request" | "send_email" | "update_inventory" | "create_shipment" | "generate_invoice" | "reconcile_payment" | "reorder_materials" | "vendor_followup" | "create_work_order" | "query";

// ============================================
// Natural Language Parsing Utilities
// ============================================

interface ParsedQuantity {
  value: number;
  unit: string;
  originalText: string;
}

interface ParsedDate {
  date: Date;
  originalText: string;
  isRelative: boolean;
}

// Unit conversion factors to base unit (units)
const UNIT_CONVERSIONS: Record<string, { factor: number; baseUnit: string }> = {
  // Weight units
  'kg': { factor: 1, baseUnit: 'kg' },
  'kgs': { factor: 1, baseUnit: 'kg' },
  'kilogram': { factor: 1, baseUnit: 'kg' },
  'kilograms': { factor: 1, baseUnit: 'kg' },
  'lb': { factor: 0.453592, baseUnit: 'kg' },
  'lbs': { factor: 0.453592, baseUnit: 'kg' },
  'pound': { factor: 0.453592, baseUnit: 'kg' },
  'pounds': { factor: 0.453592, baseUnit: 'kg' },
  'g': { factor: 0.001, baseUnit: 'kg' },
  'gram': { factor: 0.001, baseUnit: 'kg' },
  'grams': { factor: 0.001, baseUnit: 'kg' },
  'oz': { factor: 0.0283495, baseUnit: 'kg' },
  'ounce': { factor: 0.0283495, baseUnit: 'kg' },
  'ounces': { factor: 0.0283495, baseUnit: 'kg' },
  // Volume units
  'l': { factor: 1, baseUnit: 'L' },
  'liter': { factor: 1, baseUnit: 'L' },
  'liters': { factor: 1, baseUnit: 'L' },
  'litre': { factor: 1, baseUnit: 'L' },
  'litres': { factor: 1, baseUnit: 'L' },
  'ml': { factor: 0.001, baseUnit: 'L' },
  'gal': { factor: 3.78541, baseUnit: 'L' },
  'gallon': { factor: 3.78541, baseUnit: 'L' },
  'gallons': { factor: 3.78541, baseUnit: 'L' },
  // Count units
  'unit': { factor: 1, baseUnit: 'units' },
  'units': { factor: 1, baseUnit: 'units' },
  'piece': { factor: 1, baseUnit: 'units' },
  'pieces': { factor: 1, baseUnit: 'units' },
  'pcs': { factor: 1, baseUnit: 'units' },
  'ea': { factor: 1, baseUnit: 'units' },
  'each': { factor: 1, baseUnit: 'units' },
  // Container units
  'case': { factor: 1, baseUnit: 'cases' },
  'cases': { factor: 1, baseUnit: 'cases' },
  'box': { factor: 1, baseUnit: 'boxes' },
  'boxes': { factor: 1, baseUnit: 'boxes' },
  'pallet': { factor: 1, baseUnit: 'pallets' },
  'pallets': { factor: 1, baseUnit: 'pallets' },
  'carton': { factor: 1, baseUnit: 'cartons' },
  'cartons': { factor: 1, baseUnit: 'cartons' },
  'bag': { factor: 1, baseUnit: 'bags' },
  'bags': { factor: 1, baseUnit: 'bags' },
  'roll': { factor: 1, baseUnit: 'rolls' },
  'rolls': { factor: 1, baseUnit: 'rolls' },
};

// Parse quantity with unit from natural language
function parseQuantity(text: string): ParsedQuantity | null {
  // Match patterns like "50kg", "100 lbs", "25 cases", "1,000 units"
  const patterns = [
    // Number with unit attached: "50kg", "100lbs"
    /([\d,]+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|lb|lbs|pound|pounds|g|gram|grams|oz|ounce|ounces|l|liter|liters|litre|litres|ml|gal|gallon|gallons|unit|units|piece|pieces|pcs|ea|each|case|cases|box|boxes|pallet|pallets|carton|cartons|bag|bags|roll|rolls)\b/i,
    // Number with unit separated: "50 kg", "100 lbs"
    /([\d,]+(?:\.\d+)?)\s+(kg|kgs|kilogram|kilograms|lb|lbs|pound|pounds|g|gram|grams|oz|ounce|ounces|l|liter|liters|litre|litres|ml|gal|gallon|gallons|unit|units|piece|pieces|pcs|ea|each|case|cases|box|boxes|pallet|pallets|carton|cartons|bag|bags|roll|rolls)\b/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1].replace(/,/g, '');
      const value = parseFloat(numStr);
      const unitKey = match[2].toLowerCase();
      const unitInfo = UNIT_CONVERSIONS[unitKey];
      
      if (unitInfo && !isNaN(value)) {
        return {
          value,
          unit: unitInfo.baseUnit,
          originalText: match[0]
        };
      }
    }
  }
  
  // Fallback: just a number without unit
  const numberMatch = text.match(/\b([\d,]+(?:\.\d+)?)\b/);
  if (numberMatch) {
    const value = parseFloat(numberMatch[1].replace(/,/g, ''));
    if (!isNaN(value) && value > 0) {
      return {
        value,
        unit: 'units',
        originalText: numberMatch[0]
      };
    }
  }
  
  return null;
}

// Day name to number mapping
const DAY_NAMES: Record<string, number> = {
  'sunday': 0, 'sun': 0,
  'monday': 1, 'mon': 1,
  'tuesday': 2, 'tue': 2, 'tues': 2,
  'wednesday': 3, 'wed': 3,
  'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
  'friday': 5, 'fri': 5,
  'saturday': 6, 'sat': 6,
};

// Month name to number mapping
const MONTH_NAMES: Record<string, number> = {
  'january': 0, 'jan': 0,
  'february': 1, 'feb': 1,
  'march': 2, 'mar': 2,
  'april': 3, 'apr': 3,
  'may': 4,
  'june': 5, 'jun': 5,
  'july': 6, 'jul': 6,
  'august': 7, 'aug': 7,
  'september': 8, 'sep': 8, 'sept': 8,
  'october': 9, 'oct': 9,
  'november': 10, 'nov': 10,
  'december': 11, 'dec': 11,
};

// Parse date from natural language
function parseDate(text: string): ParsedDate | null {
  const lowerText = text.toLowerCase();
  const now = new Date();
  
  // Today/Tomorrow/Yesterday
  if (/\btoday\b/.test(lowerText)) {
    return { date: now, originalText: 'today', isRelative: true };
  }
  if (/\btomorrow\b/.test(lowerText)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { date: tomorrow, originalText: 'tomorrow', isRelative: true };
  }
  if (/\byesterday\b/.test(lowerText)) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { date: yesterday, originalText: 'yesterday', isRelative: true };
  }
  
  // "next [day]" - e.g., "next Friday", "next Monday"
  const nextDayMatch = lowerText.match(/\bnext\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/);
  if (nextDayMatch) {
    const targetDay = DAY_NAMES[nextDayMatch[1]];
    const result = new Date(now);
    const currentDay = result.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7; // Always go to next week
    result.setDate(result.getDate() + daysToAdd);
    return { date: result, originalText: nextDayMatch[0], isRelative: true };
  }
  
  // "this [day]" - e.g., "this Friday"
  const thisDayMatch = lowerText.match(/\bthis\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/);
  if (thisDayMatch) {
    const targetDay = DAY_NAMES[thisDayMatch[1]];
    const result = new Date(now);
    const currentDay = result.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd < 0) daysToAdd += 7;
    result.setDate(result.getDate() + daysToAdd);
    return { date: result, originalText: thisDayMatch[0], isRelative: true };
  }
  
  // "in X days/weeks/months" - e.g., "in 2 weeks", "in 3 days"
  const inTimeMatch = lowerText.match(/\bin\s+(\d+)\s*(day|days|week|weeks|month|months)\b/);
  if (inTimeMatch) {
    const amount = parseInt(inTimeMatch[1]);
    const unit = inTimeMatch[2];
    const result = new Date(now);
    
    if (unit.startsWith('day')) {
      result.setDate(result.getDate() + amount);
    } else if (unit.startsWith('week')) {
      result.setDate(result.getDate() + (amount * 7));
    } else if (unit.startsWith('month')) {
      result.setMonth(result.getMonth() + amount);
    }
    
    return { date: result, originalText: inTimeMatch[0], isRelative: true };
  }
  
  // "next week/month" 
  if (/\bnext\s+week\b/.test(lowerText)) {
    const result = new Date(now);
    result.setDate(result.getDate() + 7);
    return { date: result, originalText: 'next week', isRelative: true };
  }
  if (/\bnext\s+month\b/.test(lowerText)) {
    const result = new Date(now);
    result.setMonth(result.getMonth() + 1);
    return { date: result, originalText: 'next month', isRelative: true };
  }
  
  // "end of week/month"
  if (/\bend\s+of\s+(the\s+)?week\b/.test(lowerText)) {
    const result = new Date(now);
    const daysUntilFriday = (5 - result.getDay() + 7) % 7 || 7;
    result.setDate(result.getDate() + daysUntilFriday);
    return { date: result, originalText: 'end of week', isRelative: true };
  }
  if (/\bend\s+of\s+(the\s+)?month\b/.test(lowerText)) {
    const result = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { date: result, originalText: 'end of month', isRelative: true };
  }
  
  // Absolute dates: "March 15th", "March 15", "15th March"
  const monthDayMatch = lowerText.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (monthDayMatch) {
    const month = MONTH_NAMES[monthDayMatch[1]];
    const day = parseInt(monthDayMatch[2]);
    let year = now.getFullYear();
    // If the date has passed this year, assume next year
    const result = new Date(year, month, day);
    if (result < now) {
      result.setFullYear(year + 1);
    }
    return { date: result, originalText: monthDayMatch[0], isRelative: false };
  }
  
  // Day Month format: "15th March", "15 March"
  const dayMonthMatch = lowerText.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b/);
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1]);
    const month = MONTH_NAMES[dayMonthMatch[2]];
    let year = now.getFullYear();
    const result = new Date(year, month, day);
    if (result < now) {
      result.setFullYear(year + 1);
    }
    return { date: result, originalText: dayMonthMatch[0], isRelative: false };
  }
  
  // ISO format: "2026-03-15"
  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const result = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    return { date: result, originalText: isoMatch[0], isRelative: false };
  }
  
  // US format: "3/15/26" or "03/15/2026"
  const usDateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (usDateMatch) {
    let year = parseInt(usDateMatch[3]);
    if (year < 100) year += 2000; // Convert 26 to 2026
    const result = new Date(year, parseInt(usDateMatch[1]) - 1, parseInt(usDateMatch[2]));
    return { date: result, originalText: usDateMatch[0], isRelative: false };
  }
  
  return null;
}

// Extract material name from query
function extractMaterialName(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  
  // Patterns to extract material name
  const patterns = [
    // "order X of [material]" or "order [material]"
    /(?:order|purchase|buy|get|need)\s+(?:[\d,]+\s*(?:kg|kgs|lb|lbs|units?|cases?|boxes?|pieces?)?\s+(?:of\s+)?)?([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:from|by|before|for|at|$))/i,
    // "PO for [material]"
    /(?:po|purchase\s+order)\s+(?:for\s+)?(?:[\d,]+\s*(?:kg|kgs|lb|lbs|units?|cases?|boxes?|pieces?)?\s+(?:of\s+)?)?([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:from|by|before|for|at|$))/i,
    // "[quantity] [material]"
    /(?:[\d,]+\s*(?:kg|kgs|lb|lbs|units?|cases?|boxes?|pieces?)\s+(?:of\s+)?)([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:from|by|before|for|at|$))/i,
  ];
  
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      // Clean up the material name
      let name = match[1].trim();
      // Remove common trailing words
      name = name.replace(/\s+(please|asap|urgently|immediately)$/i, '').trim();
      if (name.length > 2 && name.length < 50) {
        return name;
      }
    }
  }
  
  return null;
}

interface ParsedIntent {
  taskType: TaskType;
  taskData: Record<string, any>;
  description: string;
}

const quickActions = [
  { icon: FileText, label: "Summarize this contract", query: "Summarize the key terms and risks of this contract", context: ["contract"], taskType: "query" as TaskType },
  { icon: DollarSign, label: "Why did margins drop?", query: "Analyze why profit margins dropped last month and suggest improvements", context: ["dashboard", "finance"], taskType: "query" as TaskType },
  { icon: Package, label: "Check inventory levels", query: "Show me products with low stock that need reordering", context: ["inventory", "products"], taskType: "query" as TaskType },
  { icon: Truck, label: "Draft vendor delay response", query: "Draft a professional response to this vendor about their shipment delay", context: ["vendor", "po", "shipment"], taskType: "send_email" as TaskType },
  { icon: ClipboardList, label: "Generate PO from forecast", query: "Based on demand forecast, generate purchase orders for materials running low", context: ["procurement", "forecast"], taskType: "generate_po" as TaskType },
  { icon: Users, label: "Find customer insights", query: "Analyze this customer's purchase history and suggest upsell opportunities", context: ["customer", "sales"], taskType: "query" as TaskType },
];

// Parse natural language query to determine intent
function parseIntent(query: string): ParsedIntent {
  const lowerQuery = query.toLowerCase();
  
  // Parse quantity and date from the query
  const parsedQuantity = parseQuantity(query);
  const parsedDate = parseDate(query);
  const materialName = extractMaterialName(query);
  
  // Check for PO generation intent
  const isPOIntent = 
    lowerQuery.includes("generate po") || 
    lowerQuery.includes("create po") || 
    lowerQuery.includes("purchase order") ||
    lowerQuery.includes("reorder") ||
    (lowerQuery.includes("order") && 
      (lowerQuery.includes("material") || lowerQuery.includes("stock") || 
       lowerQuery.includes("inventory") || parsedQuantity !== null));
  
  if (isPOIntent) {
    // Build description with parsed values
    let description = "Generate PO";
    if (parsedQuantity) {
      description += ` for ${parsedQuantity.value} ${parsedQuantity.unit}`;
    }
    if (materialName) {
      description += ` of ${materialName}`;
    }
    if (parsedDate) {
      description += ` by ${parsedDate.originalText}`;
    }
    
    return {
      taskType: "generate_po",
      taskData: {
        rawMaterialName: materialName,
        quantity: parsedQuantity?.value || 1,
        quantityUnit: parsedQuantity?.unit || 'units',
        unitCost: null,
        requiredDate: parsedDate?.date.toISOString() || null,
        requiredDateText: parsedDate?.originalText || null,
        vendorId: null
      },
      description
    };
  }
  
  // Check for RFQ intent
  if (lowerQuery.includes("rfq") || lowerQuery.includes("request for quote") || 
      lowerQuery.includes("get quotes") || lowerQuery.includes("freight quote")) {
    return {
      taskType: "send_rfq",
      taskData: {
        description: query,
        requiredDate: parsedDate?.date.toISOString() || null,
        requiredDateText: parsedDate?.originalText || null,
      },
      description: `Send RFQ${parsedDate ? ` (needed by ${parsedDate.originalText})` : ''}`
    };
  }
  
  // Check for email intent
  if (lowerQuery.includes("email") || lowerQuery.includes("send") && 
      (lowerQuery.includes("vendor") || lowerQuery.includes("supplier") || lowerQuery.includes("carrier"))) {
    return {
      taskType: "send_email",
      taskData: {
        subject: null,
        body: query
      },
      description: "Draft and send email"
    };
  }
  
  // Check for work order intent
  if (lowerQuery.includes("work order") || lowerQuery.includes("production") || 
      lowerQuery.includes("manufacture") || lowerQuery.includes("produce")) {
    return {
      taskType: "create_work_order",
      taskData: {
        description: query,
        quantity: parsedQuantity?.value || null,
        quantityUnit: parsedQuantity?.unit || null,
        requiredDate: parsedDate?.date.toISOString() || null,
      },
      description: `Create work order${parsedQuantity ? ` for ${parsedQuantity.value} ${parsedQuantity.unit}` : ''}${parsedDate ? ` by ${parsedDate.originalText}` : ''}`
    };
  }
  
  // Default to query
  return {
    taskType: "query",
    taskData: { question: query },
    description: "AI Query"
  };
}

export function AICommandBar({ open, onOpenChange, context }: AICommandBarProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [taskCreated, setTaskCreated] = useState<{ id: number; status: string } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // AI Query mutation for general questions
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

  // AI Agent task creation mutation
  const createTask = trpc.aiAgent.tasks.create.useMutation({
    onSuccess: (data) => {
      setTaskCreated({ id: data.id, status: data.status || 'pending_approval' });
      setIsLoading(false);
      toast.success(`AI Task created: ${data.taskType}`, {
        description: data.status === "pending_approval" 
          ? "Task is pending approval in the Approval Queue" 
          : "Task has been queued for execution"
      });
      utils.aiAgent.tasks.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to create task: ${error.message}`);
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
      setTaskCreated(null);
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

  const handleSubmit = useCallback(async (q: string, forceTaskType?: TaskType) => {
    if (!q.trim()) return;
    setIsLoading(true);
    setShowSuggestions(false);
    setResponse(null);
    setTaskCreated(null);
    
    // Parse the intent from the query
    const intent = parseIntent(q);
    const taskType = forceTaskType || intent.taskType;
    
    // If it's a general query, use the AI query endpoint
    if (taskType === "query") {
      let fullQuery = q;
      if (context) {
        fullQuery = `[Context: ${context.type}${context.name ? ` - ${context.name}` : ""}${context.id ? ` (ID: ${context.id})` : ""}]\n\n${q}`;
      }
      aiQuery.mutate({ question: fullQuery });
      return;
    }
    
    // For actionable tasks, create an AI Agent task
    try {
      await createTask.mutateAsync({
        taskType: taskType,
        priority: "medium",
        taskData: JSON.stringify({
          ...intent.taskData,
          originalQuery: q,
          context: context ? {
            type: context.type,
            id: context.id,
            name: context.name
          } : null
        })
      });
    } catch (error) {
      // Error handled by mutation onError
    }
  }, [context, aiQuery, createTask]);

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
            placeholder={context ? `Ask about ${context.name || context.type}...` : "Ask AI or create a task... (⌘K)"}
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
              <span className="text-muted-foreground">Processing...</span>
            </div>
          )}

          {taskCreated && !isLoading && (
            <div className="p-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-green-800">AI Task Created</p>
                  <p className="text-sm text-green-600">
                    {taskCreated.status === "pending_approval" 
                      ? "Task is awaiting approval in the Approval Queue" 
                      : "Task has been queued for execution"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLocation("/ai/approvals");
                    onOpenChange(false);
                  }}
                >
                  View Queue
                </Button>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTaskCreated(null);
                    setShowSuggestions(true);
                    setQuery("");
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> New Task
                </Button>
              </div>
            </div>
          )}

          {response && !isLoading && !taskCreated && (
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

          {showSuggestions && !isLoading && !response && !taskCreated && (
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
                      handleSubmit(action.query, action.taskType);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left transition-colors group"
                  >
                    <action.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    <span className="flex-1 text-sm">{action.label}</span>
                    {action.taskType !== "query" && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Task
                      </Badge>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  <Command className="h-3 w-3 inline mr-1" />
                  Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘K</kbd> anywhere to open
                </p>
                <p className="text-xs text-muted-foreground">
                  💡 Try: "Generate PO for 100 units of mushrooms" or "Send RFQ to freight vendors"
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
