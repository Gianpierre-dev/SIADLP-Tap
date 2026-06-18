'use client';

import { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';

export function PasswordInput({
  className,
  onKeyDown,
  onKeyUp,
  onFocus,
  onBlur,
  ...props
}: React.ComponentProps<'input'>) {
  const [show, setShow] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [focused, setFocused] = useState(false);

  const detectarCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          className={cn('pr-9', className)}
          onKeyDown={(e) => {
            detectarCapsLock(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            detectarCapsLock(e);
            onKeyUp?.(e);
          }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            setCapsLockOn(false);
            onBlur?.(e);
          }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={show}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          {show ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {focused && capsLockOn && (
        <p
          className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500"
          role="alert"
        >
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          Bloq Mayús está activo
        </p>
      )}
    </div>
  );
}
