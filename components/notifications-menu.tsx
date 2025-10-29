"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Bell, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAllChats, markChatAsRead } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

interface LandRecord {
  id: string;
  village: string;
  taluka: string;
  district: string;
  block_no: string;
  status: string;
}

interface NotificationChat {
  id: string;
  message: string;
  land_record_id: string;
  from_email: string;
  created_at: string;
  land_record?: LandRecord;
}

export function NotificationsMenu() {
  const { user } = useUser();
  const router = useRouter();
  const [unreadChats, setUnreadChats] = useState<NotificationChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUnreadChats = async () => {
      if (!user?.primaryEmailAddress?.emailAddress) return;

      try {
        const userEmail = user.primaryEmailAddress.emailAddress;
        const chats = await getAllChats({ user_email: userEmail });
        
        // Filter for unread chats where the user is in to_email and not in read_by
        const unreads = chats.filter(chat => {
          if (!chat.to_email?.includes(userEmail)) return false;
          if (!chat.read_by) return true;
          return !chat.read_by.includes(userEmail);
        });

        // Fetch land record details for each unread chat
        const chatsWithLandInfo = await Promise.all(
          unreads.map(async (chat) => {
            try {
              const { data: landRecord, error } = await supabase
                .from('land_records')
                .select('id, village, taluka, district, block_no, status')
                .eq('id', chat.land_record_id)
                .single();

              if (error) throw error;

              return {
                ...chat,
                land_record: landRecord
              };
            } catch (error) {
              console.error(`Error fetching land record ${chat.land_record_id}:`, error);
              return chat;
            }
          })
        );

        setUnreadChats(chatsWithLandInfo);
      } catch (error) {
        console.error('Error fetching unread chats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnreadChats();
    
    // Poll for new messages every 30 seconds
    const interval = setInterval(fetchUnreadChats, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleNotificationClick = async (chat: NotificationChat) => {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    try {
      // Mark as read
      await markChatAsRead(chat.id, user.primaryEmailAddress.emailAddress);
      
      // Update local state
      setUnreadChats(prev => prev.filter(c => c.id !== chat.id));
      
      // Navigate to timeline with the specific land record
      router.push(`/timeline?landId=${chat.land_record_id}`);
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadChats.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadChats.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-gray-500">Loading notifications...</div>
        ) : unreadChats.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">No new messages</div>
        ) : (
          unreadChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => handleNotificationClick(chat)}
              className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-0 transition-colors"
            >
              {/* Land Record Info Header */}
              {chat.land_record && (
                <div className="mb-2 pb-2 border-b border-gray-200">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {chat.land_record.village}, {chat.land_record.taluka}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        Block No: {chat.land_record.block_no} | District: {chat.land_record.district}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Status: <span className="capitalize font-medium">{chat.land_record.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Message Content */}
              <div className="text-sm font-medium text-gray-900 mb-1">
                New message from {chat.from_email}
              </div>
              <div className="text-sm text-gray-600 mt-1 line-clamp-2 bg-gray-50 p-2 rounded">
                {chat.message}
              </div>
              <div className="text-xs text-gray-400 mt-2 flex items-center justify-between">
                <span>{new Date(chat.created_at).toLocaleString()}</span>
                <span className="text-blue-600 font-medium">Click to view →</span>
              </div>
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}