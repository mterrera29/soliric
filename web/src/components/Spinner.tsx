interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
}

export default function Spinner({ size = 'md', inline = false }: SpinnerProps) {
  const sizes = { sm: 'w-4 h-4 border', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-2' };
  const containerClass = inline ? '' : 'flex items-center justify-center py-20';

  return (
    <div className={containerClass}>
      <div className={`${sizes[size]} border-terracotta/20 border-t-terracotta rounded-full animate-spin`} />
    </div>
  );
}