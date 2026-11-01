// src/screens/main/MediaGalleryScreen.js
// Private Media Vault — Hidden Personal Photos & Encrypted Chat Media
// Media is stored inside the app sandbox with .nomedia protection.
// Google Photos, Samsung Gallery, and Android File Managers cannot see or scan it.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenCapture from 'expo-screen-capture';
import * as ImagePicker from 'expo-image-picker';
import {
  Plus,
  Trash2,
  Download,
  X,
  Camera,
  Image as ImageIcon,
  Lock,
  MessageCircle,
} from 'lucide-react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { BackArrowIcon } from '../../components/Icons';
import {
  getAllVaultMedia,
  addVaultItem,
  deleteVaultItemById,
  deleteMessage,
} from '../../db/database';
import {
  importPhotoToPersonalVault,
  exportVaultPhotoToGallery,
  deleteOriginalGalleryAsset,
} from '../../services/mediaVault';

const { width } = Dimensions.get('window');
const GRID_GAP = 8;
const PADDING = 16;
const ITEM_SIZE = (width - (PADDING * 2) - (GRID_GAP * 2)) / 3;

export default function MediaGalleryScreen({ route, navigation }) {
  const { conversationId, contactNickname } = route?.params || {};
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'personal' | 'chats'
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Prevent screenshots & recordings while viewing the secret vault
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
  }, []);

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllVaultMedia({
        filter: conversationId ? 'chats' : activeTab,
        conversationId: conversationId || null,
      });
      setPhotos(data || []);
    } catch (e) {
      console.warn('Failed to load media vault:', e);
    } finally {
      setLoading(false);
    }
  }, [conversationId, activeTab]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  // Handle Take Secret Photo directly with camera (never saved to public camera roll)
  const handleTakeSecretPhoto = async () => {
    setShowAddModal(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission Required', 'Please enable camera permission to capture secret photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.92,
        saveToPhotos: false, // DOES NOT save to phone gallery! Stays completely private inside vault
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setIsProcessing(true);
        const asset = result.assets[0];
        const vaultRes = await importPhotoToPersonalVault(
          asset.uri,
          asset.width,
          asset.height,
          'camera'
        );

        if (vaultRes && vaultRes.vaultUri) {
          await addVaultItem({
            fileUri: vaultRes.vaultUri,
            fileName: vaultRes.fileName,
            fileSize: vaultRes.fileSize,
            source: 'camera',
          });
          await loadMedia();
          Alert.alert(
            'Secret Photo Saved 🔒',
            'Captured directly into your private vault. It does not exist in your phone gallery.'
          );
        }
      }
    } catch (err) {
      console.warn('Secret photo error:', err);
      Alert.alert('Camera Error', 'Could not save secret photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Import from Phone Gallery
  const handleImportFromGallery = async () => {
    setShowAddModal(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Gallery Permission Required', 'Please allow gallery access to select photos to import into your vault.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.92,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsProcessing(true);
        const importedAssetIds = [];

        for (const asset of result.assets) {
          const vaultRes = await importPhotoToPersonalVault(
            asset.uri,
            asset.width,
            asset.height,
            'gallery'
          );

          if (vaultRes && vaultRes.vaultUri) {
            await addVaultItem({
              fileUri: vaultRes.vaultUri,
              fileName: vaultRes.fileName,
              fileSize: vaultRes.fileSize,
              source: 'gallery',
            });
            if (asset.assetId) {
              importedAssetIds.push(asset.assetId);
            }
          }
        }

        await loadMedia();

        const count = result.assets.length;
        if (importedAssetIds.length > 0) {
          Alert.alert(
            `${count} ${count === 1 ? 'Photo' : 'Photos'} Secured in Vault 🔒`,
            'Would you like to delete the original from your phone\'s public gallery so it remains only in your secret vault?',
            [
              { text: 'Keep in Phone Gallery', style: 'cancel' },
              {
                text: 'Delete from Phone Gallery',
                style: 'destructive',
                onPress: async () => {
                  try {
                    for (const id of importedAssetIds) {
                      await deleteOriginalGalleryAsset(id);
                    }
                    Alert.alert('Original Removed', 'The photo now lives exclusively inside your private vault.');
                  } catch (delErr) {
                    console.warn('Gallery delete note:', delErr);
                  }
                },
              },
            ]
          );
        } else {
          Alert.alert(
            `${count} ${count === 1 ? 'Photo' : 'Photos'} Secured in Vault 🔒`,
            'Stored in your hidden sandbox. You can now safely delete the original from your phone gallery if you wish.'
          );
        }
      }
    } catch (err) {
      console.warn('Import gallery error:', err);
      Alert.alert('Import Error', 'Could not import photos to vault.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete an item from the vault
  const handleDeletePhoto = () => {
    if (!activePhoto) return;

    Alert.alert(
      'Delete from Vault?',
      'This photo will be permanently shredded from your private vault and cannot be recovered.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              if (activePhoto.source === 'personal') {
                await deleteVaultItemById(activePhoto.id);
              } else {
                await deleteMessage(activePhoto.id);
              }
              setActivePhoto(null);
              await loadMedia();
            } catch (err) {
              console.warn('Delete photo error:', err);
              Alert.alert('Delete Error', 'Could not delete photo from vault.');
            }
          },
        },
      ]
    );
  };

  // Export a copy back to the phone gallery
  const handleExportToGallery = async () => {
    if (!activePhoto?.media_uri) return;
    try {
      const res = await exportVaultPhotoToGallery(activePhoto.media_uri);
      if (res.success) {
        Alert.alert(
          'Saved to Gallery 📤',
          'A copy of this photo was exported to your phone\'s public camera roll.'
        );
      } else {
        Alert.alert('Export Failed', res.error || 'Could not export to gallery.');
      }
    } catch (err) {
      console.warn('Export photo error:', err);
      Alert.alert('Export Error', 'Could not export photo.');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_) {
      return '';
    }
  };

  const renderPhotoItem = ({ item }) => (
    <TouchableOpacity
      style={styles.thumbnailWrap}
      onPress={() => setActivePhoto(item)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.media_uri }} style={styles.thumbnail} />
      {/* Badge Overlay */}
      <View style={styles.badgeOverlay}>
        {item.source === 'personal' ? (
          <View style={styles.badgePersonal}>
            <Lock size={10} color="#FFFFFF" strokeWidth={2.5} />
          </View>
        ) : (
          <View style={styles.badgeChat}>
            <MessageCircle size={10} color="#FFFFFF" strokeWidth={2.5} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <BackArrowIcon size={24} color={Colors.text.primary} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {contactNickname ? `${contactNickname}'s Vault` : 'Private Media Vault'}
          </Text>
          <Text style={styles.subtitle}>
            {photos.length} {photos.length === 1 ? 'item' : 'items'} • Hidden Sandbox
          </Text>
        </View>

        {!conversationId && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add Photos</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs (when viewing main vault) */}
      {!conversationId && (
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'all' && styles.tabPillActive]}
            onPress={() => setActiveTab('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              All Media
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'personal' && styles.tabPillActive]}
            onPress={() => setActiveTab('personal')}
            activeOpacity={0.7}
          >
            <Lock size={12} color={activeTab === 'personal' ? '#FFFFFF' : Colors.text.secondary} style={{ marginRight: 4 }} />
            <Text style={[styles.tabText, activeTab === 'personal' && styles.tabTextActive]}>
              Personal Vault
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'chats' && styles.tabPillActive]}
            onPress={() => setActiveTab('chats')}
            activeOpacity={0.7}
          >
            <MessageCircle size={12} color={activeTab === 'chats' ? '#FFFFFF' : Colors.text.secondary} style={{ marginRight: 4 }} />
            <Text style={[styles.tabText, activeTab === 'chats' && styles.tabTextActive]}>
              Chat Media
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent.primary} />
          <Text style={styles.loadingText}>Decrypting vault...</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          numColumns={3}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPhotoItem}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Lock size={32} color={Colors.accent.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'personal'
                  ? 'No personal photos added yet'
                  : activeTab === 'chats'
                  ? 'No chat media found'
                  : 'Your private vault is empty'}
              </Text>
              <Text style={styles.emptySub}>
                Import photos from your phone or capture secret photos directly. They are completely invisible to Google Photos and file managers.
              </Text>
              {!conversationId && (
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={() => setShowAddModal(true)}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  <Text style={styles.emptyAddBtnText}>Add Private Photos</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Full-Screen Photo Viewer Modal */}
      <Modal visible={!!activePhoto} transparent animationType="fade">
        <View style={styles.modalBg}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />

          {/* Viewer Top Bar */}
          <View style={[styles.viewerTopBar, { paddingTop: insets.top + 8 }]}>
            <View>
              <View style={styles.viewerBadgeRow}>
                {activePhoto?.source === 'personal' ? (
                  <View style={styles.viewerBadgePersonal}>
                    <Lock size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.viewerBadgeText}>Personal Vault</Text>
                  </View>
                ) : (
                  <View style={styles.viewerBadgeChat}>
                    <MessageCircle size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.viewerBadgeText}>
                      {activePhoto?.contact_nickname ? `Shared with ${activePhoto.contact_nickname}` : 'Chat Media'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.viewerDateText}>{formatDate(activePhoto?.sent_at)}</Text>
            </View>

            <TouchableOpacity
              style={styles.viewerCloseBtn}
              onPress={() => setActivePhoto(null)}
              activeOpacity={0.7}
            >
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Full Photo */}
          {activePhoto && (
            <Image
              source={{ uri: activePhoto.media_uri }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}

          {/* Viewer Bottom Actions */}
          <View style={[styles.viewerBottomBar, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={styles.viewerActionBtn}
              onPress={handleExportToGallery}
              activeOpacity={0.75}
            >
              <Download size={18} color="#FFFFFF" />
              <Text style={styles.viewerActionText}>Save to Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.viewerActionBtn, styles.viewerDeleteBtn]}
              onPress={handleDeletePhoto}
              activeOpacity={0.75}
            >
              <Trash2 size={18} color="#FF6B6B" />
              <Text style={[styles.viewerActionText, { color: '#FF6B6B' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Photo Action Sheet Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setShowAddModal(false)}
        >
          <View style={styles.sheetContent} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderIcon}>
                <Lock size={18} color={Colors.accent.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.sheetTitle}>Add to Secret Vault 🔒</Text>
                <Text style={styles.sheetSub}>
                  Files are stored in your hidden sandbox (.nomedia) and hidden from Google Photos.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={{ padding: 4 }}>
                <X size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Option 1: Take Secret Photo */}
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={handleTakeSecretPhoto}
              activeOpacity={0.75}
            >
              <View style={styles.sheetOptionIconBox}>
                <Camera size={22} color={Colors.accent.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.sheetOptionTitle}>Take Secret Photo</Text>
                <Text style={styles.sheetOptionSub}>
                  Captures directly into vault — never touches your phone gallery
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 2: Import from Gallery */}
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={handleImportFromGallery}
              activeOpacity={0.75}
            >
              <View style={styles.sheetOptionIconBox}>
                <ImageIcon size={22} color={Colors.accent.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.sheetOptionTitle}>Import from Phone Gallery</Text>
                <Text style={styles.sheetOptionSub}>
                  Select photos from your device to hide safely in this vault
                </Text>
              </View>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setShowAddModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Processing Overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={Colors.accent.primary} />
            <Text style={styles.processingText}>Securing photo in vault...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.bg.primary,
    gap: Spacing.sm,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  title: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    gap: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: Typography.sizes.xs,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: PADDING,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.bg.primary,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  tabPillActive: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
  },
  tabText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: PADDING,
    paddingBottom: 40,
  },
  columnWrapper: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  thumbnailWrap: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.divider,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  badgeOverlay: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  badgePersonal: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(217,119,87,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeChat: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(94,148,115,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: Spacing.xl,
    gap: 12,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(217,119,87,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Radius.full,
    marginTop: 8,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: Typography.sizes.sm,
  },
  modalBg: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'space-between',
  },
  viewerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  viewerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewerBadgePersonal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.primary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
  },
  viewerBadgeChat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5E9473',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
  },
  viewerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  viewerDateText: {
    color: '#A0A0A0',
    fontSize: 12,
    marginTop: 3,
  },
  viewerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '70%',
    alignSelf: 'center',
  },
  viewerBottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  viewerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    gap: 8,
  },
  viewerDeleteBtn: {
    backgroundColor: 'rgba(255,75,75,0.18)',
  },
  viewerActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: Typography.sizes.xs,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: Colors.bg.elevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sheetHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(217,119,87,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  sheetSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    marginTop: 2,
    lineHeight: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  sheetOptionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(217,119,87,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  sheetOptionSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    marginTop: 2,
    lineHeight: 16,
  },
  sheetCancelBtn: {
    paddingVertical: 14,
    borderRadius: Radius.full,
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    marginTop: 4,
  },
  sheetCancelText: {
    color: Colors.text.primary,
    fontWeight: '700',
    fontSize: Typography.sizes.sm,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  processingCard: {
    backgroundColor: Colors.bg.elevated,
    padding: 24,
    borderRadius: Radius.lg,
    alignItems: 'center',
    gap: 12,
  },
  processingText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text.primary,
  },
});
