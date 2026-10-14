export function getWorkspaceLayout({ platform, width, height, screenWidth = width, screenHeight = height, insets = {}, calculatorHeight }) {
  // A portrait keyboard can make the window wider than it is tall. The physical
  // screen must also be in landscape before switching the native workspace.
  const desktop = platform === 'web' ? width > 1100
    : screenWidth > screenHeight && width > height;
  const compact = desktop && (width <= 1100 || height < 600);
  const usableWidth = width - (insets.left || 0) - (insets.right || 0);
  const usableHeight = height - (insets.top || 0) - (insets.bottom || 0);
  return {
    desktop,
    compact,
    calculatorWidth: compact ? Math.max(256, Math.min(340, (usableWidth - 24) * 0.44)) : 380,
    // Reserve a stable display area so adding an expression line cannot resize
    // the keys while the user presses them.
    keyHeight: compact ? Math.max(28, Math.min(40, Math.floor(((calculatorHeight || usableHeight - 44 - 16) - 80 - 15 - 16 - 4) / 5))) : 54,
  };
}
