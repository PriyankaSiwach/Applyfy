import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { HomePageContent } from "@/components/landing/HomePageContent";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }
  return <HomePageContent />;
}
