export default function EmptyState({ icon, title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      {icon && <div className="text-4xl mb-3 opacity-30">{icon}</div>}
      <p className="text-stone-400 font-medium">{title}</p>
      {sub && <p className="text-stone-300 text-sm mt-1">{sub}</p>}
    </div>
  );
}
