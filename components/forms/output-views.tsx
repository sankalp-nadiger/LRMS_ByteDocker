"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, Eye, Filter, Calendar, AlertTriangle, Send, X, Loader2 } from "lucide-react"
import { useLandRecord } from "@/contexts/land-record-context"
import { convertToSquareMeters, LandRecordService } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
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
}

// Add this interface at the top of the file, after the imports
interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface NondhDetail {
  id: string
  nondhId: string
  sNo: string
  type: string
  subType?: string
  vigat?: string
  invalidReason?: string
  oldOwner?: string
  status: 'valid' | 'invalid' | 'nullified'
  hukamStatus?: 'valid' | 'invalid' | 'nullified'
  hukamInvalidReason?: string
  hukamType?: string
  affectedNondhNo?: string
  showInOutput: boolean
  hasDocuments: boolean
  docUploadUrl?: string
  createdAt: string
  date: string
  nondhNumber?: number
  affectedSNos?: string[]
  nondhDocUrl?: string
  docUrl?: string
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
  const modalTitle = !userRole 
  ? `Send Message - Step ${step}`
  : userRole === 'manager' || userRole === 'admin'
  ? `Send Message to Executioner/Reviewer - Step ${step}`
  : userRole === 'executioner'
  ? `Send Message to Manager/Reviewer - Step ${step}`
  : `Send Message - Step ${step}`;
  
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

  const { landBasicInfo, yearSlabs, panipatraks: contextPanipatraks, nondhs, nondhDetails, recordId} = useLandRecord()
  const { toast } = useToast()
  const router = useRouter()
  const [passbookData, setPassbookData] = useState<PassbookEntry[]>([])
  const [filteredNondhs, setFilteredNondhs] = useState<NondhDetail[]>([])
  const [dateFilter, setDateFilter] = useState("")
  const [sNoFilter, setSNoFilter] = useState("")
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const { user } = useUser()
const { role } = useUserRole()
const [showCommentModal, setShowCommentModal] = useState(false)
const [sendingComment, setSendingComment] = useState(false)
const [landRecordStatus, setLandRecordStatus] = useState<string>('');
const [panipatraksState, setPanipatraksState] = useState<any[]>(contextPanipatraks || [])
const [expandedSlabs, setExpandedSlabs] = useState<Record<string, boolean>>({})
const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({})

// Fetch panipatraks data
useEffect(() => {
    const fetchPanipatraks = async () => {
      // If we already have panipatraks in context, use them
      if (contextPanipatraks && contextPanipatraks.length > 0) {
        setPanipatraksState(contextPanipatraks);
        return;
      }
      
      // Otherwise fetch from DB
      if (!recordId) return;
      
      try {
        const { data, error } = await LandRecordService.getPanipatraks(recordId);
        if (error) throw error;
        
        setPanipatraksState(data || []);
        
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
  }, [recordId, yearSlabs, contextPanipatraks]); 

  // Add this function before the return statement, after other functions
const refreshStatus = () => {
  // This would typically refetch the land record status
  const fetchStatus = async () => {
    if (!recordId) return;
    try {
      const { data, error } = await LandRecordService.getLandRecord(recordId);
      if (error) throw error;
      if (data) {
        setLandRecordStatus(data.status || '');
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
    }
  };
  fetchStatus();
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
    await exportPanipatraksToExcel(panipatraksState, landBasicInfo, yearSlabs);
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
    const dateWiseData = await getFilteredByDate();
    await exportDateWiseToExcel(dateWiseData, landBasicInfo);
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

  // Handle comment submission
// Update the handleSendComment function to handle potential API issues
const handleSendComment = async (message: string, recipients: string[], isReviewComplete: boolean = false) => {
  if (!recordId || !user?.primaryEmailAddress?.emailAddress) {
    toast({ title: "Missing user information", variant: "destructive" });
    return;
  }

  try {
    setSendingComment(true);

    const toEmails = recipients.length > 0 ? recipients : null;

    // Try the createChat function with different parameter formats
    let chatData;
    try {
      // Try with the current format
      chatData = await createChat({
        from_email: user.primaryEmailAddress.emailAddress,
        to_email: toEmails,
        message: message,
        land_record_id: recordId,
        step: 6
      });
    } catch (chatError) {
      console.error('Chat creation failed with current format:', chatError);
      // Try alternative format
      chatData = await createChat({
        user_email: user.primaryEmailAddress.emailAddress,
        recipients: toEmails,
        message: message,
        land_record_id: recordId,
        step: 6
      });
    }

    const recipientText = toEmails 
      ? `to ${toEmails.length} recipient(s)` 
      : 'to all relevant users';

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
        await LandRecordService.updateLandRecord(recordId, { status: 'completed' });
        
        await createActivityLog({
          user_email: user.primaryEmailAddress.emailAddress,
          land_record_id: recordId,
          step: 6,
          chat_id: null,
          description: 'Reviewer marked the review as complete.'
        });

        setLandRecordStatus('completed');
        toast({ title: "Review marked as complete." });
      } else {
        // Manager/Admin/Executioner pushing for review
        await LandRecordService.updateLandRecord(recordId, { status: 'review' });
        
        await createActivityLog({
          user_email: user.primaryEmailAddress.emailAddress,
          land_record_id: recordId,
          step: 6,
          chat_id: null,
          description: `${role.charAt(0).toUpperCase() + role.slice(1)} pushed the record for review.`
        });

        setLandRecordStatus('review');
        toast({ title: "Record pushed for review." });
      }
    } else {
      toast({ title: "Message sent successfully" });
    }

    setShowCommentModal(false);
  } catch (error) {
    console.error('Error sending comment:', error);
    toast({ 
      title: "Error sending message", 
      description: error instanceof Error ? error.message : "Please try again",
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
      description: 'Failed to generate integrated document. Please try again.',
      variant: 'destructive'
    });
  } finally {
    setIsGeneratingPDF(false);
  }
}

const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN');
  };
  
  //helper function to get unique S.Nos with types
 const getUniqueSNosWithTypes = () => {
  const sNoSet = new Set<string>();
  const sNoTypeMap = new Map<string, string>();
  
  // From nondhs (affected S.Nos)
  nondhs.forEach(nondh => {
    if (nondh.affectedSNos && Array.isArray(nondh.affectedSNos)) {
      nondh.affectedSNos.forEach(sNoData => {
        try {
          let sNoObj;
          if (typeof sNoData === 'string' && sNoData.startsWith('{')) {
            sNoObj = JSON.parse(sNoData);
          } else if (typeof sNoData === 'object') {
            sNoObj = sNoData;
          } else {
            sNoObj = { number: sNoData.toString(), type: 's_no' };
          }
          
          const sNoKey = `${sNoObj.number}`;
          sNoSet.add(sNoKey);
          sNoTypeMap.set(sNoKey, sNoObj.type || 's_no');
        } catch (e) {
          const sNoKey = sNoData.toString();
          sNoSet.add(sNoKey);
          sNoTypeMap.set(sNoKey, 's_no');
        }
      });
    }
  });
  
  // From nondhDetails (individual S.Nos)
  nondhDetails.forEach(detail => {
    if (detail.sNo) {
      sNoSet.add(detail.sNo);
      if (!sNoTypeMap.has(detail.sNo)) {
        sNoTypeMap.set(detail.sNo, 's_no');
      }
    }
  });
  
  // From passbook data
  passbookData.forEach(entry => {
    if (entry.sNo) {
      sNoSet.add(entry.sNo);
      if (!sNoTypeMap.has(entry.sNo)) {
        sNoTypeMap.set(entry.sNo, 's_no');
      }
    }
  });
  
  return Array.from(sNoSet).map(sNo => ({
    value: sNo,
    type: sNoTypeMap.get(sNo) || 's_no',
    label: `${sNo} (${sNoTypeMap.get(sNo) === 'block_no' ? 'Block' : 
                     sNoTypeMap.get(sNo) === 're_survey_no' ? 'Re-survey' : 'Survey'})`
  })).sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
};

  // Helper function to format affected S.Nos properly
const formatAffectedSNos = (affectedSNos: any): string => {
  if (!affectedSNos) return '-';
  
  try {
    let sNos: Array<{number: string, type: string}> = [];
    
    // Handle if it's already an array of objects
    if (Array.isArray(affectedSNos)) {
      // Check if first element is already an object with number/type properties
      if (affectedSNos.length > 0 && typeof affectedSNos[0] === 'object' && affectedSNos[0].number && affectedSNos[0].type) {
        sNos = affectedSNos;
      } 
      // Handle if it's an array of JSON strings
      else if (typeof affectedSNos[0] === 'string' && affectedSNos[0].startsWith('{')) {
        sNos = affectedSNos.map(sNo => {
          try {
            return JSON.parse(sNo);
          } catch {
            return { number: sNo, type: 's_no' };
          }
        });
      }
      // Handle simple array of strings
      else {
        sNos = affectedSNos.map(sNo => ({ number: sNo.toString(), type: 's_no' }));
      }
    }
    // Handle if it's a string (could be JSON array or single JSON object)
    else if (typeof affectedSNos === 'string') {
      // Try to parse JSON array
      if (affectedSNos.startsWith('[')) {
        try {
          sNos = JSON.parse(affectedSNos);
        } catch {
          // If not JSON array, try to parse as single JSON object
          try {
            const singleObj = JSON.parse(affectedSNos);
            sNos = [singleObj];
          } catch {
            // If not JSON at all, treat as comma-separated values
            return affectedSNos.split(',').map(s => s.trim()).join(', ');
          }
        }
      } 
      // Try to parse single JSON object
      else if (affectedSNos.startsWith('{')) {
        try {
          const singleObj = JSON.parse(affectedSNos);
          sNos = [singleObj];
        } catch {
          // If not JSON, treat as simple string
          return affectedSNos;
        }
      }
      // Simple comma-separated string
      else {
        return affectedSNos.split(',').map(s => s.trim()).join(', ');
      }
    }
    // Handle if it's a single object
    else if (typeof affectedSNos === 'object' && affectedSNos.number && affectedSNos.type) {
      sNos = [affectedSNos];
    }
    
    // Format the S.Nos nicely with type labels
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
const getPrimarySNoType = (affectedSNos: string[]): string => {
  if (!affectedSNos || affectedSNos.length === 0) return 's_no';
  
  // Priority order: s_no > block_no > re_survey_no
  const priorityOrder = ['s_no', 'block_no', 're_survey_no'];
  
  // Parse the stringified JSON objects to get the actual types
  const types = affectedSNos.map(sNoStr => {
    try {
      const parsed = JSON.parse(sNoStr);
      return parsed.type || 's_no';
    } catch (e) {
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
  const typeA = getPrimarySNoType(nondhA.affectedSNos);
  const typeB = getPrimarySNoType(nondhB.affectedSNos);
  
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
      case 'valid': return 'Pramanik'
      case 'invalid': return 'Radd'
      case 'nullified': return 'Na manjoor'
      default: return status
    }
  };

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

// Enhanced function to fetch detailed nondh information including document URLs
const fetchDetailedNondhInfo = async (nondhDetails: NondhDetail[]) => {
  try {
    const enhancedDetails = await Promise.all(
      nondhDetails.map(async (detail) => {
        let nondhDocUrl = null;
        let affectedSNosData = null;
        let hukamType = detail.hukamType || detail.subType || null;
        
        // Only try to fetch from database if we have a valid nondhId
        if (detail.nondhId) {
          try {
            // Get nondh document URL from nondh table
            const { data: nondhData, error: nondhError } = await supabase
              .from('nondhs')
              .select('nondh_doc_url, affected_s_nos')
              .eq('id', detail.nondhId)
              .maybeSingle();

            if (!nondhError && nondhData) {
              nondhDocUrl = nondhData.nondh_doc_url;
              affectedSNosData = nondhData.affected_s_nos;
            } else if (nondhError) {
              console.warn(`Error fetching nondh data for ${detail.nondhId}:`, nondhError);
            }
          } catch (error) {
            console.warn(`Exception fetching nondh data for ${detail.nondhId}:`, error);
          }
        }

        let docUploadUrl = detail.docUploadUrl || null;
        let hasDocuments = detail.hasDocuments;
        
        // Only try to fetch detail data if we have a valid detail ID
        if (detail.id) {
          try {
            // Get detail document URL and hukam_type from nondh_details table
            const { data: detailData, error: detailError } = await supabase
              .from('nondh_details')
              .select('doc_upload_url, has_documents, hukam_type')
              .eq('nondh_id', detail.nondhId)
              .maybeSingle();

            if (!detailError && detailData) {
              console.log('Detail data fetched:', detailData);
              
              // Update hasDocuments from database if available
              if (detailData.has_documents !== undefined) {
                hasDocuments = detailData.has_documents;
              }
              
              // Get hukam_type from database
              if (detailData.hukam_type) {
                hukamType = detailData.hukam_type;
              }
              
              const rawDocUrl = detailData.doc_upload_url;
              console.log('Raw doc URL from DB:', rawDocUrl);
              
              // Simplified processing - just use the text as-is if it exists
              if (rawDocUrl && rawDocUrl.trim() !== '') {
                docUploadUrl = rawDocUrl.trim();
                hasDocuments = true; // Force to true if we have a URL
                console.log('Set docUploadUrl to:', docUploadUrl);
              }
            } else if (detailError) {
              console.warn(`Error fetching detail data for ${detail.id}:`, detailError);
            }
          } catch (error) {
            console.warn(`Exception fetching detail data for ${detail.id}:`, error);
          }
        }

        console.log('Final result for nondh:', {
          id: detail.id,
          hasDocuments,
          docUploadUrl,
          nondhDocUrl,
          hukamType
        });

        return {
          ...detail,
          nondhDocUrl: nondhDocUrl,
          docUploadUrl: docUploadUrl,
          hasDocuments: hasDocuments,
          affectedSNos: affectedSNosData || detail.affectedSNos,
          hukamType: hukamType // Include hukamType in the result
        };
      })
    );

    return enhancedDetails;
  } catch (error) {
    console.error('Error fetching detailed nondh info:', error);
    return nondhDetails;
  }
};

  const safeNondhNumber = (nondh: any): string => {
  return nondh.number ? nondh.number.toString() : '0';
};

  useEffect(() => {
    fetchPassbookData()
    generateFilteredNondhs()
  }, [yearSlabs, contextPanipatraks, nondhs, nondhDetails, sNoFilter])

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

  const fetchPassbookData = async () => {
  try {
    console.log('Starting to fetch passbook data...');
    
    // Get all nondh detail IDs from nondhDetails context
    const nondhDetailIds = nondhDetails.map(detail => detail.id);
    console.log('nondhDetails IDs from context:', nondhDetailIds);

    if (nondhDetailIds.length === 0) {
      console.log('No nondh details found in context');
      setPassbookData([]);
      return;
    }

    // First, let's find the nondh_ids from our context nondhDetails
    const nondhIds = nondhDetails.map(detail => detail.nondhId);
    console.log('Nondh IDs from context:', nondhIds);

    // Method 1: Try to match using the context IDs directly
    let { data: ownerRelations, error: relationsError } = await supabase
      .from('nondh_owner_relations')
      .select(`
        owner_name,
        s_no,
        acres,
        gunthas,
        square_meters,
        area_unit,
        is_valid,
        created_at,
        nondh_detail_id
      `)
      .in('nondh_detail_id', nondhDetailIds)
      .or('is_valid.eq.true,is_valid.eq.TRUE');

    console.log('Direct match results:', ownerRelations?.length || 0);

    // Method 2: If no direct match, try to find via nondh_details table
    if (!ownerRelations || ownerRelations.length === 0) {
      console.log('No direct match found, trying to find via nondh_details...');
      
      // Get all nondh_details that belong to our nondhs
      const { data: allNondhDetails, error: detailsError } = await supabase
        .from('nondh_details')
        .select('id, nondh_id')
        .in('nondh_id', nondhIds);

      console.log('All nondh_details for our nondhs:', allNondhDetails);

      if (allNondhDetails && allNondhDetails.length > 0) {
        const allDetailIds = allNondhDetails.map(detail => detail.id);
        console.log('All detail IDs for our nondhs:', allDetailIds);

        // Now fetch owner relations for all these details
        const { data: allOwnerRelations, error: allRelationsError } = await supabase
          .from('nondh_owner_relations')
          .select(`
            owner_name,
            s_no,
            acres,
            gunthas,
            square_meters,
            area_unit,
            is_valid,
            created_at,
            nondh_detail_id
          `)
          .in('nondh_detail_id', allDetailIds)
          .or('is_valid.eq.true,is_valid.eq.TRUE');

        ownerRelations = allOwnerRelations;
        relationsError = allRelationsError;
        console.log('Found owner relations via nondh lookup:', ownerRelations?.length || 0);
      }
    }

    if (relationsError) {
      console.error('Error fetching owner relations:', relationsError);
      throw relationsError;
    }

    if (!ownerRelations || ownerRelations.length === 0) {
      console.log('No owner relations found for any method');
      setPassbookData([]);
      return;
    }

    // Process the data - we need to map back to get nondh numbers
    const passbookEntries = [];

    for (const relation of ownerRelations) {
      // Find which nondh this detail belongs to AND get the date
      const { data: detailInfo, error: detailError } = await supabase
        .from('nondh_details')
        .select('nondh_id, date')
        .eq('id', relation.nondh_detail_id)
        .single();

      if (detailError) {
        console.warn('Could not find detail info for:', relation.nondh_detail_id);
        continue;
      }

      // Use the date from nondh_details, fallback to created_at
      const relevantDate = detailInfo.date || relation.created_at;

      // Find the nondh number from context
      const nondh = nondhs.find(n => n.id === detailInfo.nondh_id);
      const nondhNumber = nondh ? safeNondhNumber(nondh) : 0;

      // Calculate area
      let area = 0;
      if (relation.area_unit === 'acre_guntha') {
        const totalGunthas = (relation.acres || 0) * 40 + (relation.gunthas || 0);
        area = convertToSquareMeters(totalGunthas, 'guntha');
      } else {
        area = relation.square_meters || 0;
      }

      console.log(`Processing: Owner ${relation.owner_name}, Nondh ${nondhNumber}, Area ${area}, Date ${relevantDate}`);

      const entry = {
        year: new Date(relevantDate).getFullYear(),
        ownerName: relation.owner_name || '',
        area,
        sNo: relation.s_no || '',
        nondhNumber: nondh ? safeNondhNumber(nondh) : '0',
        createdAt: relevantDate || '',
        // Add affected S.Nos for filtering
        affectedSNos: nondh ? formatAffectedSNos(nondh.affectedSNos) : relation.s_no || ''
      };

      // Apply S.No filter
      if (!sNoFilter || 
          entry.sNo === sNoFilter || 
          entry.affectedSNos.includes(sNoFilter)) {
        passbookEntries.push(entry);
      }
    }

    console.log('Final passbook entries:', passbookEntries);
    setPassbookData(passbookEntries.sort((a, b) => a.year - b.year));
    
  } catch (error) {
    console.error('Error in fetchPassbookData:', error);
    toast({
      title: 'Error',
      description: 'Failed to fetch passbook data',
      variant: 'destructive'
    });
  }
};

  const generateFilteredNondhs = async () => {
  // Only show nondhs that are marked for output
  let outputNondhs = nondhDetails
    .filter((detail) => detail.showInOutput)
    .map((detail) => {
      const nondh = nondhs.find((n) => n.id === detail.nondhId)
      return {
        ...detail,
        nondhNumber: nondh?.number || 0,
        affectedSNos: nondh?.affectedSNos || [detail.sNo],
        createdAt: detail.createdAt || new Date().toISOString().split("T")[0],
        docUploadUrl: detail.docUploadUrl,
        hasDocuments: detail.hasDocuments
      } as NondhDetail
    })

  // Apply S.No filter
  if (sNoFilter) {
    outputNondhs = outputNondhs.filter(nondh => {
      // Check if the filter matches any affected S.No
      const affectedSNosStr = formatAffectedSNos(nondh.affectedSNos);
      return affectedSNosStr.includes(sNoFilter) || nondh.sNo === sNoFilter;
    });
  }

  // Fetch detailed info including document URLs
  const enhancedNondhs = await fetchDetailedNondhInfo(outputNondhs);
  
  // Format affected S.Nos for display
  const formattedNondhs = enhancedNondhs.map(nondh => ({
    ...nondh,
    affectedSNos: formatAffectedSNos(nondh.affectedSNos)
  }));
  
  // Sort and set the filtered nondhs
  setFilteredNondhs(formattedNondhs.sort(sortNondhsBySNoType));
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
        nondhType: nondh?.type || detail.type,
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
        getNondhTypeDisplay(row.nondhType) || '-',
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

  const getFilteredByDate = async () => {
  let filteredDetails = nondhDetails;
  
  if (dateFilter) {
    // Change from createdAt to date
    filteredDetails = nondhDetails.filter((detail) => detail.date?.includes(dateFilter));
  }
  
  let mappedDetails = filteredDetails.map((detail) => {
    const nondh = nondhs.find((n) => n.id === detail.nondhId)
    return {
      ...detail,
      nondhNumber: nondh?.number || 0,
      affectedSNos: nondh?.affectedSNos || [detail.sNo],
      // Keep both date and createdAt for fallback
      date: detail.date || detail.createdAt,
      createdAt: detail.createdAt || new Date().toISOString().split("T")[0]
    } as NondhDetail
  });

  // Apply S.No filter
  if (sNoFilter) {
    mappedDetails = mappedDetails.filter(nondh => {
      const affectedSNosStr = formatAffectedSNos(nondh.affectedSNos);
      return affectedSNosStr.includes(sNoFilter) || nondh.sNo === sNoFilter;
    });
  }

  // Fetch detailed info including document URLs
  const enhancedDetails = await fetchDetailedNondhInfo(mappedDetails);
  
  // Format affected S.Nos for display
  const formattedDetails = enhancedDetails.map(nondh => ({
    ...nondh,
    affectedSNos: formatAffectedSNos(nondh.affectedSNos)
  }));
  
  return formattedDetails.sort(sortNondhsBySNoType);
}

  const handleCompleteProcess = () => {
    toast({ title: "Land record process completed successfully!" })
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
            <span className="text-muted-foreground">Nondh:</span>
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
          <span className="text-muted-foreground">S.No:</span>
          <div className="font-medium">{entry.sNo}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Area:</span>
          <div className="font-medium">{entry.area?.toFixed(2)} sq.m</div>
        </div>
      </div>
      
      {/* Add affected S.Nos display */}
      <div>
        <span className="text-muted-foreground text-sm">Affected S.No:</span>
        <div className="text-sm font-medium">{entry.affectedSNos || entry.sNo}</div>
      </div>
    </div>
  </Card>
)

  const renderDateWiseCard = (nondh: NondhDetail, index: number) => {    

  return (
    <Card key={index} className="p-4">
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="font-medium text-sm">Nondh #{nondh.nondhNumber}</div>
            <div className="text-muted-foreground text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDisplayDate(nondh.date || nondh.createdAt)}
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
            <span className="text-muted-foreground">Type:</span>
            <div className="font-medium">{getNondhTypeDisplay(nondh.type)}</div>
          </div>
        </div>
      </div>
    </Card>
  )
}

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

// Helper function to get year periods
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

  return (
  <Card className="w-full max-w-none">
    <CardHeader>
      <CardTitle className="text-lg sm:text-xl">Step 6: Output Views & Reports</CardTitle>
    </CardHeader>
    <CardContent className="p-4 sm:p-6">
  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
    <h2 className="text-lg font-semibold">Reports & Documents</h2>
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
<Tabs defaultValue="nondh-table" className="w-full">
  <TabsList className="grid w-full grid-cols-5 mb-4">
    <TabsTrigger value="nondh-table" className="text-xs sm:text-sm">Nondh Table</TabsTrigger>
    <TabsTrigger value="query-list" className="text-xs sm:text-sm">Query List</TabsTrigger>
    <TabsTrigger value="panipatraks" className="text-xs sm:text-sm">Panipatraks</TabsTrigger>
    <TabsTrigger value="passbook" className="text-xs sm:text-sm">Passbook</TabsTrigger>
    <TabsTrigger value="date-wise" className="text-xs sm:text-sm">Date-wise</TabsTrigger>
  </TabsList>

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
  const slabPanipatraks = panipatraksState.filter(p => p.slabId === slab.id);
            const periods = getYearPeriods(slab.startYear, slab.endYear);
            const hasSameForAll = slabPanipatraks.length > 0 && 
                                 slabPanipatraks.every(p => p.sameForAll === true);

            if (hasSameForAll) {
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

<TabsContent value="nondh-table" className="space-y-4">
  <div className="flex flex-col gap-4">
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
  </div>

  {(() => {
  const [allNondhsDataState, setAllNondhsDataState] = useState([]);
  const [isLoadingNondhTable, setIsLoadingNondhTable] = useState(true);

  useEffect(() => {
    const loadAllNondhsData = async () => {
      setIsLoadingNondhTable(true);
      
      let mappedData = nondhDetails.map((detail) => {
        const nondh = nondhs.find((n) => n.id === detail.nondhId)
        return {
          ...detail,
          nondhNumber: nondh?.number || 0,
          affectedSNos: formatAffectedSNos(nondh?.affectedSNos || [detail.sNo]),
          nondhType: nondh?.type || detail.type,
          hukamType: nondh?.subType || detail.subType || '-'
        }
      }).filter(nondh => {
        if (!sNoFilter) return true;
        return nondh.affectedSNos.includes(sNoFilter) || nondh.sNo === sNoFilter;
      });

      // Fetch document URLs just like in query list
      const enhancedData = await fetchDetailedNondhInfo(mappedData);
// Format affected S.Nos after fetching enhanced data
const formattedData = enhancedData.map(nondh => ({
  ...nondh,
  affectedSNos: formatAffectedSNos(nondh.affectedSNos)
}));
const sortedData = formattedData.sort(sortNondhsBySNoType);

setAllNondhsDataState(sortedData);
      setIsLoadingNondhTable(false);
    };

    loadAllNondhsData();
  }, [nondhDetails, nondhs, sNoFilter]);

  if (isLoadingNondhTable) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">Loading nondh data...</p>
      </div>
    );
  }

  if (allNondhsDataState.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">
          {sNoFilter ? 'No nondhs found for selected S.No' : 'No nondh data available'}
        </p>
      </div>
    );
  }

  // Use allNondhsDataState instead of allNondhsData in the rest of the component
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden lg:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nondh No.</TableHead>
              <TableHead>Nondh</TableHead>
              <TableHead>Nondh Type</TableHead>
              <TableHead>Hukam Type</TableHead>
              <TableHead>Vigat</TableHead>
              <TableHead>Affected S.No</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allNondhsDataState.map((nondh, index) => (
              <TableRow key={index}>
                <TableCell>{nondh.nondhNumber}</TableCell>
                <TableCell className={!nondh.nondhDocUrl ? 'bg-red-100' : ''}>
                  {nondh.nondhDocUrl ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => viewDocument(nondh.nondhDocUrl!, `Nondh ${nondh.nondhNumber} Document`)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Document
                    </Button>
                  ) : (
                    <span className="text-red-600 font-medium">N/A</span>
                  )}
                </TableCell>
                <TableCell>{getNondhTypeDisplay(nondh.nondhType)}</TableCell>
                <TableCell>
  {nondh.nondhType === 'Hukam' ? (nondh.hukamType || '-') : '-'}
</TableCell>
                <TableCell className="max-w-xs truncate">{nondh.vigat || "-"}</TableCell>
                <TableCell>{nondh.affectedSNos}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColorClass(nondh.status)}`}>
                    {getStatusDisplayName(nondh.status)}
                  </span>
                </TableCell>
                <TableCell className="max-w-xs">
                  {nondh.invalidReason ? (
                    <span className="text-red-600 text-sm">{nondh.invalidReason}</span>
                  ) : (
                    "-"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {allNondhsDataState.map((nondh, index) => (
          <Card key={index} className="p-4">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="font-medium text-sm">Nondh #{nondh.nondhNumber}</div>
                  <div className="text-muted-foreground text-xs">
  Type: {nondh.nondhType}
  {nondh.nondhType === 'Hukam' && nondh.hukamType && nondh.hukamType !== '-' && (
    <span> - {nondh.hukamType}</span>
  )}
</div>
                </div>
                <Badge className={`text-xs ${getStatusColorClass(nondh.status)}`}>
                  {getStatusDisplayName(nondh.status)}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nondh:</span>
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
                  <div className="text-sm font-medium truncate">{nondh.vigat}</div>
                </div>
              )}
              
              {nondh.invalidReason && (
                <div className="space-y-1">
                  <span className="text-muted-foreground text-sm">Reason:</span>
                  <div className="text-sm font-medium text-red-600">{nondh.invalidReason}</div>
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

        <TabsContent value="query-list" className="space-y-4">
          <div className="flex flex-col gap-4">
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
    <TableHead>Nondh</TableHead>
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
          <div className="flex flex-col gap-4">
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
                <Button
        onClick={handleExportDateWise}
        className="flex items-center gap-2 w-full sm:w-auto"
        variant="outline"
        size="sm"
      >
        <Download className="w-4 h-4" />
        Export Date-wise
      </Button>
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
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {(() => {
              const [filteredData, setFilteredData] = useState<NondhDetail[]>([]);
              
              useEffect(() => {
                const loadFilteredData = async () => {
                  const data = await getFilteredByDate();
                  setFilteredData(data);
                };
                loadFilteredData();
              }, [dateFilter, sNoFilter, nondhDetails]);

              if (filteredData.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">
                      {dateFilter || sNoFilter ? 
                        'No nondhs found for selected filters' : 
                        'No nondh details available'
                      }
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
                          <TableHead>Date</TableHead>
                          <TableHead>Nondh No.</TableHead>
                          <TableHead>Affected S.No</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Show in Output</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.map((nondh, index) => (
                          <TableRow key={index}>
                            <TableCell>{formatDisplayDate(nondh.date || nondh.createdAt)}</TableCell>
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
                    {filteredData.map(renderDateWiseCard)}
                  </div>
                </>
              );
            })()}
          </div>
        </TabsContent>
      </Tabs>

    <div className="flex flex-col sm:flex-row sm:justify-center items-stretch sm:items-center gap-4 mt-6 pt-4 border-t">
  
  {/* Push for Review Button - Show for manager/admin/executioner when status is not 'review' */}
  {(role === 'manager' || role === 'admin' || role === 'executioner') && landRecordStatus !== 'review' && (
    <Button 
      onClick={async () => {
        if (!recordId || !user?.primaryEmailAddress?.emailAddress) {
          toast({ title: "Missing required information", variant: "destructive" });
          return;
        }
        try {
          console.log('Pushing record for review...');
          const { error } = await LandRecordService.updateLandRecord(recordId, { status: 'review' });
          if (error) throw error;
          
          await createActivityLog({
            user_email: user.primaryEmailAddress.emailAddress,
            land_record_id: recordId,
            step: 6,
            chat_id: null,
            description: `${role.charAt(0).toUpperCase() + role.slice(1)} pushed the record for review. Status changed to Review.`
          });
          
          setLandRecordStatus('review');
          toast({ title: "Record pushed for review. Status changed to Review." });
        } catch (error) {
          console.error('Error pushing for review:', error);
          toast({ 
            title: "Error pushing for review", 
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive" 
          });
        }
      }}
      className="w-full sm:w-auto flex items-center gap-2"
      size="sm"
    >
      Push for Review
    </Button>
  )}
  
 {/* Send Message Button - Show for all roles with dynamic text */}
<Button 
  onClick={() => setShowCommentModal(true)}
  className="w-full sm:w-auto flex items-center gap-2"
  size="sm"
  variant="outline"
>
  <Send className="w-4 h-4" />
  {role === 'manager' || role === 'admin' 
    ? 'Send Message to Executioner/Reviewer'
    : role === 'executioner'
    ? 'Send Message to Manager/Reviewer'
    : 'Send Message'
  }
</Button>

  {/* Complete Process Button */}
  <Button 
    onClick={handleCompleteProcess}
    className="w-full sm:w-auto"
    size="sm"
  >
    Complete Process
  </Button>
</div>
    </CardContent>

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
  </Card>
)
}