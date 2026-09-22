import React from "react";
import { useFarm } from "../../state/FarmContext";
import { NotificationToast } from "./NotificationToast";

export const NotificationToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useFarm();

  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notification alerts"
      className="fixed top-5 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <NotificationToast
            notification={toast.notification}
            onDismiss={() => dismissToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};
