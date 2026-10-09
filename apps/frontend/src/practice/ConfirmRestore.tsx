import * as AlertDialog from "@radix-ui/react-alert-dialog";
export function ConfirmRestore({
  onConfirm,
  disabled,
}: {
  onConfirm: () => void;
  disabled: boolean;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger disabled={disabled}>
        Restaurar inicial
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-40px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6 shadow-2xl">
          <AlertDialog.Title className="mt-0 text-xl">
            Restaurar código inicial?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm leading-relaxed text-subtle">
            O código desta revisão será substituído pelo exemplo inicial. Copie
            ou baixe sua solução antes de continuar. Revisões editoriais
            anteriores permanecem guardadas.
          </AlertDialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel>Cancelar</AlertDialog.Cancel>
            <AlertDialog.Action onClick={onConfirm}>
              Restaurar código
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
