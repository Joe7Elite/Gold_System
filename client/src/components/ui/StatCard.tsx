interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
  iconBg?: string;
}

export default function StatCard({ title, value, sub, color = 'text-stone-800', icon, iconBg = 'bg-stone-100' }: StatCardProps) {
  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">{title}</p>
          <p className={`text-xl md:text-2xl font-bold mt-1.5 ${color} truncate`}>{value}</p>
          {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0 mr-3`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
