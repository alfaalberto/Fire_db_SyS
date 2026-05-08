"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[APP ERROR]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-8">
      <div className="text-center max-w-md space-y-4">
        <h2 className="text-2xl font-bold text-destructive">Algo salió mal</h2>
        <p className="text-muted-foreground text-sm">
          Ocurrió un error inesperado. Intenta recargar la página.
        </p>
        {error.message && (
          <pre className="text-xs text-left bg-muted p-3 rounded-md overflow-auto max-h-40">
            {error.message}
          </pre>
        )}
        <Button onClick={reset} variant="outline">
          Reintentar
        </Button>
      </div>
    </div>
  );
}
