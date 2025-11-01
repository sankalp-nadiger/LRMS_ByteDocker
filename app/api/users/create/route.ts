import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      console.log('[API Create User] Unauthorized: No user ID found');
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if the requester is admin
    const client = await clerkClient();
    const requester = await client.users.getUser(userId);
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const requesterEmail = requester.primaryEmailAddress?.emailAddress;
    
    if (!adminEmail || !requesterEmail || adminEmail.toLowerCase() !== requesterEmail.toLowerCase()) {
      console.log('[API Create User] Unauthorized: Not an admin');
      return new NextResponse("Unauthorized", { status: 403 });
    }

    // Get request body
    const { firstName, lastName, email, role } = await req.json() as CreateUserRequest;

    // Validate input
    if (!firstName || !email || !role) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Check if user already exists
    const existingUsers = await client.users.getUserList({ emailAddress: [email] });
    if (existingUsers.data.length > 0) {
      const existingUser = existingUsers.data[0];
      return NextResponse.json({ 
        success: false,
        message: "User with this email already exists",
        user: {
          id: existingUser.id,
          email: existingUser.emailAddresses[0]?.emailAddress,
          fullName: `${existingUser.firstName} ${existingUser.lastName || ''}`.trim(),
          role: existingUser.publicMetadata?.role || 'No role assigned'
        }
      }, { status: 409 });
    }

    // Create user directly with temporary password
    const temporaryPassword = generateTemporaryPassword();
    
    const newUser = await client.users.createUser({
      firstName,
      lastName: lastName || undefined,
      emailAddress: [email],
      password: temporaryPassword,
      publicMetadata: {
        role,
        temporaryPassword: true // Flag to indicate they need to reset password
      }
    });

    console.log('[API Create User] Created user:', {
      id: newUser.id,
      email,
      role
    });

    // Send invitation email (you can implement this with your email service)
    await sendInvitationEmail(email, firstName, temporaryPassword);

    return NextResponse.json({ 
      success: true,
      user: {
        id: newUser.id,
        email,
        fullName: lastName ? `${firstName} ${lastName}` : firstName,
        role
      },
      message: "User created successfully."
    });
  } catch (error) {
    console.error('[API Create User] Error:', error);
    
    // More detailed error handling
    if (error instanceof Error) {
      if (error.status === 422) {
        return new NextResponse("Invalid user data provided", { status: 422 });
      } else if (error.status === 400) {
        return new NextResponse("Bad request - check email format and required fields", { status: 400 });
      }
    }
    
    return new NextResponse(
      error instanceof Error ? error.message : "Internal Server Error",
      { status: 500 }
    );
  }
}

// Helper function to generate temporary password
function generateTemporaryPassword(): string {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Mock email function - replace with your actual email service
async function sendInvitationEmail(email: string, firstName: string, temporaryPassword: string): Promise<void> {
  console.log(`[EMAIL] Invitation sent to ${email}`);
  console.log(`Temporary password: ${temporaryPassword}`);
  console.log(`Login URL: ${process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in'}`);
  
  // In production, integrate with your email service (Resend, SendGrid, etc.)
  // Example with Resend:
  /*
  await resend.emails.send({
    from: 'your-app@yourdomain.com',
    to: email,
    subject: 'Welcome to Our App',
    html: `
      <h1>Welcome, ${firstName}!</h1>
      <p>Your account has been created.</p>
      <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
      <p>Please sign in at: ${process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL}</p>
      <p>You'll be asked to reset your password on first login.</p>
    `
  });
  */
}