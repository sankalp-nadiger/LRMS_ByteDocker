import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { auth } from '@clerk/nextjs/server';

export async function DELETE(request: NextRequest) {
  try {
    const { userId: currentUserId } = await auth();

    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Prevent users from deleting themselves
    if (userId === currentUserId) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    // Get the current user to check if they're admin
    const client = await clerkClient();
    const currentUser = await client.users.getUser(currentUserId);
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const currentUserEmail = currentUser.primaryEmailAddress?.emailAddress;
    
    // Check if current user is admin
    const isAdmin = adminEmail && currentUserEmail && 
                   adminEmail.toLowerCase() === currentUserEmail.toLowerCase();

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can delete users' },
        { status: 403 }
      );
    }

    // Get the target user to prevent deleting admin
    const targetUser = await client.users.getUser(userId);
    const targetUserEmail = targetUser.primaryEmailAddress?.emailAddress;
    const isTargetAdmin = adminEmail && targetUserEmail && 
                         adminEmail.toLowerCase() === targetUserEmail.toLowerCase();

    if (isTargetAdmin) {
      return NextResponse.json(
        { error: 'Cannot delete administrator account' },
        { status: 400 }
      );
    }

    // Delete user from Clerk
    await client.users.deleteUser(userId);

    return NextResponse.json(
      { message: 'User deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting user:', error);
    
    // Handle specific Clerk errors
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}