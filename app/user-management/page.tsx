"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useUserRole } from "@/contexts/user-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateUserDialog } from "@/components/create-user-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

interface UserInfo {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const { user: currentUser } = useUser();
  const { isAdmin } = useUserRole();
  
  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/users/list');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUsers();
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setUpdatingUserId(userId);
      const response = await fetch('/api/users/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          role: newRole
        })
      });

      if (!response.ok) throw new Error('Failed to update user role');

      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(userInfo => 
          userInfo.id === userId ? { ...userInfo, role: newRole } : userInfo
        )
      );
    } catch (error) {
      console.error('Error updating user role:', error);
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">You don't have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage user roles and view user information</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <CreateUserDialog onUserCreated={() => fetchUsers()} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading users...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email Address</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userInfo) => {
                  const isAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL === userInfo.email;
                  const isUpdating = updatingUserId === userInfo.id;
                  return (
                    <TableRow key={userInfo.id}>
                      <TableCell>{userInfo.fullName || 'N/A'}</TableCell>
                      <TableCell>{userInfo.email}</TableCell>
                      <TableCell>{userInfo.role.charAt(0).toUpperCase() + userInfo.role.slice(1)}</TableCell>
                      <TableCell>
                        {!isAdminEmail && (
                          <div className="flex items-center gap-2">
                            <Select
                              value={userInfo.role}
                              onValueChange={(value) => handleRoleChange(userInfo.id, value)}
                              disabled={isAdminEmail || isUpdating}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="executioner">Executioner</SelectItem>
                                <SelectItem value="reviewer">Reviewer</SelectItem>
                              </SelectContent>
                            </Select>
                            {isUpdating && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}