import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

interface UserRoleUpdate {
  userId: string;
  role: string;
}

export async function POST(req: Request) {
  try {
    const { userId: targetUserId, role } = await req.json() as UserRoleUpdate;
    console.log(`[API Role Update] Received request to set role ${role} for user ${targetUserId}`);
    
    const { userId } = await auth();
    if (!userId) {
      console.log('[API Role Update] Unauthorized: No user ID found');
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get the requester's information and verify admin status
    const client = await clerkClient();
    const requester = await client.users.getUser(userId);
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const requesterEmail = requester.primaryEmailAddress?.emailAddress;
    
    if (!adminEmail || !requesterEmail || adminEmail.toLowerCase() !== requesterEmail.toLowerCase()) {
      console.log('[API Role Update] Unauthorized: Not an admin');
      return new NextResponse("Unauthorized", { status: 403 });
    }

    // Get target user information
    const targetUser = await client.users.getUser(targetUserId);
    
    // Cannot change role of admin
    const targetEmail = targetUser.primaryEmailAddress?.emailAddress;
    if (targetEmail && adminEmail.toLowerCase() === targetEmail.toLowerCase()) {
      console.log(`[API Role Update] Cannot change role of admin user`);
      return new NextResponse("Cannot change role of admin", { status: 400 });
    }

    console.log(`[API Role Update] Updating role for user ${targetUserId} to ${role}`);

    // Update target user's metadata with new role
    await client.users.updateUserMetadata(targetUserId, {
      publicMetadata: {
        role: role
      }
    });

    console.log(`[API Role Update] Successfully set role ${role} for user ${targetUserId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Role Update] Error:', error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}