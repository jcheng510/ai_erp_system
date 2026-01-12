import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  FolderOpen, FileText, File, Download, Eye, Lock, 
  ChevronRight, Folder, ArrowLeft, Shield
} from "lucide-react";
import { useParams } from "wouter";

export default function DataRoomPublic() {
  const params = useParams<{ code: string }>();
  const linkCode = params.code || "";
  
  const [accessGranted, setAccessGranted] = useState(false);
  const [password, setPassword] = useState("");
  const [visitorInfo, setVisitorInfo] = useState({
    email: "",
    name: "",
    company: "",
  });
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [dataRoomId, setDataRoomId] = useState<number | null>(null);
  const [visitorId, setVisitorId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState({
    allowDownload: true,
    allowPrint: true,
  });
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [showNda, setShowNda] = useState(false);

  const accessMutation = trpc.dataRoom.public.accessByLink.useMutation({
    onSuccess: (data) => {
      if (data.requiresPassword) {
        setRequiresPassword(true);
        return;
      }
      if (data.requiresInfo) {
        setRequiredFields(data.requiredFields || []);
        return;
      }
      if (data.dataRoomId) {
        setDataRoomId(data.dataRoomId);
        setVisitorId(data.visitorId);
        setPermissions({
          allowDownload: data.allowDownload ?? true,
          allowPrint: data.allowPrint ?? true,
        });
        setAccessGranted(true);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const { data: content, isLoading: contentLoading } = trpc.dataRoom.public.getContent.useQuery(
    { dataRoomId: dataRoomId!, visitorId: visitorId || undefined, folderId: currentFolderId },
    { enabled: accessGranted && !!dataRoomId }
  );

  const recordViewMutation = trpc.dataRoom.public.recordView.useMutation();

  // Initial access attempt
  useEffect(() => {
    if (linkCode) {
      accessMutation.mutate({ linkCode });
    }
  }, [linkCode]);

  const handleAccessSubmit = () => {
    accessMutation.mutate({
      linkCode,
      password: password || undefined,
      visitorInfo: {
        email: visitorInfo.email || undefined,
        name: visitorInfo.name || undefined,
        company: visitorInfo.company || undefined,
      },
    });
  };

  const handleDocumentView = (documentId: number, storageUrl: string | null) => {
    if (visitorId) {
      recordViewMutation.mutate({
        documentId,
        visitorId,
      });
    }
    if (storageUrl) {
      window.open(storageUrl, '_blank');
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "pdf":
        return <FileText className="h-5 w-5 text-red-500" />;
      case "doc":
      case "docx":
        return <FileText className="h-5 w-5 text-blue-500" />;
      case "xls":
      case "xlsx":
        return <FileText className="h-5 w-5 text-green-500" />;
      case "ppt":
      case "pptx":
        return <FileText className="h-5 w-5 text-orange-500" />;
      default:
        return <File className="h-5 w-5 text-gray-500" />;
    }
  };

  // Access Gate UI
  if (!accessGranted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Secure Data Room</CardTitle>
            <CardDescription>
              {requiresPassword
                ? "Enter the password to access this data room"
                : requiredFields.length > 0
                ? "Please provide your information to continue"
                : "Verifying access..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {requiresPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
            )}
            
            {requiredFields.includes("email") && (
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={visitorInfo.email}
                  onChange={(e) => setVisitorInfo({ ...visitorInfo, email: e.target.value })}
                  placeholder="your@email.com"
                />
              </div>
            )}
            
            {requiredFields.includes("name") && (
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={visitorInfo.name}
                  onChange={(e) => setVisitorInfo({ ...visitorInfo, name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
            )}
            
            {requiredFields.includes("company") && (
              <div className="space-y-2">
                <Label htmlFor="company">Company *</Label>
                <Input
                  id="company"
                  value={visitorInfo.company}
                  onChange={(e) => setVisitorInfo({ ...visitorInfo, company: e.target.value })}
                  placeholder="Your company"
                />
              </div>
            )}

            {(requiresPassword || requiredFields.length > 0) && (
              <Button 
                className="w-full" 
                onClick={handleAccessSubmit}
                disabled={accessMutation.isPending}
              >
                {accessMutation.isPending ? "Verifying..." : "Continue"}
              </Button>
            )}

            {!requiresPassword && requiredFields.length === 0 && accessMutation.isPending && (
              <div className="text-center text-muted-foreground">
                Loading...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // NDA Gate
  if (content?.room.requiresNda && !ndaAccepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Non-Disclosure Agreement</CardTitle>
            <CardDescription>
              Please read and accept the NDA to access this data room
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-64 border rounded-lg p-4">
              <div className="prose prose-sm">
                {content.room.ndaText || (
                  <p>
                    By accessing this data room, you agree to keep all information
                    contained herein strictly confidential. You may not share, copy,
                    or distribute any documents or information without prior written
                    consent from the data room owner.
                  </p>
                )}
              </div>
            </ScrollArea>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="nda"
                checked={ndaAccepted}
                onCheckedChange={(checked) => setNdaAccepted(checked as boolean)}
              />
              <Label htmlFor="nda" className="text-sm">
                I have read and agree to the Non-Disclosure Agreement
              </Label>
            </div>
            <Button
              className="w-full"
              disabled={!ndaAccepted}
              onClick={() => setShowNda(false)}
            >
              Continue to Data Room
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main Data Room View
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {content?.room.logoUrl && (
                <img
                  src={content.room.logoUrl}
                  alt="Logo"
                  className="h-8 w-auto"
                />
              )}
              <div>
                <h1 className="text-xl font-bold">{content?.room.name}</h1>
                {content?.room.description && (
                  <p className="text-sm text-muted-foreground">{content.room.description}</p>
                )}
              </div>
            </div>
            {!permissions.allowDownload && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                Downloads disabled
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Welcome Message */}
      {content?.room.welcomeMessage && (
        <div className="bg-primary/5 border-b">
          <div className="container mx-auto px-4 py-3">
            <p className="text-sm">{content.room.welcomeMessage}</p>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        {currentFolderId && (
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => setCurrentFolderId(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to root
          </Button>
        )}

        {contentLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading documents...
          </div>
        ) : (
          <div className="grid gap-4">
            {/* Folders */}
            {content?.folders.map((folder) => (
              <Card
                key={`folder-${folder.id}`}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => setCurrentFolderId(folder.id)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Folder className="h-6 w-6 text-blue-500" />
                    <div>
                      <div className="font-medium">{folder.name}</div>
                      {folder.description && (
                        <div className="text-sm text-muted-foreground">
                          {folder.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}

            {/* Documents */}
            {content?.documents.map((doc) => (
              <Card key={`doc-${doc.id}`}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    {getFileIcon(doc.fileType)}
                    <div>
                      <div className="font-medium">{doc.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {doc.fileSize ? `${(Number(doc.fileSize) / 1024).toFixed(1)} KB` : ""}
                        {doc.pageCount ? ` • ${doc.pageCount} pages` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDocumentView(doc.id, doc.storageUrl)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    {permissions.allowDownload && doc.storageUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (visitorId) {
                            recordViewMutation.mutate({
                              documentId: doc.id,
                              visitorId,
                              downloaded: true,
                            });
                          }
                          window.open(doc.storageUrl!, '_blank');
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {!content?.folders.length && !content?.documents.length && (
              <div className="text-center py-12">
                <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No documents available</h3>
                <p className="text-muted-foreground">
                  This folder is empty or you don't have access to its contents
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          Powered by Superhumn Data Room
        </div>
      </footer>
    </div>
  );
}
