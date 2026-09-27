import { Modal, View } from 'react-native';

export default function PanelModal({ inline = false, children, ...props }) {
  return inline ? <View style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children}</View> : <Modal {...props}>{children}</Modal>;
}
