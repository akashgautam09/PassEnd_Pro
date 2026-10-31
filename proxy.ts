import { clerkMiddleware } from "@clerk/nextjs/server";

const publicPaths = ["/sign-in", "/sign-up"];
if (process.env.NODE_ENV !== "production") publicPaths.push("/crypto-proof");

export default clerkMiddleware(async (auth, request) => {
  const isPublicPath = publicPaths.some(
    (path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`),
  );

  if (!isPublicPath) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};