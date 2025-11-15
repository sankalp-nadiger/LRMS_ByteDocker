"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { CheckCircle2, Circle, MapPin, Calendar, User, AlertCircle, Filter, MessageSquare, ClipboardCheck, FileSearch, RefreshCw } from 'lucide-react';
import { createChat, createActivityLog , supabase } from '@/lib/supabase';
import { useUserRole } from '@/contexts/user-context';
import { useRouter } from 'next/navigation';

interface LandRecord {
  id: string;
  village: string;
  taluka: string;
  district: string;
  block_no: string;
  status: string;
}

interface Task {
  id: string;
  message: string;
  from_email: string;
  created_at: string;
  step: number | null;
  land_record_id: string;
  land_record?: LandRecord;
}

interface GroupedTasks {
  [landRecordId: string]: {
    land_record: LandRecord;
    tasks: Task[];
  };
}

type UserRole = 'reviewer' | 'executioner' | 'manager' | 'admin';

export default function TasksDashboard() {
  const { user } = useUser();
  const [groupedTasks, setGroupedTasks] = useState<GroupedTasks>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { role } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (role) {
      fetchUserRoleAndTasks();
    }
  }, [user, role]);

  const fetchUserRoleAndTasks = async (isRefresh = false) => {
    if (!user?.primaryEmailAddress?.emailAddress || !role) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const userEmail = user.primaryEmailAddress.emailAddress;
      console.log(`[Fetch Data] User Email: ${userEmail}, Role: ${role}`);
      
      if (role === 'reviewer') {
        await fetchReviewerTasks(userEmail);
      } else if (role === 'executioner') {
        await fetchExecutionerTasks(userEmail);
      } else if (role === 'manager' || role === 'admin') {
        await fetchManagerMessages(userEmail);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchUserRoleAndTasks(true);
  };

  const fetchReviewerTasks = async (userEmail: string) => {
    try {
      const { data: landRecords, error: landError } = await supabase
        .from('land_records')
        .select('id, village, taluka, district, block_no, status, reviewed_by')
        .eq('status', 'review')
        .order('updated_at', { ascending: false });

      if (landError) throw landError;

      const pendingReviews = (landRecords || []).filter(land => {
        const reviewedBy = land.reviewed_by || [];
        return !reviewedBy.includes(userEmail);
      });
      console.log('Pending Reviews:', pendingReviews);

      const landIds = pendingReviews.map(lr => lr.id);
      const { data: comments, error: commentsError } = await supabase
        .from('chats')
        .select('*')
        .in('land_record_id', landIds)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;

      const grouped: GroupedTasks = {};
      pendingReviews.forEach(land => {
        const landComments = (comments || []).filter(c => c.land_record_id === land.id);
        grouped[land.id] = {
          land_record: land,
          tasks: landComments.map(c => ({
            id: c.id,
            message: c.message,
            from_email: c.from_email,
            created_at: c.created_at,
            step: c.step,
            land_record_id: c.land_record_id,
            land_record: land
          }))
        };
      });
      console.log('Grouped Reviewer Tasks:', grouped);
      setGroupedTasks(grouped);
    } catch (error) {
      console.error('Error fetching reviewer tasks:', error);
    }
  };

  const fetchExecutionerTasks = async (userEmail: string) => {
    try {
      const { data: chats, error } = await supabase
        .from('chats')
        .select('*')
        .contains('to_email', [userEmail])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const pendingTasks = (chats || []).filter(chat => {
        const tasksCompleted = chat.tasks_completed || [];
        return !tasksCompleted.includes(userEmail);
      });

      const landRecordIds = [...new Set(pendingTasks.map(t => t.land_record_id))];
      const { data: landRecords, error: landError } = await supabase
        .from('land_records')
        .select('id, village, taluka, district, block_no, status')
        .in('id', landRecordIds);

      if (landError) throw landError;

      const landRecordMap = new Map(
        (landRecords || []).map(lr => [lr.id, lr])
      );

      const grouped: GroupedTasks = {};
      pendingTasks.forEach(task => {
        const landRecord = landRecordMap.get(task.land_record_id);
        if (!landRecord) return;

        if (!grouped[task.land_record_id]) {
          grouped[task.land_record_id] = {
            land_record: landRecord,
            tasks: []
          };
        }

        grouped[task.land_record_id].tasks.push({
          id: task.id,
          message: task.message,
          from_email: task.from_email,
          created_at: task.created_at,
          step: task.step,
          land_record_id: task.land_record_id,
          land_record: landRecord
        });
      });

      setGroupedTasks(grouped);
    } catch (error) {
      console.error('Error fetching executioner tasks:', error);
    }
  };

  const fetchManagerMessages = async (userEmail: string) => {
    try {
      const { data: chats, error } = await supabase
        .from('chats')
        .select('*')
        .contains('to_email', [userEmail])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const unreadChats = (chats || []).filter(chat => {
        const readBy = chat.read_by || [];
        return !readBy.includes(userEmail);
      });

      const landRecordIds = [...new Set((unreadChats || []).map(t => t.land_record_id))];
      const { data: landRecords, error: landError } = await supabase
        .from('land_records')
        .select('id, village, taluka, district, block_no, status')
        .in('id', landRecordIds);

      if (landError) throw landError;

      const landRecordMap = new Map(
        (landRecords || []).map(lr => [lr.id, lr])
      );

      const grouped: GroupedTasks = {};
      (chats || []).forEach(chat => {
        const landRecord = landRecordMap.get(chat.land_record_id);
        if (!landRecord) return;

        if (!grouped[chat.land_record_id]) {
          grouped[chat.land_record_id] = {
            land_record: landRecord,
            tasks: []
          };
        }

        grouped[chat.land_record_id].tasks.push({
          id: chat.id,
          message: chat.message,
          from_email: chat.from_email,
          created_at: chat.created_at,
          step: chat.step,
          land_record_id: chat.land_record_id,
          land_record: landRecord
        });
      });

      setGroupedTasks(grouped);
    } catch (error) {
      console.error('Error fetching manager messages:', error);
    }
  };

  const handleCompleteTask = async (taskId: string, landRecordId?: string) => {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    try {
      setCompletingTask(taskId);
      const userEmail = user.primaryEmailAddress.emailAddress;

      if (role === 'reviewer') {
        if (!landRecordId) return;

        const { data: currentLand, error: fetchError } = await supabase
          .from('land_records')
          .select('reviewed_by')
          .eq('id', landRecordId)
          .single();

        if (fetchError) throw fetchError;

        const reviewedBy = currentLand?.reviewed_by || [];

        const { error: updateError } = await supabase
          .from('land_records')
          .update({
            status: 'query',
            reviewed_by: [...reviewedBy, userEmail],
            updated_at: new Date().toISOString(),
          })
          .eq('id', landRecordId);

        if (updateError) throw updateError;

        await createActivityLog({
          user_email: userEmail,
          land_record_id: landRecordId,
          step: null,
          chat_id: null,
          description: `Review completed by ${userEmail}. Status updated to 'query'.`,
        });
      } else if (role === 'executioner') {
        const { data: currentChat, error: fetchError } = await supabase
          .from('chats')
          .select('tasks_completed, land_record_id, message, step, from_email, to_email')
          .eq('id', taskId)
          .single();

        if (fetchError) throw fetchError;

        const tasksCompleted = currentChat?.tasks_completed || [];

        if (!tasksCompleted.includes(userEmail)) {
          const { error: updateError } = await supabase
            .from('chats')
            .update({
              tasks_completed: [...tasksCompleted, userEmail],
            })
            .eq('id', taskId);

          if (updateError) throw updateError;

          await createActivityLog({
            user_email: userEmail,
            land_record_id: currentChat.land_record_id,
            step: currentChat.step || null,
            chat_id: taskId,
            description: `Task completed by ${userEmail}. Task: "${currentChat.message}"`,
          });
        }
      }

      await fetchUserRoleAndTasks();
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Failed to mark as complete. Please try again.');
    } finally {
      setCompletingTask(null);
    }
  };

  const filteredGroupedTasks = Object.entries(groupedTasks).reduce((acc, [landId, data]) => {
    if (filterStatus === 'all' || data.land_record.status === filterStatus) {
      acc[landId] = data;
    }
    return acc;
  }, {} as GroupedTasks);

  const totalCount = Object.values(groupedTasks).length;

  const uniqueStatuses = [...new Set(
    Object.values(groupedTasks).map(g => g.land_record.status)
  )];

  const getHeaderConfig = () => {
    switch (role) {
      case 'reviewer':
        return {
          title: 'Reviews Pending',
          subtitle: 'Land records awaiting your review',
          icon: FileSearch,
        };
      case 'executioner':
        return {
          title: 'Action Items',
          subtitle: 'Tasks assigned to you',
          icon: ClipboardCheck,
        };
      default:
        return {
          title: 'Messages',
          subtitle: 'Communications and updates',
          icon: MessageSquare,
        };
    }
  };

  const headerConfig = getHeaderConfig();

 // Check if user is not signed in
if (!user) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
        <p className="text-sm text-gray-600">Please sign in to access your dashboard</p>
      </div>
    </div>
  );
}

if (loading) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-3"></div>
        <p className="text-sm text-gray-600">Loading your {role === 'reviewer' ? 'reviews' : role === 'executioner' ? 'tasks' : 'messages'}...</p>
      </div>
    </div>
  );
}

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-gray-900 p-2.5 rounded-lg shadow">
                <headerConfig.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {headerConfig.title}
                </h1>
                <p className="text-sm text-gray-600">
                  {headerConfig.subtitle} • {totalCount} {role === 'reviewer' ? 'pending' : 'items'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-900">
                <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
                <div className="text-xs text-gray-600 uppercase tracking-wide">
                  {role === 'reviewer' ? 'Reviews' : role === 'executioner' ? 'Tasks' : 'Threads'}
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          {uniqueStatuses.length > 1 && (
            <div className="flex items-center gap-2 bg-white p-3 rounded-lg shadow-sm border border-gray-300">
              <Filter className="h-4 w-4 text-gray-700" />
              <span className="text-xs font-medium text-gray-900">Filter:</span>
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({totalCount})
              </button>
              {uniqueStatuses.map(status => {
                const count = Object.values(groupedTasks).filter(
                  g => g.land_record.status === status
                ).length;
                return (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                      filterStatus === status
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content Grid */}
        {Object.keys(filteredGroupedTasks).length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-300 p-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-gray-900" />
            <h2 className="text-xl font-bold text-gray-900 mb-1">All Caught Up!</h2>
            <p className="text-sm text-gray-600">
              {role === 'reviewer'
                ? 'No reviews pending at the moment.'
                : role === 'executioner'
                ? 'You have no pending tasks.'
                : 'No new messages.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(filteredGroupedTasks).map(([landRecordId, group]) => (
              <div
                key={landRecordId}
                className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden hover:shadow-md hover:border-gray-900 transition-all duration-300"
              >
                {/* Land Record Header */}
                <div className="bg-gray-900 text-white p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2.5 flex-1">
                      <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg font-bold mb-1.5">
                          {group.land_record.village}, {group.land_record.taluka}
                        </h2>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm">
                            Block: {group.land_record.block_no}
                          </span>
                          <span className="bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm">
                            District: {group.land_record.district}
                          </span>
                          <span className="bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm capitalize">
                            Status: {group.land_record.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Reviewer: Complete Review Button */}
                    {role === 'reviewer' && (
                      <button
                        onClick={() => handleCompleteTask(landRecordId, landRecordId)}
                        disabled={completingTask === landRecordId}
                        className="ml-3 bg-white text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {completingTask === landRecordId ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900 border-t-transparent" />
                            Completing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Complete
                          </>
                        )}
                      </button>
                    )}
                    
                    {/* Non-reviewer: Show count */}
                    {role !== 'reviewer' && (
                      <div className="bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm ml-3 text-sm">
                        <span className="font-bold">{group.tasks.length}</span> {role === 'executioner' ? 'task' : 'msg'}{group.tasks.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Comments/Tasks/Messages List */}
                <div className="p-4">
                  {group.tasks.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">
                        {role === 'reviewer' ? 'Comments' : role === 'executioner' ? 'Tasks' : 'Messages'}
                      </h3>
                      {group.tasks.map((task) => (
  <div
    key={task.id}
    onClick={() => {
      if (role === 'executioner') {
        const step = task.step || 1;
        router.push(`/land-master/forms?mode=edit&id=${task.land_record_id}&step=${step}&message=${encodeURIComponent(task.message)}`);
      }
    }}
    className={`group relative bg-gray-50 border border-gray-300 rounded-lg p-3 hover:border-gray-900 hover:shadow-sm transition-all duration-300 ${
      role === 'executioner' ? 'cursor-pointer' : ''
    }`}
  >
                          <div className="flex items-start gap-3">
                            {/* Checkbox (only for executioner) */}
                            {role === 'executioner' && (
                              <button
                                onClick={() => handleCompleteTask(task.id)}
                                disabled={completingTask === task.id}
                                className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
                              >
                                {completingTask === task.id ? (
                                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-900 border-t-transparent" />
                                ) : (
                                  <Circle className="h-5 w-5 text-gray-400 group-hover:text-gray-900 transition-colors" strokeWidth={2.5} />
                                )}
                              </button>
                            )}

                            {/* Message icon for reviewer/manager */}
                            {role !== 'executioner' && (
                              <div className="flex-shrink-0 mt-0.5">
                                <MessageSquare className="h-4 w-4 text-gray-600" />
                              </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {task.step && (
                                <div className="inline-flex items-center gap-1.5 mb-1.5">
                                  <span className="bg-gray-900 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                                    Step {task.step}
                                  </span>
                                </div>
                              )}

                              <p className="text-sm text-gray-900 font-medium mb-2 leading-relaxed">
                                {task.message}
                              </p>

                              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                                <div className="flex items-center gap-1">
                                  <User className="h-3.5 w-3.5 text-gray-500" />
                                  <span>From: {task.from_email}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5 text-gray-500" />
                                  <span>{new Date(task.created_at).toLocaleDateString('en-GB', { 
                                    day: 'numeric', 
                                    month: 'short', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}</span>
                                </div>
                              </div>
                            </div>

                            {/* Urgency Indicator (only for executioner tasks) */}
                            {role === 'executioner' && new Date().getTime() - new Date(task.created_at).getTime() > 7 * 24 * 60 * 60 * 1000 && (
                              <div className="flex-shrink-0">
                                <div className="bg-gray-900 text-white p-1.5 rounded-lg" title="Task is over 7 days old">
                                  <AlertCircle className="h-4 w-4" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-gray-500 py-3">
                      No {role === 'reviewer' ? 'comments' : 'messages'} yet
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}