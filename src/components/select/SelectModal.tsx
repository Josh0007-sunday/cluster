import { RowIcon } from './TokenIcon';
import type { ModalRow } from './TokenIcon';

export default function SelectModal({
  open,
  onClose,
  title,
  rows,
  selectedId,
  onSelect,
  showBalances = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: ModalRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  showBalances?: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="ml-auto grid h-7 w-7 place-items-center rounded-lg bg-card-hover text-sm text-text-muted hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          <div className="grid gap-0">
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onSelect(r.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition ${
                  r.id === selectedId ? 'bg-accent/10' : 'hover:bg-card-hover'
                }`}
              >
                <RowIcon row={r} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">{r.title}</span>
                  <span className="block truncate text-[11px] text-text-muted">{r.subtitle}</span>
                </span>
                {showBalances && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-text-muted">
                    {r.loading ? (
                      <span className="text-text-dim">...</span>
                    ) : r.balance != null ? (
                      <>
                        <span className={`h-1.5 w-1.5 rounded-full ${r.live ? 'bg-green-400' : 'bg-amber-400'}`} />
                        {r.balance}
                      </>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </span>
                )}
                {r.id === selectedId && <span className="text-xs text-accent">●</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
