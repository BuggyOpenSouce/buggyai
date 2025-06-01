// src/types.ts

export interface UserProfile {
  id: string;
  email?: string;
  nickname: string;
  avatar_url?: string | null;
  interests?: string[];
  communication_style?: 'formal' | 'informal' | 'neutral';
  storage_used_bytes?: number; // Kullanıcının kullandığı depolama alanı
  onboarding_completed?: boolean;
  // Aşağıdaki alanlar doğrudan veritabanında olmayabilir, istemci tarafında hesaplanabilir
  interests_string?: string; // İlgi alanlarının virgülle ayrılmış hali
  interests_string_with_status?: string; // İlgi alanları ve konuşulma durumları
  last_active?: string | Date; // Son aktif olduğu zaman
  created_at?: string | Date; // Profilin oluşturulma tarihi
  daily_chat_limit?: number; // Günlük sohbet limiti
  image_upload_limit?: number; // Günlük resim yükleme limiti
  is_beta_user?: boolean; // Beta kullanıcısı mı?
  beta_features_enabled?: string[]; // Etkin beta özellikleri
  settings?: UserSettings; // Kullanıcıya özel ayarlar
  // Ekleyebileceğiniz diğer alanlar:
  // preferred_language?: string;
  // timezone?: string;
  // ... vb.
}

export interface UserSettings {
  theme?: string; // 'dark', 'light', 'system', 'twilight' vb.
  notifications_enabled?: boolean;
  data_sync_enabled?: boolean; // Veri senkronizasyonu açık mı?
  ai_model_preference?: string; // Tercih edilen AI modeli (eğer seçenek varsa)
  // ... vb. diğer ayarlar
}


export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system'; // 'system' rolü de eklenebilir
  content: string;
  images?: string[]; // Base64 data URI dizisi (resimler için)
  videos?: string[]; // YENİ: Base64 data URI dizisi (videolar için)
  timestamp: number;
  isLoading?: boolean; // Mesajın yüklenip yüklenmediğini belirtir (UI için)
  isError?: boolean; // Mesaj gönderiminde hata olup olmadığını belirtir (UI için)
  feedback?: 'good' | 'bad' | null; // Mesaj için kullanıcı geri bildirimi
  // Alternatif içerik türleri için:
  // audioUrl?: string;
  // fileUrl?: string;
  // location?: { latitude: number; longitude: number };
  // ... vb.
}

export interface ChatSession {
  id: string; // Genellikle kullanıcı ID'si veya özel bir session ID
  title?: string; // Sohbet başlığı (isteğe bağlı, UI için)
  messages: Message[];
  lastUpdated: number; // En son güncelleme zaman damgası
  // Bu oturumla ilgili ek meta veriler eklenebilir
  // summary?: string; // Oturumun kısa bir özeti (AI tarafından üretilebilir)
  // tags?: string[]; // Oturumu etiketlemek için
}

export interface AISettings {
  model?: string; // Kullanılacak AI modeli
  temperature?: number; // Cevapların rastgelelik derecesi (0.0 - 1.0)
  maxTokens?: number; // Üretilecek maksimum token sayısı
  contextWindow?: number; // Modele gönderilecek maksimum geçmiş mesaj sayısı
  systemPrompt?: string; // Modele verilecek genel sistem talimatı
  // Ek ayarlar:
  // top_p?: number;
  // frequency_penalty?: number;
  // presence_penalty?: number;
  importantPoints?: string[]; // Kullanıcının vurguladığı önemli noktalar
  discussedTopics?: Array<{ topic: string; discussed: boolean; lastMentioned?: number }>; // Konuşulan konular ve durumları
}


// Günlük kayıtları için (hafıza/anılar)
export interface JournalLogItem {
  id: string; // Benzersiz ID
  timestamp: number;
  type: 'user' | 'assistant' | 'system' | 'thought' | 'event'; // Kayıt tipi
  content: string; // Kaydın içeriği
  metadata?: Record<string, any>; // Ek bilgiler (örn: ilgili mesaj ID'si, duygu durumu vb.)
}

export interface DailyJournalEntry {
  date: string; // YYYY-MM-DD formatında tarih
  logs: JournalLogItem[];
  summary?: string; // Günün özeti (AI tarafından üretilebilir)
  // O gün için ek bilgiler:
  // mood?: string; // Kullanıcının o günkü genel ruh hali
  // significant_events?: string[]; // Önemli olaylar
}

// Tema arayüzü
export interface Theme {
  name: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  // ... Diğer tema özellikleri
  styles?: {
    // CSS değişkenleri veya stil objeleri
    '--primary-color'?: string;
    '--background-color'?: string;
    '--text-color'?: string;
    // ...vb.
  };
}


// MultiImager (Resim Üretici) için Tipler
export interface ImagerProvider {
  id: string;
  name: string;
  apiKeyEnvVar?: string; // API anahtarının ortam değişkeni adı
  apiKey?: string; // Doğrudan API anahtarı (güvenlik riski oluşturabilir)
  model: string;
  endpoint: string; // API endpoint URL'i
  isFree?: boolean;
  isFast?: boolean;
  isUnavailable?: boolean;
  imageSize?: string; // '1024x1024', '512x512' vb.
  maxImagesPerRequest?: number;
  additionalConfig?: Record<string, any>; // Sağlayıcıya özel ek yapılandırma
  type?: 'openrouter' | 'custom'; // Sağlayıcı tipi
}

export interface ImageGenerationRequest {
  prompt: string;
  negative_prompt?: string;
  num_outputs?: number; // Kaç adet resim üretileceği
  width?: number;
  height?: number;
  guidance_scale?: number; // CFG Scale
  seed?: number;
  // ...modele özgü diğer parametreler
}

export interface GeneratedImage {
  id: string; // Benzersiz ID
  url?: string; // Resmin URL'i (eğer varsa)
  base64?: string; // Base64 kodlu resim verisi
  prompt: string; // Bu resmi üreten prompt
  providerId: string; // Hangi sağlayıcı tarafından üretildiği
  createdAt: number; // Oluşturulma zamanı
  // Ek meta veriler
  // seed?: number;
  // cost?: number; // Üretim maliyeti
}

// Veri senkronizasyonu için (Supabase, Firebase vb.)
export interface SyncedData {
  userProfile?: UserProfile;
  chatSessions?: ChatSession[]; // Veya Record<string, ChatSession>
  dailyJournal?: DailyJournalEntry[]; // Veya Record<string, DailyJournalEntry>
  aiSettings?: AISettings;
  generatedImages?: GeneratedImage[];
  lastSyncTimestamp?: number;
}

// Soru Üretme Modülü için Tipler
export interface QuestionTopic {
  id: string;
  name: string;
  description?: string;
  // icon?: string; // Konu için bir ikon (isteğe bağlı)
}

export interface GeneratedQuestion {
  id: string;
  topicId: string; // Hangi konuyla ilgili olduğu
  questionText: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  // Ek bilgiler:
  // correctAnswer?: string; (Eğer cevap da üretiliyorsa)
  // hints?: string[];
}

// Genel API Yanıtı (OpenRouter veya Gemini için kullanılabilir)
export interface APIResponseChoice {
  message: {
    role: 'assistant';
    content: string;
    // tool_calls?: any[]; // Eğer araç kullanımı varsa
  };
  finish_reason?: string; // 'stop', 'length', 'tool_calls' vb.
  // index?: number;
}

export interface APIResponse {
  id: string; // İstek ID'si
  choices: APIResponseChoice[];
  created: number; // Zaman damgası (Unix epoch)
  model: string; // Kullanılan modelin adı
  object: string; // Genellikle 'chat.completion'
  // usage?: { // Kullanım bilgileri (token vb.)
  //   prompt_tokens?: number;
  //   completion_tokens?: number;
  //   total_tokens?: number;
  // };
  // system_fingerprint?: string;
}

// Uygulama genelinde hata yönetimi için
export interface AppError {
  id: string;
  message: string; // Kullanıcıya gösterilecek mesaj
  details?: string; // Teknik detaylar (konsol için)
  code?: string | number; // Hata kodu
  timestamp: number;
  isRecoverable?: boolean; // Hatanın düzeltilip düzeltilemeyeceği
}