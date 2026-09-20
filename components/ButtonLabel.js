import { Children, useLayoutEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

// Each word is an unbreakable item; the surrounding row wraps between words.
export default function ButtonLabel({ children, style, numberOfLines, accessibilityLabel, ...props }) {
  const text = Children.toArray(children).join('');
  const fontSize = StyleSheet.flatten(style)?.fontSize || 14;
  const lines = text.trim().split('\n');
  if (lines.length > 1) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel || text.replace(/\n/g, ' ')} style={styles.lines}>
        <FittedWord style={style} lineCount={lines.length} {...props}>{text}</FittedWord>
      </View>
    );
  }
  return (
    <View accessible accessibilityLabel={accessibilityLabel || text}
      style={[styles.words, { columnGap: fontSize * 0.25 }]}>
      {text.trim().split(/\s+/).map((word, index) => (
        <FittedWord key={`${index}:${word}`} style={style} {...props}>{word}</FittedWord>
      ))}
    </View>
  );
}

function FittedWord({ children, style, lineCount = 1, ...props }) {
  const label = useRef(null);
  const baseSize = StyleSheet.flatten(style)?.fontSize || 14;
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = label.current;
    if (!element) return;
    let lastWidth = -1;
    const fit = () => {
      const width = element.clientWidth;
      if (!width || width === lastWidth) return;
      lastWidth = width;
      element.style.fontSize = `${baseSize}px`;
      const measuredWidth = element.scrollWidth;
      if (measuredWidth > width) {
        element.style.fontSize = `${Math.max(1, baseSize * (width - 1) / measuredWidth)}px`;
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    fit();
    let active = true;
    document.fonts?.ready.then(() => {
      if (active) { lastWidth = -1; fit(); }
    });
    return () => { active = false; observer.disconnect(); };
  }, [children, baseSize]);
  return (
    <Text ref={label} accessible={false} adjustsFontSizeToFit minimumFontScale={0.25} numberOfLines={lineCount}
      {...props} style={[style, styles.label, Platform.OS === 'web' && styles.web,
        Platform.OS === 'web' && lineCount > 1 && { whiteSpace: 'pre' }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  lines: { alignItems: 'center', justifyContent: 'center', maxWidth: '100%', minWidth: 0, flexShrink: 1 },
  words: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', minWidth: 0, flexShrink: 1 },
  label: { textAlign: 'center', flexShrink: 1, maxWidth: '100%', minWidth: 0 },
  web: { whiteSpace: 'nowrap', overflowWrap: 'normal', wordBreak: 'normal', hyphens: 'none' },
});
