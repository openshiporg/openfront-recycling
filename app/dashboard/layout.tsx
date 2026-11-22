import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { getDashboardBusiness } from "@/features/dashboard/lib/business";

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getDashboardBusiness();
  return { title: { default: `${name} · Dashboard`, template: `%s · ${name}` }, description: `${name} staff dashboard` };
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <Toaster />
    </ThemeProvider>
  );
}
