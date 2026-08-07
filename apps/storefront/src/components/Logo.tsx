import Image from "next/image";

type LogoProps = {
  /** Rendered height in pixels; width scales to keep the aspect ratio. */
  size?: number;
  className?: string;
};

/** Mini Koshk brand mark. */
export function Logo({ size = 56, className }: LogoProps) {
  return (
    <a href="/" aria-label="Mini Koshk home" className={className}>
      <Image
        src="/_logo-1.png"
        alt="Mini Koshk"
        width={size}
        height={size}
        priority
        className="h-auto w-auto object-contain scale-120"
        style={{ height: size }}
      />
    </a>
  );
}
