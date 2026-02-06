import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Link as LinkIcon,
  RefreshCw,
  LogOut,
  FolderOpen,
  FileUp,
  Download,
  FileText,
  X,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";

type ImportSource = "csv" | "sheets";
type CsvImportStep = "upload" | "map" | "importing" | "complete";
type SheetsImportStep = "connect" | "select" | "preview" | "map" | "importing" | "complete";

const MODULE_FIELDS: Record<string, { required: string[]; optional: string[]; description: string }> = {
  customers: {
    required: ["name"],
    optional: ["email", "phone", "address", "city", "state", "country", "postalCode", "notes"],
    description: "Import customer records for sales and invoicing",
  },
  vendors: {
    required: ["name"],
    optional: ["email", "phone", "address", "city", "state", "country", "postalCode", "paymentTerms", "notes"],
    description: "Import vendor/supplier records for purchasing",
  },
  products: {
    required: ["name"],
    optional: ["sku", "description", "category", "unitPrice", "costPrice"],
    description: "Import product catalog with pricing",
  },
  employees: {
    required: ["firstName", "lastName"],
    optional: ["email", "phone", "title", "department", "employmentType", "salary", "hireDate"],
    description: "Import employee and contractor records",
  },
  invoices: {
    required: ["customerId", "amount"],
    optional: ["dueDate", "description", "notes"],
    description: "Import invoices (requires existing customer IDs)",
  },
  contracts: {
    required: ["title"],
    optional: ["type", "partyName", "value", "startDate", "endDate", "description"],
    description: "Import contract records for legal tracking",
  },
  projects: {
    required: ["name"],
    optional: ["description", "type", "priority", "startDate", "targetEndDate", "budget"],
    description: "Import project records with timelines",
  },
  orders: {
    required: ["customerId"],
    optional: ["status", "totalAmount", "orderDate", "notes"],
    description: "Import sales orders (requires existing customer IDs)",
  },
  purchaseOrders: {
    required: ["vendorId"],
    optional: ["status", "totalAmount", "orderDate", "expectedDeliveryDate", "notes"],
    description: "Import purchase orders (requires existing vendor IDs)",
  },
  departments: {
    required: ["name"],
    optional: ["description"],
    description: "Import department/team structure",
  },
  warehouses: {
    required: ["name"],
    optional: ["code", "address", "city", "state", "country", "postalCode", "type"],
    description: "Import warehouse and storage locations",
  },
  accounts: {
    required: ["name", "code"],
    optional: ["type", "category", "description", "parentAccountId"],
    description: "Import chart of accounts (GL accounts)",
  },
  rawMaterials: {
    required: ["name"],
    optional: ["sku", "description", "category", "unit", "costPerUnit", "reorderPoint", "reorderQuantity", "leadTimeDays"],
    description: "Import raw materials for manufacturing",
  },
  freightCarriers: {
    required: ["name"],
    optional: ["contactName", "email", "phone", "website", "accountNumber", "modes", "notes"],
    description: "Import freight carrier records for logistics",
  },
};

const MODULE_LABELS: Record<string, string> = {
  customers: "Customers",
  vendors: "Vendors",
  products: "Products",
  employees: "Employees",
  invoices: "Invoices",
  contracts: "Contracts",
  projects: "Projects",
  orders: "Sales Orders",
  purchaseOrders: "Purchase Orders",
  departments: "Departments",
  warehouses: "Warehouses",
  accounts: "Chart of Accounts",
  rawMaterials: "Raw Materials",
  freightCarriers: "Freight Carriers",
};

function autoMapColumns(headers: string[], targetModule: string): Record<string, string> {
  const fields = MODULE_FIELDS[targetModule];
  if (!fields) return {};
  const allFields = [...fields.required, ...fields.optional];
  const mapping: Record<string, string> = {};

  headers.forEach((header) => {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchedField = allFields.find(field => {
      const normalizedField = field.toLowerCase();
      return normalizedHeader === normalizedField
        || normalizedHeader.includes(normalizedField)
        || normalizedField.includes(normalizedHeader);
    });
    if (matchedField) {
      mapping[header] = matchedField;
    }
  });

  return mapping;
}

export default function Import() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();

  // Source selection
  const [importSource, setImportSource] = useState<ImportSource>("csv");

  // Common state
  const [targetModule, setTargetModule] = useState<string>("customers");
  const [sheetData, setSheetData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importResults, setImportResults] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);

  // CSV-specific state
  const [csvStep, setCsvStep] = useState<CsvImportStep>("upload");
  const [dragActive, setDragActive] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [csvDelimiter, setCsvDelimiter] = useState<',' | ';' | '\t' | '|'>(',');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sheets-specific state
  const [sheetsStep, setSheetsStep] = useState<SheetsImportStep>("connect");
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<{ id: string; name: string } | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");

  // Google connection status
  const { data: connectionStatus, refetch: refetchConnection, isLoading: connectionLoading } =
    trpc.sheetsImport.getConnectionStatus.useQuery(undefined, {
      enabled: isAuthenticated && importSource === "sheets",
    });

  const { data: authUrlData } = trpc.sheetsImport.getAuthUrl.useQuery(undefined, {
    enabled: isAuthenticated && importSource === "sheets" && !connectionStatus?.connected,
  });

  const { data: spreadsheets, isLoading: spreadsheetsLoading, refetch: refetchSpreadsheets } =
    trpc.sheetsImport.listSpreadsheets.useQuery(undefined, {
      enabled: isAuthenticated && importSource === "sheets" && connectionStatus?.connected,
    });

  // Mutations
  const disconnectMutation = trpc.sheetsImport.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Google account disconnected");
      refetchConnection();
    },
  });

  const getSheetNamesMutation = trpc.sheetsImport.getSheetNames.useMutation();
  const fetchSheetMutation = trpc.sheetsImport.fetchSheet.useMutation();
  const sheetsImportMutation = trpc.sheetsImport.importData.useMutation();
  const csvParseMutation = trpc.csvImport.parse.useMutation();
  const csvImportMutation = trpc.csvImport.importData.useMutation();
  const csvTemplateMutation = trpc.csvImport.getTemplate.useQuery(
    { targetModule: targetModule as any },
    { enabled: importSource === "csv" }
  );

  // Handle OAuth callback
  useEffect(() => {
    if (searchParams) {
      const params = new URLSearchParams(searchParams);
      if (params.get("success") === "connected") {
        toast.success("Google account connected successfully!");
        refetchConnection();
        setImportSource("sheets");
        setLocation("/import");
      } else if (params.get("error")) {
        const error = params.get("error");
        toast.error(`Connection failed: ${error}`);
        setLocation("/import");
      }
    }
  }, [searchParams, refetchConnection, setLocation]);

  // Auto-advance sheets when connected
  useEffect(() => {
    if (importSource === "sheets" && connectionStatus?.connected && sheetsStep === "connect") {
      setSheetsStep("select");
    }
  }, [connectionStatus?.connected, sheetsStep, importSource]);

  // CSV file handling
  const processCSVFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.tsv') && !file.name.toLowerCase().endsWith('.txt')) {
      toast.error("Please upload a CSV, TSV, or TXT file");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size must be under 50MB");
      return;
    }

    setCsvFileName(file.name);

    try {
      const text = await file.text();

      // Auto-detect delimiter
      const firstLine = text.split('\n')[0] || '';
      let detectedDelimiter: ',' | ';' | '\t' | '|' = ',';
      if (firstLine.includes('\t') && !firstLine.includes(',')) {
        detectedDelimiter = '\t';
      } else if (firstLine.includes(';') && !firstLine.includes(',')) {
        detectedDelimiter = ';';
      } else if (firstLine.includes('|') && !firstLine.includes(',')) {
        detectedDelimiter = '|';
      }
      setCsvDelimiter(detectedDelimiter);

      const result = await csvParseMutation.mutateAsync({
        csvContent: text,
        delimiter: detectedDelimiter,
      });

      setSheetData({ headers: result.headers, rows: result.rows });
      setColumnMapping(autoMapColumns(result.headers, targetModule));
      setCsvStep("map");

      if (result.truncated) {
        toast.warning("File exceeds 10,000 rows. Only the first 10,000 rows will be imported.");
      }

      toast.success(`Parsed ${result.totalRows} rows from ${file.name}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to parse CSV file");
    }
  }, [csvParseMutation, targetModule]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  }, [processCSVFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCSVFile(e.target.files[0]);
    }
  }, [processCSVFile]);

  const handleDownloadTemplate = () => {
    if (csvTemplateMutation.data) {
      const blob = new Blob([csvTemplateMutation.data.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = csvTemplateMutation.data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Sheets handlers
  const handleConnectGoogle = () => {
    if (authUrlData?.url) {
      window.location.href = authUrlData.url;
    } else {
      toast.error("Google OAuth not configured. Please contact administrator.");
    }
  };

  const handleSelectSpreadsheet = async (spreadsheet: { id: string; name: string }) => {
    setSelectedSpreadsheet(spreadsheet);
    try {
      const result = await getSheetNamesMutation.mutateAsync({ spreadsheetId: spreadsheet.id });
      if (result.sheets.length > 0) {
        setSelectedSheet(result.sheets[0]);
      }
      setSheetsStep("preview");
    } catch (error: any) {
      toast.error(error.message || "Failed to load spreadsheet");
    }
  };

  const handleFetchPreview = async () => {
    if (!selectedSpreadsheet) return;
    try {
      const result = await fetchSheetMutation.mutateAsync({
        spreadsheetId: selectedSpreadsheet.id,
        sheetName: selectedSheet || undefined,
      });
      setSheetData({ headers: result.headers, rows: result.rows });
      setColumnMapping(autoMapColumns(result.headers, targetModule));
      setSheetsStep("map");
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch sheet data");
    }
  };

  // Import handlers
  const handleImport = async () => {
    if (!sheetData) return;

    if (importSource === "csv") {
      setCsvStep("importing");
    } else {
      setSheetsStep("importing");
    }

    try {
      const mutation = importSource === "csv" ? csvImportMutation : sheetsImportMutation;
      const result = await mutation.mutateAsync({
        targetModule: targetModule as any,
        data: sheetData.rows,
        columnMapping,
      });

      setImportResults(result);
      if (importSource === "csv") {
        setCsvStep("complete");
      } else {
        setSheetsStep("complete");
      }

      if (result.imported > 0) {
        toast.success(`Successfully imported ${result.imported} records`);
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} records failed to import`);
      }
    } catch (error: any) {
      toast.error(error.message || "Import failed");
      if (importSource === "csv") {
        setCsvStep("map");
      } else {
        setSheetsStep("map");
      }
    }
  };

  const handleReset = () => {
    setSheetData(null);
    setColumnMapping({});
    setImportResults(null);
    setCsvFileName("");
    setCsvStep("upload");
    setSheetsStep(connectionStatus?.connected ? "select" : "connect");
    setSelectedSpreadsheet(null);
    setSelectedSheet("");
  };

  const getNavigationPath = (module: string): string => {
    const paths: Record<string, string> = {
      customers: "/sales/customers",
      vendors: "/operations/vendors",
      products: "/operations/products",
      employees: "/hr/employees",
      invoices: "/finance/invoices",
      contracts: "/legal/contracts",
      projects: "/projects",
      orders: "/sales/orders",
      purchaseOrders: "/operations/purchase-orders",
      departments: "/hr/employees",
      warehouses: "/operations/locations",
      accounts: "/finance/accounts",
      rawMaterials: "/operations/raw-materials",
      freightCarriers: "/freight/carriers",
    };
    return paths[module] || "/";
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to use the import feature.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Determine current step for progress indicator
  const isInColumnMapping = (importSource === "csv" && csvStep === "map") || (importSource === "sheets" && sheetsStep === "map");
  const isImporting = (importSource === "csv" && csvStep === "importing") || (importSource === "sheets" && sheetsStep === "importing");
  const isComplete = (importSource === "csv" && csvStep === "complete") || (importSource === "sheets" && sheetsStep === "complete");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground mt-1">
          Bulk import data from CSV files or Google Sheets into any ERP module
        </p>
      </div>

      {/* Source Selection Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={importSource === "csv" ? "default" : "outline"}
          onClick={() => {
            setImportSource("csv");
            handleReset();
          }}
          className="flex items-center gap-2"
        >
          <FileUp className="h-4 w-4" />
          CSV File Upload
        </Button>
        <Button
          variant={importSource === "sheets" ? "default" : "outline"}
          onClick={() => {
            setImportSource("sheets");
            handleReset();
          }}
          className="flex items-center gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Google Sheets
        </Button>
      </div>

      {/* =========================================== */}
      {/* CSV IMPORT FLOW */}
      {/* =========================================== */}
      {importSource === "csv" && (
        <>
          {/* Step 1: Upload CSV */}
          {csvStep === "upload" && (
            <div className="space-y-4">
              {/* Module selector */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Target Module</CardTitle>
                  <CardDescription>Choose where to import the data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 flex-wrap">
                    <Select value={targetModule} onValueChange={setTargetModule}>
                      <SelectTrigger className="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MODULE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground flex-1">
                      {MODULE_FIELDS[targetModule]?.description}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadTemplate}
                      disabled={!csvTemplateMutation.data}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    <span className="font-medium">Required fields: </span>
                    {MODULE_FIELDS[targetModule]?.required.join(", ")}
                    {MODULE_FIELDS[targetModule]?.optional.length > 0 && (
                      <>
                        <span className="mx-2">|</span>
                        <span className="font-medium">Optional: </span>
                        {MODULE_FIELDS[targetModule]?.optional.join(", ")}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Drag and drop zone */}
              <Card>
                <CardContent className="pt-6">
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                      dragActive
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.tsv,.txt"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                    {csvParseMutation.isPending ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="text-lg font-medium">Parsing CSV file...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Upload className="h-12 w-12 text-muted-foreground" />
                        <div>
                          <p className="text-lg font-medium">
                            Drop your CSV file here, or click to browse
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Supports CSV, TSV, and TXT files up to 50MB. Delimiter auto-detected.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Column Mapping (CSV) */}
          {csvStep === "map" && sheetData && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Map Columns &mdash; {csvFileName}
                    </CardTitle>
                    <CardDescription>
                      Map CSV columns to {MODULE_LABELS[targetModule]} fields.
                      {sheetData.rows.length} rows detected.
                      Required: {MODULE_FIELDS[targetModule]?.required.join(", ")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={targetModule} onValueChange={(val) => {
                      setTargetModule(val);
                      setColumnMapping(autoMapColumns(sheetData.headers, val));
                    }}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MODULE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sheetData.headers.map((header) => (
                    <div key={header} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <Label className="text-sm font-medium truncate block">{header}</Label>
                        <span className="text-xs text-muted-foreground truncate block">
                          e.g. "{sheetData.rows[0]?.[header] || ''}"
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Select
                        value={columnMapping[header] || "_skip"}
                        onValueChange={(value) => {
                          setColumnMapping((prev) => {
                            const next = { ...prev };
                            if (value === "_skip") {
                              delete next[header];
                            } else {
                              next[header] = value;
                            }
                            return next;
                          });
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Skip column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_skip">Skip column</SelectItem>
                          {[...MODULE_FIELDS[targetModule].required, ...MODULE_FIELDS[targetModule].optional].map((field) => (
                            <SelectItem key={field} value={field}>
                              {field}
                              {MODULE_FIELDS[targetModule].required.includes(field) ? " *" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Preview (first 5 rows)</h4>
                  <ScrollArea className="h-48 border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {sheetData.headers.map((header) => (
                            <TableHead key={header} className="whitespace-nowrap">
                              {header}
                              {columnMapping[header] && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  &rarr; {columnMapping[header]}
                                </Badge>
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sheetData.rows.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            {sheetData.headers.map((header) => (
                              <TableCell key={header} className="whitespace-nowrap">
                                {row[header]}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={handleReset}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={
                      !MODULE_FIELDS[targetModule].required.every(
                        (field) => Object.values(columnMapping).includes(field)
                      ) || csvImportMutation.isPending
                    }
                  >
                    Import {sheetData.rows.length} Records
                    <Upload className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* =========================================== */}
      {/* GOOGLE SHEETS IMPORT FLOW */}
      {/* =========================================== */}
      {importSource === "sheets" && (
        <>
          {/* Step 1: Connect Google Account */}
          {sheetsStep === "connect" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Connect Google Account
                </CardTitle>
                <CardDescription>
                  Connect your Google account to access your spreadsheets from Google Drive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectionLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : connectionStatus?.connected ? (
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">Connected</p>
                        <p className="text-sm text-green-600 dark:text-green-400">{connectionStatus.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => disconnectMutation.mutate()}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Disconnect
                      </Button>
                      <Button onClick={() => setSheetsStep("select")}>
                        Continue
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">What you'll get access to:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>Browse all spreadsheets in your Google Drive</li>
                        <li>Import data from any sheet without making it public</li>
                        <li>Automatic token refresh for seamless access</li>
                      </ul>
                    </div>

                    {authUrlData?.error ? (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                        <p className="text-yellow-800 dark:text-yellow-200">
                          {authUrlData.error}. Please ask an administrator to configure Google OAuth credentials.
                        </p>
                      </div>
                    ) : (
                      <Button onClick={handleConnectGoogle} size="lg" className="w-full">
                        <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Connect with Google
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Select Spreadsheet */}
          {sheetsStep === "select" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Select Spreadsheet
                </CardTitle>
                <CardDescription>Choose a spreadsheet from your Google Drive to import</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>Import to:</Label>
                    <Select value={targetModule} onValueChange={setTargetModule}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MODULE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchSpreadsheets()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  {MODULE_FIELDS[targetModule]?.description}
                </p>

                <ScrollArea className="h-96 border rounded-lg">
                  {spreadsheetsLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : spreadsheets?.spreadsheets?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <FileSpreadsheet className="h-12 w-12 mb-2" />
                      <p>No spreadsheets found in your Drive</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {spreadsheets?.spreadsheets?.map((sheet: any) => (
                        <button
                          key={sheet.id}
                          onClick={() => handleSelectSpreadsheet({ id: sheet.id, name: sheet.name })}
                          className="w-full p-4 text-left hover:bg-muted transition-colors flex items-center gap-3"
                        >
                          <FileSpreadsheet className="h-8 w-8 text-green-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{sheet.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Modified: {new Date(sheet.modifiedTime).toLocaleDateString()}
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <div className="mt-4 flex justify-between">
                  <Button variant="outline" onClick={() => setSheetsStep("connect")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Preview & Select Sheet */}
          {sheetsStep === "preview" && selectedSpreadsheet && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  {selectedSpreadsheet.name}
                </CardTitle>
                <CardDescription>
                  Select a sheet and preview the data before importing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label>Sheet</Label>
                    <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a sheet" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSheetNamesMutation.data?.sheets.map((name: string) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label>Target Module</Label>
                    <Select value={targetModule} onValueChange={setTargetModule}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MODULE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setSheetsStep("select")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={handleFetchPreview} disabled={fetchSheetMutation.isPending}>
                    {fetchSheetMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Load & Preview Data
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Map Columns (Sheets) */}
          {sheetsStep === "map" && sheetData && (
            <Card>
              <CardHeader>
                <CardTitle>Map Columns</CardTitle>
                <CardDescription>
                  Map your spreadsheet columns to {MODULE_LABELS[targetModule]} fields.
                  Required fields: {MODULE_FIELDS[targetModule]?.required.join(", ")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sheetData.headers.map((header) => (
                    <div key={header} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <Label className="text-sm font-medium truncate block">{header}</Label>
                        <span className="text-xs text-muted-foreground truncate block">
                          e.g. "{sheetData.rows[0]?.[header] || ''}"
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Select
                        value={columnMapping[header] || "_skip"}
                        onValueChange={(value) => {
                          setColumnMapping((prev) => {
                            const next = { ...prev };
                            if (value === "_skip") {
                              delete next[header];
                            } else {
                              next[header] = value;
                            }
                            return next;
                          });
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Skip column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_skip">Skip column</SelectItem>
                          {[...MODULE_FIELDS[targetModule].required, ...MODULE_FIELDS[targetModule].optional].map((field) => (
                            <SelectItem key={field} value={field}>
                              {field}
                              {MODULE_FIELDS[targetModule].required.includes(field) ? " *" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Preview (first 5 rows)</h4>
                  <ScrollArea className="h-48 border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {sheetData.headers.map((header) => (
                            <TableHead key={header} className="whitespace-nowrap">
                              {header}
                              {columnMapping[header] && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  &rarr; {columnMapping[header]}
                                </Badge>
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sheetData.rows.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            {sheetData.headers.map((header) => (
                              <TableCell key={header} className="whitespace-nowrap">
                                {row[header]}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setSheetsStep("preview")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!MODULE_FIELDS[targetModule].required.every(
                      (field) => Object.values(columnMapping).includes(field)
                    )}
                  >
                    Import {sheetData.rows.length} Records
                    <Upload className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* =========================================== */}
      {/* SHARED: Importing & Complete states */}
      {/* =========================================== */}

      {/* Importing spinner */}
      {isImporting && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-medium">Importing data...</h3>
              <p className="text-muted-foreground">Processing {sheetData?.rows.length || 0} records into {MODULE_LABELS[targetModule]}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete */}
      {isComplete && importResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResults.failed === 0 ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              )}
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{importResults.imported}</p>
                <p className="text-sm text-green-800 dark:text-green-200">Records imported into {MODULE_LABELS[targetModule]}</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                <p className="text-3xl font-bold text-red-600">{importResults.failed}</p>
                <p className="text-sm text-red-800 dark:text-red-200">Records failed</p>
              </div>
            </div>

            {importResults.errors.length > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Errors:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                  {importResults.errors.slice(0, 20).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                  {importResults.errors.length > 20 && (
                    <li>... and {importResults.errors.length - 20} more errors</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex gap-4">
              <Button onClick={handleReset} className="flex-1">
                Import More Data
              </Button>
              <Button variant="outline" onClick={() => setLocation(getNavigationPath(targetModule))}>
                View {MODULE_LABELS[targetModule]}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
