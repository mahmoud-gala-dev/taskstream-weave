import { toast } from "sonner";

/**
 * Sonner-based replacement for window.confirm. Resolves true when the user
 * presses the confirm action, false when cancelled or dismissed.
 */
export function confirmToast(
  message: string,
  options?: { confirmLabel?: string; cancelLabel?: string; description?: string },
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    toast(message, {
      description: options?.description,
      duration: 10_000,
      action: {
        label: options?.confirmLabel ?? "Confirm",
        onClick: () => settle(true),
      },
      cancel: {
        label: options?.cancelLabel ?? "Cancel",
        onClick: () => settle(false),
      },
      onDismiss: () => settle(false),
      onAutoClose: () => settle(false),
    });
  });
}
