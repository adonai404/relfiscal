interface ImperialLogoProps {
  className?: string;
  /** Cor da seta/zigue-zague. */
  green?: string;
  /** Cor das montanhas. */
  coral?: string;
}

/**
 * Logo da Imperial Contabilidade — seta ascendente em zigue-zague (verde)
 * sobre montanhas (coral). Desenhada em SVG para escalar sem perda.
 * As lacunas são transparentes; use sobre um fundo claro/branco.
 */
export function ImperialLogo({
  className,
  green = "#15A65C",
  coral = "#F35C3D",
}: ImperialLogoProps) {
  return (
    <svg
      viewBox="0 0 1080 1080"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Imperial Contabilidade"
    >
      {/* Montanhas (coral) — laterais sangram a borda para dar o corte do original */}
      <polygon points="-40,895 260,895 110,665" fill={coral} />
      <polygon points="300,895 730,895 515,650" fill={coral} />
      <polygon points="875,895 1140,895 1007,690" fill={coral} />

      {/* Seta em zigue-zague (verde) */}
      <polyline
        points="-30,420 235,705 480,250 600,540 790,432"
        fill="none"
        stroke={green}
        strokeWidth="140"
        strokeLinejoin="miter"
        strokeMiterlimit="10"
      />
      {/* Ponta da seta (verde) */}
      <polygon points="1020,300 841,592 872,384 678,306" fill={green} />
    </svg>
  );
}
