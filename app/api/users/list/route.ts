import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

interface UserInfo {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  secondaryEmails: string[];
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      console.log('[API Users List] Unauthorized: No user ID found');
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const client = await clerkClient();
    const requester = await client.users.getUser(userId);
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    
    // Get all users with pagination
    const { data: users } = await client.users.getUserList();
    
    const usersList: UserInfo[] = users.map(user => {
      const primaryEmail = user.primaryEmailAddress?.emailAddress;
      const isAdmin = adminEmail && primaryEmail && adminEmail.toLowerCase() === primaryEmail.toLowerCase();
      const userRoles = (user.publicMetadata as any)?.role || 'No role assigned';
      
      // Get secondary email addresses (all non-primary emails)
      const secondaryEmails = user.emailAddresses
        .filter(emailAddress => 
          emailAddress.id !== user.primaryEmailAddressId && 
          emailAddress.emailAddress
        )
        .map(emailAddress => emailAddress.emailAddress);

      return {
        id: user.id,
        email: primaryEmail || 'No email',
        fullName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || null,
        role: isAdmin ? 'admin' : userRoles,
        secondaryEmails: secondaryEmails
      };
    });
    
    console.log('[API Users List] Retrieved users:', usersList.length);
    return NextResponse.json({ users: usersList });
  } catch (error) {
    console.error('[API Users List] Error:', error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}