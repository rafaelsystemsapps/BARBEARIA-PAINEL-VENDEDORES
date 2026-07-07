import { useTransition } from "react";
import { toast } from "sonner";

type ServerActionResult = { error?: string; success?: string } | void | null | undefined;

export function useServerAction() {
  const [isPending, startTransition] = useTransition();

  function executeAction<T extends ServerActionResult>(
    actionFn: () => Promise<T>,
    options?: {
      onSuccess?: (res: T) => void;
      successMessage?: string;
    }
  ) {
    startTransition(async () => {
      try {
        const res = await actionFn();
        if (res?.error) {
          toast.error(res.error);
        } else {
          const finalMsg = options?.successMessage ?? res?.success;
          if (finalMsg) toast.success(finalMsg);
          options?.onSuccess?.(res);
        }
      } catch (err) {
        console.error(err);
        toast.error("Ocorreu um erro inesperado.");
      }
    });
  }

  return { isPending, executeAction };
}
