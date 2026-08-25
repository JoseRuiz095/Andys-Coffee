import type { ReactNode } from "react";
import { Toaster } from "sileo";
import { ThemeProvider } from "../shared/assets/theme";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      {children}
      <Toaster
        position="bottom-right"
        options={{
          fill: "#171717",
          roundness: 16,
          duration: 4000,
          styles: {
            title: "text-white!",
            description: "text-white/75!",
            badge: "bg-white/10!",
            button: "bg-white/10! hover:bg-white/15!",
          },
        }}
      />
    </ThemeProvider>
  );
}
