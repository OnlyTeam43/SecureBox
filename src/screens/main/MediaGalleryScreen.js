// src/screens/main/MediaGalleryScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  Modal, StatusBar, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { getAllMediaPhotos } from '../../db/database';

import { BackArrowIcon } from '../../components/Icons';
import * as ScreenCapture from 'expo-screen-capture';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 32 - 16) / 3;

export default function MediaGalleryScreen({ route, navigation }) {
  const { conversationId, contactNickname } = route?.params || {};
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState([]);
  const [activePhoto, setActivePhoto] = useState(null);

  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    loadPhotos();
  }, [conversationId]);

  const loadPhotos = async () => {
    try {
      const data = await getAllMediaPhotos(conversationId);
      setPhotos(data || []);
    } catch (e) {
      console.warn('Gallery load error:', e);
    }
  };

  const renderPhotoItem = ({ item }) => (
    <TouchableOpacity
      style={styles.thumbnailWrap}
      onPress={() => setActivePhoto(item)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.media_uri }} style={styles.thumbnail} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <BackArrowIcon size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{contactNickname ? `${contactNickname}'s Locker` : 'Media Locker'}</Text>
      </View>

      {/* Photos Grid */}
      <FlatList
        data={photos}
        numColumns={3}
        keyExtractor={(item) => item.id}
        renderItem={renderPhotoItem}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No shared photos yet</Text>
            <Text style={styles.emptySub}>Photos shared in your chats will be saved safely here</Text>
          </View>
        }
      />

      {/* Full Screen Photo Viewer Modal */}
      <Modal visible={!!activePhoto} transparent animationType="fade">
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setActivePhoto(null)}>
            <Text style={styles.closeText}>✕ Close</Text>
          </TouchableOpacity>
          {activePhoto && (
            <Image
              source={{ uri: activePhoto.media_uri }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.bg.secondary,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  backIcon: { fontSize: 22, color: Colors.text.primary },
  title: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  columnWrapper: {
    gap: 8,
    marginBottom: 8,
  },
  thumbnailWrap: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 50 },
  emptyTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  emptySub: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
    zIndex: 10,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.full,
  },
  closeText: {
    color: Colors.text.primary,
    fontWeight: '700',
    fontSize: Typography.sizes.sm,
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});
