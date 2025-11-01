import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 w-full max-w-4xl">
        {/* Sign In Box */}
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl={undefined} // disables sign-up link navigation
          appearance={{
            elements: {
              footerAction: { display: 'none' }, // hides the "Don't have an account?" message
            },
          }}
          afterSignInUrl="/"
        />
     

        {/* Vertical Divider - Hidden on mobile */}
        {/* <div className="h-px w-full lg:h-64 lg:w-px bg-gray-200"></div> */}

        {/* Sign Up Prompt */}
        {/* <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md border w-full lg:w-[320px] text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">New Here?</h2>
          <p className="text-gray-600 mb-4 sm:mb-6">Create an account to get started</p>
          <Link href="/sign-up" className="w-full inline-block">
            <button className="w-full bg-violet-800 hover:bg-violet-700 text-white font-medium py-2 sm:py-2.5 px-4 sm:px-6 rounded-md transition-colors duration-200">
              Sign Up
            </button>
          </Link>
        </div> */}
      </div>
    </div>
  );
}