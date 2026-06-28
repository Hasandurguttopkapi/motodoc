import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, 
  ActivityIndicator, Modal, TextInput, FlatList, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Alert, Linking 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location'; // YENİ: GPS Kütüphanesi
import { sendChatMessage, resetChat } from '../services/aiService';

import MaintenanceScreen from './MaintenanceScreen';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  images?: string[]; 
  audio?: string | null;
  // YENİ: Risk Değerlendirme Parametreleri
  riskLevel?: 'Düşük' | 'Orta' | 'Yüksek' | 'Kritik' | string;
  riskPercent?: number;
}

interface ChatSession {
  id: string;
  title: string;
  date: string;
  messages: Message[];
}

export default function DiagnosisScreen() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const currentSessionIdRef = useRef<string | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  useEffect(() => { loadAllData(); }, []);

  const loadAllData = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('@motodoc_theme');
      if (savedTheme !== null) setIsDarkMode(savedTheme === 'dark');
      const storedSessions = await AsyncStorage.getItem('@motodoc_chat_sessions');
      if (storedSessions) setChatSessions(JSON.parse(storedSessions));
    } catch (error) {}
  };

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    try { await AsyncStorage.setItem('@motodoc_theme', newTheme ? 'dark' : 'light'); } catch (error) {}
  };

  const appendMessageAndSave = (newMsg: Message) => {
    setMessages(prev => {
      const updatedMessages = [...prev, newMsg];
      setChatSessions(prevSessions => {
        let updatedSessions = [...prevSessions];
        let sessionId = currentSessionIdRef.current;

        if (!sessionId) {
          sessionId = Date.now().toString();
          currentSessionIdRef.current = sessionId;
          let title = newMsg.text || "Ses/Görsel Analizi";
          if (title.length > 25) title = title.substring(0, 25) + "...";
          updatedSessions.unshift({ id: sessionId, title: title, date: new Date().toLocaleDateString('tr-TR'), messages: updatedMessages });
        } else {
          updatedSessions = updatedSessions.map(s => s.id === sessionId ? { ...s, messages: updatedMessages } : s);
        }
        AsyncStorage.setItem('@motodoc_chat_sessions', JSON.stringify(updatedSessions)).catch(()=>{});
        return updatedSessions;
      });
      return updatedMessages;
    });
  };

  const startNewChat = () => { currentSessionIdRef.current = null; setMessages([]); resetChat(); };

  const loadPastSession = (session: ChatSession) => {
    currentSessionIdRef.current = session.id;
    setMessages(session.messages);
    setIsDrawerOpen(false); 
    resetChat(); 
  };

  const deletePastSession = async (id: string) => {
    setChatSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      AsyncStorage.setItem('@motodoc_chat_sessions', JSON.stringify(updated)).catch(()=>{});
      return updated;
    });
    if (currentSessionIdRef.current === id) startNewChat();
  };

  // YENİ: GPS ile En Yakın Servisi Bulma Fonksiyonu
  const openNearestMechanic = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Konum İzni Gerekli", "En yakın tamirciyi bulabilmemiz için ayarlardan konum izni vermelisiniz.");
        return;
      }

      setLoading(true); // Yükleniyor efekti verelim
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLoading(false);

      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      const query = "Motosiklet Tamircisi";

      // Telefonun türüne göre uygun harita uygulamasını aç (Apple Maps / Google Maps)
      const url = Platform.select({
        ios: `maps:${lat},${lng}?q=${query}`,
        android: `geo:${lat},${lng}?q=${query}`
      });

      if (url) {
        Linking.openURL(url);
      }
    } catch (error) {
      setLoading(false);
      Alert.alert("Hata", "Konumunuz alınamadı. Lütfen telefonunuzun GPS'inin açık olduğundan emin olun.");
    }
  };

  // YENİ: AI'dan gelen veriyi işle ve ekrana bas (JSON ayrıştırma)
  const processAIResponse = (aiResponseText: string) => {
    let parsedData = {
      cevap: aiResponseText,
      risk_seviyesi: undefined,
      risk_yuzdesi: undefined
    };

    try {
      const jsonObj = JSON.parse(aiResponseText);
      if (jsonObj.cevap) {
        parsedData = jsonObj;
      }
    } catch (e) {
      console.log("JSON Parse Hatası (Normal metin olarak işleniyor)");
    }

    appendMessageAndSave({ 
      id: (Date.now() + 1).toString(), 
      text: parsedData.cevap, 
      sender: 'ai',
      riskLevel: parsedData.risk_seviyesi,
      riskPercent: parsedData.risk_yuzdesi
    });
  };

  const styles = getStyles(isDarkMode);
  const accentColor = isDarkMode ? "#00E5FF" : "#0096C7";
  const iconColor = isDarkMode ? "#F8FAFC" : "#0F172A";

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | undefined>();
  const [isRecording, setIsRecording] = useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewComment, setPreviewComment] = useState("");
  const [isGarageOpen, setIsGarageOpen] = useState(false);

  const startDiagnosis = async () => {
    startNewChat();
    setIsChatOpen(true); 
    const userNote = previewComment.trim() ? previewComment.trim() : "İnceleme talebi gönderildi 🛠️";
    appendMessageAndSave({ id: Date.now().toString(), text: userNote, sender: 'user', images: selectedImages, audio: recordedAudioUri });
    setLoading(true);

    const aiResponse = await sendChatMessage(previewComment.trim(), selectedImages, recordedAudioUri);
    processAIResponse(aiResponse); // YENİ FONKSİYON KULLANILDI
    
    setLoading(false); setPreviewComment(""); setSelectedImages([]); setRecordedAudioUri(null);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const userText = inputText; setInputText(""); 
    appendMessageAndSave({ id: Date.now().toString(), text: userText, sender: 'user' });
    setLoading(true);

    const aiResponse = await sendChatMessage(userText);
    processAIResponse(aiResponse); // YENİ FONKSİYON KULLANILDI
    setLoading(false);
  };

  const pickImageForChat = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: 3, quality: 0.7 });
    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      appendMessageAndSave({ id: Date.now().toString(), text: "📷 Yeni görsel eklendi", sender: 'user', images: uris });
      setLoading(true);
      const aiResponse = await sendChatMessage("", uris, null);
      processAIResponse(aiResponse);
      setLoading(false);
    }
  };

  const toggleChatRecording = async () => {
    if (isRecording) {
      if (!recording) return;
      setIsRecording(false); await recording.stopAndUnloadAsync();
      const uri = recording.getURI(); setRecording(undefined);
      if (uri) {
        appendMessageAndSave({ id: Date.now().toString(), text: "🎵 Yeni motor sesi dinletildi", sender: 'user', audio: uri });
        setLoading(true);
        const aiResponse = await sendChatMessage("", [], uri);
        processAIResponse(aiResponse);
        setLoading(false);
      }
    } else {
      try {
        const perm = await Audio.requestPermissionsAsync();
        if (perm.status === 'granted') {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
          const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
          setRecording(newRecording); setIsRecording(true);
        }
      } catch (err) {}
    }
  };

  const pickImage = async () => {
    const remainingLimit = 3 - selectedImages.length;
    if (remainingLimit <= 0) { alert("Maksimum 3 fotoğraf ekleyebilirsiniz."); return; }
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: remainingLimit, quality: 0.7 });
    if (!result.canceled) {
      const uris = result.assets.map(asset => asset.uri);
      setSelectedImages(prev => [...prev, ...uris].slice(0, 3));
    }
  };

  const takePhoto = async () => {
    if (selectedImages.length >= 3) { alert("En fazla 3 fotoğraf ekleyebilirsiniz."); return; }
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) { alert("İzin gerekli."); return; }
    let result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
    if (!result.canceled) { setSelectedImages(prev => [...prev, result.assets[0].uri]); }
  };

  const removeImage = (indexToRemove: number) => { setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove)); };

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status === 'granted') {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(recording); setIsRecording(true);
      }
    } catch (err) {}
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(undefined); setIsRecording(false); await recording.stopAndUnloadAsync();
    const uri = recording.getURI(); if (uri) setRecordedAudioUri(uri);
  };

  const playAudio = async () => {
    if (!recordedAudioUri) return;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: recordedAudioUri });
      await sound.playAsync();
    } catch (error) {}
  };

  // YENİ: Risk Seviyesine Göre Renk Belirleme
  const getRiskColor = (level?: string) => {
    if (level === 'Kritik' || level === 'Yüksek') return '#EF4444'; // Kırmızı
    if (level === 'Orta') return '#F59E0B'; // Sarı
    if (level === 'Düşük') return '#10B981'; // Yeşil
    return accentColor;
  };

  if ((selectedImages.length > 0 || recordedAudioUri) && !isChatOpen) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardArea}>
          <View style={styles.previewHeader}>
            <View style={styles.neonBadge}>
              <Ionicons name="scan" size={16} color={accentColor} />
              <Text style={styles.neonBadgeText}>SİSTEM HAZIR</Text>
            </View>
            <Text style={styles.title}>Teşhis <Text style={styles.textHighlight}>Önizleme</Text></Text>
            <Text style={styles.subtitle}>Veriler analiz edilmek üzere bekliyor.</Text>
          </View>
          <View style={styles.toolbarGlass}>
            {selectedImages.length < 3 && (
              <>
                <TouchableOpacity style={styles.toolbarBtn} onPress={takePhoto}><Ionicons name="camera" size={20} color={iconColor} /></TouchableOpacity>
                <TouchableOpacity style={styles.toolbarBtn} onPress={pickImage}><Ionicons name="images" size={20} color={iconColor} /></TouchableOpacity>
              </>
            )}
            {!recordedAudioUri && (
              <TouchableOpacity style={[styles.toolbarBtn, isRecording && styles.recordingGlow]} onPress={isRecording ? stopRecording : startRecording}>
                <Ionicons name={isRecording ? "stop" : "mic"} size={20} color={isRecording ? "#EF4444" : iconColor} />
              </TouchableOpacity>
            )}
          </View>
          {selectedImages.length > 0 && (
            <View style={styles.multiImageContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 15, paddingHorizontal: 25 }}>
                {selectedImages.map((uri, index) => (
                  <View key={index} style={styles.multiImageWrapper}>
                    <Image source={{ uri }} style={styles.previewMultiImage} />
                    <TouchableOpacity style={styles.removeImageBadge} onPress={() => removeImage(index)}><Ionicons name="close" size={18} color="#fff" /></TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
          {recordedAudioUri && (
            <View style={styles.audioPlayerGlass}>
              <View style={styles.audioWaveIcon}><Ionicons name="pulse" size={40} color={accentColor} /></View>
              <TouchableOpacity style={styles.playButtonNeon} onPress={playAudio}>
                <Ionicons name="play" size={20} color={isDarkMode ? '#0B101E' : '#FFFFFF'} />
                <Text style={styles.playButtonText}>Kaydı Dinle</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.previewCommentWrapper}>
            <TextInput style={styles.glassInput} placeholder="Ustaya özel not ekle... (İsteğe bağlı)" placeholderTextColor="#64748B" value={previewComment} onChangeText={setPreviewComment} multiline />
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.glassCancelButton} onPress={() => {setSelectedImages([]); setRecordedAudioUri(null); setPreviewComment("");}}>
              <Text style={styles.glassCancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryNeonButton} onPress={startDiagnosis}>
              <Ionicons name="flash" size={20} color={isDarkMode ? '#0B101E' : '#FFFFFF'} style={styles.btnIcon} />
              <Text style={styles.primaryNeonText}>Ustaya Gönder</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      <TouchableOpacity style={styles.themeToggleBtn} onPress={toggleTheme}>
        <Ionicons name={isDarkMode ? "sunny" : "moon"} size={24} color={isDarkMode ? "#FBBF24" : "#64748B"} />
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.logoGlow}><Ionicons name="construct" size={45} color={accentColor} /></View>
        <Text style={styles.brandTitle}>motodoc<Text style={styles.textHighlight}>.</Text></Text>
        <Text style={styles.brandSubtitle}>Yapay Zeka Destekli Usta</Text>
      </View>

      <View style={styles.cardContainer}>
        <View style={styles.rowCards}>
          <TouchableOpacity style={styles.glassCard} onPress={takePhoto}>
            <View style={styles.iconCircle}><Ionicons name="camera" size={24} color={accentColor} /></View>
            <Text style={styles.cardTitle}>Kamera</Text>
            <Text style={styles.cardDesc}>Anında çek</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.glassCard} onPress={pickImage}>
            <View style={styles.iconCircle}><Ionicons name="images" size={24} color={accentColor} /></View>
            <Text style={styles.cardTitle}>Galeri</Text>
            <Text style={styles.cardDesc}>Dosya seç</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rowCards}>
          <TouchableOpacity style={[styles.glassCard, isRecording && styles.recordingGlassCard]} onPress={isRecording ? stopRecording : startRecording} activeOpacity={0.8}>
            <View style={[styles.iconCircle, isRecording && styles.recordingCircle]}>
              <Ionicons name={isRecording ? "stop" : "mic"} size={24} color={isRecording ? "#EF4444" : accentColor} />
            </View>
            <Text style={styles.cardTitle}>{isRecording ? "Kayıt..." : "Ses"}</Text>
            <Text style={styles.cardDesc}>Sesi dinlet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.glassCard} onPress={() => setIsGarageOpen(true)} activeOpacity={0.8}>
            <View style={styles.iconCircle}><Ionicons name="calendar" size={24} color={accentColor} /></View>
            <Text style={styles.cardTitle}>Garaj</Text>
            <Text style={styles.cardDesc}>Bakım geçmişi</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.glassGarageCard} 
          onPress={() => {
            startNewChat(); 
            setIsChatOpen(true);
          }} 
          activeOpacity={0.8}
        >
          <View style={styles.largeIconCircle}><Ionicons name="chatbubbles" size={32} color={accentColor} /></View>
          <View style={styles.audioTextWrapper}>
            <Text style={styles.cardTitle}>Ustaya Danış</Text>
            <Text style={styles.cardDesc}>Doğrudan yaz, geçmiş sohbetleri incele</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Modal visible={isChatOpen} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.chatModalRoot}>
          
          <View style={styles.chatHeaderGlass}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
              <TouchableOpacity onPress={() => setIsDrawerOpen(true)} style={{padding: 5, marginRight: 5}}>
                <Ionicons name="menu-outline" size={32} color={accentColor} />
              </TouchableOpacity>
              
              <View style={styles.aiAvatar}><Ionicons name="hardware-chip" size={22} color={isDarkMode ? '#0B101E' : '#fff'} /></View>
              <View>
                <Text style={styles.chatHeaderTitle}>Motodoc AI</Text>
                <Text style={styles.chatHeaderStatus}>🟢 Çevrimiçi</Text>
              </View>
            </View>
            <View style={{flexDirection: 'row', gap: 15, alignItems: 'center'}}>
              <TouchableOpacity onPress={() => { startNewChat(); setIsDrawerOpen(false); }}>
                <Ionicons name="add-circle-outline" size={28} color={accentColor} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsChatOpen(false)}>
                <Ionicons name="close" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            style={{ flex: 1, width: '100%' }}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatScroll}
            renderItem={({ item }) => (
              <View style={[styles.messageBubble, item.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
                
                {/* YENİ: Risk Badge (Etiketi) AI Mesajının Başında */}
                {item.sender === 'ai' && item.riskLevel && (
                  <View style={[styles.riskBadge, { backgroundColor: getRiskColor(item.riskLevel) + '20', borderColor: getRiskColor(item.riskLevel) }]}>
                    <Ionicons name={item.riskLevel === 'Kritik' || item.riskLevel === 'Yüksek' ? 'warning' : 'information-circle'} size={14} color={getRiskColor(item.riskLevel)} />
                    <Text style={[styles.riskBadgeText, { color: getRiskColor(item.riskLevel) }]}>
                      Durum: {item.riskLevel} {item.riskPercent ? `(%${item.riskPercent})` : ''}
                    </Text>
                  </View>
                )}

                {item.images && item.images.length > 0 && (
                  <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10}}>
                    {item.images.map((imgUri, idx) => (
                      <TouchableOpacity key={idx} onPress={() => setFullScreenImage(imgUri)}>
                        <Image source={{ uri: imgUri }} style={styles.chatImage} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {item.audio && (
                  <View style={styles.chatAudioBadge}>
                    <Ionicons name="musical-notes" size={16} color={item.sender === 'user' ? (isDarkMode ? "#0B101E" : "#fff") : accentColor} />
                    <Text style={item.sender === 'user' ? styles.userAudioText : styles.aiAudioText}>Ses Kaydı</Text>
                  </View>
                )}

                <Text style={item.sender === 'user' ? styles.userMessageText : styles.aiMessageText}>{item.text}</Text>

                {/* YENİ: Kritik durumlarda Servis Butonu Çıkar */}
                {item.sender === 'ai' && (item.riskLevel === 'Kritik' || item.riskLevel === 'Yüksek') && (
                  <TouchableOpacity style={styles.emergencyBtn} onPress={openNearestMechanic}>
                    <Ionicons name="navigate-circle" size={18} color="#fff" />
                    <Text style={styles.emergencyBtnText}>En Yakın Servisi Bul</Text>
                  </TouchableOpacity>
                )}

              </View>
            )}
          />

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={styles.chatInputGlass}>
              <TouchableOpacity style={styles.chatActionBtn} onPress={pickImageForChat} disabled={loading || isRecording}><Ionicons name="images" size={24} color="#94A3B8" /></TouchableOpacity>
              <TouchableOpacity style={styles.chatActionBtn} onPress={toggleChatRecording} disabled={loading}><Ionicons name={isRecording ? "stop-circle" : "mic"} size={26} color={isRecording ? "#EF4444" : "#94A3B8"} /></TouchableOpacity>
              
              <TextInput 
                style={styles.chatInputText} 
                placeholder={isRecording ? "Ses dinleniyor..." : (loading ? "AI düşünüyor..." : "Mesaj yaz...")} 
                placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"} 
                value={inputText} 
                onChangeText={setInputText} 
                editable={!loading && !isRecording} 
              />
              
              <TouchableOpacity style={[styles.sendNeonBtn, (!inputText.trim() || loading || isRecording) && {opacity: 0.4}]} onPress={handleSendMessage} disabled={loading || isRecording || !inputText.trim()}>
                {loading ? <ActivityIndicator color={isDarkMode ? '#0B101E' : '#fff'} /> : <Ionicons name="send" size={18} color={isDarkMode ? '#0B101E' : '#fff'} />}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>

          {isDrawerOpen && (
            <View style={[StyleSheet.absoluteFill, {zIndex: 50}]}>
              <TouchableOpacity style={styles.drawerOverlay} activeOpacity={1} onPress={() => setIsDrawerOpen(false)} />
              <View style={styles.drawerSidebar}>
                <View style={styles.drawerHeader}>
                  <Text style={styles.drawerTitle}>Geçmiş Sohbetler</Text>
                  <TouchableOpacity onPress={() => setIsDrawerOpen(false)}><Ionicons name="close" size={28} color="#94A3B8" /></TouchableOpacity>
                </View>

                {chatSessions.length === 0 ? (
                  <View style={{padding: 20, alignItems: 'center'}}>
                    <Ionicons name="chatbox-ellipses-outline" size={40} color={isDarkMode ? '#1E293B' : '#CBD5E1'} />
                    <Text style={{color: '#64748B', textAlign: 'center', marginTop: 10}}>Geçmiş sohbet yok.</Text>
                  </View>
                ) : (
                  <FlatList
                    data={chatSessions}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{padding: 15, paddingBottom: 50}}
                    renderItem={({item}) => (
                      <TouchableOpacity 
                        style={[styles.historyCard, currentSessionIdRef.current === item.id && { borderColor: accentColor }]} 
                        onPress={() => loadPastSession(item)}
                      >
                        <View style={{flex: 1}}>
                          <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.historyDate}>{item.date}</Text>
                        </View>
                        <TouchableOpacity onPress={() => deletePastSession(item.id)} style={{padding: 5}}><Ionicons name="trash-outline" size={20} color="#EF4444" /></TouchableOpacity>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </View>
          )}

          {fullScreenImage && (
            <View style={[StyleSheet.absoluteFill, styles.fullScreenImageContainer, { zIndex: 100 }]}>
              <TouchableOpacity style={styles.fullScreenCloseBtn} onPress={() => setFullScreenImage(null)}>
                <Ionicons name="close-circle" size={36} color="#ffffff" />
              </TouchableOpacity>
              <Image source={{ uri: fullScreenImage }} style={styles.fullScreenImage} resizeMode="contain" />
            </View>
          )}
          
        </SafeAreaView>
      </Modal>

      <Modal visible={isGarageOpen} animationType="slide" transparent={false}>
        <MaintenanceScreen onClose={() => setIsGarageOpen(false)} isDarkMode={isDarkMode} />
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDarkMode ? '#070B14' : '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  chatModalRoot: { flex: 1, backgroundColor: isDarkMode ? '#070B14' : '#F8FAFC', alignItems: 'stretch', width: '100%' },
  keyboardArea: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  themeToggleBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, right: 20, zIndex: 10, padding: 10, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#E2E8F0', borderRadius: 20 },
  header: { alignItems: 'center', marginBottom: 40, marginTop: -30 },
  logoGlow: { width: 90, height: 90, borderRadius: 45, backgroundColor: isDarkMode ? 'rgba(0, 229, 255, 0.05)' : 'rgba(0, 150, 199, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: isDarkMode ? 'rgba(0, 229, 255, 0.2)' : 'rgba(0, 150, 199, 0.2)', shadowColor: isDarkMode ? '#00E5FF' : '#0096C7', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 10 },
  brandTitle: { fontSize: 42, fontWeight: '900', color: isDarkMode ? '#fff' : '#0F172A', letterSpacing: -1 },
  textHighlight: { color: isDarkMode ? '#00E5FF' : '#0096C7' },
  brandSubtitle: { fontSize: 15, color: '#64748B', marginTop: 5, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },

  cardContainer: { width: '88%', gap: 15 },
  rowCards: { flexDirection: 'row', gap: 15 },
  glassCard: { flex: 1, backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#FFFFFF', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0', alignItems: 'flex-start', shadowColor: '#000', shadowOpacity: isDarkMode ? 0 : 0.05, shadowRadius: 10, elevation: 2 },
  recordingGlassCard: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' },
  glassGarageCard: { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#FFFFFF', padding: 25, borderRadius: 30, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0', shadowColor: '#000', shadowOpacity: isDarkMode ? 0 : 0.05, shadowRadius: 10, elevation: 2 },

  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: isDarkMode ? 'rgba(0, 229, 255, 0.1)' : 'rgba(0, 150, 199, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  largeIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: isDarkMode ? 'rgba(0, 229, 255, 0.1)' : 'rgba(0, 150, 199, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 20 },
  recordingCircle: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  
  cardTitle: { color: isDarkMode ? '#fff' : '#0F172A', fontSize: 16, fontWeight: '700' },
  cardDesc: { color: '#64748B', fontSize: 12, marginTop: 4, fontWeight: '500' },
  audioTextWrapper: { flex: 1 },

  previewHeader: { width: '88%', marginBottom: 25, marginTop: 10 },
  neonBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? 'rgba(0, 229, 255, 0.1)' : 'rgba(0, 150, 199, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: isDarkMode ? 'rgba(0, 229, 255, 0.2)' : 'rgba(0, 150, 199, 0.2)' },
  neonBadgeText: { color: isDarkMode ? '#00E5FF' : '#0096C7', fontSize: 12, fontWeight: 'bold', marginLeft: 6, letterSpacing: 1 },
  title: { fontSize: 32, fontWeight: '800', color: isDarkMode ? '#fff' : '#0F172A' },
  subtitle: { fontSize: 15, color: '#64748B', marginTop: 5 },

  toolbarGlass: { flexDirection: 'row', backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : '#FFFFFF', padding: 8, borderRadius: 20, gap: 8, marginBottom: 20, borderWidth: 1, borderColor: isDarkMode ? 'transparent' : '#E2E8F0' },
  toolbarBtn: { width: 50, height: 50, borderRadius: 15, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  recordingGlow: { backgroundColor: 'rgba(239, 68, 68, 0.2)', shadowColor: '#EF4444', shadowOpacity: 0.5, shadowRadius: 10 },

  multiImageContainer: { height: 180, width: '100%', marginBottom: 15 },
  multiImageWrapper: { position: 'relative', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
  previewMultiImage: { width: 140, height: 180, borderRadius: 24, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0' },
  removeImageBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#0F172A', borderRadius: 15, padding: 2 },

  audioPlayerGlass: { width: '88%', backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#FFFFFF', borderRadius: 24, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0' },
  audioWaveIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: isDarkMode ? 'rgba(0, 229, 255, 0.05)' : 'rgba(0, 150, 199, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  playButtonNeon: { flexDirection: 'row', backgroundColor: isDarkMode ? '#00E5FF' : '#0096C7', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 20, alignItems: 'center', gap: 8 },
  playButtonText: { color: isDarkMode ? '#0B101E' : '#FFFFFF', fontWeight: '800', fontSize: 15 },

  previewCommentWrapper: { width: '88%', marginBottom: 20 },
  glassInput: { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#FFFFFF', color: isDarkMode ? '#fff' : '#0F172A', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0', fontSize: 15, minHeight: 80, textAlignVertical: 'top' },

  buttonRow: { flexDirection: 'row', width: '88%', gap: 15 },
  glassCancelButton: { flex: 1, backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : '#E2E8F0', padding: 18, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  glassCancelText: { color: isDarkMode ? '#94A3B8' : '#475569', fontSize: 16, fontWeight: '700' },
  primaryNeonButton: { flex: 2, flexDirection: 'row', backgroundColor: isDarkMode ? '#00E5FF' : '#0096C7', padding: 18, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  primaryNeonText: { color: isDarkMode ? '#0B101E' : '#FFFFFF', fontSize: 16, fontWeight: '800' },
  btnIcon: { marginRight: 8 },

  chatHeaderGlass: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, paddingTop: Platform.OS === 'ios' ? 10 : 20, backgroundColor: isDarkMode ? 'rgba(11, 16, 30, 0.9)' : '#FFFFFF', borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0', width: '100%' },
  aiAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: isDarkMode ? '#00E5FF' : '#0096C7', alignItems: 'center', justifyContent: 'center' },
  chatHeaderTitle: { color: isDarkMode ? '#fff' : '#0F172A', fontSize: 18, fontWeight: '800' },
  chatHeaderStatus: { color: '#10B981', fontSize: 12, fontWeight: '600', marginTop: 2 },

  chatScroll: { padding: 20, paddingBottom: 40 },
  messageBubble: { maxWidth: '82%', padding: 18, borderRadius: 24, marginBottom: 15 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: isDarkMode ? '#00E5FF' : '#0096C7', borderBottomRightRadius: 6 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.7)' : '#FFFFFF', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0' },
  
  userMessageText: { color: isDarkMode ? '#0B101E' : '#FFFFFF', fontSize: 15, fontWeight: '600', lineHeight: 22 },
  aiMessageText: { color: isDarkMode ? '#F8FAFC' : '#0F172A', fontSize: 15, lineHeight: 24 },
  
  chatImage: { width: 110, height: 110, borderRadius: 16 },
  chatAudioBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 5 },
  userAudioText: { color: isDarkMode ? '#0B101E' : '#FFFFFF', fontWeight: '800', fontSize: 12 },
  aiAudioText: { color: isDarkMode ? '#00E5FF' : '#0096C7', fontWeight: '800', fontSize: 12 },
  
  chatInputGlass: { flexDirection: 'row', padding: 12, backgroundColor: isDarkMode ? 'rgba(11, 16, 30, 0.95)' : '#FFFFFF', borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0', alignItems: 'center', width: '100%', paddingBottom: Platform.OS === 'ios' ? 30 : 15 },
  chatActionBtn: { padding: 8, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#F1F5F9', borderRadius: 20, marginRight: 5 },
  chatInputText: { flex: 1, height: 48, backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : '#F1F5F9', color: isDarkMode ? '#fff' : '#0F172A', paddingHorizontal: 20, borderRadius: 24, fontSize: 15, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0', marginHorizontal: 8 },
  sendNeonBtn: { backgroundColor: isDarkMode ? '#00E5FF' : '#0096C7', width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },

  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  drawerSidebar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '75%', maxWidth: 320, backgroundColor: isDarkMode ? '#0B101E' : '#FFFFFF', borderRightWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 15, paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#E2E8F0' },
  drawerTitle: { color: isDarkMode ? '#fff' : '#0F172A', fontSize: 18, fontWeight: '800' },
  historyCard: { flexDirection: 'row', backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#F8FAFC', padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0', alignItems: 'center', justifyContent: 'space-between' },
  historyTitle: { color: isDarkMode ? '#fff' : '#0F172A', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  historyDate: { color: '#64748B', fontSize: 12, fontWeight: '500' },

  fullScreenImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullScreenCloseBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, right: 20, zIndex: 10, padding: 10 },
  fullScreenImage: { width: '100%', height: '80%' },

  // YENİ: Risk ve Servis Butonu Stilleri
  riskBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 8, borderWidth: 1, alignSelf: 'flex-start' },
  riskBadgeText: { fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
  emergencyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 16, marginTop: 15, gap: 8, shadowColor: '#EF4444', shadowOpacity: 0.4, shadowRadius: 8 },
  emergencyBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' }
});