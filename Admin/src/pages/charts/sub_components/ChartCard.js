export default function ChartCard({ children, className = "" }) {
    return <div className={`bg-white rounded-2xl p-5 border border-gray-100 ${className}`}>{children}</div>;
}