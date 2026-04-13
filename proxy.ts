import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Page routes that require a signed-in user.
// API routes handle their own auth — they are NOT blocked here, but Clerk
// context (auth()) must still be initialized for them, so the matcher below
// includes /api/* so clerkMiddleware runs on every request.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/my-application(.*)",
  "/tracker(.*)",
  "/resume-editor(.*)",
  "/salary-coach(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on all page routes and API routes; skip Next.js internals and static assets.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always include API routes so Clerk auth() context is available inside handlers.
    "/(api|trpc)(.*)",
  ],
};
