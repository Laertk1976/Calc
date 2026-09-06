import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { getSavedCalculations } from '../calculationStorage';
import { styles } from '../calculatorStyles';

export default function SaveCalculationModal({ visible, title, onTitleChange, onConfirm, onClose }) {
  const suggestions = getSavedCalculations()
    .map((item) => item.title)
    .filter((item) => typeof item === 'string' && item.trim())
    .filter((item) => !title || item.toLowerCase().includes(title.toLowerCase()))
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 6);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.savePanel}>
          <Text style={styles.listTitle}>Save as</Text>
          <TextInput
            value={title}
            onChangeText={onTitleChange}
            placeholder="Type a name or choose one below"
            placeholderTextColor="#94a3b8"
            autoFocus
            style={styles.saveInput}
          />
          {suggestions.length ? (
            <View style={styles.saveSuggestions}>
              {suggestions.map((suggestion) => (
                <Pressable key={suggestion} onPress={() => onTitleChange(suggestion)} style={styles.suggestionItem}>
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.saveActions}>
            <Pressable onPress={onClose} style={[styles.closeButton, styles.cancelButton]}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={[styles.closeButton, styles.saveButton]}>
              <Text style={styles.closeButtonText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
