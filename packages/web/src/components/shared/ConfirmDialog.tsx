'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
}

const variantStyles = {
  danger: {
    icon: XCircle,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    confirmBg: 'bg-red-600 hover:bg-red-700',
    confirmText: 'text-white',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    confirmBg: 'bg-amber-600 hover:bg-amber-700',
    confirmText: 'text-white',
  },
  default: {
    icon: Info,
    iconBg: 'bg-gold/10 border border-gold/30',
    iconColor: 'text-gold',
    confirmBg: 'bg-sage hover:bg-sage/90',
    confirmText: 'text-white',
  },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'default',
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const styles = variantStyles[variant];
  const Icon = styles.icon;

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative mx-4 w-full max-w-md luxury-card p-6"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
          >
            <div className="flex items-start gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${styles.iconBg}`}>
                <Icon className={`h-5 w-5 ${styles.iconColor}`} />
              </div>
              <div className="flex-1">
                <h3
                  id="confirm-dialog-title"
                  className="mb-1 text-display-thin text-lg text-ink"
                >
                  {title}
                </h3>
                <p
                  id="confirm-dialog-message"
                  className="text-body-relaxed text-sm text-ink-soft"
                >
                  {message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                ref={cancelRef}
                onClick={onClose}
                className="rounded-md border border-tan/40 px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-cream"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`rounded-md px-4 py-2 text-sm font-medium ${styles.confirmBg} ${styles.confirmText} transition-colors`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
