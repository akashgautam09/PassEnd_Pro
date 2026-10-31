import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f5fb] px-5 py-12">
      <Suspense>
        <SignUp />
      </Suspense>
    </main>
  );
}