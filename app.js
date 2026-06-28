import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// İki ana ekranımızı içe aktarıyoruz
import DiagnosisScreen from './src/screens/DiagnosisScreen';
import MaintenanceScreen from './src/screens/MaintenanceScreen';

export default function App() {
  // Uygulamanın hangi ekranda olduğunu takip eden State ('diagnosis' veya 'maintenance')
  const [activeTab, setActiveTab] = useState('diagnosis');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070B14" />
      
      {/* Aktif sekmeye göre ekranı render et */}
      <View style={styles.content}>
        {activeTab === 'diagnosis' ? <DiagnosisScreen /> : <MaintenanceScreen />}
      </View>

      {/* Özel Tasarım Alt Menü Çubuğu (Bottom Tab Bar) */}
      <View style={styles.tabBarWrapper}>
        <View style={styles.tabBarGlass}>
          
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => setActiveTab('diagnosis')}
          >
            <Ionicons 
              name={activeTab === 'diagnosis' ? "scan-circle" : "scan-circle-outline"} 
              size={30} 
              color={activeTab === 'diagnosis' ? "#00E5FF" : "#64748B"} 
            />
            <Text style={[styles.tabText, activeTab === 'diagnosis' && styles.tabTextActive]}>
              Teşhis
            </Text>
            {activeTab === 'diagnosis' && <View style={styles.activeDot} />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => setActiveTab('maintenance')}
          >
            <Ionicons 
              name={activeTab === 'maintenance' ? "calendar" : "calendar-outline"} 
              size={28} 
              color={activeTab === 'maintenance' ? "#00E5FF" : "#64748B"} 
            />
            <Text style={[styles.tabText, activeTab === 'maintenance' && styles.tabTextActive]}>
              Garajım
            </Text>
            {activeTab === 'maintenance' && <View style={styles.activeDot} />}
          </TouchableOpacity>

        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#070B14' 
  },
  content: { 
    flex: 1,
    // Alt menünün ekranın altındaki içerikleri kapatmaması için alt boşluk
    paddingBottom: 90 
  },
  
  // Tab Bar Stilleri
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    alignItems: 'center',
    paddingBottom: 25, // Cihazların alt çentiği için boşluk
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  tabBarGlass: {
    flexDirection: 'row',
    backgroundColor: 'rgba(11, 16, 30, 0.95)',
    width: '85%',
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: '100%',
  },
  tabText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  tabTextActive: {
    color: '#00E5FF',
    fontWeight: '800',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00E5FF',
    position: 'absolute',
    bottom: 8,
    shadowColor: '#00E5FF',
    shadowOpacity: 0.8,
    shadowRadius: 4,
  }
});