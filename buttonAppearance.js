import { Platform } from 'react-native';

// A tight contact shadow plus a softer shadow makes each button look raised.
export const raisedButton = Platform.select({
  web: { boxShadow: '0 3px 2px rgba(0, 0, 0, 0.5), 0 7px 10px rgba(0, 0, 0, 0.55)' },
  default: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 5,
    elevation: 10,
  },
});

export const pressedButton = {
  transform: [{ translateY: 2 }],
  ...Platform.select({
    web: { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.55), 0 2px 4px rgba(0, 0, 0, 0.4)' },
    default: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.45, shadowRadius: 2, elevation: 3 },
  }),
};
