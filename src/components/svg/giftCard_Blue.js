export function giftCard_Blue(amount, serviceName = "Gift Card") {
    return `
    <svg width="400" height="250" viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0" y1="0" x2="400" y2="250" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#4fc3f7"/>
          <stop offset="100%" stop-color="#0288d1"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#888" flood-opacity="0.3"/>
        </filter>
      </defs>
      <rect width="400" height="250" rx="32" fill="url(#bgGradient)" filter="url(#shadow)"/>
      <text x="50%" y="28%" dominant-baseline="middle" text-anchor="middle" font-size="30" font-family="Arial Rounded MT Bold, Arial, sans-serif" fill="#fff" font-weight="bold" letter-spacing="1">
        ${serviceName}
      </text>
      <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" font-size="70" font-family="Arial Black, Arial, sans-serif" fill="#fff" font-weight="bold" letter-spacing="2" stroke="#fff" stroke-width="2">
        $${amount}
      </text>
      <rect x="30" y="30" width="340" height="190" rx="24" fill="none" stroke="#fff" stroke-width="3" opacity="0.5"/>
    </svg>
  `;
  }