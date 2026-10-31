import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f5fb] px-5 py-12">
      <Suspense>
        <SignIn />
      </Suspense>
    </main>
  );
}