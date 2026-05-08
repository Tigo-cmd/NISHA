import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Settings, X, Server, Globe } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { streamManager } from '../services/StreamManager';
import { useAgentStore } from '../store/useAgentStore';

const STORAGE_KEY = '@nisha_master_url';

export function ConfigOverlay() {
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      const defaultUrl = process.env.EXPO_PUBLIC_MASTER_WS_URL || '';
      const finalUrl = val || defaultUrl;
      
      if (finalUrl) {
        setUrl(finalUrl);
        setSavedUrl(finalUrl);
        streamManager.initialize(finalUrl);
      }
    });
  }, []);

  const handleSave = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, url);
    setSavedUrl(url);
    // [ESP-Lite] Force trigger store to reconnect
    useAgentStore.getState().initializeStreaming(url);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Settings color="#39d353" size={24} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalBg}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Server color="#39d353" size={20} />
                <Text style={styles.title}>MASTER NODE CONFIG</Text>
              </View>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <X color="#8b949e" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>MASTER ENDPOINT URL</Text>
              <View style={styles.inputWrapper}>
                <Globe color="#8b949e" size={16} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={url}
                  onChangeText={setUrl}
                  placeholder="e.g. 192.168.1.100:8080"
                  placeholderTextColor="#484f58"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.hint}>Currently: {savedUrl || 'Not set'}</Text>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>SAVE CONFIGURATION</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 999,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#e6edf3',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  form: {
    gap: 16,
  },
  label: {
    color: '#8b949e',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1117',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    color: '#e6edf3',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hint: {
    color: '#8b949e',
    fontSize: 11,
    fontStyle: 'italic',
  },
  saveBtn: {
    backgroundColor: '#238636',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
