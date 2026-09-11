import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { getSavedCalculations } from '../calculationStorage';
import { styles } from '../calculatorStyles';

export default function SaveCalculationModal({ visible, title, onTitleChange, onConfirm, onClose }) {
  const [savedTitles, setSavedTitles] = useState([]);
  const [localTitle, setLocalTitle] = useState(title);

  useEffect(() => {
    if (!visible) return;
    setLocalTitle(title);
    getSavedCalculations().then((items) => setSavedTitles(items.map((item) => item.title)));
  }, [visible, title]);

  const suggestions = savedTitles
    .filter((item) => typeof item === 'string' && item.trim())
    .filter((item) => !localTitle || item.toLowerCase().includes(localTitle.toLowerCase()))
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 6);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.savePanel}>
            <Text style={styles.listTitle}>Save as</Text>
            <TextInput
              value={localTitle}
              onChangeText={(value) => {
                setLocalTitle(value);
                onTitleChange(value);
              }}
              placeholder="Type a name or choose one below"
              placeholderTextColor="#94a3b8"
              autoFocus
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
            <View style={styles.saveActions}>
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
