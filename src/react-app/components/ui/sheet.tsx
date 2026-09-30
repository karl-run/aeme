import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { XIcon } from "lucide-react";

function Sheet(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetBackdrop({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="sheet-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

const sheetSideClasses = {
  right:
    "inset-y-0 right-0 h-full w-full border-l border-border sm:max-w-lg data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
  left: "inset-y-0 left-0 h-full w-full border-r border-border sm:max-w-lg data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full",
  top: "inset-x-0 top-0 h-auto border-b border-border data-[ending-style]:-translate-y-full data-[starting-style]:-translate-y-full",
  bottom:
    "inset-x-0 bottom-0 h-auto border-t border-border data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full",
} as const;

function SheetContent({
  className,
  children,
  showClose = true,
  side = "right",
  ...props
}: DialogPrimitive.Popup.Props & { showClose?: boolean; side?: keyof typeof sheetSideClasses }) {
  return (
    <SheetPortal>
      <SheetBackdrop />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto bg-background p-6 shadow-lg outline-none transition-transform duration-300 ease-in-out",
          sheetSideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <SheetClose className="absolute top-4 right-4 rounded-sm opacity-60 outline-none transition-opacity hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/30">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
        )}
      </DialogPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5", className)} {...props} />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetBackdrop,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
