import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileSpreadsheet, 
  Download, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

type ImportStep = "connect" | "preview" | "map" | "import" | "complete";

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
    optional: ["sku", "description", "category", "price", "unitPrice", "cost", "costPrice"],
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
};

export default function Import() {
  const [step, setStep] = useState<ImportStep>("connect");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [sheetData, setSheetData] = useState<{ headers: string[]; rows: Record<string, string>[]; totalRows: number } | null>(null);
  const [targetModule, setTargetModule] = useState<string>("");
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);

  const fetchSheetNames = trpc.sheetsImport.getSheetNames.useMutation();
  const fetchSheet = trpc.sheetsImport.fetchSheet.useMutation();
  const importData = trpc.sheetsImport.importData.useMutation();

  // Extract spreadsheet ID from URL
  const extractSpreadsheetId = (url: string): string | null => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const handleConnect = async () => {
    const id = extractSpreadsheetId(spreadsheetUrl);
    if (!id) {
      toast.error("Invalid Google Sheets URL. Please enter a valid URL.");
      return;
    }
    
    setSpreadsheetId(id);
    
    try {
      const result = await fetchSheetNames.mutateAsync({ spreadsheetId: id });
      setAvailableSheets(result.sheets);
      if (result.sheets.length > 0) {
        setSelectedSheet(result.sheets[0]);
      }
      setStep("preview");
      toast.success("Connected to spreadsheet successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to connect to spreadsheet");
    }
  };

  const handleFetchData = async () => {
    if (!spreadsheetId || !selectedSheet) return;
    
    try {
      const result = await fetchSheet.mutateAsync({
        spreadsheetId,
        sheetName: selectedSheet,
      });
      setSheetData(result);
      toast.success(`Loaded ${result.totalRows} rows from sheet`);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch sheet data");
    }
  };

  const handleProceedToMapping = () => {
    if (!targetModule) {
      toast.error("Please select a target module");
      return;
    }
    if (!sheetData || sheetData.rows.length === 0) {
      toast.error("No data to import");
      return;
    }
    
    // Initialize mapping with best guesses
    const initialMapping: Record<string, string> = {};
    const moduleFields = MODULE_FIELDS[targetModule];
    const allFields = [...moduleFields.required, ...moduleFields.optional];
    
    for (const header of sheetData.headers) {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z]/g, '');
      for (const field of allFields) {
        const normalizedField = field.toLowerCase();
        if (normalizedHeader.includes(normalizedField) || normalizedField.includes(normalizedHeader)) {
          initialMapping[header] = field;
          break;
        }
      }
    }
    
    setColumnMapping(initialMapping);
    setStep("map");
  };

  const handleImport = async () => {
    if (!sheetData || !targetModule) return;
    
    // Validate required fields are mapped
    const moduleFields = MODULE_FIELDS[targetModule];
    const mappedFields = Object.values(columnMapping);
    const missingRequired = moduleFields.required.filter(f => !mappedFields.includes(f));
    
    if (missingRequired.length > 0) {
      toast.error(`Missing required field mappings: ${missingRequired.join(", ")}`);
      return;
    }
    
    setStep("import");
    
    try {
      const result = await importData.mutateAsync({
        targetModule: targetModule as any,
        data: sheetData.rows,
        columnMapping,
      });
      setImportResult(result);
      setStep("complete");
      
      if (result.imported > 0) {
        toast.success(`Successfully imported ${result.imported} records!`);
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} records failed to import`);
      }
    } catch (error: any) {
      toast.error(error.message || "Import failed");
      setStep("map");
    }
  };

  const resetImport = () => {
    setStep("connect");
    setSpreadsheetUrl("");
    setSpreadsheetId("");
    setAvailableSheets([]);
    setSelectedSheet("");
    setSheetData(null);
    setTargetModule("");
    setColumnMapping({});
    setImportResult(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="h-8 w-8" />
          Import from Google Sheets
        </h1>
        <p className="text-muted-foreground mt-1">
          Import data from your Google Sheets into the ERP system.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {["connect", "preview", "map", "import", "complete"].map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : ["connect", "preview", "map", "import", "complete"].indexOf(step) > i
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {["connect", "preview", "map", "import", "complete"].indexOf(step) > i ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < 4 && <div className="w-8 h-0.5 bg-muted mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Connect */}
      {step === "connect" && (
        <Card>
          <CardHeader>
            <CardTitle>Connect to Google Sheets</CardTitle>
            <CardDescription>
              Enter the URL of your Google Sheet. Make sure the sheet is shared publicly or with "Anyone with the link".
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sheetUrl">Google Sheets URL</Label>
              <Input
                id="sheetUrl"
                value={spreadsheetUrl}
                onChange={(e) => setSpreadsheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
              <p className="text-xs text-muted-foreground">
                Example: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
              </p>
            </div>
            <Button onClick={handleConnect} disabled={!spreadsheetUrl || fetchSheetNames.isPending}>
              {fetchSheetNames.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Connect
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Sheet Data</CardTitle>
            <CardDescription>
              Select a sheet and preview the data before importing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Sheet</Label>
                <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sheet" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSheets.map((sheet) => (
                      <SelectItem key={sheet} value={sheet}>
                        {sheet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Module</Label>
                <Select value={targetModule} onValueChange={setTargetModule}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customers">Customers</SelectItem>
                    <SelectItem value="vendors">Vendors</SelectItem>
                    <SelectItem value="products">Products</SelectItem>
                    <SelectItem value="employees">Employees</SelectItem>
                    <SelectItem value="invoices">Invoices</SelectItem>
                    <SelectItem value="contracts">Contracts</SelectItem>
                    <SelectItem value="projects">Projects</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleFetchData} disabled={!selectedSheet || fetchSheet.isPending}>
              {fetchSheet.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Load Data
            </Button>

            {sheetData && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{sheetData.headers.length} columns</Badge>
                  <Badge variant="outline">{sheetData.totalRows} rows</Badge>
                </div>

                <ScrollArea className="h-[300px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {sheetData.headers.map((header) => (
                          <TableHead key={header} className="whitespace-nowrap">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sheetData.rows.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          {sheetData.headers.map((header) => (
                            <TableCell key={header} className="whitespace-nowrap">
                              {row[header] || "-"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {sheetData.totalRows > 10 && (
                  <p className="text-sm text-muted-foreground">
                    Showing first 10 of {sheetData.totalRows} rows
                  </p>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("connect")}>
                    Back
                  </Button>
                  <Button onClick={handleProceedToMapping} disabled={!targetModule}>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Configure Mapping
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Map Columns */}
      {step === "map" && sheetData && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <CardDescription>
              Map your spreadsheet columns to the {targetModule} fields. Required fields are marked with *.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {sheetData.headers.map((header) => {
                const moduleFields = MODULE_FIELDS[targetModule];
                const allFields = [...moduleFields.required, ...moduleFields.optional];
                
                return (
                  <div key={header} className="flex items-center gap-4">
                    <div className="w-1/3">
                      <Badge variant="secondary" className="font-mono">
                        {header}
                      </Badge>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="w-1/2">
                      <Select
                        value={columnMapping[header] || ""}
                        onValueChange={(value) =>
                          setColumnMapping((prev) => ({
                            ...prev,
                            [header]: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field (or skip)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">-- Skip this column --</SelectItem>
                          {allFields.map((field) => (
                            <SelectItem key={field} value={field}>
                              {field}
                              {moduleFields.required.includes(field) ? " *" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <p className="text-sm">
                Required fields for {targetModule}:{" "}
                <strong>{MODULE_FIELDS[targetModule].required.join(", ")}</strong>
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("preview")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importData.isPending}>
                {importData.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Import {sheetData.totalRows} Records
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Importing */}
      {step === "import" && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-medium">Importing Data...</h3>
              <p className="text-muted-foreground">Please wait while we import your data.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Complete */}
      {step === "complete" && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.failed === 0 ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : (
                <AlertCircle className="h-6 w-6 text-amber-500" />
              )}
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-green-600">{importResult.imported}</div>
                  <p className="text-sm text-muted-foreground">Records imported</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-red-600">{importResult.failed}</div>
                  <p className="text-sm text-muted-foreground">Records failed</p>
                </CardContent>
              </Card>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Errors:</h4>
                <ScrollArea className="h-[150px] border rounded-md p-3">
                  {importResult.errors.slice(0, 20).map((error, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm py-1">
                      <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  ))}
                  {importResult.errors.length > 20 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      ... and {importResult.errors.length - 20} more errors
                    </p>
                  )}
                </ScrollArea>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={resetImport}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Import More Data
              </Button>
              <Button variant="outline" onClick={() => window.location.href = `/${targetModule === 'employees' ? 'hr/employees' : targetModule === 'contracts' ? 'legal/contracts' : targetModule === 'projects' ? 'projects' : `operations/${targetModule}`}`}>
                View Imported Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
