/**
 * Reusable VoteGuard 2×2 logo mark.
 * @param {{ size?: number, className?: string, style?: object }} props
 */
export default function LogoMark({ size = 14, className = '', style = {} }) {
  return (
    <div
      className={`logo-mark ${className}`}
      style={{
        gridTemplateColumns: `${size}px ${size}px`,
        gridTemplateRows: `${size}px ${size}px`,
        ...style,
      }}
    >
      <span></span><span></span><span></span><span></span>
    </div>
  );
}
