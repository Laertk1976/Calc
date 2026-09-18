import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import KeyboardModalFrame from './KeyboardModalFrame';
import { getSavedCalculations } from '../calculationStorage';
import useCalculatorStyles from '../useCalculatorStyles';

export default function SaveCalculationModal({ visible, title, userId, onTitleChange, onConfirm, onClose }) {
  const styles = useCalculatorStyles();
  const titleInputRef = useRef(null);
  const [savedTitles, setSavedTitles] = useState([]);
  const [localTitle, setLocalTitle] = useState(title);

  useEffect(() => {
    if (!visible) return;
    setLocalTitle(title);
    getSavedCalculations(userId).then((items) => setSavedTitles(items.filter((item) => !item.deletedAt).map((item) => item.title)));
  }, [visible, title, userId]);

  const suggestions = savedTitles
    .filter((item) => typeof item === 'string' && item.trim())
    .filter((item) => !localTitle || item.toLowerCase().includes(localTitle.toLowerCase()))
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 6);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
      onShow={() => titleInputRef.current?.focus()}
    >
      <KeyboardModalFrame style={styles.modalBackdrop}>
          <View style={[styles.savePanel, { maxHeight: '100%', flexShrink: 1 }]}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
            <Text style={styles.listTitle}>Save as</Text>
            <TextInput
              ref={titleInputRef}
              value={localTitle}
              onChangeText={(value) => {
                setLocalTitle(value);
                onTitleChange(value);
              }}
              placeholder="Type a name or choose one below"
              placeholderTextColor="#94a3b8"
              autoFocus={Platform.OS === 'web'}
              showSoftInputOnFocus
              returnKeyType="done"
              onSubmitEditing={() => onConfirm(localTitle)}
              style={styles.saveInput}
            />
            {suggestions.length ? (
              <View style={styles.saveSuggestions}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => {
                      setLocalTitle(suggestion);
                      onTitleChange(suggestion);
                    }}
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
                <Text style={styles.closeButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  onConfirm(localTitle);
                }}
                style={({ pressed }) => [styles.closeButton, styles.saveButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Save calculation"
              >
                <Text style={styles.closeButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
      </KeyboardModalFrame>
    </Modal>
  );
}
