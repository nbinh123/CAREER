export default function ChartHeader({ icon: Icon, iconColor, title, children }) {
    return (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
                <Icon size={16} className={iconColor} />
                <h3 className="font-bold text-gray-700 text-sm">{title}</h3>
            </div>
            {children}
        </div>
    );
}