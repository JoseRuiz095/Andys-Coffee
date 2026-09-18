import type { ReactNode } from "react";
import { Toaster } from "sileo";
import { ThemeProvider } from "../shared/assets/theme";
import { ErrorBoundary } from "../shared/components/ErrorBoundary";
import { GeneralPreferencesProvider } from "../shared/contexts/GeneralPreferencesContext";
import { useSessionValidator } from "../features/auth/hooks/useSessionValidator";

type ProvidersProps = {
  children: ReactNode;
};

function SessionValidatorWrapper({ children }: { children: ReactNode }) {
  useSessionValidator();
  return <>{children}</>;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <GeneralPreferencesProvider>
          <SessionValidatorWrapper>
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
          </SessionValidatorWrapper>
        </GeneralPreferencesProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
