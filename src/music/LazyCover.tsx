import { useEffect, useRef, useState } from 'react';

interface LazyCoverProps {
  src: string;
  alt: string;
  className?: string;
}

export default function LazyCover({ src, alt, className }: LazyCoverProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [visibleSrc, setVisibleSrc] = useState('');

  useEffect(() => {
    const image = imageRef.current;
    if (!image || !src) return;
    if (!('IntersectionObserver' in window)) {
      setVisibleSrc(src);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      setVisibleSrc(src);
      observer.disconnect();
    }, { rootMargin: '180px' });

    observer.observe(image);
    return () => observer.disconnect();
  }, [src]);

  return (
    <img
      ref={imageRef}
      src={visibleSrc || undefined}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      draggable={false}
      referrerPolicy="no-referrer"
    />
  );
}
