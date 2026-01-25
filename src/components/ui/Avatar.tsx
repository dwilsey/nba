import { cn } from '@/lib/utils/cn';
import Image from 'next/image';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

export function Avatar({ src, alt = 'Avatar', fallback, size = 'md', className }: AvatarProps) {
  const initials = fallback
    ? fallback
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-full bg-gray-200 font-medium text-gray-600',
        sizeClasses[size],
        className
      )}
    >
      {src ? (
        <Image src={src} alt={alt} fill className="object-cover" sizes="56px" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
