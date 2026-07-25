interface BadgeProps {
  label: string;
  color?: 'amber' | 'green' | 'red' | 'blue' | 'purple' | 'orange' | 'pink' | 'yellow' | 'stone';
}

const colorMap: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
  pink: 'bg-pink-100 text-pink-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  stone: 'bg-stone-100 text-stone-600',
};

export default function Badge({ label, color = 'stone' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorMap[color]}`}>
      {label}
    </span>
  );
}
