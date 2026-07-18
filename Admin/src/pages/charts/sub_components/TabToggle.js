export default function TabToggle({ value, onChange, options }) {
    return (
        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {options.map(([k, l]) => (
                <button key={k} onClick={() => onChange(k)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all
                        ${value === k ? "bg-white text-green-700 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                    {l}
                </button>
            ))}
        </div>
    );
}