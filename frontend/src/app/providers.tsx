import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
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
      {/* Page and dialog animations follow the system "reduce motion" setting, like the CSS ones. */}
      <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <GeneralPreferencesProvider>
          <SessionValidatorWrapper>
            {children}
            <Toaster
              // Top center: at the bottom right they covered "Procesar orden" for seconds after
              // every sale (and the total of the POS).
              position="top-center"
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
      </MotionConfig>
    </ErrorBoundary>
  );
}
