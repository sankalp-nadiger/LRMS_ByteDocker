"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Download, Eye, Filter, Calendar, AlertTriangle, Send, X, Loader2, ChevronUp, ChevronDown } from "lucide-react"
import { useLandRecord } from "@/contexts/land-record-context"
import { convertToSquareMeters, LandRecordService } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { createActivityLog, createChat } from "@/lib/supabase"
import { useUserRole } from '@/contexts/user-context'
import { 
  exportPanipatraksToExcel, 
  exportPassbookToExcel, 
  exportQueryListToExcel, 
  exportDateWiseToExcel 
} from "@/lib/supabase-exports"

interface PassbookEntry {
  year: number
  ownerName: string
  area: number
  sNo: string
  nondhNumber: string
  createdAt: string
  affectedSNos: string
}

interface NondhDetail {
  id: string
  nondhId: string
  sNo: string
  type: string
  vigat?: string
  invalidReason?: string
  status: 'valid' | 'invalid' | 'nullified'
  showInOutput: boolean
  hasDocuments: boolean
  docUploadUrl?: string
  createdAt: string
  date: string
  nondhNumber?: string
  affectedSNos?: string
  nondhDocUrl?: string
  hukamType?: string
}

interface Nondh {
  id: string
  number: string
  affected_s_nos: any[]
  nondh_doc_url?: string
}

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

// Comment Modal Component
interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
 onSubmit: (message: string, recipients: string[], isReviewComplete?: boolean) => Promise<void>;
  loading?: boolean;
  step: number;
  userRole: string;
  landRecordStatus?: string;
}

const CommentModal = ({ isOpen, onClose, onSubmit, loading = false, step, userRole, landRecordStatus }: CommentModalProps) => {
  const [message, setMessage] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [isReviewComplete, setIsReviewComplete] = useState(false);
  const { user } = useUser();
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine the modal title based on user role
  const modalTitle = userRole === 'reviewer'
  ? `Send Message to Manager/Executioner - Step ${step}`
  : userRole === 'executioner'
  ? `Send Message to Manager/Reviewer - Step ${step}`
  : `Send Message to Executioner/Reviewer - Step ${step}`;
  // Fetch users when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          const response = await fetch('/api/users/list');
          if (!response.ok) throw new Error('Failed to fetch users');
          const data = await response.json();
          setUsers(data.users);
        } catch (error) {
          console.error('Error fetching users:', error);
        }
      };
      fetchUsers();
      // Reset state when modal opens
      setMessage('');
      setSelectedRecipients([]);
      setShowMentionDropdown(false);
      // Set isReviewComplete based on status
    if (userRole === 'reviewer') {
      setIsReviewComplete(landRecordStatus === 'review');
    } else {
      setIsReviewComplete(false);
    }
    }
}, [isOpen, landRecordStatus, userRole]); 

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    
    setMessage(value);
    setCursorPosition(position);

    // Check for @ mention
    const textBeforeCursor = value.substring(0, position);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const afterAt = textBeforeCursor.substring(lastAtIndex + 1);
      const beforeAt = textBeforeCursor.substring(0, lastAtIndex);
      if (beforeAt === '' || beforeAt.endsWith(' ')) {
        setMentionSearch(afterAt);
        setShowMentionDropdown(true);
        return;
      }
    }
    
    setShowMentionDropdown(false);
  };

  const handleMentionSelect = (userEmail: string, userName: string) => {
    const textBeforeCursor = message.substring(0, cursorPosition);
    const textAfterCursor = message.substring(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    const beforeMention = message.substring(0, lastAtIndex);
    const newText = beforeMention + `@${userName} ` + textAfterCursor;
    
    setMessage(newText);
    setSelectedRecipients([...selectedRecipients, userEmail]);
    setShowMentionDropdown(false);
    setMentionSearch('');
    
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const removeMention = (email: string) => {
    setSelectedRecipients(selectedRecipients.filter(e => e !== email));
  };

  const getUserByEmail = (email: string) => {
    return users.find(u => u.email === email);
  };

  const filteredUsers = users
    .filter(u => u.email !== user?.primaryEmailAddress?.emailAddress)
    .filter(u => !selectedRecipients.includes(u.email))
    .filter(u => 
      mentionSearch === '' || 
      u.fullName.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(mentionSearch.toLowerCase())
    );

  const handleSubmit = async () => {
    if (!message.trim()) return;
    await onSubmit(message, selectedRecipients, isReviewComplete);
    setMessage('');
    setSelectedRecipients([]);
    setIsReviewComplete(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="flex-shrink-0 border-b bg-white sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <CardTitle>{modalTitle}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto flex-1 p-6 pt-4">
          {/* Selected Recipients Pills */}
          {selectedRecipients.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedRecipients.map(email => {
                const recipient = getUserByEmail(email);
                return (
                  <span key={email} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {recipient?.fullName || email}
                    <button
                      onClick={() => removeMention(email)}
                      className="hover:text-blue-900 text-xs"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="comment-message">Message</Label>
            <div className="relative">
              <input
                ref={inputRef}
                id="comment-message"
                type="text"
                value={message}
                onChange={handleMessageChange}
                placeholder={userRole === 'reviewer' 
                  ? "Type @ to mention someone or send to all managers/executioners..." 
                  : "Type @ to mention someone or send to all executioners..."}
                disabled={loading}
                onKeyPress={(e) => e.key === 'Enter' && !showMentionDropdown && handleSubmit()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {/* Mention Dropdown */}
              {showMentionDropdown && filteredUsers.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                  {filteredUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleMentionSelect(u.email, u.fullName)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center justify-between border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-sm">{u.fullName}</span>
                        <span className="text-xs text-gray-500">{u.email}</span>
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Type @ to mention specific users, or send to all {userRole === 'reviewer' ? 'managers/executioners' : 'executioners'}
            </p>
          </div>
         {userRole === 'reviewer' ? (
  landRecordStatus === 'review' && ( // ADD THIS CONDITION
    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <input
        type="checkbox"
        id="review-complete"
        checked={isReviewComplete}
        onChange={(e) => setIsReviewComplete(e.target.checked)}
        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
      />
      <Label htmlFor="review-complete" className="text-sm font-medium cursor-pointer">
        Mark Review as Complete
      </Label>
    </div>
  )
) : (userRole === 'manager' || userRole === 'admin' || userRole === 'executioner') && (
  landRecordStatus !== 'review' && ( // ADD THIS CONDITION
    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
      <input
        type="checkbox"
        id="push-review"
        checked={isReviewComplete}
        onChange={(e) => setIsReviewComplete(e.target.checked)}
        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
      />
      <Label htmlFor="push-review" className="text-sm font-medium cursor-pointer">
        Push for Review
      </Label>
    </div>
  )
)}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !message.trim()}
              className="flex-1 flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Message
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Nondh type translations
const nondhTypeTranslations: Record<string, string> = {
  "Kabjedaar": "કબજેદાર",
  "Ekatrikaran": "એકત્રીકરણ",
  "Varsai": "વારસાઈ",
  "Hayati_ma_hakh_dakhal": "હયાતીમા હક દાખલ",
  "Hakkami": "હક કમી",
  "Vechand": "વેચાણ",
  "Durasti": "દુરસ્તી",
  "Promulgation": "પ્રમોલગેશન",
  "Hukam": "હુકમથી",
  "Vehchani": "વેંચાણી",
  "Bojo": "બોજો દાખલ",
  "Other": "વસિયત"
};

// Function to get display text with Gujarati translation
const getNondhTypeDisplay = (type: string): string => {
  const gujaratiText = nondhTypeTranslations[type];
  return gujaratiText ? `${type} (${gujaratiText})` : type;
};

export default function OutputViews() {
  const { landBasicInfo, recordId, yearSlabs, refreshStatus } = useLandRecord()
  const { toast } = useToast()
  const router = useRouter()
  const { user } = useUser()
  const { role } = useUserRole()
  
  const [passbookData, setPassbookData] = useState<PassbookEntry[]>([])
  const [nondhDetails, setNondhDetails] = useState<NondhDetail[]>([])
  const [nondhs, setNondhs] = useState<Nondh[]>([])
  const [filteredNondhs, setFilteredNondhs] = useState<NondhDetail[]>([])
  const [dateWiseFilteredData, setDateWiseFilteredData] = useState<NondhDetail[]>([])
  const [dateFilter, setDateFilter] = useState("")
  const [sNoFilter, setSNoFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [sendingComment, setSendingComment] = useState(false)
  const [landRecordStatus, setLandRecordStatus] = useState<string>('');

  
  // Fetch land record status
useEffect(() => {
  const fetchLandRecordStatus = async () => {
    if (!recordId) return;
    
    try {
      const { data, error } = await LandRecordService.getLandRecord(recordId);
      if (error) throw error;
      if (data) {
        setLandRecordStatus(data.status || '');
      }
    } catch (error) {
      console.error('Error fetching land record status:', error);
    }
  };

  if (recordId) {
    fetchLandRecordStatus();
  }
}, [recordId]);

 // Helper function to format affected S.Nos properly
const formatAffectedSNos = (affectedSNos: any, availableSNos?: Array<{value: string, type: string, label: string}>): string => {
  console.log('formatAffectedSNos received:', affectedSNos, 'type:', typeof affectedSNos);
  if (!affectedSNos) return '-';
  
  try {
    let sNos: Array<{number: string, type: string}> = [];
    
    // Handle array format like ["{\"number\":\"345\",\"type\":\"block_no\"}"]
    if (Array.isArray(affectedSNos)) {
      sNos = affectedSNos.map(sNoData => {
        try {
          if (typeof sNoData === 'string') {
            // Parse JSON string format
            return JSON.parse(sNoData);
          } else if (typeof sNoData === 'object' && sNoData.number && sNoData.type) {
            return sNoData;
          } else {
            return { number: sNoData.toString(), type: 's_no' };
          }
        } catch (e) {
          console.warn('Error parsing S.No data:', sNoData, e);
          return { number: sNoData.toString(), type: 's_no' };
        }
      });
    } else if (typeof affectedSNos === 'string') {
      // Handle single JSON string
      try {
        const parsed = JSON.parse(affectedSNos);
        sNos = [parsed];
      } catch {
        return affectedSNos;
      }
    } else if (typeof affectedSNos === 'object' && affectedSNos.number && affectedSNos.type) {
      sNos = [affectedSNos];
    }
    
    // Filter out S.Nos that are not in available S.Nos (basic info/year slabs)
    if (availableSNos && availableSNos.length > 0) {
      const availableSNosSet = new Set(availableSNos.map(s => s.value));
      sNos = sNos.filter(sNo => {
        const number = typeof sNo === 'object' ? sNo.number : sNo;
        return availableSNosSet.has(number?.toString());
      });
    }
    
    // Format the S.Nos with type labels
    if (sNos && sNos.length > 0) {
      return sNos.map(sNo => {
        if (typeof sNo === 'object' && sNo.number && sNo.type) {
          const typeLabel = sNo.type === 'block_no' ? 'Block' : 
                           sNo.type === 're_survey_no' ? 'Re-survey' : 'Survey';
          return `${sNo.number} (${typeLabel})`;
        }
        return sNo.toString();
      }).join(', ');
    }
    
    return '-';
  } catch (error) {
    console.warn('Error formatting affected S.Nos:', error);
    return typeof affectedSNos === 'string' ? affectedSNos : JSON.stringify(affectedSNos);
  }
};

  // Handle comment submission
const handleSendComment = async (message: string, recipients: string[], isReviewComplete: boolean = false) => {
  if (!recordId || !user?.primaryEmailAddress?.emailAddress) return;

  try {
    setSendingComment(true);

    const toEmails = recipients.length > 0 ? recipients : null;

    const chatData = await createChat({
      from_email: user.primaryEmailAddress.emailAddress,
      to_email: toEmails,
      message: message,
      land_record_id: recordId,
      step: 6
    });

    const recipientText = toEmails 
      ? `to ${toEmails.length} recipient(s)` 
      : role === 'reviewer' 
        ? 'to all managers/executioners'
        : 'to all executioners/reviewers';

    await createActivityLog({
      user_email: user.primaryEmailAddress.emailAddress,
      land_record_id: recordId,
      step: 6,
      chat_id: chatData.id,
      description: `Sent message ${recipientText}: ${message}`
    });

    // Handle review completion or push for review
    if (isReviewComplete) {
      if (role === 'reviewer') {
        // Reviewer marking review as complete
        await LandRecordService.updateLandRecord(recordId, { status: 'query' });
        
        await createActivityLog({
          user_email: user.primaryEmailAddress.emailAddress,
          land_record_id: recordId,
          step: 6,
          chat_id: null,
          description: 'Reviewer marked the review as complete.'
        });

        setLandRecordStatus('query'); // UPDATE LOCAL STATE
        toast({ title: "Review marked as complete." });
        refreshStatus();
      } else {
        // Manager/Admin/Executioner pushing for review
        await LandRecordService.updateLandRecord(recordId, { status: 'review' });
        
        await createActivityLog({
          user_email: user.primaryEmailAddress.emailAddress,
          land_record_id: recordId,
          step: 6,
          chat_id: null,
          description: `${role.charAt(0).toUpperCase() + role.slice(1)} pushed the record for review. Status changed to Review.`
        });

        setLandRecordStatus('review'); // UPDATE LOCAL STATE
        toast({ title: "Record pushed for review. Status changed to Review." });
        refreshStatus();
      }
    } else {
      toast({ title: "Message sent successfully" });
    }

    setShowCommentModal(false);
  } catch (error) {
    console.error('Error sending comment:', error);
    toast({ 
      title: "Error sending message", 
      variant: "destructive" 
    });
  } finally {
    setSendingComment(false);
  }
};

const handleDownloadIntegratedDocument = async () => {

  if (!landBasicInfo) {
    toast({
      title: 'Error',
      description: 'Land basic information is required to generate the document',
      variant: 'destructive'
    });
    return;
  }

  setIsGeneratingPDF(true);
  
  try {
    // Import the PDF generator dynamically to avoid SSR issues
    const { IntegratedDocumentGenerator } = await import('@/lib/pdf-generator');
    
    
    await IntegratedDocumentGenerator.generateIntegratedPDF(recordId as string, landBasicInfo);
    
    toast({
      title: 'Success',
      description: 'Integrated document generated and downloaded successfully',
    });
  } catch (error) {
  console.error('Error generating PDF:', error);
  toast({
    title: 'Error',
    description: error instanceof Error ? error.message : 'Failed to generate integrated document. Please try again.',
    variant: 'destructive'
  });
} finally {
    setIsGeneratingPDF(false);
  }
}

  const safeNondhNumber = (nondh: any): string => {
  if (!nondh || (!nondh.number && nondh.number !== 0)) return "0";
  return nondh.number.toString();
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN'); // or your preferred format
};

// Helper function to get unique S.Nos with types from ONLY basic info and year slabs
const getUniqueSNosWithTypes = () => {
  const sNoSet = new Set<string>();
  const sNoTypeMap = new Map<string, string>();
  
  // Add S.Nos from year slabs (step 2) - yearSlabs is available from component scope
  yearSlabs.forEach((slab) => {
    if (slab.sNo?.trim() !== "") {
      sNoSet.add(slab.sNo);
      sNoTypeMap.set(slab.sNo, slab.sNoType || 's_no');
    }
    
    slab.paikyEntries?.forEach((entry) => {
      if (entry.sNo?.trim() !== "") {
        sNoSet.add(entry.sNo);
        sNoTypeMap.set(entry.sNo, entry.sNoType || 's_no');
      }
    });
    
    slab.ekatrikaranEntries?.forEach((entry) => {
      if (entry.sNo?.trim() !== "") {
        sNoSet.add(entry.sNo);
        sNoTypeMap.set(entry.sNo, entry.sNoType || 's_no');
      }
    });
  });
  
  // Add S.Nos from step 1 (landBasicInfo) - landBasicInfo is available from component scope
  if (landBasicInfo) {
    // Survey Numbers from step 1
    if (landBasicInfo.sNo && landBasicInfo.sNo.trim() !== "") {
      const surveyNos = landBasicInfo.sNo.split(',').map(s => s.trim()).filter(s => s !== "");
      surveyNos.forEach(sNo => {
        sNoSet.add(sNo);
        if (!sNoTypeMap.has(sNo)) {
          sNoTypeMap.set(sNo, 's_no');
        }
      });
    }
    
    // Block Number from step 1
    if (landBasicInfo.blockNo && landBasicInfo.blockNo.trim() !== "") {
      sNoSet.add(landBasicInfo.blockNo);
      if (!sNoTypeMap.has(landBasicInfo.blockNo)) {
        sNoTypeMap.set(landBasicInfo.blockNo, 'block_no');
      }
    }
    
    // Re-survey Number from step 1
    if (landBasicInfo.reSurveyNo && landBasicInfo.reSurveyNo.trim() !== "") {
      sNoSet.add(landBasicInfo.reSurveyNo);
      if (!sNoTypeMap.has(landBasicInfo.reSurveyNo)) {
        sNoTypeMap.set(landBasicInfo.reSurveyNo, 're_survey_no');
      }
    }
  }
  
  return Array.from(sNoSet).map(sNo => ({
    value: sNo,
    type: sNoTypeMap.get(sNo) || 's_no',
    label: `${sNo} (${sNoTypeMap.get(sNo) === 'block_no' ? 'Block' : 
                     sNoTypeMap.get(sNo) === 're_survey_no' ? 'Re-survey' : 'Survey'})`
  })).sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
};

  const getPrimarySNoType = (affectedSNos: any[]): string => {
  if (!affectedSNos || affectedSNos.length === 0) return 's_no';
  
  // Priority order: s_no > block_no > re_survey_no
  const priorityOrder = ['s_no', 'block_no', 're_survey_no'];
  
  // Parse the JSON strings to get the actual types
  const types = affectedSNos.map(sNoStr => {
    try {
      // Handle the specific format: "{\"number\":\"345\",\"type\":\"block_no\"}"
      if (typeof sNoStr === 'string') {
        const parsed = JSON.parse(sNoStr);
        return parsed.type || 's_no';
      } else if (typeof sNoStr === 'object' && sNoStr.type) {
        return sNoStr.type;
      }
      return 's_no';
    } catch (e) {
      console.warn('Error parsing affected S.No:', sNoStr, e);
      return 's_no'; // fallback
    }
  });
  
  // Find the highest priority type present
  for (const type of priorityOrder) {
    if (types.includes(type)) {
      return type;
    }
  }
  
  return 's_no'; // default
};

  // Sorting function for nondhs
   const sortNondhsBySNoType = (a: NondhDetail, b: NondhDetail): number => {
  // Get the nondh objects for the details
  const nondhA = nondhs.find(n => n.id === a.nondhId);
  const nondhB = nondhs.find(n => n.id === b.nondhId);
  
  if (!nondhA || !nondhB) return 0;
  
  // Use the same getPrimarySNoType function for consistency
  const typeA = getPrimarySNoType(nondhA.affected_s_nos);
  const typeB = getPrimarySNoType(nondhB.affected_s_nos);

  // Priority order: s_no > block_no > re_survey_no
  const priorityOrder = ['s_no', 'block_no', 're_survey_no'];
  const priorityA = priorityOrder.indexOf(typeA);
  const priorityB = priorityOrder.indexOf(typeB);
  
  // First sort by type priority
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }
  
  // Within same type group, sort only by nondh number (ascending)
  const aNondhNo = parseInt(nondhA.number.toString()) || 0;
  const bNondhNo = parseInt(nondhB.number.toString()) || 0;
  return aNondhNo - bNondhNo;
};

  // Helper function to get status display name
  const getStatusDisplayName = (status: string): string => {
    switch (status) {
      case 'valid':
        return 'Pramaanik (પ્રમાણિત)'
      case 'nullified':
        return 'Na Manjoor (નામંજૂર)'
      case 'invalid':
        return 'Radd (રદ)'
      default:
        return status
    }
  }

  // Helper function to get status color classes
  const getStatusColorClass = (status: string): string => {
    switch (status) {
      case 'valid': return 'bg-green-100 text-green-800'
      case 'invalid': return 'bg-red-100 text-red-800'
      case 'nullified': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  };

  // Helper function to view document in new window
  const viewDocument = (url: string, title: string) => {
    if (url) {
      window.open(url, '_blank', 'width=800,height=600');
    } else {
      toast({
        title: 'Error',
        description: 'Document URL not available',
        variant: 'destructive'
      });
    }
  };

  // Load all data on component mount
  useEffect(() => {
    if (recordId) {
      fetchAllData()
    }
  }, [recordId])

  // Update filters when dependencies change
  useEffect(() => {
    if (nondhs.length > 0 && nondhDetails.length > 0) {
      generateFilteredNondhs()
      updateDateWiseFilter()
    }
  }, [nondhs, nondhDetails, sNoFilter, dateFilter])

  const fetchAllData = async () => {
    if (!recordId) {
      toast({
        title: 'Error',
        description: 'No land record ID found',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      // Fetch all data in sequence to ensure proper dependencies
      await fetchNondhsFromDB()
      await fetchNondhDetailsFromDB()
      await fetchPassbookData()
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch output data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchNondhsFromDB = async () => {
  try {
    const { data: nondhsData, error } = await LandRecordService.getNondhs(recordId)
    if (error) throw error
    
    const processedNondhs = nondhsData?.map(nondh => ({
  id: nondh.id,
  number: nondh.number,
  affected_s_nos: nondh.affectedSNos || [],
  nondh_doc_url: nondh.nondhDoc,
})) || []

    
    setNondhs(processedNondhs)
  } catch (error) {
    console.error('Error fetching nondhs:', error)
  }
}

 const fetchNondhDetailsFromDB = async () => {
  try {
    const { data: nondhDetailsWithRelations, error } = 
      await LandRecordService.getNondhDetailsWithRelations(recordId)
    
    if (error) throw error

    const processedDetails: NondhDetail[] = nondhDetailsWithRelations?.map(detail => ({
  id: detail.id,
  nondhId: detail.nondh_id,
  sNo: detail.s_no || '',
  type: detail.type || 'Standard',
  vigat: detail.vigat || '',
  status: detail.status || 'pending',
  hasDocuments: Boolean(detail.has_documents),
  showInOutput: Boolean(detail.show_in_output),
  createdAt: detail.created_at || new Date().toISOString(),
  date: detail.date || detail.created_at || new Date().toISOString(),
  docUploadUrl: detail.doc_upload_url || null,
  invalidReason: detail.invalid_reason || '',
  hukamType: detail.hukam_type || ''
})) || []

    setNondhDetails(processedDetails)
    
  } catch (error) {
    console.error('Error fetching nondh details:', error)
  }
}

  const fetchPassbookData = async () => {
  try {
    const { data: nondhsData, error: nondhError } = await LandRecordService.getNondhs(recordId)
    if (nondhError) throw nondhError
    
    const freshNondhs = nondhsData?.map(nondh => ({
      id: nondh.id,
      number: nondh.number,
      affected_s_nos: nondh.affectedSNos || [],
      nondh_doc_url: nondh.nondhDoc
    })) || []

    const { data: nondhDetailsWithRelations, error: detailsError } = 
      await LandRecordService.getNondhDetailsWithRelations(recordId)
    
    if (detailsError) throw detailsError

    if (!nondhDetailsWithRelations || nondhDetailsWithRelations.length === 0) {
      setPassbookData([])
      return
    }

    const availableSNos = getUniqueSNosWithTypes(); // Get available S.Nos
    const passbookEntries: PassbookEntry[] = []

    nondhDetailsWithRelations.forEach(detail => {
      const nondh = freshNondhs.find(n => n.id === detail.nondh_id)
      const nondhNumber = nondh ? safeNondhNumber(nondh) : "0"
      
      const relevantDate = detail.date || detail.created_at || new Date().toISOString()

      detail.owner_relations?.forEach(relation => {
        if (!relation.is_valid) return

        let area = 0
        if (relation.area_unit === 'acre_guntha') {
          const totalGunthas = (relation.acres || 0) * 40 + (relation.gunthas || 0)
          area = convertToSquareMeters(totalGunthas, 'guntha')
        } else {
          area = relation.square_meters || 0
        }

        console.log('Entry affectedSNos before format:', nondh?.affected_s_nos);
        const affectedSNosFormatted = nondh ? formatAffectedSNos(nondh.affected_s_nos, availableSNos) : relation.s_no || ''; // Pass availableSNos
        console.log('Entry affectedSNos after format:', affectedSNosFormatted);
        
        const entry = {
          year: new Date(relevantDate).getFullYear(),
          ownerName: relation.owner_name || '',
          area,
          sNo: relation.s_no || '',
          nondhNumber,
          createdAt: relevantDate,
          affectedSNos: affectedSNosFormatted
        }

        if (!sNoFilter || 
            entry.sNo === sNoFilter || 
            entry.affectedSNos.includes(sNoFilter)) {
          passbookEntries.push(entry)
        }
      })
    })

    setPassbookData(passbookEntries.sort((a, b) => a.year - b.year))
    
  } catch (error) {
    console.error('Error in fetchPassbookData:', error)
    toast({
      title: 'Error',
      description: 'Failed to fetch passbook data',
      variant: 'destructive'
    })
  }
}


  const [panipatraks, setPanipatraks] = useState<any[]>([])
  const [expandedSlabs, setExpandedSlabs] = useState<Record<string, boolean>>({})
  const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({})

  // Fetch panipatraks data
  useEffect(() => {
    const fetchPanipatraks = async () => {
      if (!recordId) return;
      
      try {
        const { data, error } = await LandRecordService.getPanipatraks(recordId);
        if (error) throw error;
        
        setPanipatraks(data || []);
        
        // Initialize expanded states for slabs
        const initialExpanded: Record<string, boolean> = {};
        yearSlabs.forEach(slab => {
          initialExpanded[slab.id] = true;
        });
        setExpandedSlabs(initialExpanded);
        
      } catch (error) {
        console.error('Error fetching panipatraks:', error);
      }
    };
    
    if (recordId && yearSlabs.length > 0) {
      fetchPanipatraks();
    }
  }, [recordId, yearSlabs]);

  // Helper function to get year periods (same as in Panipatrak component)
  const getYearPeriods = (startYear: number, endYear: number) => {
    if (!startYear || !endYear) return [];
    
    const periods: { from: number; to: number; period: string }[] = [];
    for (let y = startYear; y < endYear; y++) {
      periods.push({ 
        from: y, 
        to: y + 1, 
        period: `${y}-${y + 1}` 
      });
    }
    return periods;
  };

  // Export functions for each tab
const handleExportPanipatraks = async () => {
  if (!landBasicInfo) {
    toast({
      title: 'Error',
      description: 'Land basic information is required',
      variant: 'destructive'
    });
    return;
  }

  try {
    // Pass the actual panipatraks data and yearSlabs to the export function
    await exportPanipatraksToExcel(panipatraks, landBasicInfo, yearSlabs);
    toast({
      title: 'Success',
      description: 'Panipatraks exported successfully',
    });
  } catch (error) {
    console.error('Error exporting panipatraks:', error);
    toast({
      title: 'Error',
      description: 'Failed to export panipatraks',
      variant: 'destructive'
    });
  }
};

  const handleExportPassbook = async () => {
  if (!landBasicInfo) {
    toast({
      title: 'Error',
      description: 'Land basic information is required',
      variant: 'destructive'
    });
    return;
  }

  try {
    await exportPassbookToExcel(passbookData, landBasicInfo);
    toast({
      title: 'Success',
      description: 'Passbook exported successfully',
    });
  } catch (error) {
    console.error('Error exporting passbook:', error);
    toast({
      title: 'Error',
      description: 'Failed to export passbook',
      variant: 'destructive'
    });
  }
};

const handleExportQueryList = async () => {
  if (!landBasicInfo) {
    toast({
      title: 'Error',
      description: 'Land basic information is required',
      variant: 'destructive'
    });
    return;
  }

  try {
    await exportQueryListToExcel(filteredNondhs, landBasicInfo);
    toast({
      title: 'Success',
      description: 'Query list exported successfully',
    });
  } catch (error) {
    console.error('Error exporting query list:', error);
    toast({
      title: 'Error',
      description: 'Failed to export query list',
      variant: 'destructive'
    });
  }
};

const handleExportDateWise = async () => {
  if (!landBasicInfo) {
    toast({
      title: 'Error',
      description: 'Land basic information is required',
      variant: 'destructive'
    });
    return;
  }

  try {
    await exportDateWiseToExcel(dateWiseFilteredData, landBasicInfo);
    toast({
      title: 'Success',
      description: 'Date-wise data exported successfully',
    });
  } catch (error) {
    console.error('Error exporting date-wise data:', error);
    toast({
      title: 'Error',
      description: 'Failed to export date-wise data',
      variant: 'destructive'
    });
  }
};

  const generateFilteredNondhs = () => {
  console.log('generateFilteredNondhs - nondhs available:', nondhs.length);
  console.log('generateFilteredNondhs - nondhDetails available:', nondhDetails.length);
  
  const availableSNos = getUniqueSNosWithTypes(); // Get available S.Nos
  
  let outputNondhs = nondhDetails
    .filter(detail => detail.showInOutput)
    .map(detail => {
      console.log('Processing detail:', detail.id, 'looking for nondh:', detail.nondhId);
      const nondh = nondhs.find(n => n.id === detail.nondhId)
      console.log('Found nondh for detail:', nondh);
      return {
        ...detail,
        nondhNumber: nondh ? safeNondhNumber(nondh) : "0",
        affectedSNos: formatAffectedSNos(nondh?.affected_s_nos || [detail.sNo], availableSNos), // Pass availableSNos
        nondhDocUrl: nondh?.nondh_doc_url || null
      }
    })

  // Apply S.No filter
  if (sNoFilter) {
    outputNondhs = outputNondhs.filter(nondh => {
      return nondh.affectedSNos.includes(sNoFilter) || nondh.sNo === sNoFilter;
    });
  }
  
  setFilteredNondhs(outputNondhs.sort(sortNondhsBySNoType));
}

  const updateDateWiseFilter = () => {
  let filteredDetails = nondhDetails;
  
  if (dateFilter) {
    filteredDetails = nondhDetails.filter(detail => detail.date?.includes(dateFilter));
  }
  
  const availableSNos = getUniqueSNosWithTypes(); // Get available S.Nos
  
  let mappedDetails = filteredDetails.map(detail => {
    const nondh = nondhs.find(n => n.id === detail.nondhId)
    return {
      ...detail,
      nondhNumber: nondh ? safeNondhNumber(nondh) : 0,
      affectedSNos: formatAffectedSNos(nondh?.affected_s_nos || [detail.sNo], availableSNos), // Pass availableSNos
      nondhDocUrl: nondh?.nondh_doc_url || null,
      date: detail.date || detail.createdAt
    }
  });

  // Apply S.No filter
  if (sNoFilter) {
    mappedDetails = mappedDetails.filter(nondh => {
      return nondh.affectedSNos.includes(sNoFilter) || nondh.sNo === sNoFilter;
    });
  }
  
  setDateWiseFilteredData(mappedDetails.sort(sortNondhsBySNoType));
}

 const exportToExcel = async () => {
  if (!landBasicInfo) {
    toast({
      title: 'Error',
      description: 'Land basic information is required',
      variant: 'destructive'
    })
    return
  }

  try {
    // Get available S.Nos for filtering
    const availableSNos = getUniqueSNosWithTypes();
    
    const formatAffectedSNos = (affectedSNos: any): string => {
      if (!affectedSNos) {
        return '-';
      }
      
      try {
        let sNos: Array<{number: string, type: string}> = [];
        
        // Handle array format like ["{\"number\":\"345\",\"type\":\"block_no\"}"]
        if (Array.isArray(affectedSNos)) {
          console.log('📦 [EXCEL] Processing as array, length:', affectedSNos.length);
          sNos = affectedSNos.map(sNoData => {
            try {
              if (typeof sNoData === 'string') {
                return JSON.parse(sNoData);
              } else if (typeof sNoData === 'object' && sNoData.number && sNoData.type) {
                return sNoData;
              } else {
                return { number: sNoData.toString(), type: 's_no' };
              }
            } catch (e) {
              return { number: sNoData.toString(), type: 's_no' };
            }
          });
        } else if (typeof affectedSNos === 'string') {
          // Handle single JSON string
          try {
            const parsed = JSON.parse(affectedSNos);
            sNos = [parsed];
          } catch {
            return affectedSNos;
          }
        } else if (typeof affectedSNos === 'object' && affectedSNos.number && affectedSNos.type) {
          sNos = [affectedSNos];
        } else {
          return JSON.stringify(affectedSNos);
        }

        // Filter out S.Nos that are not in available S.Nos (basic info/year slabs)
        const availableSNosSet = new Set(availableSNos.map(s => s.value));
        sNos = sNos.filter(sNo => {
          const number = typeof sNo === 'object' ? sNo.number : sNo;
          return availableSNosSet.has(number?.toString());
        });
        
        // Format the S.Nos as simple numbers separated by commas
        if (sNos && sNos.length > 0) {
          const result = sNos.map(sNo => {
            if (typeof sNo === 'object' && sNo.number) {
              return sNo.number.toString(); // Just return the number without type
            }
            return sNo.toString();
          }).join(', ');
          return result;
        }

        return '-';
      } catch (error) {
        return typeof affectedSNos === 'string' ? affectedSNos : JSON.stringify(affectedSNos);
      }
    }
    
    // Dynamically import xlsx
    const XLSX = await import('xlsx-js-style')

    // Get all nondh data
    let allData = nondhDetails.map((detail) => {
      const nondh = nondhs.find((n) => n.id === detail.nondhId)
      const affectedSNosRaw = nondh?.affected_s_nos || [detail.sNo]
      
      return {
        ...detail,
        nondhNumber: nondh?.number || 0,
        affectedSNosFormatted: formatAffectedSNos(affectedSNosRaw),
        nondhType:  getNondhTypeDisplay(nondh?.type || detail.type),
        hukamType: detail.hukamType || detail.subType || '-',
      }
    })

    const sortedData = allData.sort(sortNondhsBySNoType)

  
    // Format date as DDMMYYYY
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '-'
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return '-'
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    }

    // Create header info
    const headerInfo = [
      `District (જીલ્લો): ${landBasicInfo.district || 'N/A'}`,
      `Taluka (તાલુકો): ${landBasicInfo.taluka || 'N/A'}`,
      `Village (મોજે): ${landBasicInfo.village || 'N/A'}`,
      `Block No (બ્લોક નં.): ${landBasicInfo.blockNo || 'N/A'}`,
      landBasicInfo.reSurveyNo ? `Re-survey No (ફરી-સર્વે નં.): ${landBasicInfo.reSurveyNo}` : ''
    ].filter(Boolean).join(', ')

    // Create worksheet data
    const wsData = [
      [headerInfo], // Header row
      [], // Empty row
      ['Serial No (અનુક્રમ નંબર)', 'Nondh No. (નોધ નંબર)', 'Nondh Type (નોધ ની પ્રકાર)', 'Nondh Date (નોધ ની તારીખ)', 'Vigat (નોધ ની વિગત)', 'Affected Survey Numbers (સર્વે નંબર)', 'Status (સ્થિતિ)'], // Column headers
      ...sortedData.map((row, index) => [
        index + 1,
        row.nondhNumber || '-',
        row.nondhType || '-',
        row.date ? formatDate(row.date) : '-',
        row.vigat || '-',
        row.affectedSNosFormatted || '-',
        getStatusDisplayName(row.status || 'valid')
      ])
    ]

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Get range for styling
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    
    // Apply styles to header row (A1)
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true, sz: 12 },
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
      };
    }

    // Apply styles to column headers (row 3)
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "3";
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        fill: { fgColor: { rgb: "CCCCCC" } }
      };
    }

    // Apply text wrapping and alignment to all data cells (starting from row 4)
    for (let R = 3; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[address]) continue;
        
        ws[address].s = {
          alignment: { 
            horizontal: C === 4 ? "left" : "center", // Left align Vigat column, center others
            vertical: "center", // Center vertically for better appearance
            wrapText: true 
          }
        };
      }
    }
    
    // Set column widths with wider Vigat column
    ws['!cols'] = [
      { wch: 12 },  // Serial No (increased)
      { wch: 15 },  // Nondh No (increased)
      { wch: 18 },  // Nondh Type (increased)
      { wch: 15 },  // Nondh Date (increased)
      { wch: 60 },  // Vigat (significantly wider for text wrapping)
      { wch: 30 },  // Affected Survey Numbers (increased)
      { wch: 15 }   // Status (increased)
    ]

    // Set row heights dynamically based on content
    ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 30 }; // Header row
    ws['!rows'][1] = { hpt: 15 }; // Empty row
    ws['!rows'][2] = { hpt: 45 }; // Column headers (increased for bilingual text)
    
    // Calculate row heights for data rows based on Vigat content
    for (let i = 0; i < sortedData.length; i++) {
      const vigatText = sortedData[i].vigat || '-';
      // Estimate height: approximately 15pt per 60 characters (column width)
      // Minimum height of 30pt, maximum of 150pt
      const estimatedLines = Math.ceil(vigatText.length / 60);
      const rowHeight = Math.min(Math.max(estimatedLines * 15, 30), 150);
      ws['!rows'][i + 3] = { hpt: rowHeight };
    }

    // Merge first row (header info) across all columns
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Output Views')

    // Generate filename
    const filename = `output-land-${landBasicInfo.blockNo || 'NA'}-nondhs.xlsx`

    // Write file with UTF-8 support for Gujarati
    XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true })

    toast({
      title: 'Success',
      description: 'Excel file exported successfully',
    })
  } catch (error) {
    console.error('Error exporting to Excel:', error)
    toast({
      title: 'Error',
      description: 'Failed to export Excel file',
      variant: 'destructive'
    })
  }
}

  const handleCompleteProcess = () => {
    toast({ title: "Land records fetched successfully!" })
    router.push('/land-master')
  }

  const renderQueryListCard = (nondh: NondhDetail, index: number) => {    
  return (
    <Card key={index} className="p-4">
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="font-medium text-sm">Nondh #{nondh.nondhNumber}</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Nondh Doc:</span>
            <div className={`font-medium p-1 rounded ${!nondh.nondhDocUrl ? 'bg-red-100' : ''}`}>
              {nondh.nondhDocUrl ? (
                <span className="text-green-600 text-xl">✓</span>
              ) : (
                <span className="text-red-600 text-xs">N/A</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-sm">Relevant Docs:</span>
            <div className={`font-medium p-1 rounded ${nondh.hasDocuments ? (!nondh.docUploadUrl ? 'bg-yellow-100' : '') : ''}`}>
              <div className="text-sm">Available: {nondh.hasDocuments ? "Yes" : "No"}</div>
              {nondh.hasDocuments && (
                <div className="mt-1">
                  {nondh.docUploadUrl ? (
                    <span className="text-green-600 text-xl">✓</span>
                  ) : (
                    <span className="text-red-600 text-xl">✗</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

  const renderPassbookCard = (entry: PassbookEntry, index: number) => (
    <Card key={index} className="p-4">
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="font-medium text-sm">{entry.ownerName}</div>
            <div className="text-muted-foreground text-xs">Year: {entry.year}</div>
          </div>
          <Badge variant="outline" className="text-xs">
            {entry.nondhNumber || "-"}
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Area:</span>
            <div className="font-medium">{entry.area?.toFixed(2)} sq.m</div>
          </div>
        </div>
        
        <div>
          <span className="text-muted-foreground text-sm">Affected S.No:</span>
          <div className="text-sm font-medium">{entry.affectedSNos || entry.sNo}</div>
        </div>
      </div>
    </Card>
  )

  const renderDateWiseCard = (nondh: NondhDetail, index: number) => (
    <Card key={nondh.id || index} className="p-4">
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="font-medium text-sm">Nondh #{nondh.nondhNumber}</div>
            <div className="text-muted-foreground text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(nondh.date)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={`text-xs ${getStatusColorClass(nondh.status)}`}>
              {getStatusDisplayName(nondh.status)}
            </Badge>
            <span className={`text-xs ${nondh.showInOutput ? "text-green-600" : "text-red-600"}`}>
              {nondh.showInOutput ? "In Output" : "Not in Output"}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Affected S.No:</span>
            <div className="font-medium">
              {nondh.affectedSNos || nondh.sNo}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Nondh Type:</span>
            <div className="font-medium">{getNondhTypeDisplay(nondh.type)}</div>
          </div>
        </div>
      </div>
    </Card>
  )

  const SNoFilterComponent = () => {
    const uniqueSNos = getUniqueSNosWithTypes();
    
    return (
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4" />
        <Label htmlFor="sno-filter" className="text-sm whitespace-nowrap">Filter by S.No:</Label>
        <select
          id="sno-filter"
          value={sNoFilter}
          onChange={(e) => setSNoFilter(e.target.value)}
          className="w-full sm:w-48 px-3 py-1 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All S.Nos</option>
          {uniqueSNos.map((sno, index) => (
            <option key={index} value={sno.value}>
              {sno.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="w-full max-w-none">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Step 6: Output Views & Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading output data...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="w-full max-w-none">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Step 6: Output Views & Reports</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <h2 className="text-lg font-semibold">Reports & Documents</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleDownloadIntegratedDocument}
                className="flex items-center gap-2 w-full sm:w-auto"
                variant="outline"
                disabled={isGeneratingPDF}
              >
                <Download className="w-4 h-4" />
                {isGeneratingPDF ? 'Generating...' : 'Download Integrated Document'}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="nondh-table" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="nondh-table" className="text-xs sm:text-sm">Nondh Table</TabsTrigger>
              <TabsTrigger value="query-list" className="text-xs sm:text-sm">Query List</TabsTrigger>
              <TabsTrigger value="panipatraks" className="text-xs sm:text-sm">Panipatraks</TabsTrigger>
              <TabsTrigger value="passbook" className="text-xs sm:text-sm">Passbook</TabsTrigger>
              <TabsTrigger value="date-wise" className="text-xs sm:text-sm">Date-wise</TabsTrigger>
            </TabsList>

           <TabsContent value="nondh-table" className="space-y-4">
  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
    <h3 className="text-base sm:text-lg font-semibold">
      All Nondhs ({nondhDetails.length})
    </h3>
    
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <SNoFilterComponent />
      <Button
        onClick={exportToExcel}
        className="flex items-center gap-2 w-full sm:w-auto"
        variant="outline"
        size="sm"
      >
        <Download className="w-4 h-4" />
        Export Nondh Table
      </Button>
    </div>
  </div>

  {(() => {
    const availableSNos = getUniqueSNosWithTypes(); // Get available S.Nos
    
    const allNondhsData = nondhDetails.map((detail) => {
      const nondh = nondhs.find((n) => n.id === detail.nondhId)
      return {
        ...detail,
        nondhNumber: nondh?.number || 0,
        affectedSNos: formatAffectedSNos(nondh?.affected_s_nos || [detail.sNo], availableSNos), // Pass availableSNos
        nondhType: detail.type,
        hukamType: detail.hukamType || '-',
        nondhDocUrl: nondh?.nondh_doc_url || null
      }
    }).filter(nondh => {
      if (!sNoFilter) return true;
      return nondh.affectedSNos.includes(sNoFilter) || nondh.sNo === sNoFilter;
    }).sort(sortNondhsBySNoType);

    if (allNondhsData.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">
            {sNoFilter ? 'No nondhs found for selected S.No' : 'No nondh data available'}
          </p>
        </div>
      );
    }

    return (
      <>
        {/* Desktop Table */}
        <div className="hidden lg:block rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Nondh No.</TableHead>
                <TableHead className="w-24">Nondh Doc</TableHead>
                <TableHead className="w-24">Nondh Type</TableHead>
                <TableHead className="w-20">Hukam Type</TableHead>
                <TableHead className="w-[300px]">Vigat</TableHead>
                <TableHead className="w-32">Affected S.No</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
                <TableHead className="w-48">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allNondhsData.map((nondh, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{nondh.nondhNumber}</TableCell>
                  <TableCell className={!nondh.nondhDocUrl ? 'bg-red-50' : ''}>
                    {nondh.nondhDocUrl ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-8 px-2"
                        onClick={() => viewDocument(nondh.nondhDocUrl!, `Nondh ${nondh.nondhNumber} Document`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    ) : (
                      <span className="text-red-600 font-medium">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>{getNondhTypeDisplay(nondh.nondhType)}</TableCell>
                  <TableCell className="text-sm">
                    {nondh.type === 'Hukam' ? (nondh.hukamType || '-') : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="max-h-32 overflow-y-auto">
                      <div className="text-sm whitespace-pre-wrap break-words min-h-[20px]">
                        {nondh.vigat || "-"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{nondh.affectedSNos}</TableCell>
                 <TableCell>
  <div className="flex justify-center">
    <span className={`inline-block px-3 py-1 rounded text-sm text-center min-w-[100px] ${getStatusColorClass(nondh.status)}`}>
      {getStatusDisplayName(nondh.status)}
    </span>
  </div>
</TableCell>
                  <TableCell>
                    <div className="max-h-32 overflow-y-auto">
                      <div className="text-sm whitespace-pre-wrap break-words min-h-[20px]">
                        {nondh.invalidReason ? (
                          <span className="text-red-600">{nondh.invalidReason}</span>
                        ) : (
                          "-"
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-3">
          {allNondhsData.map((nondh, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="font-medium text-sm">Nondh #{nondh.nondhNumber}</div>
                    <div className="text-muted-foreground text-xs">
                      Type: {getNondhTypeDisplay(nondh.nondhType)}
                      {nondh.nondhType === 'Hukam' && nondh.hukamType && nondh.hukamType !== '-' && (
                        <span> - {nondh.hukamType}</span>
                      )}
                    </div>
                  </div>
                  <Badge className={`text-sm px-3 py-1 min-w-[100px] text-center ${getStatusColorClass(nondh.status)}`}>
  {getStatusDisplayName(nondh.status)}
</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nondh Doc:</span>
                    <div className={`font-medium p-1 rounded ${!nondh.nondhDocUrl ? 'bg-red-100' : ''}`}>
                      {nondh.nondhDocUrl ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-6 px-2"
                          onClick={() => viewDocument(nondh.nondhDocUrl!, `Nondh ${nondh.nondhNumber} Document`)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      ) : (
                        <span className="text-red-600 text-xs">N/A</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Affected S.No:</span>
                    <div className="font-medium text-xs">{nondh.affectedSNos}</div>
                  </div>
                </div>
                
                {nondh.vigat && nondh.vigat !== '-' && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-sm">Vigat:</span>
                    <div className="max-h-24 overflow-y-auto border rounded p-2 bg-gray-50">
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {nondh.vigat}
                      </div>
                    </div>
                  </div>
                )}
                
                {nondh.invalidReason && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-sm">Reason:</span>
                    <div className="max-h-24 overflow-y-auto border rounded p-2 bg-red-50">
                      <div className="text-sm whitespace-pre-wrap break-words text-red-600">
                        {nondh.invalidReason}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </>
    );
  })()}
</TabsContent>

  {/* New Panipatraks Tab */}
<TabsContent value="panipatraks" className="space-y-4">
  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
    <h3 className="text-base sm:text-lg font-semibold">
      Panipatraks - Farmer Allotments
    </h3>
    <Button
      onClick={handleExportPanipatraks}
      className="flex items-center gap-2 w-full sm:w-auto"
      variant="outline"
      size="sm"
    >
      <Download className="w-4 h-4" />
      Export Panipatraks
    </Button>
  </div>

  {yearSlabs.length === 0 ? (
    <div className="text-center py-8">
      <p className="text-gray-500 text-sm">No year slabs found</p>
    </div>
  ) : (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/4">Year(s)</TableHead>
            <TableHead className="w-1/2">Farmer Name</TableHead>
            <TableHead className="w-1/4">Area Alloted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {yearSlabs.map((slab) => {
            const slabPanipatraks = panipatraks.filter(p => p.slabId === slab.id);
            const periods = getYearPeriods(slab.startYear, slab.endYear);
            const hasSameForAll = slabPanipatraks.length > 0 && 
                                 slabPanipatraks.every(p => p.sameForAll === true);

            if (hasSameForAll) {
              // Single entry for all years
              const firstPeriodData = slabPanipatraks.find(p => p.year === periods[0]?.from);
              if (!firstPeriodData?.farmers?.length) return null;

              return firstPeriodData.farmers.map((farmer: any, farmerIndex: number) => {
                const areaInSqM = farmer.area.unit === "sq_m" 
                  ? farmer.area.value 
                  : convertToSquareMeters(farmer.area.value, "sq_m");
                
                const acres = convertToSquareMeters(areaInSqM, "acre");
                const guntha = convertToSquareMeters(areaInSqM, "guntha") % 40;

                return (
                  <TableRow key={`${slab.id}-all-${farmerIndex}`}>
                    <TableCell className="font-medium">
                      {farmerIndex === 0 ? `${slab.startYear}-${slab.endYear}` : ''}
                    </TableCell>
                    <TableCell>{farmer.name}</TableCell>
                    <TableCell>
                      {Math.round(areaInSqM * 100) / 100} sq.m ({Math.floor(acres)} acre {Math.round(guntha)} guntha)
                    </TableCell>
                  </TableRow>
                );
              });
            } else {
              // Separate entries for each period
              return periods.flatMap((period) => {
                const periodData = slabPanipatraks.find(p => p.year === period.from);
                if (!periodData?.farmers?.length) return null;

                return periodData.farmers.map((farmer: any, farmerIndex: number) => {
                  const areaInSqM = farmer.area.unit === "sq_m" 
                    ? farmer.area.value 
                    : convertToSquareMeters(farmer.area.value, "sq_m");
                  
                  const acres = convertToSquareMeters(areaInSqM, "acre");
                  const guntha = convertToSquareMeters(areaInSqM, "guntha") % 40;

                  return (
                    <TableRow key={`${slab.id}-${period.period}-${farmerIndex}`}>
                      <TableCell className="font-medium">
                        {farmerIndex === 0 ? period.period : ''}
                      </TableCell>
                      <TableCell>{farmer.name}</TableCell>
                      <TableCell>
                        {Math.round(areaInSqM * 100) / 100} sq.m ({Math.floor(acres)} acre {Math.round(guntha)} guntha)
                      </TableCell>
                    </TableRow>
                  );
                });
              });
            }
          })}
        </TableBody>
      </Table>
    </div>
  )}
</TabsContent>

          <TabsContent value="query-list" className="space-y-4">
            {/* <div className="flex flex-col gap-4"> */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <h3 className="text-base sm:text-lg font-semibold">
                  Nondhs Marked for Output ({filteredNondhs.length})
                </h3>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <SNoFilterComponent />
                  <Button
                    onClick={handleExportQueryList}
                    className="flex items-center gap-2 w-full sm:w-auto"
                    variant="outline"
                    size="sm"
                  >
                    <Download className="w-4 h-4" />
                    Export Query List
                  </Button>
                </div>
              </div>


            {filteredNondhs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">
                  {sNoFilter ? 'No nondhs found for selected S.No' : 'No nondhs marked for output display'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
  <TableRow>
    <TableHead>Nondh No.</TableHead>
    <TableHead>Nondh Doc</TableHead>
    <TableHead>Relevant Docs Available</TableHead>
    <TableHead>Relevant Docs</TableHead>
  </TableRow>
</TableHeader>
                    <TableBody>
  {filteredNondhs.map((nondh, index) => {
    return (
      <TableRow key={index}>
        <TableCell>{nondh.nondhNumber}</TableCell>
        <TableCell className={!nondh.nondhDocUrl ? 'bg-red-100' : ''}>
          {nondh.nondhDocUrl ? (
            <div className="flex items-center justify-center">
              <span className="text-green-600 text-xl">✓</span>
            </div>
          ) : (
            <span className="text-red-600 font-medium">N/A</span>
          )}
        </TableCell>
        <TableCell>{nondh.hasDocuments ? "Yes" : "No"}</TableCell>
        <TableCell className={nondh.hasDocuments && !nondh.docUploadUrl ? 'bg-yellow-100' : ''}>
          {nondh.hasDocuments ? (
            nondh.docUploadUrl ? (
              <div className="flex items-center justify-center">
                <span className="text-green-600 text-xl">✓</span>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <span className="text-red-600 text-xl">✗</span>
              </div>
            )
          ) : (
            "N/A"
          )}
        </TableCell>
      </TableRow>
    );
  })}
</TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-3">
                  {filteredNondhs.map(renderQueryListCard)}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="passbook" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <h3 className="text-base sm:text-lg font-semibold">
                  Land Ownership Records ({passbookData.length})
                </h3>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <SNoFilterComponent />
                   <Button
                    onClick={handleExportPassbook}
                    className="flex items-center gap-2 w-full sm:w-auto"
                    variant="outline"
                    size="sm"
                  >
                    <Download className="w-4 h-4" />
                    Export Passbook
                  </Button>
                </div>
              </div>


            {passbookData.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">
                  {sNoFilter ? 'No passbook data found for selected S.No' : 'No passbook data available'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead>Owner Name</TableHead>
                        <TableHead>Affected S.No</TableHead>
                        <TableHead>Area (sq.m)</TableHead>
                        <TableHead>Nondh No.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {passbookData.map((entry, index) => (
                        <TableRow key={index}>
                          <TableCell>{entry.year}</TableCell>
                          <TableCell>{entry.ownerName}</TableCell>
                          <TableCell>{entry.affectedSNos || entry.sNo}</TableCell>
                          <TableCell>{entry.area?.toFixed(2)}</TableCell>
                          <TableCell>{entry.nondhNumber || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-3">
                  {passbookData.map(renderPassbookCard)}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="date-wise" className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <h3 className="text-base sm:text-lg font-semibold">
                  Date-wise All Nondhs
                </h3>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <SNoFilterComponent />
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <Label htmlFor="date-filter" className="text-sm whitespace-nowrap">Filter by Date:</Label>
                    <Input
                      id="date-filter"
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-full sm:w-40"
                    />
                    <Button
                    onClick={handleExportDateWise}
                    className="flex items-center gap-2 w-full sm:w-auto"
                    variant="outline"
                    size="sm"
                  >
                    <Download className="w-4 h-4" />
                    Export Date-wise
                  </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {dateWiseFilteredData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">
                    {dateFilter || sNoFilter ? 
                      'No nondhs found for selected filters' : 
                      'No nondh details available'
                    }
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden lg:block rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Nondh No.</TableHead>
                          <TableHead>Affected S.No</TableHead>
                          <TableHead>Nondh Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Show in Output</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dateWiseFilteredData.map((nondh, index) => (
                          <TableRow key={nondh.id || index}>
                            <TableCell>{formatDate(nondh.date)}</TableCell>
                            <TableCell>{nondh.nondhNumber}</TableCell>
                            <TableCell>{nondh.affectedSNos || nondh.sNo}</TableCell>
                            <TableCell>{getNondhTypeDisplay(nondh.type)}</TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded text-xs ${getStatusColorClass(nondh.status)}`}
                              >
                                {getStatusDisplayName(nondh.status)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {nondh.showInOutput ? (
                                <span className="text-green-600 text-sm">Yes</span>
                              ) : (
                                <span className="text-red-600 text-sm">No</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="lg:hidden space-y-3">
                    {dateWiseFilteredData.map(renderDateWiseCard)}
                  </div>
                </>
              )}
            </div>
          </TabsContent>
          </Tabs>

         <div className="flex flex-col sm:flex-row sm:justify-center items-stretch sm:items-center gap-4 mt-6 pt-4 border-t">
  {role === 'reviewer' ? (
    landRecordStatus === 'review' && (
      <Button 
        onClick={async () => {
          if (!recordId || !user?.primaryEmailAddress?.emailAddress) return;
          try {
            await LandRecordService.updateLandRecord(recordId, { status: 'query' });
            await createActivityLog({
              user_email: user.primaryEmailAddress.emailAddress,
              land_record_id: recordId,
              step: 6,
              chat_id: null,
              description: 'Reviewer marked the review as complete.'
            });
            setLandRecordStatus('query');
            toast({ title: "Review marked as complete." });
            refreshStatus();
            router.push('/land-master');
          } catch (error) {
            console.error('Error marking review complete:', error);
            toast({ title: "Error marking review complete", variant: "destructive" });
          }
        }}
        className="w-full sm:w-auto flex items-center gap-2"
        size="sm"
      >
        Mark Review Complete
      </Button>
    )
  ) : (role === 'manager' || role === 'admin' || role === 'executioner') && (
    landRecordStatus !== 'review' && (
      <Button 
        onClick={async () => {
          if (!recordId || !user?.primaryEmailAddress?.emailAddress) return;
          try {
            await LandRecordService.updateLandRecord(recordId, { status: 'review' });
            await createActivityLog({
              user_email: user.primaryEmailAddress.emailAddress,
              land_record_id: recordId,
              step: 6,
              chat_id: null,
              description: `${role.charAt(0).toUpperCase() + role.slice(1)} pushed the record for review. Status changed to Review.`
            });
            setLandRecordStatus('review'); // UPDATE LOCAL STATE
            toast({ title: "Record pushed for review. Status changed to Review." });
            refreshStatus();
            router.push('/land-master');
          } catch (error) {
            console.error('Error pushing for review:', error);
            toast({ title: "Error pushing for review", variant: "destructive" });
          }
        }}
        className="w-full sm:w-auto flex items-center gap-2"
        size="sm"
      >
        Push for Review
      </Button>
    )
  )}
  {/* END NEW SECTION */}
  {(role === 'manager' || role === 'admin' || role === 'reviewer' || role === 'executioner') && (
    <Button 
      onClick={() => setShowCommentModal(true)}
      className="w-full sm:w-auto flex items-center gap-2"
      size="sm"
      variant="outline"
    >
      <Send className="w-4 h-4" />
      {role === 'reviewer' 
        ? 'Send Message to Manager/Executioner'
        : role === 'executioner'
        ? 'Send Message to Manager/Reviewer'
        : 'Send Message to Executioner/Reviewer'}
    </Button>
  )}
  
  
  <Button 
    onClick={handleCompleteProcess}
    className="w-full sm:w-auto"
    size="sm"
  >
    Back to Land Master
  </Button>
</div>
        </CardContent>
      </Card>

      {/* Comment Modal */}
      {showCommentModal && (
        <CommentModal
          isOpen={showCommentModal}
          onClose={() => setShowCommentModal(false)}
          onSubmit={handleSendComment}
          loading={sendingComment}
          step={6}
          userRole={role || ''}
          landRecordStatus={landRecordStatus} 
        />
      )}
    </>
  )
}