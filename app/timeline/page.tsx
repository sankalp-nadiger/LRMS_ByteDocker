'use client';

import { useEffect, useState, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useUserRole } from '@/contexts/user-context';
import { 
  getActivityLogsByLandRecord, 
  getChatsByLandRecord, 
  createChat,
  createActivityLog,
  createOwnerDiscussion,
  getOwnerDiscussionsByLandRecord,
  updateLandRecordStatus
} from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { RefreshCw, MessageCircle, Send, CheckCircle, ExternalLink, AlertCircle, X } from 'lucide-react';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface LandRecord {
  id: string;
  status: string;
  district: string;
  taluk: string;
  village: string;
  block_no: string;
  created_at: string;
}

interface Broker {
  id: string;
  name: string;
  phone_number: string;
  area: string;
  rating: number;
  status: string;
}

interface BrokerLandRecord {
  id: string;
  broker_id: string;
  land_record_id: string;
  last_offer: number | null;
  next_update: string | null;
  status: string;
  broker?: Broker;
}

interface ActivityLog {
  id: string;
  created_at: string;
  user_email: string;
  land_record_id: string;
  step: number;
  chat_id: string | null;
  description: string;
}

interface Chat {
  id: string;
  created_at: string;
  from_email: string;
  to_email: string[] | null;
  message: string;
  land_record_id: string;
  step: number;
}

interface OwnerDiscussion {
  id: string;
  land_record_id: string;
  user_email: string;
  message: string;
  created_at: string;
}

export default function LandRecordTimelinePage() {
  const { user } = useUser();
  const role = useUserRole();
  
  const [lands, setLands] = useState<LandRecord[]>([]);
  const [selectedLandId, setSelectedLandId] = useState<string>('');
  const [selectedLand, setSelectedLand] = useState<LandRecord | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [ownerDiscussions, setOwnerDiscussions] = useState<OwnerDiscussion[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newOwnerMessage, setNewOwnerMessage] = useState('');
  const [brokerMessage, setBrokerMessage] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
const [completionComment, setCompletionComment] = useState('');
const [selectedBrokerForOffer, setSelectedBrokerForOffer] = useState<string>('');
const [brokerOffer, setBrokerOffer] = useState('');
const [brokerStatusForCompletion, setBrokerStatusForCompletion] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingOwnerMessage, setIsSendingOwnerMessage] = useState(false);
  const [isSendingBrokerMessage, setIsSendingBrokerMessage] = useState(false);
  const [isSendingExternalReview, setIsSendingExternalReview] = useState(false);
  const [brokers, setBrokers] = useState<BrokerLandRecord[]>([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const ownerChatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoadingUsers(true);
        const response = await fetch('/api/users/list');
        if (!response.ok) throw new Error('Failed to fetch users');
        const data = await response.json();
        setUsers(data.users);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  // Add admin user
  useEffect(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (adminEmail && !users.find(u => u.email === adminEmail)) {
      setUsers(prevUsers => [
        ...prevUsers,
        {
          id: 'admin-user',
          email: adminEmail,
          fullName: 'Admin User',
          role: 'admin'
        }
      ]);
    }
  }, [users]);

  // Handle URL parameter
  const [urlParamHandled, setUrlParamHandled] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const landId = params.get('landId');
    if (landId) {
      setSelectedLandId(landId);
    }
    setUrlParamHandled(true);
  }, []);

  // Fetch land records
  useEffect(() => {
    const fetchLandRecords = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('land_records')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setLands(data || []);
        
        if (data && data.length > 0 && !selectedLandId && urlParamHandled) {
          setSelectedLandId(data[0].id);
        }
      } catch (err) {
        console.error('Error fetching land records:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLandRecords();
  }, [urlParamHandled]);

  // Set selected land when selectedLandId changes
  useEffect(() => {
    if (selectedLandId && lands.length > 0) {
      const land = lands.find(l => l.id === selectedLandId);
      setSelectedLand(land || null);
    }
  }, [selectedLandId, lands]);

  useEffect(() => {
    if (!selectedLandId) return;

    const fetchBrokers = async () => {
      try {
       const { data, error } = await supabase
  .from('broker_land_records')
  .select(`
    *,
    broker:brokers (*)
  `)
  .eq('land_record_id', selectedLandId);

        if (error) throw error;
        setBrokers(data || []);
        
        const activeBroker = data?.find(b => b.broker?.status === 'active');
        if (activeBroker?.broker) {
          setSelectedBroker(activeBroker.broker);
        }
      } catch (error) {
        console.error('Error fetching brokers:', error);
        setBrokers([]);
      }
    };

    fetchBrokers();
  }, [selectedLandId]);

  useEffect(() => {
    if (!selectedLandId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [logsData, chatsData, discussionsData] = await Promise.all([
          getActivityLogsByLandRecord(selectedLandId),
          getChatsByLandRecord(selectedLandId),
          getOwnerDiscussionsByLandRecord(selectedLandId)
        ]);
        
        setActivityLogs(logsData || []);
        setChats(chatsData || []);
        setOwnerDiscussions(discussionsData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setActivityLogs([]);
        setChats([]);
        setOwnerDiscussions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedLandId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    ownerChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, ownerDiscussions]);

  const handlePushToOffer = async () => {
  if (!selectedLandId || !user?.primaryEmailAddress?.emailAddress) {
    return;
  }

  try {
    setIsSendingExternalReview(true);
    
    await updateLandRecordStatus(selectedLandId, 'offer');

    await createActivityLog({
      user_email: user.primaryEmailAddress.emailAddress,
      land_record_id: selectedLandId,
      step: null,
      chat_id: null,
      description: 'Pushed land record to offer stage'
    });

    setLands(lands.map(land => 
      land.id === selectedLandId 
        ? { ...land, status: 'offer' }
        : land
    ));
    setSelectedLand(prev => prev ? { ...prev, status: 'offer' } : null);

    const logsData = await getActivityLogsByLandRecord(selectedLandId);
    setActivityLogs(logsData);
    alert('Land record pushed to offer stage successfully!');
  } catch (error) {
    console.error('Error pushing to offer:', error);
    alert('Error pushing to offer');
  } finally {
    setIsSendingExternalReview(false);
  }
};

const handleShowCompletionModal = () => {
  setShowCompletionModal(true);
  setCompletionComment('');
  setSelectedBrokerForOffer('');
  setBrokerOffer('');
  setBrokerStatusForCompletion('');
};

const handleConfirmCompletion = async () => {
  if (!selectedLandId || !user?.primaryEmailAddress?.emailAddress) {
    return;
  }

  try {
    setIsSendingExternalReview(true);
    
    // Update land record status with comment
    const { error: landError } = await supabase
      .from('land_records')
      .update({ 
        status: 'completed',
        comments: completionComment || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedLandId);

    if (landError) throw landError;

    // Update broker offer if selected
    if (selectedBrokerForOffer && (brokerOffer || brokerStatusForCompletion)) {
      const updateData: any = {};
      if (brokerOffer) updateData.last_offer = parseFloat(brokerOffer);
      if (brokerStatusForCompletion) updateData.status = brokerStatusForCompletion;

      const { error: brokerError } = await supabase
        .from('broker_land_records')
        .update(updateData)
        .eq('broker_id', selectedBrokerForOffer)
        .eq('land_record_id', selectedLandId);

      if (brokerError) throw brokerError;
    }

    // Create activity log
    let description = 'Marked land record as completed';
    if (completionComment) description += ` with note: ${completionComment.substring(0, 50)}${completionComment.length > 50 ? '...' : ''}`;
    if (brokerOffer) description += ` | Broker offer: ₹${brokerOffer}`;

    await createActivityLog({
      user_email: user.primaryEmailAddress.emailAddress,
      land_record_id: selectedLandId,
      step: null,
      chat_id: null,
      description
    });

    setLands(lands.map(land => 
      land.id === selectedLandId 
        ? { ...land, status: 'completed', comments: completionComment || null }
        : land
    ));
    setSelectedLand(prev => prev ? { ...prev, status: 'completed', comments: completionComment || null } : null);

    const logsData = await getActivityLogsByLandRecord(selectedLandId);
    setActivityLogs(logsData);
    
    setShowCompletionModal(false);
    alert('Land record marked as completed successfully!');
  } catch (error) {
    console.error('Error marking as completed:', error);
    alert('Error marking as completed');
  } finally {
    setIsSendingExternalReview(false);
    setIsUpdatingStatus(false);
  }
};

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    
    setNewMessage(value);
    setCursorPosition(position);

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
    const textBeforeCursor = newMessage.substring(0, cursorPosition);
    const textAfterCursor = newMessage.substring(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    const beforeMention = newMessage.substring(0, lastAtIndex);
    const newText = beforeMention + `@${userName} ` + textAfterCursor;
    
    setNewMessage(newText);
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

  const filteredUsers = users
    .filter(u => u.email !== user?.primaryEmailAddress?.emailAddress)
    .filter(u => !selectedRecipients.includes(u.email))
    .filter(u => 
      mentionSearch === '' || 
      u.fullName.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(mentionSearch.toLowerCase())
    );

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.primaryEmailAddress?.emailAddress) {
      return;
    }

    try {
      setIsSending(true);
      const toEmails = selectedRecipients.length > 0 ? selectedRecipients : null;
      
      const chatData = await createChat({
        from_email: user.primaryEmailAddress.emailAddress,
        to_email: toEmails,
        message: newMessage,
        land_record_id: selectedLandId,
        step: null
      });

      const recipientText = toEmails 
        ? `to ${toEmails.length} recipient(s)` 
        : 'to all';

      await createActivityLog({
        user_email: user.primaryEmailAddress.emailAddress,
        land_record_id: selectedLandId,
        step: null,
        chat_id: chatData.id,
        description: `Sent message ${recipientText}`
      });

      setChats([...chats, chatData]);
      setNewMessage('');
      setSelectedRecipients([]);
      
      const logsData = await getActivityLogsByLandRecord(selectedLandId);
      setActivityLogs(logsData);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendOwnerMessage = async () => {
    if (!newOwnerMessage.trim() || !user?.primaryEmailAddress?.emailAddress) {
      return;
    }

    try {
      setIsSendingOwnerMessage(true);
      
      const discussionData = await createOwnerDiscussion({
        land_record_id: selectedLandId,
        user_email: user.primaryEmailAddress.emailAddress,
        message: newOwnerMessage
      });

      setOwnerDiscussions([...ownerDiscussions, discussionData]);
      setNewOwnerMessage('');

      await createActivityLog({
        user_email: user.primaryEmailAddress.emailAddress,
        land_record_id: selectedLandId,
        step: null,
        chat_id: null,
        description: 'Added discussion note in discussion threads'
      });

      const logsData = await getActivityLogsByLandRecord(selectedLandId);
      setActivityLogs(logsData);
    } catch (error) {
      console.error('Error sending owner message:', error);
    } finally {
      setIsSendingOwnerMessage(false);
    }
  };

  const handleSendExternalReview = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedLandId || !user?.primaryEmailAddress?.emailAddress) {
      return;
    }

    const newStatus = e.target.checked ? 'review2' : 'query';

    try {
      setIsSendingExternalReview(true);
      
      await updateLandRecordStatus(selectedLandId, newStatus);

      await createActivityLog({
        user_email: user.primaryEmailAddress.emailAddress,
        land_record_id: selectedLandId,
        step: null,
        chat_id: null,
        description: `Updated land record status to ${newStatus}`
      });

      setLands(lands.map(land => 
        land.id === selectedLandId 
          ? { ...land, status: newStatus }
          : land
      ));
      setSelectedLand(prev => prev ? { ...prev, status: newStatus } : null);

      const logsData = await getActivityLogsByLandRecord(selectedLandId);
      setActivityLogs(logsData);
      setIsUpdatingStatus(true);
      alert(`Land record status updated to ${newStatus} successfully!`);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status');
    } finally {
      setIsSendingExternalReview(false);
      setIsUpdatingStatus(false);
    }
  };

  const handleSendBrokerMessage = async () => {
    if (!brokerMessage.trim() || !selectedBroker?.phone_number) {
      alert('Please enter a message and select a broker');
      return;
    }

    try {
      setIsSendingBrokerMessage(true);

      const response = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: selectedBroker.phone_number,
          message: brokerMessage,
          landRecordId: selectedLandId,
          brokerId: selectedBroker.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send WhatsApp message');
      }

      await createActivityLog({
        user_email: user?.primaryEmailAddress?.emailAddress || '',
        land_record_id: selectedLandId,
        step: null,
        chat_id: null,
        description: `Sent WhatsApp message to broker ${selectedBroker.name}: ${brokerMessage.substring(0, 50)}...`
      });

      setBrokerMessage('');
      setShowBrokerModal(false);
      setSelectedBroker(null);

      const logsData = await getActivityLogsByLandRecord(selectedLandId);
      setActivityLogs(logsData);

      alert('Message sent to broker successfully!');
    } catch (error) {
      console.error('Error sending broker message:', error);
      alert('Error sending message to broker');
    } finally {
      setIsSendingBrokerMessage(false);
    }
  };

  const getUserByEmail = (email: string) => {
    return users.find(u => 
      u.email.toLowerCase() === email.toLowerCase()
    );
  };

  const groupLogsByRole = () => {
    const grouped = {
      manager: [] as ActivityLog[],
      executioner: [] as ActivityLog[],
      reviewer: [] as ActivityLog[]
    };

    activityLogs.forEach(log => {
      try {
        const logUser = getUserByEmail(log.user_email);
        if (!logUser || !logUser.role) {
          return;
        }
        
        const role = logUser.role.toLowerCase();
        if (role in grouped) {
          grouped[role as keyof typeof grouped].push(log);
        }
      } catch (error) {
        console.error('Error processing log:', error, log);
      }
    });

    return grouped;
  };

  const isOwnMessage = (email: string) => {
    return email === user?.primaryEmailAddress?.emailAddress;
  };

  const groupedLogs = groupLogsByRole();
  const isCompleted = selectedLand?.status === 'completed';
  const isOffer = selectedLand?.status === 'offer';
  const isQuery = selectedLand?.status === 'query';
  const isReview2 = selectedLand?.status === 'review2';

  const userRole = role?.role || role?.name || role;
  const canSendExternalReview = ['manager', 'admin'].includes(userRole || '') && (isQuery || isReview2);
  const canSendBrokerMessage = brokers.some(b => b.broker?.status === 'active') && 
    ['manager', 'admin', 'executioner'].includes(userRole || '') && (isQuery || isReview2);
  const canMarkCompleted = ['manager', 'admin'].includes(userRole || '') && !isCompleted;
  const canPushToOffer = ['manager', 'admin'].includes(userRole || '') && 
  !['offer', 'drafting', 'review', 'initiated', 'completed'].includes(selectedLand?.status || '');

  const handleMarkAsCompleted = async () => {
    if (!selectedLandId || !user?.primaryEmailAddress?.emailAddress) {
      return;
    }

    try {
      setIsSendingExternalReview(true);
      
      await updateLandRecordStatus(selectedLandId, 'completed');

      await createActivityLog({
        user_email: user.primaryEmailAddress.emailAddress,
        land_record_id: selectedLandId,
        step: null,
        chat_id: null,
        description: 'Marked land record as completed'
      });

      setLands(lands.map(land => 
        land.id === selectedLandId 
          ? { ...land, status: 'completed' }
          : land
      ));
      setSelectedLand(prev => prev ? { ...prev, status: 'completed' } : null);

      const logsData = await getActivityLogsByLandRecord(selectedLandId);
      setActivityLogs(logsData);
      setIsUpdatingStatus(true);
      alert('Land record marked as completed successfully!');
    } catch (error) {
      console.error('Error marking as completed:', error);
      alert('Error marking as completed');
    } finally {
      setIsSendingExternalReview(false);
      setIsUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Land Record Selector */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <h1 className="text-2xl md:text-3xl font-bold">Land Record Timeline</h1>
            
            {/* Action Buttons - Smaller Size */}
            <div className="flex flex-wrap gap-2">
              {canPushToOffer && (
    <button
      onClick={handlePushToOffer}
      disabled={isSendingExternalReview}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 transition-colors"
    >
      <Send className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Push to Offer</span>
    </button>
  )}
              {canMarkCompleted && (
                <button
                  onClick={handleShowCompletionModal}
                  disabled={isSendingExternalReview}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 transition-colors"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Complete</span>
                </button>
              )}

              {canSendExternalReview && (
                <div className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-500 text-white rounded-md">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">External Review</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isReview2}
                      onChange={handleSendExternalReview}
                      disabled={isSendingExternalReview}
                    />
                    <div className="w-9 h-5 bg-purple-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-700"></div>
                  </label>
                </div>
              )}

              {canSendBrokerMessage && (
                <button
                  onClick={() => setShowBrokerModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Broker</span>
                </button>
              )}

              <button
                onClick={async () => {
                  if (!selectedLandId) return;
                  try {
                    setLoading(true);
                    // Refresh land records to get updated status
                    const { data: landData, error: landError } = await supabase
                      .from('land_records')
                      .select('*')
                      .order('created_at', { ascending: false });

                    if (!landError && landData) {
                      setLands(landData);
                      const updatedLand = landData.find(l => l.id === selectedLandId);
                      if (updatedLand) {
                        setSelectedLand(updatedLand);
                      }
                    }

                    // Refresh all other data
                    const [logsData, chatsData, discussionsData] = await Promise.all([
                      getActivityLogsByLandRecord(selectedLandId),
                      getChatsByLandRecord(selectedLandId),
                      getOwnerDiscussionsByLandRecord(selectedLandId)
                    ]);
                    setActivityLogs(logsData || []);
                    setChats(chatsData || []);
                    setOwnerDiscussions(discussionsData || []);
                  } catch (error) {
                    console.error('Error refreshing:', error);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
          
          <div className="relative w-full">
            <select
              value={selectedLandId}
              onChange={(e) => setSelectedLandId(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white pr-10 appearance-none"
            >
              {lands.map(land => (
  <option key={land.id} value={land.id}>
    District: {land.district} | Taluk: {land.taluka} | Village: {land.village} | Block No: {land.block_no} | Status:{' '}
    {land.status === 'review2'
      ? 'External Review'
      : land.status.charAt(0).toUpperCase() + land.status.slice(1)}
  </option>
))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        {/* Two Column Grid - Activity Log and Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Activity Log Column */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
            
            {/* Manager Section */}
            <div className="mb-5">
              <h3 className="text-base font-semibold text-blue-600 mb-2 flex items-center">
                <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
                Manager Activities
              </h3>
              <div className="space-y-2 pl-4 border-l-2 border-blue-200">
                {groupedLogs.manager.map(log => (
                  <div key={log.id} className="bg-blue-50 p-2.5 rounded-md">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-xs text-blue-900">
                        {getUserByEmail(log.user_email)?.fullName || log.user_email}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700">{log.description}</p>
                  </div>
                ))}
                {groupedLogs.manager.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No activities yet</p>
                )}
              </div>
            </div>

            {/* Executioner Section */}
            <div className="mb-5">
              <h3 className="text-base font-semibold text-green-600 mb-2 flex items-center">
                <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                Executioner Activities
              </h3>
              <div className="space-y-2 pl-4 border-l-2 border-green-200">
                {groupedLogs.executioner.map(log => (
                  <div key={log.id} className="bg-green-50 p-2.5 rounded-md">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-xs text-green-900">
                        {getUserByEmail(log.user_email)?.fullName || log.user_email}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700">{log.description}</p>
                  </div>
                ))}
                {groupedLogs.executioner.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No activities yet</p>
                )}
              </div>
            </div>

            {/* Reviewer Section */}
            <div>
              <h3 className="text-base font-semibold text-purple-600 mb-2 flex items-center">
                <span className="w-2 h-2 bg-purple-600 rounded-full mr-2"></span>
                Reviewer Activities
              </h3>
              <div className="space-y-2 pl-4 border-l-2 border-purple-200">
                {groupedLogs.reviewer.map(log => (
                  <div key={log.id} className="bg-purple-50 p-2.5 rounded-md">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-xs text-purple-900">
                        {getUserByEmail(log.user_email)?.fullName || log.user_email}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700">{log.description}</p>
                  </div>
                ))}
                {groupedLogs.reviewer.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No activities yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Chat Column */}
          <div className="bg-white rounded-lg shadow p-5 flex flex-col" style={{ height: '600px' }}>
            <h2 className="text-xl font-semibold mb-4">Chat Logs</h2>
            
            <div className="flex-1 overflow-y-auto mb-4 space-y-2">
              {chats.map(chat => {
                const isOwn = isOwnMessage(chat.from_email);
                const sender = getUserByEmail(chat.from_email);
                
                return (
                  <div key={chat.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md ${isOwn ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'} rounded-lg p-2.5`}>
                      <div className={`text-xs font-semibold mb-1 ${isOwn ? 'text-blue-100' : 'text-gray-600'}`}>
                        {sender?.fullName || chat.from_email}
                      </div>
                      <p className="text-sm break-words">{chat.message}</p>
                      {chat.to_email && chat.to_email.length > 0 && (
                        <div className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                          To: {chat.to_email.map(email => getUserByEmail(email)?.fullName || email).join(', ')}
                        </div>
                      )}
                      <button
                        onClick={() => {
                          const selectedLand = lands.find(l => l.id === selectedLandId);
                          if (selectedLand) {
                            const message = `Regarding: ${chat.message.substring(0, 50)}${chat.message.length > 50 ? '...' : ''}`;
                            window.location.href = `/land-master/forms?mode=view&id=${selectedLand.id}&step=${chat.step || 1}&message=${encodeURIComponent(message)}`;
                          }
                        }}
                        className={`mt-1.5 text-xs px-2 py-0.5 rounded ${
                          isOwn 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                            : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                        } transition-colors`}
                      >
                        {chat.step !== null && chat.step !== undefined ? `View Step ${chat.step}` : 'View Record'}
                      </button>
                      <div className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                        {new Date(chat.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t pt-3">
              {selectedRecipients.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {selectedRecipients.map(email => {
                    const recipient = getUserByEmail(email);
                    return (
                      <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                        {recipient?.fullName || email}
                        <button
                          onClick={() => removeMention(email)}
                          className="hover:text-blue-900"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={handleMessageChange}
                    onKeyPress={(e) => e.key === 'Enter' && !showMentionDropdown && handleSendMessage()}
                    placeholder="Type @ to mention someone..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSending}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isSending || !newMessage.trim()}
                    className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSending ? 'Sending...' : 'Send'}
                  </button>
                </div>

                {showMentionDropdown && filteredUsers.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                    {filteredUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleMentionSelect(u.email, u.fullName)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center justify-between text-sm"
                      >
                        <span className="font-medium">{u.fullName}</span>
                        <span className="text-xs text-gray-500">{u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {isCompleted && selectedLand?.comments && (
  <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg mb-4">
    <h3 className="font-semibold text-green-900 mb-2">Completion Note</h3>
    <p className="text-sm text-green-800">{selectedLand.comments}</p>
  </div>
)}

        {/* Full Width Property Discussion Section - Notion-like Callout Design */}
        {(isCompleted || isOffer) && (
          <div className="bg-white rounded-lg shadow">
            {/* Header with Icon */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 p-4 rounded-t-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-amber-900 mb-1">Property Discussion Thread</h2>
                  <p className="text-sm text-amber-800">
                    Internal discussion notes for this land record. Visible to managers and admins only.
                  </p>
                </div>
              </div>
            </div>

            {/* Discussion Content */}
            <div className="p-5">
              <div className="flex flex-col md:flex-row gap-5">
                {/* Discussion Messages - Left Side */}
                <div className="flex-1">
                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                    {ownerDiscussions.map(discussion => {
                      const isOwn = isOwnMessage(discussion.user_email);
                      const sender = getUserByEmail(discussion.user_email);
                      
                      return (
                        <div key={discussion.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                                sender?.role === 'manager' ? 'bg-blue-500 text-white' :
                                sender?.role === 'admin' ? 'bg-red-500 text-white' :
                                'bg-gray-500 text-white'
                              }`}>
                                {(sender?.fullName || discussion.user_email).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {sender?.fullName || discussion.user_email}
                                </div>
                                <div className="flex items-center gap-2">
                                  {sender?.role && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      sender.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                                      sender.role === 'admin' ? 'bg-red-100 text-red-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {sender.role.charAt(0).toUpperCase() + sender.role.slice(1)}
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    {new Date(discussion.created_at).toLocaleString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric', 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {discussion.message}
                          </p>
                        </div>
                      );
                    })}
                    {ownerDiscussions.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <MessageCircle className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500 italic">
                          No discussion notes yet. Start the conversation about this property.
                        </p>
                      </div>
                    )}
                    <div ref={ownerChatEndRef} />
                  </div>
                </div>

                {/* Input Area - Right Side */}
                <div className="md:w-96 flex flex-col">
                  <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-lg p-4">
                    <label className="block text-sm font-medium text-amber-900 mb-2">
                      Add Discussion Note
                    </label>
                    <textarea
                      value={newOwnerMessage}
                      onChange={(e) => setNewOwnerMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendOwnerMessage();
                        }
                      }}
                      placeholder="Add your internal notes about this property..."
                      className="w-full h-32 px-3 py-2 text-sm border border-amber-200 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none bg-white"
                      disabled={isSendingOwnerMessage}
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-amber-700">
                        Press Shift+Enter for new line
                      </p>
                      <button
                        onClick={handleSendOwnerMessage}
                        disabled={isSendingOwnerMessage || !newOwnerMessage.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {isSendingOwnerMessage ? 'Adding...' : 'Add Note'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                      💡 <strong>Tip:</strong> Use this section to document important details, agreements, or follow-up items related to this land record.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Broker Message Modal */}
      {showBrokerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Send Message to Broker</h3>
            
            {brokers.length > 0 ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Broker
                  </label>
                  <select
                    value={selectedBroker?.id || ''}
                    onChange={(e) => {
                      const brokerId = e.target.value;
                      const brokerRelation = brokers.find(b => b.broker_id === brokerId);
                      setSelectedBroker(brokerRelation?.broker || null);
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select a broker</option>
                    {brokers
                      .filter(b => b.broker?.status === 'active')
                      .map(brokerRelation => (
                        <option key={brokerRelation.broker_id} value={brokerRelation.broker_id}>
                          {brokerRelation.broker?.name} - {brokerRelation.broker?.phone_number}
                        </option>
                      ))}
                  </select>
                </div>

                {selectedBroker && (
                  <>
                    <div className="mb-4 p-3 bg-orange-50 rounded-md border border-orange-200">
                      <p className="text-sm text-orange-900">
                        <strong>{selectedBroker.name}</strong> • {selectedBroker.phone_number}
                      </p>
                      {selectedBroker.area && (
                        <p className="text-xs text-orange-700 mt-1">Area: {selectedBroker.area}</p>
                      )}
                    </div>
                    
                    <textarea
                      value={brokerMessage}
                      onChange={(e) => setBrokerMessage(e.target.value)}
                      placeholder="Enter your message for the broker..."
                      className="w-full h-32 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-4 resize-none"
                      disabled={isSendingBrokerMessage}
                    />
                    
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowBrokerModal(false);
                          setBrokerMessage('');
                          setSelectedBroker(null);
                        }}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                        disabled={isSendingBrokerMessage}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSendBrokerMessage}
                        disabled={isSendingBrokerMessage || !brokerMessage.trim() || !selectedBroker}
                        className="px-4 py-2 text-sm bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {isSendingBrokerMessage ? 'Sending...' : 'Send via WhatsApp'}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-600 mb-4">No brokers assigned to this land record.</p>
                <button
                  onClick={() => setShowBrokerModal(false)}
                  className="px-4 py-2 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completion Modal */}
{showCompletionModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
      {/* Close Button */}
      <button
        onClick={() => setShowCompletionModal(false)}
        disabled={isSendingExternalReview}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Close modal"
      >
        <X className="h-5 w-5" />
      </button>

      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 pr-8">
        <CheckCircle className="h-5 w-5 text-green-600" />
        Mark Land Record as Completed
      </h3>
      
      {/* Comment Section */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Completion Note (Optional)
        </label>
        <textarea
          value={completionComment}
          onChange={(e) => setCompletionComment(e.target.value)}
          placeholder="Add any final notes or comments about this land record..."
          className="w-full h-24 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Broker Section - Only if brokers exist */}
      {brokers.length > 0 && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <h4 className="text-sm font-semibold text-orange-900 mb-3">Broker Information (Optional)</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Broker
              </label>
              <select
                value={selectedBrokerForOffer}
                onChange={(e) => setSelectedBrokerForOffer(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">-- Select Broker --</option>
                {brokers.map(brokerRelation => (
                  <option key={brokerRelation.broker_id} value={brokerRelation.broker_id}>
                    {brokerRelation.broker?.name} - {brokerRelation.broker?.phone_number}
                  </option>
                ))}
              </select>
            </div>

            {selectedBrokerForOffer && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Offer Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={brokerOffer}
                    onChange={(e) => setBrokerOffer(e.target.value)}
                    placeholder="Enter offer amount"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Broker Status
                  </label>
                  <select
                    value={brokerStatusForCompletion}
                    onChange={(e) => setBrokerStatusForCompletion(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">-- Select Status --</option>
                    <option value="pending">Pending</option>
                    <option value="negotiating">Negotiating</option>
                    <option value="deal_closed">Deal Closed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          onClick={() => setShowCompletionModal(false)}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          disabled={isSendingExternalReview}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirmCompletion}
          disabled={isSendingExternalReview}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <CheckCircle className="h-4 w-4" />
          {isSendingExternalReview ? 'Completing...' : 'Confirm Completion'}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}