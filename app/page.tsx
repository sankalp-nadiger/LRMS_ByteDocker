"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { CheckCircle2, Circle, MapPin, Calendar, User, AlertCircle, Filter, MessageSquare, ClipboardCheck, FileSearch } from 'lucide-react';
import { createChat, createActivityLog , supabase } from '@/lib/supabase';
import { useUserRole } from '@/contexts/user-context';

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
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { role } = useUserRole();
  useEffect(() => {
  if (role) { // Only fetch when role is available
    fetchUserRoleAndTasks();
  }
}, [user, role]);

 const fetchUserRoleAndTasks = async () => {
  if (!user?.primaryEmailAddress?.emailAddress || !role) return; // Check role exists

  try {
    setLoading(true);
    const userEmail = user.primaryEmailAddress.emailAddress;
    console.log(`[Fetch Data] User Email: ${userEmail}, Role: ${role}`);
    // Fetch data based on role - use 'role' directly
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
  }
};

  const fetchReviewerTasks = async (userEmail: string) => {
    try {
      // Fetch all land records with status 'review'
      const { data: landRecords, error: landError } = await supabase
        .from('land_records')
        .select('id, village, taluka, district, block_no, status, reviewed_by')
        .eq('status', 'review')
        .order('updated_at', { ascending: false });

      if (landError) throw landError;

      // Filter out land records already reviewed by this user
      const pendingReviews = (landRecords || []).filter(land => {
        const reviewedBy = land.reviewed_by || [];
        return !reviewedBy.includes(userEmail);
      });
      console.log('Pending Reviews:', pendingReviews);
      // Fetch comments (messages) for these land records
      const landIds = pendingReviews.map(lr => lr.id);
      const { data: comments, error: commentsError } = await supabase
        .from('chats')
        .select('*')
        .in('land_record_id', landIds)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;

      // Group by land record
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
      // Fetch chats where user is in to_email but NOT in tasks_completed
      const { data: chats, error } = await supabase
        .from('chats')
        .select('*')
        .contains('to_email', [userEmail])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out tasks where user has already marked as completed
      const pendingTasks = (chats || []).filter(chat => {
        const tasksCompleted = chat.tasks_completed || [];
        return !tasksCompleted.includes(userEmail);
      });

      // Fetch land record details
      const landRecordIds = [...new Set(pendingTasks.map(t => t.land_record_id))];
      const { data: landRecords, error: landError } = await supabase
        .from('land_records')
        .select('id, village, taluka, district, block_no, status')
        .in('id', landRecordIds);

      if (landError) throw landError;

      const landRecordMap = new Map(
        (landRecords || []).map(lr => [lr.id, lr])
      );

      // Group tasks by land record
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
      // Fetch all chats where user is in to_email
      const { data: chats, error } = await supabase
        .from('chats')
        .select('*')
        .contains('to_email', [userEmail])
        .order('created_at', { ascending: false });

      if (error) throw error;

       // Filter out chats where manager has already read (their email is in read_by)
      const unreadChats = (chats || []).filter(chat => {
        const readBy = chat.read_by || [];
        return !readBy.includes(userEmail);
      });

      // Fetch land record details
      const landRecordIds = [...new Set((unreadChats || []).map(t => t.land_record_id))];
      const { data: landRecords, error: landError } = await supabase
        .from('land_records')
        .select('id, village, taluka, district, block_no, status')
        .in('id', landRecordIds);

      if (landError) throw landError;

      const landRecordMap = new Map(
        (landRecords || []).map(lr => [lr.id, lr])
      );

      // Group messages by land record
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
      // For reviewer: Mark land record as reviewed and update status
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

      // Create activity log for review completion
      await createActivityLog({
        user_email: userEmail,
        land_record_id: landRecordId,
        step: null,
        chat_id: null,
        description: `Review completed by ${userEmail}. Status updated to 'query'.`,
      });
    } else if (role === 'executioner') {
      // For executioner: Mark task as completed
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

        // ✅ Create activity log for task completion
        await createActivityLog({
          user_email: userEmail,
          land_record_id: currentChat.land_record_id,
          step: currentChat.step || null,
          chat_id: taskId,
          description: `Task completed by ${userEmail}. Task: "${currentChat.message}"`,
        });

        // ✅ Create reversed chat (executioner reply)
        await createChat({
          from_email: currentChat.to_email,     // invert
          to_email: currentChat.from_email,     // invert
          message: currentChat.message,         // same description/message
          land_record_id: currentChat.land_record_id,
          step: currentChat.step,
        });
      }
    }

    // Refresh data after completion
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
          color: 'from-purple-600 to-pink-600'
        };
      case 'executioner':
        return {
          title: 'Action Items',
          subtitle: 'Tasks assigned to you',
          icon: ClipboardCheck,
          color: 'from-blue-600 to-purple-600'
        };
      default:
        return {
          title: 'Messages',
          subtitle: 'Communications and updates',
          icon: MessageSquare,
          color: 'from-green-600 to-blue-600'
        };
    }
  };

  const headerConfig = getHeaderConfig();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your {role === 'reviewer' ? 'reviews' : role === 'executioner' ? 'tasks' : 'messages'}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className={`bg-gradient-to-r ${headerConfig.color} p-4 rounded-xl shadow-lg`}>
                <headerConfig.icon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  {headerConfig.title}
                </h1>
                <p className="text-gray-600">
                  {headerConfig.subtitle} • {totalCount} {role === 'reviewer' ? 'pending' : 'items'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white px-6 py-3 rounded-lg shadow-sm border border-gray-200">
                <div className="text-3xl font-bold text-blue-600">{totalCount}</div>
                <div className="text-xs text-gray-600 uppercase tracking-wide">
                  {role === 'reviewer' ? 'Reviews' : role === 'executioner' ? 'Tasks' : 'Threads'}
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          {uniqueStatuses.length > 1 && (
            <div className="flex items-center gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <Filter className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter by status:</span>
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white'
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
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      filterStatus === status
                        ? 'bg-blue-600 text-white'
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center">
            <CheckCircle2 className="h-20 w-20 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">All Caught Up! 🎉</h2>
            <p className="text-gray-600">
              {role === 'reviewer'
                ? 'No reviews pending at the moment.'
                : role === 'executioner'
                ? 'You have no pending tasks.'
                : 'No new messages.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(filteredGroupedTasks).map(([landRecordId, group]) => (
              <div
                key={landRecordId}
                className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300"
              >
                {/* Land Record Header */}
                <div className={`bg-gradient-to-r ${headerConfig.color} text-white p-6`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
                        <MapPin className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-2">
                          {group.land_record.village}, {group.land_record.taluka}
                        </h2>
                        <div className="flex flex-wrap gap-3 text-sm">
                          <span className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                            Block: {group.land_record.block_no}
                          </span>
                          <span className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                            District: {group.land_record.district}
                          </span>
                          <span className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm capitalize">
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
                        className="ml-4 bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {completingTask === landRecordId ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-600 border-t-transparent" />
                            Completing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-5 w-5" />
                            Complete Review
                          </>
                        )}
                      </button>
                    )}
                    
                    {/* Non-reviewer: Show count */}
                    {role !== 'reviewer' && (
                      <div className="bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm ml-4">
                        <span className="font-bold">{group.tasks.length}</span> {role === 'executioner' ? 'task' : 'message'}{group.tasks.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Comments/Tasks/Messages List */}
                <div className="p-6">
                  {group.tasks.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {role === 'reviewer' ? 'Comments' : role === 'executioner' ? 'Tasks' : 'Messages'}
                      </h3>
                      {group.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="group relative bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all duration-300"
                        >
                          <div className="flex items-start gap-4">
                            {/* Checkbox (only for executioner) */}
                            {role === 'executioner' && (
                              <button
                                onClick={() => handleCompleteTask(task.id)}
                                disabled={completingTask === task.id}
                                className="flex-shrink-0 mt-1 transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
                              >
                                {completingTask === task.id ? (
                                  <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-600 border-t-transparent" />
                                ) : (
                                  <Circle className="h-7 w-7 text-gray-400 group-hover:text-blue-600 transition-colors" strokeWidth={2.5} />
                                )}
                              </button>
                            )}

                            {/* Message icon for reviewer/manager */}
                            {role !== 'executioner' && (
                              <div className="flex-shrink-0 mt-1">
                                <MessageSquare className="h-6 w-6 text-gray-400" />
                              </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {task.step && (
                                <div className="inline-flex items-center gap-2 mb-2">
                                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                                    Step {task.step}
                                  </span>
                                </div>
                              )}

                              <p className="text-gray-900 font-medium mb-3 leading-relaxed">
                                {task.message}
                              </p>

                              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-1.5">
                                  <User className="h-4 w-4 text-gray-400" />
                                  <span>From: {task.from_email}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-4 w-4 text-gray-400" />
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
                                <div className="bg-red-100 text-red-700 p-2 rounded-lg" title="Task is over 7 days old">
                                  <AlertCircle className="h-5 w-5" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-4">
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