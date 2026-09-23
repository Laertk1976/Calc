import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { styles as baseStyles } from './calculatorStyles';

export default function useCalculatorStyles() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const compact = width < 380;
    const padding = width < 600 ? 12 : 20;
    const gap = compact ? 8 : 12;
    const contentWidth = Math.min(width, 720) - padding * 2;
    const keyWidth = (contentWidth - gap * 4) / 5;
    const keyHeight = Math.max(44, Math.min(keyWidth, 88, (height - 280 - gap * 4) / 5));
    const overrides = {
      calculator: { paddingHorizontal: padding },
      display: { minHeight: compact || height < 700 ? 112 : 150, paddingBottom: 16 },
      displayText: { fontSize: compact ? 62.4 : 81.6 },
      expression: { fontSize: compact ? 24 : 28.8, maxWidth: '100%' },
      topBar: { flexWrap: 'wrap', gap: 8 },
      keypadLayout: { gap },
      keypad: { gap },
      keyRow: { gap },
      key: { aspectRatio: undefined, height: keyHeight },
      keyText: { fontSize: compact ? 24 : 28 },
      utilityColumn: { width: keyWidth + 3, gap },
      utilityPrimaryGroup: { gap },
      utilityPrimaryKey: { height: Math.max(38, keyHeight - 3) },
      utilityKey: { aspectRatio: undefined, height: keyHeight + 3 },
      utilityKeyText: { fontSize: compact ? 13 : 16, maxWidth: '100%' },
      utilityThreeLineText: { fontSize: compact ? 13 : 15, lineHeight: compact ? 13 : 15 },
      utilityFourLineText: { fontSize: compact ? 14 : 16, lineHeight: compact ? 14 : 16 },
      modalBackdrop: { padding },
      tablePanel: { padding, paddingBottom: padding, maxWidth: 1100 },
      savePanel: { padding },
      authPanel: { padding },
      listPanel: { padding },
      listTitle: { fontSize: compact ? 20 : 22 },
      tableTitleGroup: { flexShrink: 1, maxWidth: '100%' },
      tableTitle: { flexShrink: 1 },
      tableTopHeader: { marginBottom: 8 },
      searchInputContainer: { minWidth: Math.min(180, width - padding * 2), maxWidth: width < 600 ? '100%' : 300 },
      dateDropdownButton: { maxWidth: '100%' },
      dateDropdownButtonText: { flexShrink: 1 },
      tableActions: { gap: compact ? 6 : 12, marginBottom: 8 },
      tableActionButton: { minWidth: 0, minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
      addRowButton: { minWidth: 0, minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
      addRowButtonText: { fontSize: width < 600 ? 12 : 15, textAlign: 'center' },
      closeButtonText: { fontSize: width < 600 ? 13 : 16, textAlign: 'center', flexShrink: 1 },
      authButton: { flexShrink: 1, maxWidth: '100%' },
      authButtonText: { fontSize: compact ? 12 : 13, textAlign: 'center' },
      headerControl: { width: compact ? 96 : 108 },
      authModeButton: { paddingHorizontal: 10 },
      closeButton: { minWidth: 0, paddingHorizontal: 6, justifyContent: 'center' },
      warningCancelButton: { minWidth: 0, paddingHorizontal: 6 },
      warningConfirmButton: { minWidth: 0, paddingHorizontal: 6 },
      commentModalCancelButton: { minWidth: 0, paddingHorizontal: 6 },
      commentModalSaveButton: { minWidth: 0, paddingHorizontal: 6 },
      dropdownBackdrop: { padding },
      dropdownPanel: { padding },
      warningBackdrop: { padding },
      warningPanel: { padding, maxHeight: '100%' },
      commentModalBackdrop: { padding },
      commentModalPanel: { padding, maxHeight: '100%' },
      savedMetaRow: { flexWrap: 'wrap', gap: 6 },
      savedDate: { flexShrink: 1 },
    };
    return Object.fromEntries(Object.entries(baseStyles).map(([name, style]) => [
      name, overrides[name] ? [style, overrides[name]] : style,
    ]));
  }, [width, height]);
}
