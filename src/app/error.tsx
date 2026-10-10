"use client";

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[Señales y Sistemas]', error);
  }, [error]);

  return (
    <div className="flex h-dvh items-center justify-center bg-background p-8 text-foreground">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="font-display text-2xl font-semibold">La página encontró un error</h1>
        <p className="text-muted-foreground">Puedes volver a intentarlo. Si se repite, recarga la página; tu avance y los borradores están guardados.</p>
        {error.digest && <p className="font-mono text-xs text-soft">Referencia: {error.digest}</p>}
        <div className="flex justify-center gap-2">
          <Button onClick={reset}>Reintentar</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Recargar
          </Button>
        </div>
      </div>
    </div>
  );
}
