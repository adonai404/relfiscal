interface ImperialLogoProps {
  className?: string;
  /** Cor da montanha/seta em zigue-zague. */
  green?: string;
  /** Cor dos triângulos da base. */
  coral?: string;
}

/**
 * Logo da Imperial Contabilidade — montanha ascendente em zigue-zague (verde)
 * com triângulos na base (vermelho/coral). Desenhada em SVG para escalar sem
 * perda. O fundo é transparente; use sobre um fundo claro.
 */
export function ImperialLogo({
  className,
  green = "#00AC6A",
  coral = "#FF5C44",
}: ImperialLogoProps) {
  return (
    <svg
      viewBox="0 0 1080 1080"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Imperial Contabilidade"
    >
      {/* Montanha/seta em zigue-zague (verde) */}
      <polygon
        points="93,334 93,508 270,687 508,447 747,686 926,505 982,564 988,358 784,358 838,416 748,507 509,272 271,506"
        fill={green}
      />
      {/* Triângulos da base (coral) */}
      <polygon points="334,806 686,804 508,627" fill={coral} />
      <polygon points="91,683 91,806 210,805" fill={coral} />
      <polygon points="924,688 808,805 924,805" fill={coral} />
    </svg>
  );
}
