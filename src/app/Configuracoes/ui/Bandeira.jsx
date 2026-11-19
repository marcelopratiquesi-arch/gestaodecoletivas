// Bandeira do país em SVG puro (BR / AR / US): não depende de fonte de emoji, nunca vira "BR BR" no Windows.
export function FlagIcon({ pais, className = "w-4 h-3" }) {
  const wrap = `${className} rounded-[2px] ring-1 ring-black/10 shrink-0 overflow-hidden inline-block align-middle`;
  if (pais === "BR") return (
    <svg viewBox="0 0 20 14" className={wrap} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="20" height="14" fill="#009739" /><polygon points="10,2 18,7 10,12 2,7" fill="#FEDD00" /><circle cx="10" cy="7" r="3.1" fill="#012169" />
    </svg>
  );
  if (pais === "AR") return (
    <svg viewBox="0 0 20 14" className={wrap} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="20" height="14" fill="#ffffff" /><rect width="20" height="4.66" fill="#75AADB" /><rect width="20" height="4.66" y="9.34" fill="#75AADB" />
      <circle cx="10" cy="7" r="1.5" fill="#F6B40E" stroke="#85340A" strokeWidth="0.15" />
    </svg>
  );
  if (pais === "US") return (
    <svg viewBox="0 0 20 14" className={wrap} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="20" height="14" fill="#B22234" />
      {[1.077, 3.231, 5.385, 7.538, 9.692, 11.846].map((y) => <rect key={y} y={y} width="20" height="1.077" fill="#fff" />)}
      <rect width="8" height="7.538" fill="#3C3B6E" />
    </svg>
  );
  return null;
}
