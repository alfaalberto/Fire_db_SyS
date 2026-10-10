"use client";

import { useRef } from 'react';
import { useTheme } from 'next-themes';
import { Download, KeyRound, ListOrdered, LogOut, Moon, PencilRuler, Sun, Upload, UserRound, Wrench } from 'lucide-react';
import type { AdminControls } from '@/hooks/use-admin';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AdminMenuProps {
  admin: AdminControls;
  editMode: boolean;
  onEditModeChange: (value: boolean) => void;
  onRenumber: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onMaintenance: () => void;
}

const DENIAL_TEXT = {
  'not-listed': 'Esta cuenta no está en la lista de docentes.',
  'rules-pending': 'Las reglas de Firestore publicadas aún no incluyen la lista de docentes. Publica el archivo firestore.rules del repositorio.',
  unknown: 'No se pudo comprobar el permiso. Revisa la conexión e inténtalo de nuevo.',
} as const;

/** Pie del panel lateral: tema claro/oscuro y acceso del docente. */
export function AdminMenu({ admin, editMode, onEditModeChange, onRenumber, onExport, onImport, onMaintenance }: AdminMenuProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { toast } = useToast();
  const importRef = useRef<HTMLInputElement>(null);
  const { state } = admin;

  const signIn = async () => {
    const problem = await admin.signIn();
    if (problem) toast({ title: 'No se pudo iniciar sesión', description: problem, variant: 'destructive' });
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        title="Cambiar entre tema claro y oscuro"
        aria-label="Cambiar entre tema claro y oscuro"
      >
        <Sun className="hidden dark:block" />
        <Moon className="dark:hidden" />
      </Button>

      <div className="min-w-0 flex-1" />

      {state.status === 'signed-out' && (
        <Button variant="ghost" size="sm" onClick={() => void signIn()} disabled={admin.busy} className="text-muted-foreground">
          <KeyRound /> {admin.busy ? 'Abriendo…' : 'Acceso docente'}
        </Button>
      )}

      {state.status === 'checking' && <span className="px-2 text-sm text-muted-foreground">Comprobando permiso…</span>}

      {state.status === 'denied' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="max-w-[12rem] text-destructive">
              <UserRound /> <span className="truncate">Sin permiso</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="break-all font-semibold">{state.user.email}</DropdownMenuLabel>
            <p className="px-2 pb-2 text-sm text-muted-foreground">{DENIAL_TEXT[state.reason]}</p>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void admin.signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {state.status === 'admin' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={editMode ? 'default' : 'ghost'} size="sm" className={editMode ? 'bg-control text-background hover:bg-control/90' : ''}>
              <PencilRuler /> {editMode ? 'Editando' : 'Docente'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="break-all font-semibold">{state.user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={editMode} onCheckedChange={(checked) => onEditModeChange(checked === true)}>
              Modo edición
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem disabled={!editMode} onSelect={onRenumber}>
              <ListOrdered className="mr-2 h-4 w-4" /> Renumerar el temario
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onExport}>
              <Download className="mr-2 h-4 w-4" /> Exportar respaldo
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => importRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Importar respaldo
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onMaintenance}>
              <Wrench className="mr-2 h-4 w-4" /> Mantenimiento
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void admin.signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onImport(file);
        }}
      />
    </div>
  );
}
