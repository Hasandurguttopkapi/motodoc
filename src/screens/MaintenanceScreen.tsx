import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, 
  FlatList, Modal, TextInput, KeyboardAvoidingView, Platform, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MaintenanceRecord {
  id: string;
  brand: string;
  model: string;
  mileage: string;
  date: string;
  notes: string;
}

interface Props {
  onClose?: () => void;
  isDarkMode: boolean; // YENİ: Tema bilgisi
}

export default function MaintenanceScreen({ onClose, isDarkMode }: Props) {
  const styles = getStyles(isDarkMode); // Dinamik stilleri çağır
  const accentColor = isDarkMode ? "#00E5FF" : "#0096C7";
  const iconColor = isDarkMode ? "#F8FAFC" : "#0F172A";
  const mutedColor = "#64748B";

  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [mileage, setMileage] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    try {
      const storedData = await AsyncStorage.getItem('@motodoc_records');
      if (storedData) setRecords(JSON.parse(storedData));
    } catch (error) {}
  };

  const saveToStorage = async (updatedRecords: MaintenanceRecord[]) => {
    setRecords(updatedRecords);
    try { await AsyncStorage.setItem('@motodoc_records', JSON.stringify(updatedRecords)); } 
    catch (error) {}
  };

  const saveRecord = () => {
    if (!brand || !model || !mileage || !date) { alert("Lütfen marka, model, KM ve tarih alanlarını doldurun."); return; }
    let updatedRecords;
    if (editingId) {
      updatedRecords = records.map(record => record.id === editingId ? { ...record, brand, model, mileage, date, notes } : record);
    } else {
      const newRecord: MaintenanceRecord = { id: Date.now().toString(), brand, model, mileage, date, notes };
      updatedRecords = [newRecord, ...records];
    }
    saveToStorage(updatedRecords);
    closeAddModal();
  };

  const deleteRecord = (id: string) => {
    Alert.alert("Kaydı Sil", "Bu bakım kaydını silmek istediğinize emin misiniz?", [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => {
          const updatedRecords = records.filter(record => record.id !== id);
          saveToStorage(updatedRecords);
        } 
      }
    ]);
  };

  const openEditModal = (record: MaintenanceRecord) => {
    setBrand(record.brand); setModel(record.model); setMileage(record.mileage);
    setDate(record.date); setNotes(record.notes); setEditingId(record.id);
    setIsModalVisible(true);
  };

  const closeAddModal = () => {
    setIsModalVisible(false); setEditingId(null); 
    setBrand(""); setModel(""); setMileage(""); setDate(""); setNotes("");
  };

  const renderRecord = ({ item }: { item: MaintenanceRecord }) => (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <View style={styles.timelineDot} />
        <View style={styles.timelineLine} />
      </View>
      <View style={styles.recordCard}>
        <View style={styles.cardHeader}>
          <View style={styles.dateAndKm}>
            <Text style={styles.recordDate}>{item.date}</Text>
            <View style={styles.kmBadge}>
              <Text style={styles.kmBadgeText}>{item.mileage} KM</Text>
            </View>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => openEditModal(item)}>
              <Ionicons name="pencil" size={18} color={accentColor} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => deleteRecord(item.id)}>
              <Ionicons name="trash" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.recordTitle}>{item.brand} {item.model}</Text>
        {item.notes ? (
          <View style={styles.notesContainer}>
            <Ionicons name="build-outline" size={14} color={accentColor} />
            <Text style={styles.recordNotes}>{item.notes}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onClose && (
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Ionicons name="arrow-back" size={28} color={mutedColor} />
          </TouchableOpacity>
        )}
        <View style={styles.headerIconWrapper}>
          <Ionicons name="calendar" size={32} color={accentColor} />
        </View>
        <Text style={styles.title}>Servis <Text style={styles.textHighlight}>Geçmişi</Text></Text>
        <Text style={styles.subtitle}>Motorunun dijital sağlık karnesi</Text>
      </View>

      {records.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={60} color={isDarkMode ? '#1E293B' : '#CBD5E1'} />
          <Text style={styles.emptyStateText}>Henüz bir bakım kaydı yok.</Text>
          <Text style={styles.emptyStateSub}>Sağ alttaki butondan ilk kaydını oluştur.</Text>
        </View>
      ) : (
        <FlatList data={records} keyExtractor={(item) => item.id} renderItem={renderRecord} contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false} />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => {
        const today = new Date(); setDate(`${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`);
        setIsModalVisible(true);
      }}>
        <Ionicons name="add" size={30} color={isDarkMode ? '#0B101E' : '#FFFFFF'} />
      </TouchableOpacity>

      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? "Kaydı Düzenle" : "Yeni Bakım Kaydı"}</Text>
              <TouchableOpacity onPress={closeAddModal}><Ionicons name="close-circle" size={28} color={mutedColor} /></TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 1, marginRight: 10}]} placeholder="Marka (Örn: Yamaha)" placeholderTextColor={mutedColor} value={brand} onChangeText={setBrand} />
                <TextInput style={[styles.input, {flex: 1}]} placeholder="Model (Örn: MT-07)" placeholderTextColor={mutedColor} value={model} onChangeText={setModel} />
              </View>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 1, marginRight: 10}]} placeholder="Güncel KM" placeholderTextColor={mutedColor} keyboardType="numeric" value={mileage} onChangeText={setMileage} />
                <TextInput style={[styles.input, {flex: 1}]} placeholder="Tarih" placeholderTextColor={mutedColor} value={date} onChangeText={setDate} />
              </View>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Yapılan işlemler..." placeholderTextColor={mutedColor} multiline value={notes} onChangeText={setNotes} />
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={saveRecord}>
              <Ionicons name={editingId ? "checkmark-done" : "save"} size={20} color={isDarkMode ? '#0B101E' : '#FFFFFF'} />
              <Text style={styles.saveButtonText}>{editingId ? "Güncelle" : "Kaydet"}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// YENİ: Dinamik Stil Fonksiyonu
const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDarkMode ? '#070B14' : '#F8FAFC' },
  header: { alignItems: 'center', paddingVertical: 30, borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#E2E8F0', position: 'relative' },
  backButton: { position: 'absolute', left: 20, top: 40, padding: 5, zIndex: 10 },
  headerIconWrapper: { width: 64, height: 64, borderRadius: 32, backgroundColor: isDarkMode ? 'rgba(0, 229, 255, 0.1)' : 'rgba(0, 150, 199, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderWidth: 1, borderColor: isDarkMode ? 'rgba(0, 229, 255, 0.2)' : 'rgba(0, 150, 199, 0.2)' },
  title: { fontSize: 28, fontWeight: '800', color: isDarkMode ? '#fff' : '#0F172A' },
  textHighlight: { color: isDarkMode ? '#00E5FF' : '#0096C7' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 5 },
  listContainer: { padding: 20, paddingBottom: 100 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyStateText: { color: '#64748B', fontSize: 18, fontWeight: '600', marginTop: 15 },
  emptyStateSub: { color: isDarkMode ? '#334155' : '#94A3B8', fontSize: 14, marginTop: 5 },
  timelineItem: { flexDirection: 'row', marginBottom: 20 },
  timelineLeft: { width: 30, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: isDarkMode ? '#00E5FF' : '#0096C7', marginTop: 5 },
  timelineLine: { width: 2, flex: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#E2E8F0', marginTop: 5 },
  recordCard: { flex: 1, backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#E2E8F0', shadowColor: '#000', shadowOpacity: isDarkMode ? 0 : 0.05, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dateAndKm: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  iconBtn: { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F1F5F9', padding: 6, borderRadius: 10 },
  recordDate: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  kmBadge: { backgroundColor: isDarkMode ? 'rgba(0, 229, 255, 0.1)' : 'rgba(0, 150, 199, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  kmBadgeText: { color: isDarkMode ? '#00E5FF' : '#0096C7', fontSize: 12, fontWeight: 'bold' },
  recordTitle: { color: isDarkMode ? '#fff' : '#0F172A', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  notesContainer: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#F8FAFC', padding: 10, borderRadius: 10, gap: 8 },
  recordNotes: { color: isDarkMode ? '#F8FAFC' : '#334155', fontSize: 14, flex: 1, lineHeight: 20 },
  fab: { position: 'absolute', right: 25, bottom: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: isDarkMode ? '#00E5FF' : '#0096C7', alignItems: 'center', justifyContent: 'center', shadowColor: isDarkMode ? '#00E5FF' : '#0096C7', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: isDarkMode ? '#0B101E' : '#FFFFFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#E2E8F0' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { color: isDarkMode ? '#fff' : '#0F172A', fontSize: 20, fontWeight: 'bold' },
  inputGroup: { gap: 15, marginBottom: 25 },
  row: { flexDirection: 'row' },
  input: { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : '#F8FAFC', color: isDarkMode ? '#fff' : '#0F172A', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#E2E8F0', fontSize: 15 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  saveButton: { flexDirection: 'row', backgroundColor: isDarkMode ? '#00E5FF' : '#0096C7', padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveButtonText: { color: isDarkMode ? '#0B101E' : '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});