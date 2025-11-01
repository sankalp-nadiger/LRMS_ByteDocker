import { RedirectToUserProfile } from '@clerk/nextjs';

export default function SSOCallback() {
  return <RedirectToUserProfile />;
}