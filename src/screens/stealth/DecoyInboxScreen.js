// src/screens/stealth/DecoyInboxScreen.js
// Fake / Decoy Inbox Screen — Plausible Deniability Vault
// Displayed when the user enters the Decoy PIN (e.g. 0000=) into the Calculator.
// Shows completely innocent, believable school & family conversations.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/useUserStore';
import { BackArrowIcon } from '../../components/Icons';

const DECOY_CHATS = [
  {
    id: 'decoy_1',
    name: 'Physics Study Group 📚',
    lastMsg: "Don't forget to submit chapter 5 assignment by tomorrow.",
    time: '10:15 AM',
    unread: 1,
    messages: [
      { id: 'm1', text: 'Hey, did anyone finish question 4 from the worksheet?', isMe: false, time: '09:45 AM' },
      { id: 'm2', text: 'Yes, use the kinetic energy equation (1/2 mv^2).', isMe: true, time: '09:50 AM' },
      { id: 'm3', text: 'Got it, thank you so much!', isMe: false, time: '09:55 AM' },
      { id: 'm4', text: "Don't forget to submit chapter 5 assignment by tomorrow.", isMe: false, time: '10:15 AM' },
    ],
  },
  {
    id: 'decoy_2',
    name: 'Class Teacher / School 🏫',
    lastMsg: 'The midterm exam schedule has been updated on the board.',
    time: 'Yesterday',
    unread: 0,
    messages: [
      { id: 'm1', text: 'Dear students, please bring your practical lab manuals on Friday.', isMe: false, time: 'Yesterday' },
      { id: 'm2', text: 'The midterm exam schedule has been updated on the board.', isMe: false, time: 'Yesterday' },
    ],
  },
  {
    id: 'decoy_3',
    name: 'Mom 🏡',
    lastMsg: 'Be on time for dinner tonight.',
    time: 'Tuesday',
    unread: 0,
    messages: [
      { id: 'm1', text: 'Are your classes over for the day?', isMe: false, time: 'Tuesday' },
      { id: 'm2', text: 'Yes mom, heading to the library now.', isMe: true, time: 'Tuesday' },
      { id: 'm3', text: 'Be on time for dinner tonight.', isMe: false, time: 'Tuesday' },
    ],
  },
];

export default function DecoyInboxScreen({ onLock }) {
  const insets = useSafeAreaInsets();
  const setDecoyUnlocked = useUserStore((s) => s.setDecoyUnlocked);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');

  const handleOpenChat = (chat) => {
    setSelectedChat(chat);
    setChatMessages(chat.messages);
  };

  const handleSendDecoyMsg = () => {
    if (!inputMsg.trim()) return;
    const newMsg = {
      id: `m_${Date.now()}`,
      text: inputMsg.trim(),
      isMe: true,
      time: 'Just now',
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setInputMsg('');
  };

  const handleLock = () => {
    setDecoyUnlocked(false);
    if (onLock) onLock();
  };

  if (selectedChat) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor="#121214" />

        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setSelectedChat(null)} style={styles.backBtn}>
            <BackArrowIcon size={20} color="#ffffff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.chatTitle} numberOfLines={1}>{selectedChat.name}</Text>
            <Text style={styles.chatStatus}>School Connect</Text>
          </View>
          <TouchableOpacity onPress={handleLock} style={styles.lockBtn}>
            <Text style={styles.lockText}>🔒 Lock</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          data={chatMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.msgList}
          renderItem={({ item }) => (
            <View style={[styles.msgRow, item.isMe ? styles.msgMe : styles.msgThem]}>
              <Text style={[styles.msgBody, item.isMe ? styles.msgBodyMe : styles.msgBodyThem]}>
                {item.text}
              </Text>
              <Text style={styles.msgTime}>{item.time}</Text>
            </View>
          )}
        />

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={inputMsg}
            onChangeText={setInputMsg}
            placeholder="Type a message..."
            placeholderTextColor="#8696A0"
          />
          <TouchableOpacity onPress={handleSendDecoyMsg} style={styles.sendBtn}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#121214" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Study Connect</Text>
          <Text style={styles.headerSubtitle}>Course Discussions & Groups</Text>
        </View>
        <TouchableOpacity onPress={handleLock} style={styles.lockBtn}>
          <Text style={styles.lockText}>🔒 Lock</Text>
        </TouchableOpacity>
      </View>

      {/* Decoy Chat List */}
      <FlatList
        data={DECOY_CHATS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.chatRow} onPress={() => handleOpenChat(item)} activeOpacity={0.7}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{item.name.charAt(0)}</Text>
            </View>
            <View style={styles.chatInfo}>
              <View style={styles.rowTop}>
                <Text style={styles.chatName}>{item.name}</Text>
                <Text style={styles.chatTime}>{item.time}</Text>
              </View>
              <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMsg}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111b21',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#202c33',
    borderBottomWidth: 1,
    borderBottomColor: '#2a3942',
  },
  headerTitle: {
    color: '#e9edef',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#8696a0',
    fontSize: 12,
    marginTop: 2,
  },
  lockBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  lockText: {
    color: '#00a884',
    fontSize: 12,
    fontWeight: '700',
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(134, 150, 160, 0.15)',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00a884',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  chatInfo: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatName: {
    color: '#e9edef',
    fontSize: 16,
    fontWeight: '600',
  },
  chatTime: {
    color: '#8696a0',
    fontSize: 12,
  },
  lastMsg: {
    color: '#8696a0',
    fontSize: 14,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#202c33',
  },
  backBtn: {
    padding: 6,
  },
  chatTitle: {
    color: '#e9edef',
    fontSize: 16,
    fontWeight: '700',
  },
  chatStatus: {
    color: '#8696a0',
    fontSize: 12,
  },
  msgList: {
    padding: 16,
    gap: 8,
  },
  msgRow: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  msgMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#005c4b',
    borderBottomRightRadius: 2,
  },
  msgThem: {
    alignSelf: 'flex-start',
    backgroundColor: '#202c33',
    borderBottomLeftRadius: 2,
  },
  msgBody: {
    fontSize: 15,
  },
  msgBodyMe: {
    color: '#e9edef',
  },
  msgBodyThem: {
    color: '#e9edef',
  },
  msgTime: {
    color: 'rgba(233, 237, 239, 0.5)',
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#202c33',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#2a3942',
    color: '#e9edef',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: '#00a884',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
