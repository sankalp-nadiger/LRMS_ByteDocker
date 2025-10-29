"use client";

import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle, Loader2, Edit, MessageSquare, X, Send, Clock, MessageCircle, Users } from "lucide-react";
import { useLandRecord } from "@/contexts/land-record-context";
import { useToast } from "@/hooks/use-toast";
import { useStepFormData } from "@/hooks/use-step-form-data";
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useUserRole } from '@/contexts/user-context';
import { createChat, createActivityLog, getChatsByLandRecord, getLandRecordById } from '@/lib/supabase';
import LandBasicInfoComponent from "./land-basic-info";
import YearSlabs from "./year-slabs";
import Panipatrak from "./panipatrak";
import NondhAdd from "./nondh-add";
import NondhDetails from "./nondh-details";
import OutputViews from "./output-views";
import { AuthProvider } from "../auth-provider";

interface FormStep {
  id: number;
  title: string;
  description: string;
  shortTitle?: string;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface Chat {
  id: string;
  from_email: string;
  to_email: string[] | null;
  message: string;
  land_record_id: string;
  step: number | null;
  created_at: string;
}

function EditFormsContainerInner() {
  const {
    currentStep,
    setCurrentStep,
    landBasicInfo,
    hasUnsavedChanges,
    formData,
    setFormData,
    recordId,
     refreshStatus,           // ADD THIS
  statusRefreshTrigger, 
  } = useLandRecord();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const userRole = useUserRole();
  
  const [isSaving, setIsSaving] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [commentMessage, setCommentMessage] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showFloatingButtons, setShowFloatingButtons] = useState(false);
  const [referrerMessage, setReferrerMessage] = useState<string | null>(null);
  const [landRecordStatus, setLandRecordStatus] = useState('initiated');
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const steps: FormStep[] = [
    {
      id: 1,
      title: "Land Basic Info",
      shortTitle: "Basic Info",
      description: "District, Taluka, Village & Area details",
    },
    { 
      id: 2, 
      title: "Year Slabs", 
      shortTitle: "Slabs",
      description: "Add year-wise land slabs" 
    },
    {
      id: 3,
      title: "Panipatrak",
      shortTitle: "Panipatrak",
      description: "Add farmer details for each slab",
    },
    {
      id: 4,
      title: "Nondh Add",
      shortTitle: "Nondh Add",
      description: "Add Nondh numbers and affected S.no",
    },
    {
      id: 5,
      title: "Nondh Details",
      shortTitle: "Details",
      description: "Complete Nondh information",
    },
    {
      id: 6,
      title: "Output",
      shortTitle: "Output",
      description: "View results and generate reports",
    },
  ];

  // Observe header visibility for floating buttons
useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      setIsHeaderVisible(entry.isIntersecting);
      // Show floating buttons only when header is NOT visible
      setShowFloatingButtons(!entry.isIntersecting);
    },
    { threshold: 0 }
  );

  if (headerRef.current) {
    observer.observe(headerRef.current);
  }

  return () => {
    if (headerRef.current) {
      observer.unobserve(headerRef.current);
    }
  };
}, []);

  // Fetch users
  useEffect(() => {
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
  }, []);

  // Fetch land record status
useEffect(() => {
  const fetchLandRecordStatus = async () => {
    if (!recordId) {
      setIsLoadingStatus(false);
      return;
    }

    try {
      setIsLoadingStatus(true);
      const landRecord = await getLandRecordById(recordId);
      if (landRecord && landRecord.status) {
        setLandRecordStatus(landRecord.status);
      }
    } catch (error) {
      console.error('Error fetching land record status:', error);
      setLandRecordStatus('initiated');
    } finally {
      setIsLoadingStatus(false);
    }
  };

  fetchLandRecordStatus();
}, [recordId, statusRefreshTrigger]); // Add statusRefreshTrigger here

  // Fetch chats when recordId changes or chat modal opens
  useEffect(() => {
    if (recordId && showChatModal) {
      fetchChats();
    }
  }, [recordId, showChatModal]);

  // Auto-scroll to bottom of chats
  useEffect(() => {
    if (showChatModal) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chats, showChatModal]);

  const fetchChats = async () => {
    if (!recordId) return;
    
    try {
      const chatsData = await getChatsByLandRecord(recordId);
      setChats(chatsData || []);
    } catch (error) {
      console.error('Error fetching chats:', error);
      setChats([]);
    }
  };

  // Memoize steps to prevent unnecessary re-renders
  const stepsMap = useMemo(() => {
    return new Map(steps.map(step => [step.id, step]));
  }, []);

  // Handle step parameter from URL
  useEffect(() => {
    const stepParam = searchParams.get('step');
    const messageParam = searchParams.get('message');
    
    if (stepParam) {
      const targetStep = parseInt(stepParam, 10);
      if (targetStep >= 1 && targetStep <= 6) {
        setCurrentStep(targetStep);
      }
    }
    
    if (messageParam) {
      setReferrerMessage(decodeURIComponent(messageParam));
    }
  }, [searchParams, setCurrentStep]);

  // Observe header visibility for floating buttons
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeaderVisible(entry.isIntersecting);
        // Show floating buttons only when header is NOT visible
        setShowFloatingButtons(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    if (headerRef.current) {
      observer.observe(headerRef.current);
    }

    return () => {
      if (headerRef.current) {
        observer.unobserve(headerRef.current);
      }
    };
  }, []);

  // Handle step changes
  const handleStepChange = useCallback(async (newStep: number) => {
    setCurrentStep(newStep);
    return true;
  }, [setCurrentStep]);

  // Navigation handlers
  const handleNext = useCallback(async () => {
    const currentIndex = steps.findIndex((step) => step.id === currentStep);
    if (currentIndex < steps.length - 1) {
      await handleStepChange(steps[currentIndex + 1].id);
    }
  }, [currentStep, handleStepChange, steps]);

  const handlePrevious = useCallback(async () => {
    const currentIndex = steps.findIndex((step) => step.id === currentStep);
    if (currentIndex > 0) {
      await handleStepChange(steps[currentIndex - 1].id);
    }
  }, [currentStep, handleStepChange, steps]);

  // Handle comment message change
  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    
    setCommentMessage(value);
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

  // Handle chat message change
  const handleChatMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    
    setChatMessage(value);
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

  const handleMentionSelect = (userEmail: string, userName: string, isChat: boolean = false) => {
    const currentMessage = isChat ? chatMessage : commentMessage;
    const textBeforeCursor = currentMessage.substring(0, cursorPosition);
    const textAfterCursor = currentMessage.substring(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    const beforeMention = currentMessage.substring(0, lastAtIndex);
    const newText = beforeMention + `@${userName} ` + textAfterCursor;
    
    if (isChat) {
      setChatMessage(newText);
    } else {
      setCommentMessage(newText);
    }
    
    setSelectedRecipients([...selectedRecipients, userEmail]);
    setShowMentionDropdown(false);
    setMentionSearch('');
    
    setTimeout(() => {
      const ref = isChat ? chatInputRef : inputRef;
      ref.current?.focus();
    }, 0);
  };

  const removeMention = (email: string) => {
    setSelectedRecipients(selectedRecipients.filter(e => e !== email));
  };

  const filteredUsers = users
    .filter(u => u.email !== user?.primaryEmailAddress?.emailAddress)
    .filter(u => !selectedRecipients.includes(u.email))
    .filter(u => 
      mentionSearch === '' || 
      u.fullName.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(mentionSearch.toLowerCase())
    );

  const getUserByEmail = (email: string) => {
    return users.find(u => u.email === email);
  };

  const handleSendComment = async () => {
    if (!commentMessage.trim() || !user?.primaryEmailAddress?.emailAddress || !recordId) {
      return;
    }

    try {
      setIsSending(true);
      const toEmails = selectedRecipients.length > 0 ? selectedRecipients : null;
      
      const chatData = await createChat({
        from_email: user.primaryEmailAddress.emailAddress,
        to_email: toEmails,
        message: commentMessage,
        land_record_id: recordId,
        step: currentStep
      });

      const recipientText = toEmails 
        ? `to ${toEmails.length} recipient(s)` 
        : 'to all';

      await createActivityLog({
        user_email: user.primaryEmailAddress.emailAddress,
        land_record_id: recordId,
        step: currentStep,
        chat_id: chatData.id,
        description: `Added comment on Step ${currentStep} ${recipientText}`
      });

      setCommentMessage('');
      setSelectedRecipients([]);
      setShowCommentModal(false);
      
      toast({
        title: "Comment added successfully!",
        description: `Your comment has been sent ${recipientText}.`,
      });
    } catch (error) {
      console.error('Error sending comment:', error);
      toast({
        title: "Failed to send comment",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatMessage.trim() || !user?.primaryEmailAddress?.emailAddress || !recordId) {
      return;
    }

    try {
      setIsSendingChat(true);
      const toEmails = selectedRecipients.length > 0 ? selectedRecipients : null;
      
      const chatData = await createChat({
        from_email: user.primaryEmailAddress.emailAddress,
        to_email: toEmails,
        message: chatMessage,
        land_record_id: recordId,
        step: currentStep
      });

      // Add to local chats
      setChats(prev => [...prev, chatData]);
      setChatMessage('');
      setSelectedRecipients([]);
      
      toast({
        title: "Message sent!",
        description: "Your message has been sent successfully.",
      });
    } catch (error) {
      console.error('Error sending chat message:', error);
      toast({
        title: "Failed to send message",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleSwitchToTimeline = () => {
    if (recordId) {
      window.location.href = `/timeline?landId=${recordId}`;
    }
  };

  const openChatModal = () => {
    setShowChatModal(true);
    setSelectedRecipients([]);
    setChatMessage('');
  };

  const closeChatModal = () => {
    setShowChatModal(false);
    setSelectedRecipients([]);
    setChatMessage('');
  };

  // Render current step with its saved data
  const renderStep = useCallback(() => {
    const stepData = formData[currentStep] || {};
    
    switch (currentStep) {
      case 1: 
        return <LandBasicInfoComponent data={stepData.landBasicInfo} />;
      case 2: 
        return <YearSlabs data={stepData.yearSlabs} />;
      case 3: 
        return <Panipatrak data={stepData.panipatrak} />;
      case 4: 
        return <NondhAdd data={stepData.nondhAdd} />;
      case 5: 
        return <NondhDetails data={stepData.nondhDetails} />;
      case 6: 
        return <OutputViews data={stepData.outputViews} />;
      default: 
        return <LandBasicInfoComponent />;
    }
  }, [currentStep, formData]);

  const isLastStep = currentStep === steps[steps.length - 1].id;
  const isFirstStep = currentStep === steps[0].id;
  const progress = (currentStep / steps.length) * 100;

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50/50 p-2 sm:p-4 lg:p-6">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
         {/* Status Timeline with Subtle Colors */}
<Card className="mb-4">
  <CardContent className="p-4">
    {isLoadingStatus ? (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>Loading status...</span>
      </div>
    ) : (
      <div className="flex items-center justify-between">
        {/* Status Steps - Full width on mobile */}
        <div className="flex items-center flex-1 lg:mr-6">
          {[
            { id: 'initiated', label: 'Initiated', color: 'bg-slate-300' },
            { id: 'drafting', label: 'Drafting', color: 'bg-blue-300' },
            { id: 'review', label: 'Review', color: 'bg-indigo-300' },
            { id: 'query', label: 'Query', color: 'bg-yellow-300' },
            { id: 'review2', label: 'External Review', color: 'bg-orange-300' },
            { id: 'completed', label: 'Completed', color: 'bg-green-300' }
          ].map((status, index, array) => {
            const isActive = landRecordStatus === status.id;
            const isCompleted = 
              status.id === 'initiated' ? true :
              landRecordStatus === 'completed' ? true :
              array.findIndex(s => s.id === landRecordStatus) >= array.findIndex(s => s.id === status.id);
            
            return (
              <div key={status.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center relative z-10 flex-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-slate-700 text-sm font-semibold transition-all duration-300 ${
                      isActive 
                        ? 'ring-3 ring-blue-100 ring-offset-2 shadow-sm ' + status.color
                        : isCompleted 
                          ? status.color + ' opacity-80'
                          : 'bg-slate-200 opacity-60'
                    }`}
                    style={{ marginTop: '1px' }}
                  >
                    {isCompleted && (isActive ? '✓' : index + 1)}
                  </div>
                  <span
                    className={`text-xs mt-2 font-medium transition-colors text-center px-1 whitespace-nowrap ${
                      isActive ? 'text-blue-600 font-semibold' : 
                      isCompleted ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {status.label}
                  </span>
                </div>
                
                {index < array.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-1 -ml-1 ${
                      isCompleted ? 'bg-blue-200' : 'bg-slate-100'
                    } rounded-full transition-colors duration-300`}
                    style={{ marginTop: '-6px' }}
                  />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Compact Status Badge - Hidden on mobile */}
        <div className="flex-shrink-0 hidden lg:block">
          <Badge 
            variant="secondary" 
            className={`
              text-xs font-normal px-2 py-1 rounded-md border-0
              ${landRecordStatus === 'completed' ? 'bg-green-100 text-green-800' :
                landRecordStatus === 'review2' ? 'bg-orange-100 text-orange-800' :
                landRecordStatus === 'query' ? 'bg-yellow-100 text-yellow-800' :
                landRecordStatus === 'review' ? 'bg-indigo-100 text-indigo-800' :
                landRecordStatus === 'drafting' ? 'bg-blue-100 text-blue-800' :
                'bg-slate-100 text-slate-800'
              }
            `}
          >
            {landRecordStatus === 'review2' ? 'External Review' : 
             landRecordStatus.charAt(0).toUpperCase() + landRecordStatus.slice(1)}
          </Badge>
        </div>
      </div>
    )}
  </CardContent>
</Card>

          {/* Progress Header */}
          <Card ref={headerRef}>
            <CardHeader>
              {/* Mobile Header Layout */}
              <div className="flex flex-col sm:hidden space-y-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-bold">
                    LRMS
                  </CardTitle>
                  <Badge variant='default'>
                    Edit Mode
                  </Badge>
                </div>
              </div>

              {/* Tablet and Desktop Header Layout */}
              <div className="hidden sm:flex justify-between items-center">
                <div className="flex flex-col gap-2">
                  <CardTitle className="text-xl sm:text-2xl font-bold">
                    Land Record Management System (LRMS)
                  </CardTitle>
                </div>
                <Badge variant='default'>
                  Edit Mode
                </Badge>
              </div>

              {/* Progress Section */}
              <div className="mt-4">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Step {currentStep} of {steps.length}
                </p>
              </div>

              {/* Action Buttons Section */}
              <div className="flex justify-between items-center mt-4 flex-wrap gap-3">
                {/* Left side: Referrer message - only show when message exists */}
                <div className="flex-1 min-w-0">
                  {referrerMessage && (
                    <p className="text-sm text-muted-foreground italic truncate">
                      From Timeline: "{referrerMessage}"
                    </p>
                  )}
                </div>

                {/* Right side: Action buttons - always aligned to right */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Action Buttons Grid */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowCommentModal(true)}
                      className="flex items-center gap-1 h-8 px-2 hover:bg-white"
                      title="Add Comment"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span className="text-xs hidden sm:inline">Comment</span>
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={openChatModal}
                      className="flex items-center gap-1 h-8 px-2 hover:bg-white"
                      title="Chat Logs"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span className="text-xs hidden sm:inline">Chats</span>
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleSwitchToTimeline}
                      className="flex items-center gap-1 h-8 px-2 hover:bg-white"
                      title="Timeline"
                    >
                      <Clock className="w-3 h-3" />
                      <span className="text-xs hidden sm:inline">Timeline</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Floating Action Buttons - Show only when header is scrolled past */}
{showFloatingButtons && (
  <div className="fixed right-4 sm:right-6 bottom-6 z-50">
    <div className="flex flex-col gap-2 bg-white/90 backdrop-blur-sm rounded-2xl p-2 shadow-xl border">
      <Button 
        variant="default" 
        size="icon"
        onClick={() => setShowCommentModal(true)}
        className="rounded-full w-11 h-11 shadow-lg hover:shadow-xl transition-all hover:scale-105"
        title="Add Comment"
      >
        <MessageSquare className="w-4 h-4" />
      </Button>
      <Button 
        variant="default" 
        size="icon"
        onClick={openChatModal}
        className="rounded-full w-11 h-11 shadow-lg hover:shadow-xl transition-all hover:scale-105"
        title="Chat Logs"
      >
        <MessageCircle className="w-4 h-4" />
      </Button>
      <Button 
        variant="default" 
        size="icon"
        onClick={handleSwitchToTimeline}
        className="rounded-full w-11 h-11 shadow-lg hover:shadow-xl transition-all hover:scale-105"
        title="View Timeline"
      >
        <Clock className="w-4 h-4" />
      </Button>
    </div>
  </div>
)}

          {/* Comment Modal */}
          {showCommentModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                <CardHeader className="flex-shrink-0 border-b bg-white sticky top-0 z-10">
                  <div className="flex justify-between items-center">
                    <CardTitle>Add Comment - Step {currentStep}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowCommentModal(false);
                        setCommentMessage('');
                        setSelectedRecipients([]);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <CardDescription>
                    Add a comment about Step {currentStep}: {steps.find(s => s.id === currentStep)?.title}
                  </CardDescription>
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

                  {/* Comment Input */}
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={commentMessage}
                      onChange={handleCommentChange}
                      onKeyPress={(e) => e.key === 'Enter' && !showMentionDropdown && handleSendComment()}
                      placeholder="Type @ to mention someone or just send to all..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isSending}
                    />

                    {/* Mention Dropdown */}
                    {showMentionDropdown && filteredUsers.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                        {filteredUsers.map(u => (
                          <button
                            key={u.id}
                            onClick={() => handleMentionSelect(u.email, u.fullName, false)}
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
                    Type @ to mention specific users, or send to everyone
                  </p>

                  {/* Send Button */}
                  <Button
                    onClick={handleSendComment}
                    disabled={isSending || !commentMessage.trim()}
                    className="w-full flex items-center justify-center gap-2 mt-4"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Comment
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Chat Modal */}
          {showChatModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <CardHeader className="flex-shrink-0 border-b bg-white sticky top-0 z-10">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-6 h-6 text-blue-600" />
                      <div>
                        <CardTitle>Chat Logs</CardTitle>
                        <CardDescription>
                          Step {currentStep}: {steps.find(s => s.id === currentStep)?.title}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchChats}
                        className="flex items-center gap-1"
                      >
                        <Loader2 className="w-3 h-3" />
                        Refresh
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={closeChatModal}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {chats.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No chat messages yet</p>
                        <p className="text-sm">Start a conversation by sending a message below</p>
                      </div>
                    ) : (
                      chats.map(chat => {
                        const isOwn = chat.from_email === user?.primaryEmailAddress?.emailAddress;
                        const sender = getUserByEmail(chat.from_email);
                        
                        return (
                          <div key={chat.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-md rounded-lg p-4 ${
                              isOwn 
                                ? 'bg-blue-500 text-white rounded-br-none' 
                                : 'bg-gray-100 text-gray-800 rounded-bl-none'
                            }`}>
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  isOwn ? 'bg-blue-200' : 'bg-green-500'
                                }`} />
                                <span className={`text-sm font-semibold ${
                                  isOwn ? 'text-blue-100' : 'text-gray-600'
                                }`}>
                                  {sender?.fullName || chat.from_email}
                                </span>
                                {chat.step && (
                                  <Badge variant="secondary" className="text-xs">
                                    Step {chat.step}
                                  </Badge>
                                )}
                              </div>
                              
                              <p className="text-sm break-words mb-2">{chat.message}</p>
                              
                              {chat.to_email && chat.to_email.length > 0 && (
                                <div className={`text-xs flex items-center gap-1 ${
                                  isOwn ? 'text-blue-100' : 'text-gray-500'
                                }`}>
                                  <Users className="w-3 h-3" />
                                  To: {chat.to_email.map(email => getUserByEmail(email)?.fullName || email).join(', ')}
                                </div>
                              )}
                              
                              <div className={`text-xs mt-2 ${
                                isOwn ? 'text-blue-100' : 'text-gray-500'
                              }`}>
                                {new Date(chat.created_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Input */}
                  <div className="border-t p-4 bg-gray-50">
                    {selectedRecipients.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
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
                    
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          ref={chatInputRef}
                          type="text"
                          value={chatMessage}
                          onChange={handleChatMessageChange}
                          onKeyPress={(e) => e.key === 'Enter' && !showMentionDropdown && handleSendChatMessage()}
                          placeholder="Type your message... Use @ to mention someone"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={isSendingChat}
                        />

                        {/* Mention Dropdown */}
                        {showMentionDropdown && filteredUsers.length > 0 && (
                          <div className="absolute bottom-full left-0 mb-2 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                            {filteredUsers.map(u => (
                              <button
                                key={u.id}
                                onClick={() => handleMentionSelect(u.email, u.fullName, true)}
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
                      
                      <Button
                        onClick={handleSendChatMessage}
                        disabled={isSendingChat || !chatMessage.trim()}
                        className="px-6 flex items-center gap-2"
                      >
                        {isSendingChat ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Send
                      </Button>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-2">
                      Type @ to mention specific users, or send to everyone. Messages are tied to this land record.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Responsive Step Navigation */}
          <Card className="shadow-sm">
            <CardContent className="p-3 sm:p-4">
              {/* Mobile Step Navigation - Horizontal Scroll */}
              <div className="sm:hidden">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {steps.map((step) => (
                    <Button
                      key={step.id}
                      variant={currentStep === step.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStepChange(step.id)}
                      className="flex items-center gap-1 whitespace-nowrap flex-shrink-0 min-w-fit"
                    >
                      {currentStep > step.id ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <Circle className="w-3 h-3" />
                      )}
                      <span className="text-xs">{step.id}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tablet and Desktop Step Navigation */}
              <div className="hidden sm:block">
                {/* Tablet - 3 column grid */}
                <div className="sm:grid sm:grid-cols-3 lg:hidden gap-2">
                  {steps.map((step) => (
                    <Button
                      key={step.id}
                      variant={currentStep === step.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStepChange(step.id)}
                      className="flex items-center gap-2 w-full"
                    >
                      {currentStep > step.id ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                      <span className="text-sm truncate">{step.shortTitle || step.title}</span>
                    </Button>
                  ))}
                </div>

                {/* Desktop - Single row */}
                <div className="hidden lg:flex lg:flex-wrap lg:gap-2 lg:justify-center">
                  {steps.map((step) => (
                    <Button
                      key={step.id}
                      variant={currentStep === step.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStepChange(step.id)}
                      className="flex items-center gap-2 px-3 py-2"
                    >
                      {currentStep > step.id ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                      <span>{step.title}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Step Content - Responsive Container */}
          <div className="w-full">
            <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 lg:p-6">
              {renderStep()}
            </div>
          </div>

          {/* Responsive Navigation Buttons */}
          <Card className="shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={isFirstStep || isSaving}
                  className="order-2 sm:order-1"
                >
                  Previous
                </Button>

                <div className="flex gap-2 order-1 sm:order-2">
                  {!isLastStep && (
                    <Button 
                      onClick={handleNext} 
                      disabled={isSaving}
                      className="w-full sm:w-auto"
                    >
                      Next
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthProvider>
  );
}

export function EditFormsContainer() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50/50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading form...</p>
        </div>
      </div>
    }>
      <EditFormsContainerInner />
    </Suspense>
  );
}