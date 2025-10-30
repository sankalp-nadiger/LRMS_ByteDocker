"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Send, X, Loader2 } from "lucide-react"
import { useLandRecord } from "@/contexts/land-record-context"
import { supabase, uploadFile } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { LandRecordService } from "@/lib/supabase"
import { useRouter } from "next/navigation";
import { promulgationData, getDistricts, getTalukas, getVillages, isPromulgation } from "@/lib/mock-data"
import { useStepFormData } from "@/hooks/use-step-form-data"
import type { LandBasicInfo } from "@/contexts/land-record-context"
import { useUser } from "@clerk/nextjs"
import { createActivityLog, createChat } from "@/lib/supabase"
import { useUserRole } from '@/contexts/user-context';
import { useRef } from 'react';

const initialFormData: LandBasicInfo = {
  district: "",
  taluka: "",
  village: "",
  area: { 
    value: 0, 
    unit: "sq_m",
    acres: 0,
    gunthas: 0,
    square_meters: 0
  },
  sNoType: "s_no",
  sNo: "",
  isPromulgation: false,
  blockNo: "",
  reSurveyNo: "",
  integrated712: "",
  integrated712FileName: ""
}

function isEqual(obj1: any, obj2: any) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

interface ValidationErrors {
  district?: string
  taluka?: string
  village?: string
  blockNo?: string
  reSurveyNo?: string
  integrated712?: string
  area?: string
}

interface AreaFieldsProps {
  area: { 
    value: number; 
    unit: 'acre_guntha' | 'sq_m';
    acres?: number;
    gunthas?: number;
    square_meters?: number;
  };
  onChange: (area: { 
    value: number; 
    unit: 'acre_guntha' | 'sq_m';
    acres?: number;
    gunthas?: number;
    square_meters?: number;
  }) => void;
  disabled?: boolean;
}

// Comment Modal Component
interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (message: string, recipients: string[]) => Promise<void>;
  loading?: boolean;
  step: number;
  onCloseButtonClick?: () => void;
}

const AreaFields = ({ area, onChange, disabled = false }: AreaFieldsProps) => {
  // Define constants
  const SQM_PER_GUNTHA = 101.17;
  const SQM_PER_ACRE = 4046.86;
  const GUNTHAS_PER_ACRE = 40;

  // Helper functions for conversions
  const convertToSquareMeters = (value: number, unit: string) => {
    if (unit === "acre") return value * SQM_PER_ACRE;
    if (unit === "guntha") return value * SQM_PER_GUNTHA;
    return value;
  };

  const convertFromSquareMeters = (sqm: number, unit: string) => {
    if (unit === "acre") return sqm / SQM_PER_ACRE;
    if (unit === "guntha") return sqm / SQM_PER_GUNTHA;
    return sqm;
  };

  // Calculate display values based on current area with rounded sq_m
  const displayValues = {
    sq_m: Math.round((area.value || 0) * 100) / 100, // Round to 2 decimal places
    acre: Math.floor(convertFromSquareMeters(area.value || 0, "acre")),
    guntha: Math.round(convertFromSquareMeters(area.value || 0, "guntha") % 40)
  };

  const handleSqmChange = (value: string) => {
    if (value === "") {
      onChange({
        ...area,
        value: 0,
        unit: "sq_m",
        acres: undefined,
        gunthas: undefined,
        square_meters: undefined
      });
      return;
    }

    const num = parseFloat(value);
    if (!isNaN(num)) {
      const totalAcres = convertFromSquareMeters(num, "acre");
      const acres = Math.floor(totalAcres);
      const remainingGuntha = Math.round((totalAcres - acres) * 40);
      
      onChange({
        ...area,
        value: num,
        unit: "sq_m",
        acres: acres,
        gunthas: remainingGuntha,
        square_meters: num
      });
    }
  };

  const handleAcreChange = (value: string) => {
    if (value === "") {
      const remainingSqm = area.gunthas ? Math.round(convertToSquareMeters(area.gunthas, "guntha") * 100) / 100 : undefined;
      onChange({
        ...area,
        value: remainingSqm || 0,
        unit: area.unit,
        acres: undefined,
        gunthas: area.gunthas,
        square_meters: remainingSqm
      });
      return;
    }

    const num = parseFloat(value);
    if (!isNaN(num)) {
      const guntha = area.gunthas || 0;
      const totalSqm = Math.round((convertToSquareMeters(num, "acre") + 
                      convertToSquareMeters(guntha, "guntha")) * 100) / 100; // Round to 2 decimal places
      onChange({ 
        ...area, 
        value: totalSqm,
        unit: area.unit,
        acres: num,
        gunthas: guntha,
        square_meters: totalSqm
      });
    }
  };

  const handleGunthaChange = (value: string) => {
    if (value === "") {
      const remainingSqm = area.acres ? Math.round(convertToSquareMeters(area.acres, "acre") * 100) / 100 : undefined;
      onChange({
        ...area,
        value: remainingSqm || 0,
        unit: area.unit,
        gunthas: undefined,
        acres: area.acres,
        square_meters: remainingSqm
      });
      return;
    }

    let num = parseFloat(value);
    if (!isNaN(num)) {
      if (num >= 40) {
        num = 39;
        // You might want to add toast here if needed
        console.warn("Guntha must be less than 40");
      }
      
      const acre = area.acres || 0;
      const totalSqm = Math.round((convertToSquareMeters(acre, "acre") + 
                      convertToSquareMeters(num, "guntha")) * 100) / 100; // Round to 2 decimal places
      onChange({ 
        ...area, 
        value: totalSqm,
        unit: area.unit,
        gunthas: num,
        acres: acre,
        square_meters: totalSqm
      });
    }
  };

  const formatValue = (value: number | undefined): string => {
    return value === undefined ? "" : value.toString();
  };

  return (
    <div className="space-y-4">
      {/* On mobile: Stack all fields vertically */}
      <div className="md:hidden space-y-4">
        {/* Unit Selector */}
        <div className="space-y-2 w-full">
          <Label>Unit</Label>
          <Select
            value={area.unit}
            onValueChange={(unit) => {
              const newUnit = unit as 'acre_guntha' | 'sq_m';
              onChange({
                ...area,
                unit: newUnit,
                value: area.value || 0
              });
            }}
          >
            <SelectTrigger className="w-full px-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="acre_guntha">Acre-Guntha</SelectItem>
              <SelectItem value="sq_m">Square Meters</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Primary Field */}
        {area.unit === "sq_m" ? (
          <div className="space-y-2 w-full">
            <Label>Square Meters</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formatValue(displayValues.sq_m)}
              onChange={(e) => handleSqmChange(e.target.value)}
              placeholder="Enter square meters"
              className="w-full"
              disabled={disabled}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2 w-full">
              <Label>Acres</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formatValue(displayValues.acre)}
                onChange={(e) => handleAcreChange(e.target.value)}
                placeholder="Enter acres"
                className="w-full"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 w-full">
              <Label>Gunthas</Label>
              <Input
                type="number"
                min="0"
                max="39"
                step="1"
                value={formatValue(displayValues.guntha)}
                onChange={(e) => handleGunthaChange(e.target.value)}
                placeholder="Enter gunthas (0-39)"
                className="w-full"
                disabled={disabled}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          </>
        )}

        {/* Secondary Fields */}
        {area.unit === "sq_m" ? (
          <>
            <div className="space-y-2 w-full">
              <Label>Acres</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formatValue(displayValues.acre)}
                onChange={(e) => handleAcreChange(e.target.value)}
                placeholder="Enter or view acres"
                className="w-full bg-blue-50 border-blue-200"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 w-full">
              <Label>Gunthas</Label>
              <Input
                type="number"
                min="0"
                max="39"
                step="1"
                value={formatValue(displayValues.guntha)}
                onChange={(e) => handleGunthaChange(e.target.value)}
                placeholder="Enter gunthas (0-39)"
                className="w-full bg-blue-50 border-blue-200"
                disabled={disabled}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          </>
        ) : (
          <div className="space-y-2 w-full">
            <Label>Square Meters</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formatValue(displayValues.sq_m)}
              onChange={(e) => handleSqmChange(e.target.value)}
              placeholder="Enter or view sq. meters"
              className="w-full bg-blue-50 border-blue-200"
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* On desktop: Original single-row layout with better spacing */}
      <div className="hidden md:flex items-end gap-6">
        {/* Unit Selector */}
        <div className="space-y-2 w-[140px] flex-shrink-0">
          <Label>Unit</Label>
          <Select
            value={area.unit}
            onValueChange={(unit) => {
              const newUnit = unit as 'acre_guntha' | 'sq_m';
              onChange({
                ...area,
                unit: newUnit,
                value: area.value || 0
              });
            }}
          >
            <SelectTrigger className="w-[140px] px-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="acre_guntha">Acre-Guntha</SelectItem>
              <SelectItem value="sq_m">Square Meters</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Primary Fields */}
        {area.unit === "sq_m" ? (
          <div className="space-y-2 min-w-[150px] flex-1">
            <Label>Square Meters</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formatValue(displayValues.sq_m)}
              onChange={(e) => handleSqmChange(e.target.value)}
              placeholder="Enter square meters"
              className="w-full"
              disabled={disabled}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2 min-w-[120px] flex-1">
              <Label>Acres</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formatValue(displayValues.acre)}
                onChange={(e) => handleAcreChange(e.target.value)}
                placeholder="Enter acres"
                className="w-full"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 min-w-[100px] flex-1">
              <Label>Gunthas</Label>
              <Input
                type="number"
                min="0"
                max="39"
                step="1"
                value={formatValue(displayValues.guntha)}
                onChange={(e) => handleGunthaChange(e.target.value)}
                placeholder="Enter gunthas (0-39)"
                className="w-full"
                disabled={disabled}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          </>
        )}

        {/* Secondary Fields */}
        {area.unit === "sq_m" ? (
          <>
            <div className="space-y-2 min-w-[120px] flex-1">
              <Label>Acres</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formatValue(displayValues.acre)}
                onChange={(e) => handleAcreChange(e.target.value)}
                placeholder="Enter or view acres"
                className="w-full bg-blue-50 border-blue-200"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 min-w-[100px] flex-1">
              <Label>Gunthas</Label>
              <Input
                type="number"
                min="0"
                max="39"
                step="1"
                value={formatValue(displayValues.guntha)}
                onChange={(e) => handleGunthaChange(e.target.value)}
                placeholder="Enter gunthas (0-39)"
                className="w-full bg-blue-50 border-blue-200"
                disabled={disabled}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          </>
        ) : (
          <div className="space-y-2 min-w-[150px] flex-1">
            <Label>Square Meters</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formatValue(displayValues.sq_m)}
              onChange={(e) => handleSqmChange(e.target.value)}
              placeholder="Enter or view sq. meters"
              className="w-full bg-blue-50 border-blue-200"
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const CommentModal = ({ isOpen, onClose, onSubmit, loading = false, step, onCloseButtonClick }: CommentModalProps) => {
  const [message, setMessage] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const { user } = useUser();
  const inputRef = useRef<HTMLInputElement>(null);

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
    }
  }, [isOpen]);

  const handleCloseButtonClick = () => {
    if (onCloseButtonClick) {
      onCloseButtonClick(); // Call the special close handler
    } else {
      onClose(); // Fallback to regular close
    }
  };

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
    await onSubmit(message, selectedRecipients);
    setMessage('');
    setSelectedRecipients([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="flex-shrink-0 border-b bg-white sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <CardTitle>Assign to Executioner </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCloseButtonClick}
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
                placeholder="Type @ to assign to someone or send a thread to all..."
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
              Type @ to mention specific users
            </p>
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleCloseButtonClick}
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
              Send & Assign
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


export default function LandBasicInfoComponent() {
  const { 
    landBasicInfo, 
    setLandBasicInfo, 
    setCurrentStep,
    recordId, 
    setHasUnsavedChanges, 
    currentStep, 
    hasUnsavedChanges,
    setRecordId 
  } = useLandRecord()
  const { toast } = useToast()
  const router = useRouter()
  const { user } = useUser()
const [loading, setLoading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string>("")
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [duplicateRecord, setDuplicateRecord] = useState<any>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null)
  const [sendingComment, setSendingComment] = useState(false)
  const { role } = useUserRole();
   const [showNavigationModal, setShowNavigationModal] = useState(false);
  
  // Form data with proper initialization
  const { getStepData, updateStepData } = useStepFormData(currentStep)
  
  // Get form data from context or use initial values
  const contextData = getStepData()
  const formData = contextData.landBasicInfo 
    ? { ...initialFormData, ...contextData.landBasicInfo } 
    : initialFormData

  const district = formData.district
  const taluka = formData.taluka
  const village = formData.village

  useEffect(() => {
    if (!hasUnsavedChanges[currentStep]) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges, currentStep])

  // Prefill from previous info (if any)
  useEffect(() => {
  if (landBasicInfo && !isEqual(landBasicInfo, formData)) {
    updateStepData({
      landBasicInfo: {
        ...initialFormData,
        ...landBasicInfo
      }
    });
    
    if (landBasicInfo.integrated712FileName) {
      setUploadedFileName(landBasicInfo.integrated712FileName);
    } else if (landBasicInfo.integrated712) {
      const urlParts = landBasicInfo.integrated712.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const cleanFileName = fileName.includes('_') ? fileName.split('_').slice(1).join('_') : fileName;
      setUploadedFileName(cleanFileName || "Document uploaded");
    }
  }
}, [landBasicInfo]); // Only depend on landBasicInfo

  // Helper function to update form data
  const updateFormField = useCallback((updates: Partial<LandBasicInfo>) => {
    updateStepData({
      landBasicInfo: {
        ...formData,
        ...updates
      }
    })
    
    // Clear validation errors for updated fields
    const updatedErrors = { ...validationErrors }
    Object.keys(updates).forEach(field => {
      if (updatedErrors[field as keyof ValidationErrors]) {
        delete updatedErrors[field as keyof ValidationErrors]
      }
    })
    setValidationErrors(updatedErrors)
  }, [formData, updateStepData, validationErrors])

  // Validation function with proper area validation for both unit types
const validateForm = (): boolean => {
  const errors: ValidationErrors = {}
  let isValid = true

  if (!formData.district) {
    errors.district = "Please select a district"
    isValid = false
  }

  if (!formData.taluka) {
    errors.taluka = "Please select a taluka"
    isValid = false
  }

  if (!formData.village) {
    errors.village = "Please select a village"
    isValid = false
  }

  if (!formData.blockNo) {
    errors.blockNo = "Please enter Block No"
    isValid = false
  }

  if (formData.isPromulgation && !formData.reSurveyNo) {
    errors.reSurveyNo = "Please enter Re Survey No (required for Promulgation)"
    isValid = false
  }

  // if (!formData.integrated712) {
  //   errors.integrated712 = "Please upload Integrated 7/12 Document"
  //   isValid = false
  // }

  // Validate area based on unit type
  const hasValidArea = (() => {
    if (formData.area.unit === 'sq_m') {
      return formData.area.value && formData.area.value > 0;
    } else if (formData.area.unit === 'acre_guntha') {
      return (formData.area.acres && formData.area.acres > 0) || 
             (formData.area.gunthas && formData.area.gunthas > 0);
    }
    return false;
  })();

  if (!hasValidArea) {
    errors.area = "Please enter a valid area"
    isValid = false
  }

  setValidationErrors(errors)
  return isValid
}

  // Handlers for cascading selects
  const handleDistrictChange = (value: string) => {
    updateFormField({
      district: value,
      taluka: "",
      village: "",
      isPromulgation: false
    })
  }

  const handleTalukaChange = (value: string) => {
    updateFormField({
      taluka: value,
      village: "",
      isPromulgation: false
    })
  }

  const handleVillageChange = (value: string) => {
    const isProm = isPromulgation(formData.district, formData.taluka, value)
    updateFormField({
      village: value,
      isPromulgation: isProm
    })
  }

  // File upload with better error handling and filename sanitization
  const handleFileUpload = async (file: File) => {
    if (!file) return
    
    try {
      setLoading(true)
      
      const sanitizedFileName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '')
      
      const path = `${Date.now()}_${sanitizedFileName}`
      const url = await uploadFile(file, "land-documents", path)
      
      if (!url) throw new Error("Failed to upload file")

      updateFormField({ 
        integrated712: url,
        integrated712FileName: file.name
      })
      
      setUploadedFileName(file.name)
      toast({ title: "File uploaded successfully" })
      
    } catch (error) {
      console.error('File upload error:', error)
      toast({ 
        title: "Error uploading file", 
        description: "Please try again or contact support",
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  // Remove uploaded file
  const handleRemoveFile = () => {
    updateFormField({ 
      integrated712: "",
      integrated712FileName: ""
    })
    setUploadedFileName("")
  }

  // Handle comment submission
  const handleSendComment = async (message: string, recipients: string[]) => {
    if (!savedRecordId || !user?.primaryEmailAddress?.emailAddress) return;

    try {
      setSendingComment(true);

      const toEmails = recipients.length > 0 ? recipients : null;

      const chatData = await createChat({
        from_email: user.primaryEmailAddress.emailAddress,
        to_email: toEmails,
        message: message,
        land_record_id: savedRecordId,
        step: 1
      });

      const recipientText = toEmails 
        ? `to ${toEmails.length} recipient(s)` 
        : 'to all executioners';

      await createActivityLog({
        user_email: user.primaryEmailAddress.emailAddress,
        land_record_id: savedRecordId,
        step: 1,
        chat_id: chatData.id,
        description: `Sent message ${recipientText}: ${message}`
      });

      toast({ title: "Message sent successfully" });
      setShowCommentModal(false);
       setShowNavigationModal(true);
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

  // Handle navigation after comment
  const handleContinueToStep2 = () => {
    setCurrentStep(2);
    setShowCommentModal(false);
  };

  const handleBackToLandMaster = () => {
    router.push('/land-master');
    setShowCommentModal(false);
  };

  // Main submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      // Always save square meters value, regardless of unit chosen
      let areaValueInSqm = 0;
      
      if (formData.area.unit === 'acre_guntha') {
        areaValueInSqm = formData.area.sq_m || 0;
      } else if (formData.area.unit === 'sq_m') {
        areaValueInSqm = formData.area.value || 0;
      }

      // Check for duplicate records
      const duplicateCheckData = {
        district: formData.district,
        taluka: formData.taluka,
        village: formData.village,
        block_no: formData.blockNo,
        re_survey_no: formData.reSurveyNo || undefined,
        excludeId: landBasicInfo?.id
      }

      const { data: duplicate, error: duplicateError } = await LandRecordService.checkDuplicateLandRecord(duplicateCheckData)
      
      if (duplicateError) {
        console.error('Error checking duplicate:', duplicateError)
      }

      if (duplicate && duplicate.id !== landBasicInfo?.id) {
        setDuplicateRecord(duplicate)
        setShowDuplicateDialog(true)
        setLoading(false)
        return
      }

      // Map form data to database schema
      const landRecordData = {
        district: formData.district,
        taluka: formData.taluka,
        village: formData.village,
        area_value: areaValueInSqm,
        area_unit: 'sq_m',
        s_no_type: formData.sNoType || 's_no',
        s_no: formData.sNo || formData.blockNo,
        is_promulgation: formData.isPromulgation || false,
        block_no: formData.blockNo,
        re_survey_no: formData.reSurveyNo || null,
        integrated_712: formData.integrated712 || null,
        integrated_712_filename: formData.integrated712FileName || null,
        current_step: 1,
        status: 'initiated'
      }

      // Add ID if updating existing record
      if (landBasicInfo?.id) {
        landRecordData.id = landBasicInfo.id
      }

      const { data: result, error } = await LandRecordService.saveLandRecord(landRecordData)
      
      if (error) throw error

      setRecordId(result.id);

      // Update context with the saved data
      const updatedInfo: LandBasicInfo = {
        id: result.id,
        district: formData.district, 
        taluka: formData.taluka, 
        village: formData.village, 
        area: formData.area,
        sNoType: formData.sNoType, 
        sNo: formData.sNo,
        isPromulgation: formData.isPromulgation, 
        blockNo: formData.blockNo, 
        reSurveyNo: formData.reSurveyNo, 
        integrated712: formData.integrated712,
        integrated712FileName: formData.integrated712FileName
      }

      setLandBasicInfo(updatedInfo)
      setSavedRecordId(result.id)
      
      // Update step data
      updateStepData({
        landBasicInfo: updatedInfo
      })

      // Create activity log
      await createActivityLog({
        user_email: user?.primaryEmailAddress?.emailAddress || "",
        land_record_id: result.id,
        step: 1,
        chat_id: null,
        description: `Added land basic information for ${formData.village}, ${formData.taluka}, ${formData.district}`
      });

      setHasUnsavedChanges(currentStep, false)
      toast({ title: "Land basic info saved successfully" })
      
       if (role === 'manager' || role === 'admin') {
        setShowCommentModal(true);
      } else {
        // For other roles, navigate directly to step 2
        setCurrentStep(2);
      }
      
    } catch (error) {
      console.error('Error saving land record:', error)
      toast({ 
        title: "Error saving data", 
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

const handleNavigateToDuplicate = (mode: 'edit' | 'view') => {
  if (!duplicateRecord) return;
  
  router.push(`/land-master/forms?mode=${mode}&id=${duplicateRecord.id}`);
  setShowDuplicateDialog(false);
  setDuplicateRecord(null);
};

const handleCloseDuplicateDialog = () => {
  setShowDuplicateDialog(false);
  setDuplicateRecord(null);
};

   return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Land Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Your existing form content remains exactly the same */}
          {/* Location Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>District *</Label>
              <Select value={district} onValueChange={handleDistrictChange}>
                <SelectTrigger className={validationErrors.district ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select District" />
                </SelectTrigger>
                <SelectContent>
                  {getDistricts().map((dist) => (
                    <SelectItem key={dist} value={dist}>{dist}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.district && (
                <p className="text-sm text-red-600">{validationErrors.district}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Taluka *</Label>
              <Select value={taluka} onValueChange={handleTalukaChange} disabled={!district}>
                <SelectTrigger className={validationErrors.taluka ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select Taluka" />
                </SelectTrigger>
                <SelectContent>
                  {getTalukas(district).map((tal) => (
                    <SelectItem key={tal} value={tal}>{tal}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.taluka && (
                <p className="text-sm text-red-600">{validationErrors.taluka}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Village *</Label>
              <Select value={village} onValueChange={handleVillageChange} disabled={!taluka}>
                <SelectTrigger className={validationErrors.village ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select Village" />
                </SelectTrigger>
                <SelectContent>
                  {getVillages(district, taluka).map((vill) => (
                    <SelectItem key={vill} value={vill}>{vill}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.village && (
                <p className="text-sm text-red-600">{validationErrors.village}</p>
              )}
            </div>
          </div>

          {/* Area Fields */}
          <div className="space-y-2">
            <Label>Land Area *</Label>
            <AreaFields
              area={formData.area}
              onChange={(newArea) => updateFormField({ area: newArea })}
              disabled={loading}
            />
            {validationErrors.area && (
              <p className="text-sm text-red-600">{validationErrors.area}</p>
            )}
          </div>

          {/* Promulgation Display */}
          {formData.village && formData.isPromulgation !== null && (
            <div>
              <Label>Promulgation Status:</Label>{" "}
              <span className={formData.isPromulgation ? "text-green-600" : "text-red-600"}>
                {formData.isPromulgation ? "Yes" : "No"}
              </span>
            </div>
          )}

          {/* Block No */}
          <div className="space-y-2">
            <Label htmlFor="block-no">Block No *</Label>
            <Input
              id="block-no"
              value={formData.blockNo}
              onChange={(e) => updateFormField({ blockNo: e.target.value })}
              placeholder="Enter Block No"
              className={validationErrors.blockNo ? "border-red-500" : ""}
            />
            {validationErrors.blockNo && (
              <p className="text-sm text-red-600">{validationErrors.blockNo}</p>
            )}
          </div>

          {/* Re Survey No */}
          {formData.isPromulgation && (
            <div className="p-4 border rounded-lg bg-blue-50">
              <div className="space-y-2">
                <Label htmlFor="re-survey-no">Re Survey No *</Label>
                <Input
                  id="re-survey-no"
                  value={formData.reSurveyNo}
                  onChange={(e) => updateFormField({ reSurveyNo: e.target.value })}
                  placeholder="Enter Re Survey No"
                  className={validationErrors.reSurveyNo ? "border-red-500" : ""}
                />
                {validationErrors.reSurveyNo && (
                  <p className="text-sm text-red-600">{validationErrors.reSurveyNo}</p>
                )}
              </div>
            </div>
          )}

          {/* Document Upload */}
          <div className="space-y-2">
            <Label htmlFor="integrated-712">Integrated 7/12 Document *</Label>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  id="integrated-712"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleFileUpload(file)
                      e.target.value = ''
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={loading}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  disabled={loading}
                  className={`flex items-center gap-2 bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:opacity-50 ${
                    validationErrors.integrated712 ? 'border-red-500' : ''
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  {loading ? "Uploading..." : "Choose File"}
                </Button>
              </div>
              {uploadedFileName && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                  <span className="text-sm text-green-800 max-w-[200px] truncate" title={uploadedFileName}>
                    {uploadedFileName}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="text-green-600 hover:text-green-800 text-lg leading-none"
                    title="Remove file"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            {validationErrors.integrated712 && (
              <p className="text-sm text-red-600">{validationErrors.integrated712}</p>
            )}
            <p className="text-xs text-gray-500">
              Supported formats: PDF, JPG, JPEG, PNG 
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2">
              {loading ? "Saving..." : "Save & Continue"}        
            </Button>
          </div>

          {/* Duplicate Record Dialog */}
          {showDuplicateDialog && duplicateRecord && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle className="text-yellow-600">Duplicate Land Record Found</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p>A land record with the same details already exists:</p>
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p><strong>District:</strong> {duplicateRecord.district}</p>
                      <p><strong>Taluka:</strong> {duplicateRecord.taluka}</p>
                      <p><strong>Village:</strong> {duplicateRecord.village}</p>
                      <p><strong>Block No:</strong> {duplicateRecord.block_no}</p>
                      {duplicateRecord.re_survey_no && (
                        <p><strong>Re-Survey No:</strong> {duplicateRecord.re_survey_no}</p>
                      )}
                    </div>
                    <p className="mt-3">Please modify the land information to create a unique record or navigate to the existing record.</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleNavigateToDuplicate('view')}
                    >
                      View Existing Record
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleNavigateToDuplicate('edit')}
                    >
                      Edit Existing Record
                    </Button>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="default"
                      className="w-full"
                      onClick={handleCloseDuplicateDialog}
                    >
                      Close & Modify Form
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comment Modal */}
      <CommentModal
        isOpen={showCommentModal}
        onClose={() => setShowCommentModal(false)}
        onCloseButtonClick={() => {
    setShowCommentModal(false);
    setShowNavigationModal(true);
  }}
        onSubmit={handleSendComment}
        loading={sendingComment}
        step={currentStep}
      />

      {/* Navigation Modal after sending comment */}
     {showNavigationModal && (role === 'manager' || role === 'admin') && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
          <p className="text-sm text-muted-foreground">
            {role === 'manager' || role === 'admin' 
              ? 'Message sent successfully! What would you like to do next?'
              : 'Data saved successfully! What would you like to do next?'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleContinueToStep2}
              className="w-full"
            >
              Continue to Step 2
            </Button>
            <Button
              variant="outline"
              onClick={handleBackToLandMaster}
              className="w-full"
            >
              Back to Land Master
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )}
    </>
  )
}