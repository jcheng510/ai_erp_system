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
  ChevronRight, Folder, ArrowLeft, Shield, Clock, Mail, AlertCircle
} from "lucide-react";
import { useRef } from "react";
import { useParams } from "wouter";

export default function DataRoomPublic() {
  const params = useParams<{ code: string }>();
  const linkCode = params.code || "";

  // Access flow states
  const [linkValidated, setLinkValidated] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);
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

  // Link validation mutation
  const accessMutation = trpc.dataRoom.public.accessByLink.useMutation({
    onSuccess: (data) => {
      if (data.requiresPassword) {
        setRequiresPassword(true);
        return;
      }
      if (data.requiresInfo) {
        // Always require email for strict access control
        setRequiredFields(['email', ...(data.requiredFields || []).filter(f => f !== 'email')]);
        return;
      }
      if (data.dataRoomId) {
        setDataRoomId(data.dataRoomId);
        setVisitorId(data.visitorId);
        setPermissions({
          allowDownload: data.allowDownload ?? true,
          allowPrint: data.allowPrint ?? true,
        });
        setLinkValidated(true);
        // Always require email even if link doesn't require it
        if (!visitorInfo.email) {
          setRequiredFields(['email']);
        } else {
          setEmailSubmitted(true);
        }
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Check access status for the submitted email
  const { data: accessStatus, isLoading: accessStatusLoading, refetch: refetchAccessStatus } =
    trpc.dataRoom.public.checkAccessStatus.useQuery(
      { dataRoomId: dataRoomId!, email: visitorInfo.email },
      {
        enabled: linkValidated && emailSubmitted && !!dataRoomId && !!visitorInfo.email,
        retry: false,
      }
    );

  // Get content only when fully authorized (email approved + NDA signed)
  const { data: content, isLoading: contentLoading, error: contentError } = trpc.dataRoom.public.getContent.useQuery(
    {
      dataRoomId: dataRoomId!,
      visitorId: visitorId || undefined,
      visitorEmail: visitorInfo.email || undefined,
      folderId: currentFolderId
    },
    {
      enabled: accessGranted && !!dataRoomId,
      retry: false,
    }
  );

  const recordViewMutation = trpc.dataRoom.public.recordView.useMutation();

  // Initial access attempt
  useEffect(() => {
    if (linkCode) {
      accessMutation.mutate({ linkCode });
    }
  }, [linkCode]);

  // Check if access should be granted based on accessStatus
  useEffect(() => {
    if (accessStatus) {
      if (accessStatus.emailApproved && accessStatus.ndaSigned) {
        setNdaAccepted(true);
        setAccessGranted(true);
      } else if (accessStatus.emailApproved && !accessStatus.ndaSigned) {
        // Email approved, need NDA signing
        setNdaAccepted(false);
      }
    }
  }, [accessStatus]);

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

  const handleEmailSubmit = () => {
    if (!visitorInfo.email) {
      toast.error('Email is required');
      return;
    }
    setEmailSubmitted(true);
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

  // Gate 1: Password Gate
  if (requiresPassword && !linkValidated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Password Protected</CardTitle>
            <CardDescription>
              Enter the password to access this data room
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <Button
              className="w-full"
              onClick={handleAccessSubmit}
              disabled={accessMutation.isPending}
            >
              {accessMutation.isPending ? "Verifying..." : "Continue"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Gate 2: Email Entry Gate (always required for strict access)
  if (!emailSubmitted && (requiredFields.length > 0 || linkValidated)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Verify Your Identity</CardTitle>
            <CardDescription>
              Please enter your email address to access this secure data room.
              Your email must be pre-approved by the administrator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={visitorInfo.email}
                onChange={(e) => setVisitorInfo({ ...visitorInfo, email: e.target.value })}
                placeholder="your@email.com"
              />
            </div>

            {requiredFields.includes("name") && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
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
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={visitorInfo.company}
                  onChange={(e) => setVisitorInfo({ ...visitorInfo, company: e.target.value })}
                  placeholder="Your company"
                />
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => {
                if (!linkValidated) {
                  handleAccessSubmit();
                } else {
                  handleEmailSubmit();
                }
              }}
              disabled={accessMutation.isPending || !visitorInfo.email}
            >
              {accessMutation.isPending ? "Verifying..." : "Continue"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Gate 3: Loading access status
  if (emailSubmitted && accessStatusLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <CardTitle>Verifying Access</CardTitle>
            <CardDescription>
              Checking your email approval and NDA status...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Gate 4: Email not approved - awaiting approval
  if (emailSubmitted && accessStatus && !accessStatus.emailApproved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <CardTitle>Access Pending Approval</CardTitle>
            <CardDescription className="space-y-2">
              <p>Your email <strong>{visitorInfo.email}</strong> has not been approved for access to this data room.</p>
              <p className="text-sm">Please contact the data room administrator to request access.</p>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {accessStatus.roomName && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium">{accessStatus.roomName}</h4>
                {accessStatus.roomDescription && (
                  <p className="text-sm text-muted-foreground mt-1">{accessStatus.roomDescription}</p>
                )}
              </div>
            )}
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => {
                  setEmailSubmitted(false);
                  setVisitorInfo({ ...visitorInfo, email: "" });
                }}
              >
                Try a Different Email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Gate 5: Email approved but NDA not signed
  if (emailSubmitted && accessStatus && accessStatus.emailApproved && !accessStatus.ndaSigned && !ndaAccepted) {
    return (
      <NdaSigningGate
        dataRoomId={dataRoomId!}
        visitorId={visitorId}
        visitorEmail={visitorInfo.email}
        visitorName={visitorInfo.name}
        visitorCompany={visitorInfo.company}
        ndaText={accessStatus.ndaText || null}
        ndaDocumentId={accessStatus.ndaDocumentId}
        roomName={accessStatus.roomName}
        roomDescription={accessStatus.roomDescription}
        logoUrl={accessStatus.logoUrl}
        brandColor={accessStatus.brandColor}
        onSigned={() => {
          setNdaAccepted(true);
          refetchAccessStatus();
          setAccessGranted(true);
        }}
      />
    );
  }

  // Gate 6: Show loading while waiting for initial validation
  if (!accessGranted && accessMutation.isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <CardTitle>Secure Data Room</CardTitle>
            <CardDescription>Verifying access...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Gate 7: Content error handling
  if (accessGranted && contentError) {
    const errorMessage = contentError.message;
    if (errorMessage === 'NDA_REQUIRED') {
      // Refresh access status to show NDA gate
      setAccessGranted(false);
      setNdaAccepted(false);
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setEmailSubmitted(false);
                setAccessGranted(false);
                setVisitorInfo({ ...visitorInfo, email: "" });
              }}
            >
              Try a Different Email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Gate 8: Wait for access to be granted
  if (!accessGranted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Secure Data Room</CardTitle>
            <CardDescription>Initializing...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Main Data Room View
  return (
    <div className="min-h-screen bg-background relative">
      {/* Watermark Overlay */}
      {content?.watermark && (
        <div 
          className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
          style={{ opacity: content.watermark.opacity }}
        >
          {content.watermark.position === 'tiled' && content.watermark.tiledPositions ? (
            content.watermark.tiledPositions.slice(0, 50).map((pos, i) => (
              <div
                key={i}
                className="absolute whitespace-nowrap"
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  transform: `rotate(${content.watermark!.rotation}deg)`,
                  fontSize: `${content.watermark!.fontSize}px`,
                  color: content.watermark!.color,
                  fontFamily: 'Arial, sans-serif',
                  userSelect: 'none',
                }}
              >
                {content.watermark!.text}
              </div>
            ))
          ) : (
            <div
              className="absolute top-1/2 left-1/2 whitespace-nowrap"
              style={{
                transform: `translate(-50%, -50%) rotate(${content.watermark.rotation}deg)`,
                fontSize: `${content.watermark.fontSize * 3}px`,
                color: content.watermark.color,
                fontFamily: 'Arial, sans-serif',
                userSelect: 'none',
              }}
            >
              {content.watermark.text}
            </div>
          )}
        </div>
      )}
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

// NDA Signing Gate Component
function NdaSigningGate({
  dataRoomId,
  visitorId,
  visitorEmail,
  visitorName,
  visitorCompany,
  ndaText,
  ndaDocumentId,
  roomName,
  roomDescription,
  logoUrl,
  brandColor,
  onSigned,
}: {
  dataRoomId: number;
  visitorId: number | null;
  visitorEmail: string;
  visitorName: string;
  visitorCompany: string;
  ndaText: string | null;
  ndaDocumentId?: number | null;
  roomName?: string | null;
  roomDescription?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  onSigned: () => void;
}) {
  const [step, setStep] = useState<'view' | 'sign'>('view');
  const [signerName, setSignerName] = useState(visitorName);
  const [signerEmail, setSignerEmail] = useState(visitorEmail);
  const [signerTitle, setSignerTitle] = useState('');
  const [signerCompany, setSignerCompany] = useState(visitorCompany);
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn'>('typed');
  const [typedSignature, setTypedSignature] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Use provided ndaDocumentId or fetch active NDA
  const { data: activeNda } = trpc.nda.documents.getActive.useQuery(
    { dataRoomId },
    { enabled: !ndaDocumentId }
  );
  const effectiveNdaId = ndaDocumentId || activeNda?.id;

  const { data: existingSignature } = trpc.nda.signatures.checkSigned.useQuery(
    { dataRoomId, email: signerEmail },
    { enabled: !!signerEmail }
  );

  const signMutation = trpc.nda.signatures.sign.useMutation({
    onSuccess: () => {
      toast.success('NDA signed successfully');
      onSigned();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Check if already signed
  useEffect(() => {
    if (existingSignature?.signed) {
      onSigned();
    }
  }, [existingSignature, onSigned]);

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSign = async () => {
    if (!effectiveNdaId) {
      toast.error('No NDA document found');
      return;
    }

    let signatureData = '';
    if (signatureType === 'typed') {
      signatureData = typedSignature;
    } else {
      const canvas = canvasRef.current;
      if (canvas) {
        signatureData = canvas.toDataURL('image/png');
      }
    }

    if (!signatureData) {
      toast.error('Please provide your signature');
      return;
    }

    signMutation.mutate({
      ndaDocumentId: effectiveNdaId,
      dataRoomId,
      visitorId: visitorId || undefined,
      signerName,
      signerEmail,
      signerTitle: signerTitle || undefined,
      signerCompany: signerCompany || undefined,
      signatureType,
      signatureData,
      consentCheckbox: consentChecked,
    });
  };

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
      }
    }
  }, [signatureType]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          {/* Room branding */}
          {(logoUrl || roomName) && (
            <div className="flex items-center gap-3 mb-4 pb-4 border-b">
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="h-10 w-auto" />
              )}
              {roomName && (
                <div>
                  <h3 className="font-semibold">{roomName}</h3>
                  {roomDescription && (
                    <p className="text-sm text-muted-foreground">{roomDescription}</p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle>Non-Disclosure Agreement Required</CardTitle>
          </div>
          <CardDescription>
            {step === 'view'
              ? 'Your email has been approved. Please review and sign the NDA to access the data room.'
              : 'Complete your signature to proceed'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'view' ? (
            <>
              {/* NDA Document Preview */}
              {activeNda ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-red-500" />
                      <span className="font-medium">{activeNda.name}</span>
                      <span className="text-sm text-muted-foreground">v{activeNda.version}</span>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={activeNda.storageUrl} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4 mr-2" />
                        View Full Document
                      </a>
                    </Button>
                  </div>
                  <iframe
                    src={activeNda.storageUrl}
                    className="w-full h-96 border-0"
                    title="NDA Document"
                  />
                </div>
              ) : (
                <ScrollArea className="h-64 border rounded-lg p-4">
                  <div className="prose prose-sm">
                    {ndaText || (
                      <p>
                        By accessing this data room, you agree to keep all information
                        contained herein strictly confidential. You may not share, copy,
                        or distribute any documents or information without prior written
                        consent from the data room owner.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              )}

              <Button className="w-full" onClick={() => setStep('sign')}>
                Proceed to Sign
              </Button>
            </>
          ) : (
            <>
              {/* Signer Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="john@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={signerTitle}
                    onChange={(e) => setSignerTitle(e.target.value)}
                    placeholder="CEO"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input
                    value={signerCompany}
                    onChange={(e) => setSignerCompany(e.target.value)}
                    placeholder="Acme Inc."
                  />
                </div>
              </div>

              {/* Signature Type Selection */}
              <div className="space-y-2">
                <Label>Signature Method</Label>
                <div className="flex gap-2">
                  <Button
                    variant={signatureType === 'typed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSignatureType('typed')}
                  >
                    Type Signature
                  </Button>
                  <Button
                    variant={signatureType === 'drawn' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSignatureType('drawn')}
                  >
                    Draw Signature
                  </Button>
                </div>
              </div>

              {/* Signature Input */}
              {signatureType === 'typed' ? (
                <div className="space-y-2">
                  <Label>Type your full legal name as signature</Label>
                  <Input
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    placeholder="John Smith"
                    className="font-signature text-2xl h-16"
                    style={{ fontFamily: 'cursive' }}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Draw your signature</Label>
                    <Button variant="ghost" size="sm" onClick={clearCanvas}>
                      Clear
                    </Button>
                  </div>
                  <div className="border rounded-lg bg-white">
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={150}
                      className="w-full cursor-crosshair"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                    />
                  </div>
                </div>
              )}

              {/* Consent Checkbox */}
              <div className="flex items-start space-x-2 pt-4 border-t">
                <Checkbox
                  id="consent"
                  checked={consentChecked}
                  onCheckedChange={(checked) => setConsentChecked(checked as boolean)}
                />
                <Label htmlFor="consent" className="text-sm leading-relaxed">
                  I have read and understood the Non-Disclosure Agreement. By signing below,
                  I agree to be legally bound by its terms and conditions. I understand that
                  this electronic signature has the same legal effect as a handwritten signature.
                </Label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep('view')}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSign}
                  disabled={
                    !signerName ||
                    !signerEmail ||
                    !consentChecked ||
                    (signatureType === 'typed' && !typedSignature) ||
                    signMutation.isPending
                  }
                >
                  {signMutation.isPending ? 'Signing...' : 'Sign & Continue'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
