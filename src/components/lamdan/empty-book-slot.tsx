import { Plus } from "lucide-react";

export function EmptyBookSlot({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="empty-book-slot" onClick={onClick} aria-label={label}>
      <span>
        <Plus size={22} />
      </span>
      <strong>{label}</strong>
    </button>
  );
}
