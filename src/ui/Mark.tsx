/** 产品标记：一张牌里的一枚黑桃——掼蛋自己的东西，不是通用字标。 */
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
      <rect x="1.5" y="1.5" width="17" height="17" rx="4.5" fill="none" stroke="#ffffff" strokeWidth="1.5" />
      <path
        d="M10 4.6c2 2.3 3.6 3.8 3.6 5.6 0 1.4-1.1 2.4-2.3 2.4-.6 0-1-.2-1.3-.5-.3.3-.7.5-1.3.5-1.2 0-2.3-1-2.3-2.4 0-1.8 1.6-3.3 3.6-5.6Z"
        fill="#f2b33d"
      />
      <path d="M9.1 12.9h1.8l.5 2.4H8.6l.5-2.4Z" fill="#f2b33d" />
    </svg>
  )
}

/** 音效开关：16px 线性图标，不用 emoji。 */
export function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3.2 4.8 6H2.4v4h2.4L8 12.8V3.2Z" />
      {muted ? (
        <>
          <path d="M10.6 6.4 13.6 9.6" />
          <path d="M13.6 6.4 10.6 9.6" />
        </>
      ) : (
        <>
          <path d="M10.4 6.1a2.8 2.8 0 0 1 0 3.8" />
          <path d="M12.2 4.3a5.4 5.4 0 0 1 0 7.4" />
        </>
      )}
    </svg>
  )
}
