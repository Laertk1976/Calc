import ButtonLabel from './ButtonLabel';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, Keyboard, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import KeyboardModalFrame from './KeyboardModalFrame';
import { getSavedCalculations } from '../calculationStorage';
import useCalculatorStyles from '../useCalculatorStyles';

export default function SaveCalculationModal({ visible, title, userId, onTitleChange, onConfirm, onClose }) {
  const { t, i18n } = useTranslation();
  const styles = useCalculatorStyles();
  const titleInputRef = useRef(null);
  const focusTimers = useRef([]);
  const [savedTitles, setSavedTitles] = useState([]);
  const [localTitle, setLocalTitle] = useState(title);
  const focusTitleInput = useCallback(() => {
    if (!titleInputRef.current) return;
    titleInputRef.current.focus();
    if (Platform.OS !== 'web') {
      requestAnimationFrame(() => titleInputRef.current?.focus());
      focusTimers.current.forEach(clearTimeout);
      focusTimers.current = [50, 150].map((delay) => setTimeout(() => titleInputRef.current?.focus(), delay));
    }
  }, []);
  const selectSuggestion = useCallback((suggestion) => {
    setLocalTitle(suggestion);
    onTitleChange(suggestion);
    // Keep the text field active: otherwise Android consumes the first
    // suggestion tap to dismiss the keyboard.
    requestAnimationFrame(focusTitleInput);
  }, [focusTitleInput, onTitleChange]);

  useEffect(() => {
    if (!visible) return;
    setLocalTitle(title);
    getSavedCalculations(userId).then((items) => setSavedTitles(items.filter((item) => !item.deletedAt).map((item) => item.title)));
    const task = InteractionManager.runAfterInteractions(focusTitleInput);
    return () => {
      task.cancel();
      focusTimers.current.forEach(clearTimeout);
      focusTimers.current = [];
    };
  }, [visible, title, userId, focusTitleInput]);

  const suggestions = savedTitles
    .filter((item) => typeof item === 'string' && item.trim())
    .filter((item) => !localTitle || item.toLowerCase().includes(localTitle.toLowerCase()))
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 6);

  return (
    <Modal
      animationType="none"
      transparent
      visible={visible}
      onRequestClose={onClose}
      onShow={focusTitleInput}
    >
      <KeyboardModalFrame style={styles.modalBackdrop}>
          <View style={[styles.savePanel, { maxHeight: '100%', flexShrink: 1 }]}>
            <ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="none" style={{ flexShrink: 1 }}>
            <Text style={styles.listTitle}>{t("Save as")}</Text>
            <TextInput
              ref={titleInputRef}
              value={localTitle}
              onChangeText={(value) => {
                setLocalTitle(value);
                onTitleChange(value);
              }}
              placeholder={t("Type a name or choose one below")}
              placeholderTextColor="#94a3b8"
              autoFocus
              showSoftInputOnFocus
              onLayout={focusTitleInput}
              returnKeyType="done"
              onSubmitEditing={() => onConfirm(localTitle)}
              style={styles.saveInput}
            />
            {suggestions.length ? (
              <View style={styles.saveSuggestions}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onTouchStart={() => selectSuggestion(suggestion)}
                    style={({ pressed }) => [styles.suggestionItem, pressed && styles.pressed]}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            </ScrollView>
            <View style={[styles.saveActions, { flexShrink: 0 }]}>
              <Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, styles.cancelButton, pressed && styles.pressed]}>
                <ButtonLabel style={styles.closeButtonText}>{t("Cancel")}</ButtonLabel>
              </Pressable>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  onConfirm(localTitle);
                }}
                style={({ pressed }) => [styles.closeButton, styles.saveButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t("Save calculation")}
              >
                <ButtonLabel style={styles.closeButtonText}>{t("Save")}</ButtonLabel>
              </Pressable>
            </View>
          </View>
      </KeyboardModalFrame>
    </Modal>
  );
}
