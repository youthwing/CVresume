"use client";

import {ThemeProvider} from "@/components/providers/theme-provider";
import {AuthProvider} from "@/components/providers/auth-provider";
import {Toaster} from "sonner";

export function AppProviders({children}: {children: React.ReactNode}) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}
