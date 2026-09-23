import { Children, useLayoutEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

// Each word is an unbreakable item; the surrounding row wraps between words.
export default function ButtonLabel({ children, style, numberOfLines, accessibilityLabel, naturalWrap = false, ...props }) {
  const text = Children.toArray(children).join('');
  const fontSize = StyleSheet.flatten(style)?.fontSize || 14;
  const lines = text.trim().split('\n');
  if (naturalWrap) {
    return <WrappedLabel style={style} accessibilityLabel={accessibilityLabel || text} {...props}>{text}</WrappedLabel>;
  }
  if (numberOfLines === 1) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel || text} style={[styles.lines, { width: '100%' }]}>
        <FittedWord style={[style, { width: '100%' }]} {...props}>{text.replace(/\n/g, ' ')}</FittedWord>
      </View>
    );
  }
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

function WrappedLabel({ children, style, ...props }) {
  const label = useRef(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const baseSize = StyleSheet.flatten(style)?.fontSize || 18;
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !label.current || !bounds.height) return;
    const element = label.current;
    const fit = () => {
      for (let size = baseSize; size >= 8; size -= 0.5) {
        element.style.fontSize = `${size}px`;
        element.style.lineHeight = `${size * 1.2}px`;
        if (element.scrollHeight <= bounds.height && element.scrollWidth <= bounds.width) break;
      }
    };
    fit();
    let active = true;
    document.fonts?.ready.then(() => { if (active) fit(); });
    return () => { active = false; };
  }, [bounds.width, bounds.height, baseSize, children]);
  return <View onLayout={({ nativeEvent: { layout } }) => setBounds(current => current.width === layout.width && current.height === layout.height ? current : { width: layout.width, height: layout.height })}
    style={{ position: 'absolute', left: 5, right: 5, top: 7, bottom: 7, overflow: 'hidden', justifyContent: 'center' }}>
    <Text ref={label} {...props} textBreakStrategy="simple" android_hyphenationFrequency="none"
      adjustsFontSizeToFit minimumFontScale={0.45} numberOfLines={Platform.OS === 'web' ? undefined : 5}
      style={[style, { width: bounds.width || '100%', maxHeight: bounds.height || '100%', lineHeight: undefined, paddingHorizontal: 0, flexShrink: 1, textAlign: 'center', overflow: 'hidden' },
        Platform.OS === 'web' && { whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'normal' }]}>{children}</Text>
  </View>;
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
