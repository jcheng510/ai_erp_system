import { toast as sonnerToast } from "sonner";

export const useToast = () => {
  return {
    toast: sonnerToast,
  };
};

export { sonnerToast as toast };
