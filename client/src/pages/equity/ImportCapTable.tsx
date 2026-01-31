import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, ChevronLeft, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

interface ParsedRow {
  name: string;
  type: string;
  email?: string;
  shares: number;
  shareClass: string;
  acquisitionDate: Date;
  pricePerShare?: number;
}

interface ParsedShareClass {
  name: string;
  type: string;
  authorizedShares: number;
  pricePerShare?: number;
}

export default function ImportCapTable() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{
    shareholders: ParsedRow[];
    shareClasses: ParsedShareClass[];
  } | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<any>(null);

  const importCapTable = trpc.capTable.import.useMutation({
    onSuccess: (result) => {
      setImportResult(result);
      setStep(4);
      toast.success("Cap table imported successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const parseCSV = (content: string): string[][] => {
    const lines = content.split("\n").filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      const rows = parseCSV(content);

      if (rows.length < 2) {
        toast.error("File must contain headers and at least one data row");
        return;
      }

      setHeaders(rows[0]);
      setRawData(rows.slice(1));

      // Auto-detect column mappings based on header names
      const mapping: Record<string, string> = {};
      rows[0].forEach((header, index) => {
        const lowerHeader = header.toLowerCase().trim();
        if (lowerHeader.includes("name") || lowerHeader.includes("shareholder")) {
          mapping["name"] = String(index);
        } else if (lowerHeader.includes("type") || lowerHeader.includes("investor")) {
          mapping["type"] = String(index);
        } else if (lowerHeader.includes("email")) {
          mapping["email"] = String(index);
        } else if (lowerHeader.includes("share") && (lowerHeader.includes("count") || lowerHeader.includes("qty") || lowerHeader.includes("quantity") || lowerHeader === "shares")) {
          mapping["shares"] = String(index);
        } else if (lowerHeader.includes("class") || lowerHeader.includes("series")) {
          mapping["shareClass"] = String(index);
        } else if (lowerHeader.includes("date") || lowerHeader.includes("acquired")) {
          mapping["acquisitionDate"] = String(index);
        } else if (lowerHeader.includes("price")) {
          mapping["pricePerShare"] = String(index);
        }
      });

      setColumnMapping(mapping);
      setStep(2);
    };

    reader.readAsText(selectedFile);
  }, []);

  const processMapping = () => {
    if (!columnMapping.name || !columnMapping.shares || !columnMapping.shareClass) {
      toast.error("Please map at least Name, Shares, and Share Class columns");
      return;
    }

    const shareClassSet = new Set<string>();
    const shareholders: ParsedRow[] = [];

    for (const row of rawData) {
      const name = row[parseInt(columnMapping.name)];
      const shares = parseInt(row[parseInt(columnMapping.shares)]?.replace(/,/g, "") || "0");
      const shareClass = row[parseInt(columnMapping.shareClass)] || "Common Stock";

      if (!name || isNaN(shares) || shares <= 0) continue;

      shareClassSet.add(shareClass);

      const shareholderType = columnMapping.type
        ? mapShareholderType(row[parseInt(columnMapping.type)])
        : "individual";

      let acquisitionDate = new Date();
      if (columnMapping.acquisitionDate && row[parseInt(columnMapping.acquisitionDate)]) {
        const dateStr = row[parseInt(columnMapping.acquisitionDate)];
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          acquisitionDate = parsed;
        }
      }

      shareholders.push({
        name,
        type: shareholderType,
        email: columnMapping.email ? row[parseInt(columnMapping.email)] : undefined,
        shares,
        shareClass,
        acquisitionDate,
        pricePerShare: columnMapping.pricePerShare
          ? parseFloat(row[parseInt(columnMapping.pricePerShare)]?.replace(/[$,]/g, "") || "0") || undefined
          : undefined,
      });
    }

    // Calculate share class totals
    const shareClasses: ParsedShareClass[] = Array.from(shareClassSet).map(className => {
      const totalShares = shareholders
        .filter(s => s.shareClass === className)
        .reduce((sum, s) => sum + s.shares, 0);

      return {
        name: className,
        type: className.toLowerCase().includes("preferred") ? "preferred" : "common",
        authorizedShares: Math.ceil(totalShares * 1.2), // 20% buffer
      };
    });

    setParsedData({ shareholders, shareClasses });
    setStep(3);
  };

  const mapShareholderType = (type: string): string => {
    if (!type) return "individual";
    const lower = type.toLowerCase();
    if (lower.includes("founder")) return "founder";
    if (lower.includes("employee")) return "employee";
    if (lower.includes("entity") || lower.includes("corp") || lower.includes("llc") || lower.includes("fund")) return "entity";
    if (lower.includes("trust")) return "trust";
    if (lower.includes("advisor")) return "advisor";
    return "individual";
  };

  const handleImport = () => {
    if (!parsedData) return;

    importCapTable.mutate({
      shareClasses: parsedData.shareClasses,
      shareholders: parsedData.shareholders.map(s => ({
        ...s,
        acquisitionDate: s.acquisitionDate,
      })),
    });
  };

  const downloadTemplate = () => {
    const template = `Name,Type,Email,Shares,Share Class,Acquisition Date,Price Per Share
John Smith,founder,john@company.com,1000000,Common Stock,2023-01-15,0.0001
Jane Doe,employee,jane@company.com,50000,Common Stock,2023-06-01,0.10
Acme Ventures,entity,investments@acmevc.com,500000,Series A Preferred,2024-01-01,1.00`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cap_table_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/equity/cap-table">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Cap Table
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Upload className="h-8 w-8" />
            Import Cap Table
          </h1>
          <p className="text-muted-foreground mt-1">
            Import existing cap table data from CSV files.
          </p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step
                  ? "bg-primary text-primary-foreground"
                  : s < step
                  ? "bg-green-600 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <CheckCircle className="h-4 w-4" /> : s}
            </div>
            {s < 4 && (
              <div className={`w-16 h-1 mx-2 ${s < step ? "bg-green-600" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Upload File */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Upload File</CardTitle>
            <CardDescription>
              Upload a CSV file containing your cap table data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <div className="mb-4">
                <Label
                  htmlFor="file-upload"
                  className="cursor-pointer text-primary hover:underline"
                >
                  Click to upload
                </Label>
                <span className="text-muted-foreground"> or drag and drop</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                CSV files only (max 10MB)
              </p>
              <Input
                id="file-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button variant="outline" onClick={() => document.getElementById("file-upload")?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Expected CSV Format</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Your CSV should include columns for:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Shareholder name (required)</li>
                <li>Number of shares (required)</li>
                <li>Share class (required)</li>
                <li>Shareholder type (optional: founder, employee, entity, etc.)</li>
                <li>Email address (optional)</li>
                <li>Acquisition date (optional)</li>
                <li>Price per share (optional)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map Columns */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Map Columns</CardTitle>
            <CardDescription>
              Map your CSV columns to cap table fields
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name Column *</Label>
                <Select
                  value={columnMapping.name || ""}
                  onValueChange={(v) => setColumnMapping({ ...columnMapping, name: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Shares Column *</Label>
                <Select
                  value={columnMapping.shares || ""}
                  onValueChange={(v) => setColumnMapping({ ...columnMapping, shares: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Share Class Column *</Label>
                <Select
                  value={columnMapping.shareClass || ""}
                  onValueChange={(v) => setColumnMapping({ ...columnMapping, shareClass: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type Column (optional)</Label>
                <Select
                  value={columnMapping.type || "none"}
                  onValueChange={(v) => setColumnMapping({ ...columnMapping, type: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not mapped</SelectItem>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Email Column (optional)</Label>
                <Select
                  value={columnMapping.email || "none"}
                  onValueChange={(v) => setColumnMapping({ ...columnMapping, email: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not mapped</SelectItem>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Acquisition Date (optional)</Label>
                <Select
                  value={columnMapping.acquisitionDate || "none"}
                  onValueChange={(v) => setColumnMapping({ ...columnMapping, acquisitionDate: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not mapped</SelectItem>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price Per Share (optional)</Label>
                <Select
                  value={columnMapping.pricePerShare || "none"}
                  onValueChange={(v) => setColumnMapping({ ...columnMapping, pricePerShare: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not mapped</SelectItem>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-6">
              <h4 className="font-medium mb-2">Preview (first 5 rows)</h4>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h, i) => (
                        <TableHead key={i}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawData.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell key={j}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={processMapping}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Import */}
      {step === 3 && parsedData && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Review & Import</CardTitle>
            <CardDescription>
              Review the data before importing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Share Classes Summary */}
            <div>
              <h4 className="font-medium mb-2">Share Classes to Create ({parsedData.shareClasses.length})</h4>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Authorized Shares</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.shareClasses.map((sc, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{sc.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{sc.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {new Intl.NumberFormat().format(sc.authorizedShares)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Shareholders Summary */}
            <div>
              <h4 className="font-medium mb-2">Shareholders to Import ({parsedData.shareholders.length})</h4>
              <div className="border rounded-lg overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Share Class</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.shareholders.map((sh, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{sh.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{sh.type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{sh.email || "-"}</TableCell>
                        <TableCell>{sh.shareClass}</TableCell>
                        <TableCell className="text-right font-mono">
                          {new Intl.NumberFormat().format(sh.shares)}
                        </TableCell>
                        <TableCell>
                          {sh.acquisitionDate.toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleImport} disabled={importCapTable.isPending}>
                {importCapTable.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Import Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Results */}
      {step === 4 && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Import Complete
            </CardTitle>
            <CardDescription>
              Your cap table data has been imported
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {importResult.shareClassesCreated}
                </div>
                <div className="text-sm text-muted-foreground">Share Classes Created</div>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {importResult.shareholdersCreated}
                </div>
                <div className="text-sm text-muted-foreground">Shareholders Created</div>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {importResult.holdingsCreated}
                </div>
                <div className="text-sm text-muted-foreground">Holdings Created</div>
              </div>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 font-medium mb-2">
                  <AlertCircle className="h-4 w-4" />
                  {importResult.errors.length} Error(s)
                </div>
                <ul className="text-sm text-red-600 list-disc list-inside">
                  {importResult.errors.map((error: string, i: number) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Link href="/equity/cap-table">
                <Button>View Cap Table</Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setFile(null);
                  setParsedData(null);
                  setImportResult(null);
                }}
              >
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
