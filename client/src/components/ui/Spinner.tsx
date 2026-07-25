export default function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizes[size]} border-3 border-stone-200 border-t-gold-500 rounded-full animate-spin`}
        style={{ borderWidth: size === 'sm' ? '2px' : '3px' }} />
    </div>
  );
}

export function PageLoader({ text = 'جاري التحميل...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in">
      <Spinner size="lg" />
      <p className="text-stone-400 text-sm">{text}</p>
    </div>
  );
}
