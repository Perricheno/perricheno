import type { VisualEntry } from "./types";

interface Props {
    entry: VisualEntry;
    selected: boolean;
    onClick: () => void;
    compact?: boolean;
}

export default function VisualCard({ entry, selected, onClick, compact = false }: Props) {
    return (
        <button
            onClick={onClick}
            className={`w-full text-left rounded-xl border transition-all duration-150 active:scale-[0.98]
                ${compact ? "px-3 py-2" : "px-3 py-2.5"}
                ${selected
                    ? "border-[#1a1a1a] bg-[#1a1a1a]"
                    : "border-[#ebebeb] bg-white hover:border-[#aaa]"
                }`}
        >
            <p className={`font-bold leading-tight ${compact ? "text-[12px]" : "text-[11px]"} ${selected ? "text-white" : "text-[#1a1a1a]"}`}>
                {entry.name}
            </p>
            {!compact && (
                <p className={`text-[10px] mt-0.5 font-medium leading-tight ${selected ? "text-gray-300" : "text-gray-400"}`}>
                    {entry.desc}
                </p>
            )}
        </button>
    );
}
