import { ReactNode } from "react";

export function EmptyState({ 
  message, 
  children,
  icon 
}: { 
  message?: ReactNode; 
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      {icon && <div className="mb-4 flex justify-center text-muted-foreground">{icon}</div>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {children}
    </div>
  );
}
