// src/screens/stealth/CalculatorScreen.js
// Functional Decoy Calculator Screen — "The Hidden Gem"
// Behaves 100% as a real working calculator with arithmetic operations.
// Unlocks SecureBox when entering secret PIN followed by '='.
// Triggers instant emergency kill-switch purge when entering duress PIN followed by '='.

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useUserStore } from '../../store/useUserStore';
import { instantEraseEverything } from '../../services/panicService';

const { width } = Dimensions.get('window');
const BUTTON_GAP = 12;
const BUTTON_SIZE = Math.floor((width - 32 - BUTTON_GAP * 3) / 4);

export default function CalculatorScreen({ onUnlock }) {
  const insets = useSafeAreaInsets();
  const stealthPin = useUserStore((s) => s.stealthPin) || '1357';
  const stealthDuressPin = useUserStore((s) => s.stealthDuressPin) || '9999';
  const setStealthUnlocked = useUserStore((s) => s.setStealthUnlocked);

  const [displayValue, setDisplayValue] = useState('0');
  const [prevValue, setPrevValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const inputSequenceRef = useRef('');

  const displayScale = useRef(new Animated.Value(1)).current;

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
  };

  const handleDigit = (digit) => {
    triggerHaptic();
    inputSequenceRef.current += digit;

    if (waitingForOperand) {
      setDisplayValue(String(digit));
      setWaitingForOperand(false);
    } else {
      setDisplayValue((prev) => (prev === '0' ? String(digit) : prev + String(digit)));
    }
  };

  const handleDecimal = () => {
    triggerHaptic();
    inputSequenceRef.current += '.';
    if (waitingForOperand) {
      setDisplayValue('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!displayValue.includes('.')) {
      setDisplayValue((prev) => prev + '.');
    }
  };

  const handleClear = () => {
    triggerHaptic();
    inputSequenceRef.current = '';
    setDisplayValue('0');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const handleToggleSign = () => {
    triggerHaptic();
    const val = parseFloat(displayValue);
    if (!isNaN(val)) {
      setDisplayValue(String(val * -1));
    }
  };

  const handlePercent = () => {
    triggerHaptic();
    const val = parseFloat(displayValue);
    if (!isNaN(val)) {
      setDisplayValue(String(val / 100));
    }
  };

  const handleOperator = (nextOp) => {
    triggerHaptic();
    inputSequenceRef.current += nextOp;
    const inputValue = parseFloat(displayValue);

    if (prevValue === null) {
      setPrevValue(inputValue);
    } else if (operator) {
      const result = calculate(prevValue, inputValue, operator);
      setPrevValue(result);
      setDisplayValue(String(result));
    }

    setWaitingForOperand(true);
    setOperator(nextOp);
  };

  const calculate = (first, second, op) => {
    switch (op) {
      case '+':
        return first + second;
      case '-':
        return first - second;
      case '×':
        return first * second;
      case '÷':
        return second !== 0 ? first / second : 'Error';
      default:
        return second;
    }
  };

  const handleEqual = async () => {
    triggerHaptic();
    const fullSequence = inputSequenceRef.current;
    inputSequenceRef.current = '';

    // 1. Check for Emergency Duress Kill-Switch PIN (e.g. 9999=)
    if (displayValue === stealthDuressPin || fullSequence.endsWith(stealthDuressPin)) {
      console.log('[Calculator] DURESS PIN ENTERED — SILENT KILL-SWITCH ACTIVATING');
      setDisplayValue('0');
      await instantEraseEverything({ silent: true });
      return;
    }

    // 2. Check for Secret Vault Unlock PIN (e.g. 1357=)
    if (displayValue === stealthPin || fullSequence.endsWith(stealthPin)) {
      console.log('[Calculator] SECRET VAULT PIN CONFIRMED — UNLOCKING SECUREBOX');
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}
      setStealthUnlocked(true);
      if (onUnlock) {
        onUnlock();
      }
      return;
    }

    // 3. Normal Math Calculation
    const inputValue = parseFloat(displayValue);
    if (prevValue !== null && operator) {
      const result = calculate(prevValue, inputValue, operator);
      setDisplayValue(String(result));
      setPrevValue(null);
      setOperator(null);
      setWaitingForOperand(false);
    }
  };

  const renderButton = (label, onPress, type = 'number', customStyle = null) => {
    let bg = styles.numBtn;
    let textStyle = styles.numBtnText;

    if (type === 'action') {
      bg = styles.actionBtn;
      textStyle = styles.actionBtnText;
    } else if (type === 'op') {
      bg = styles.opBtn;
      textStyle = styles.opBtnText;
      if (operator === label && waitingForOperand) {
        bg = styles.opBtnActive;
        textStyle = styles.opBtnActiveText;
      }
    }

    return (
      <TouchableOpacity
        key={label}
        style={[styles.btn, bg, customStyle]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.btnText, textStyle]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Calculator Display */}
      <View style={styles.displayContainer}>
        <Animated.Text
          style={[styles.displayText, { transform: [{ scale: displayScale }] }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {displayValue}
        </Animated.Text>
      </View>

      {/* Calculator Keypad */}
      <View style={styles.keypad}>
        <View style={styles.row}>
          {renderButton(displayValue !== '0' ? 'C' : 'AC', handleClear, 'action')}
          {renderButton('±', handleToggleSign, 'action')}
          {renderButton('%', handlePercent, 'action')}
          {renderButton('÷', () => handleOperator('÷'), 'op')}
        </View>

        <View style={styles.row}>
          {renderButton('7', () => handleDigit(7))}
          {renderButton('8', () => handleDigit(8))}
          {renderButton('9', () => handleDigit(9))}
          {renderButton('×', () => handleOperator('×'), 'op')}
        </View>

        <View style={styles.row}>
          {renderButton('4', () => handleDigit(4))}
          {renderButton('5', () => handleDigit(5))}
          {renderButton('6', () => handleDigit(6))}
          {renderButton('-', () => handleOperator('-'), 'op')}
        </View>

        <View style={styles.row}>
          {renderButton('1', () => handleDigit(1))}
          {renderButton('2', () => handleDigit(2))}
          {renderButton('3', () => handleDigit(3))}
          {renderButton('+', () => handleOperator('+'), 'op')}
        </View>

        <View style={styles.row}>
          {renderButton('0', () => handleDigit(0), 'number', styles.zeroBtn)}
          {renderButton('.', handleDecimal)}
          {renderButton('=', handleEqual, 'op')}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  displayContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    minHeight: 120,
  },
  displayText: {
    color: '#ffffff',
    fontSize: 72,
    fontWeight: '300',
    textAlign: 'right',
  },
  keypad: {
    gap: BUTTON_GAP,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: BUTTON_GAP,
  },
  btn: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 32,
    fontWeight: '400',
  },
  numBtn: {
    backgroundColor: '#333333',
  },
  numBtnText: {
    color: '#ffffff',
  },
  actionBtn: {
    backgroundColor: '#a5a5a5',
  },
  actionBtnText: {
    color: '#000000',
    fontWeight: '500',
  },
  opBtn: {
    backgroundColor: '#ff9f0a',
  },
  opBtnText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  opBtnActive: {
    backgroundColor: '#ffffff',
  },
  opBtnActiveText: {
    color: '#ff9f0a',
    fontWeight: '500',
  },
  zeroBtn: {
    width: BUTTON_SIZE * 2 + BUTTON_GAP,
    alignItems: 'flex-start',
    paddingLeft: BUTTON_SIZE * 0.4,
  },
});
