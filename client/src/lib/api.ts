import type { User, Universe, Character, Card, UserProgress, ChatThread, ChatMessage, ImageGeneration, Location, DesignGuide, UniverseReferenceAsset } from "@shared/schema";

export type ReferenceAsset = UniverseReferenceAsset;

class ApiClient {
  private baseUrl = "/api";

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      throw new Error(error.message || "Request failed");
    }

    return response.json();
  }

  // Auth
  async register(username: string, password: string, email?: string) {
    return this.request<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, email }),
    });
  }

  async login(username: string, password: string) {
    return this.request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  async logout() {
    return this.request<{ message: string }>("/auth/logout", {
      method: "POST",
    });
  }

  async me() {
    return this.request<{ user: User }>("/auth/me");
  }

  // Universe
  async getUniverses() {
    return this.request<Universe[]>("/universes");
  }

  async getUniverse(id: number) {
    return this.request<Universe>(`/universes/${id}`);
  }

  async getStoryBySlug(slug: string) {
    return this.request<{ 
      universe: Universe; 
      cards: Card[]; 
      characters: Character[];
      creator?: { displayName: string; slug: string | null; headline: string | null; avatarUrl: string | null } | null;
      publicAccessToken?: string;
    }>(`/story/${slug}`);
  }

  async createUniverse(data: Partial<Universe>) {
    return this.request<Universe>("/universes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateUniverse(id: number, data: Partial<Universe>) {
    return this.request<Universe>(`/universes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteUniverse(id: number) {
    return this.request<{ message: string }>(`/universes/${id}`, {
      method: "DELETE",
    });
  }

  // Visual Bible (Design Guide & Reference Assets)
  async updateDesignGuide(universeId: number, designGuide: DesignGuide) {
    return this.request<{ designGuide: DesignGuide }>(`/universes/${universeId}/design-guide`, {
      method: "PUT",
      body: JSON.stringify(designGuide),
    });
  }

  async getReferenceAssets(universeId: number) {
    return this.request<ReferenceAsset[]>(`/universes/${universeId}/reference-assets`);
  }

  async createReferenceAsset(universeId: number, data: FormData) {
    const response = await fetch(`${this.baseUrl}/universes/${universeId}/reference-assets`, {
      method: "POST",
      credentials: "include",
      body: data,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      throw new Error(error.message || "Request failed");
    }
    return response.json() as Promise<ReferenceAsset>;
  }

  async updateReferenceAsset(id: number, data: Partial<ReferenceAsset>) {
    return this.request<ReferenceAsset>(`/reference-assets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteReferenceAsset(id: number) {
    return this.request<{ message: string }>(`/reference-assets/${id}`, {
      method: "DELETE",
    });
  }

  // Characters
  async getCharacters(universeId: number) {
    return this.request<Character[]>(`/characters?universeId=${universeId}`);
  }

  async getCharacter(id: number) {
    return this.request<Character>(`/characters/${id}`);
  }

  async createCharacter(data: Partial<Character>) {
    return this.request<Character>("/characters", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCharacter(id: number, data: Partial<Character>) {
    return this.request<Character>(`/characters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteCharacter(id: number) {
    return this.request<{ message: string }>(`/characters/${id}`, {
      method: "DELETE",
    });
  }

  // Locations
  async getLocations(universeId: number) {
    return this.request<Location[]>(`/locations?universeId=${universeId}`);
  }

  // Cards
  async getCards(universeId: number, season?: number) {
    const params = new URLSearchParams({ universeId: universeId.toString() });
    if (season) params.append("season", season.toString());
    return this.request<Card[]>(`/cards?${params}`);
  }

  async getCard(id: number) {
    return this.request<Card>(`/cards/${id}`);
  }

  async createCard(data: Partial<Card>) {
    return this.request<Card>("/cards", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCard(id: number, data: Partial<Card>) {
    return this.request<Card>(`/cards/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteCard(id: number) {
    return this.request<{ message: string }>(`/cards/${id}`, {
      method: "DELETE",
    });
  }

  async deleteAllCards(universeId: number) {
    return this.request<{ message: string; deletedCount: number }>(`/universes/${universeId}/cards`, {
      method: "DELETE",
    });
  }

  async linkCardCharacter(cardId: number, characterId: number) {
    return this.request<{ message: string }>(`/cards/${cardId}/characters/${characterId}`, {
      method: "POST",
    });
  }

  async unlinkCardCharacter(cardId: number, characterId: number) {
    return this.request<{ message: string }>(`/cards/${cardId}/characters/${characterId}`, {
      method: "DELETE",
    });
  }

  async getCardCharacters(cardId: number) {
    return this.request<Character[]>(`/cards/${cardId}/characters`);
  }

  // User Progress
  async getProgress(universeId: number) {
    return this.request<UserProgress>(`/progress?universeId=${universeId}`);
  }

  async unlockNextCard(universeId: number) {
    return this.request<UserProgress>("/progress/unlock", {
      method: "POST",
      body: JSON.stringify({ universeId }),
    });
  }

  // Chat
  async getChatThread(universeId: number, characterId: number) {
    return this.request<ChatThread>(`/chat/threads?universeId=${universeId}&characterId=${characterId}`);
  }

  async getChatMessages(threadId: number) {
    return this.request<ChatMessage[]>(`/chat/threads/${threadId}/messages`);
  }

  async sendChatMessage(threadId: number, content: string) {
    return this.request<ChatMessage>(`/chat/threads/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ role: "user", content }),
    });
  }

  async addAssistantMessage(threadId: number, content: string) {
    return this.request<ChatMessage>(`/chat/threads/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ role: "assistant", content }),
    });
  }

  // Events
  async logEvent(type: string, metadata?: Record<string, any>) {
    return this.request<{ message: string }>("/events", {
      method: "POST",
      body: JSON.stringify({ type, metadata }),
    });
  }

  // Feed (with visibility resolver)
  async getFeed(universeId: number, season?: number): Promise<FeedResponse> {
    const params = season ? `?season=${season}` : '';
    return this.request<FeedResponse>(`/feed/${universeId}${params}`);
  }

  // Image Generation
  async getPendingImages(universeId: number): Promise<PendingImagesResult> {
    return this.request<PendingImagesResult>(`/universes/${universeId}/cards/pending-images`);
  }

  async generateCardImage(cardId: number): Promise<GenerateImageResult> {
    return this.request<GenerateImageResult>(`/cards/${cardId}/generate-image`, {
      method: "POST",
    });
  }

  async generateCardVideo(cardId: number): Promise<GenerateVideoResult> {
    return this.request<GenerateVideoResult>(`/cards/${cardId}/generate-video`, {
      method: "POST",
    });
  }

  async setGeneratedImage(cardId: number, generatedImageUrl: string) {
    return this.request<{ success: boolean; cardId: number; generatedImageUrl: string }>(`/cards/${cardId}/set-generated-image`, {
      method: "PATCH",
      body: JSON.stringify({ generatedImageUrl }),
    });
  }

  async updateCardImageSettings(cardId: number, data: { sceneDescription?: string; imageGeneration?: any }) {
    return this.request<{ success: boolean; card: any }>(`/cards/${cardId}/image-settings`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // Import
  async validateImport(file: File): Promise<ImportValidationResult> {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetch(`${this.baseUrl}/import/validate`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Validation failed" }));
      throw new Error(error.message || "Validation failed");
    }
    
    return response.json();
  }

  async executeImport(file: File, options?: { universeId?: number; overwrite?: boolean; dropImmediately?: boolean }): Promise<ImportExecutionResult> {
    const formData = new FormData();
    formData.append("file", file);
    if (options?.universeId) {
      formData.append("universeId", options.universeId.toString());
    }
    if (options?.overwrite) {
      formData.append("overwrite", "true");
    }
    if (options?.dropImmediately) {
      formData.append("dropImmediately", "true");
    }
    
    const response = await fetch(`${this.baseUrl}/import/execute`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Import failed" }));
      throw new Error(error.message || "Import failed");
    }
    
    return response.json();
  }

  // Audio
  async scanAudioFiles(): Promise<{ files: ScannedAudioFile[] }> {
    return this.request<{ files: ScannedAudioFile[] }>("/admin/audio/scan");
  }

  async importAudioFiles(files: Array<ScannedAudioFile & { title?: string; artist?: string; moodTags?: string[]; genreTags?: string[] }>): Promise<{ imported: AudioTrack[]; count: number }> {
    return this.request<{ imported: AudioTrack[]; count: number }>("/admin/audio/import", {
      method: "POST",
      body: JSON.stringify({ files }),
    });
  }

  async uploadAudioFile(file: File, metadata?: { title?: string; artist?: string; moodTags?: string[]; genreTags?: string[] }): Promise<{ track: AudioTrack }> {
    const formData = new FormData();
    formData.append("audio", file);
    if (metadata) {
      formData.append("metadata", JSON.stringify(metadata));
    }
    
    const response = await fetch(`${this.baseUrl}/admin/audio/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Upload failed" }));
      throw new Error(error.message || "Upload failed");
    }
    
    return response.json();
  }

  async getAudioTracks(mood?: string, genre?: string): Promise<AudioTrack[]> {
    const params = new URLSearchParams();
    if (mood) params.append("mood", mood);
    if (genre) params.append("genre", genre);
    const query = params.toString();
    return this.request<AudioTrack[]>(`/audio${query ? `?${query}` : ""}`);
  }

  async getAudioTrack(id: number): Promise<AudioTrack> {
    return this.request<AudioTrack>(`/audio/${id}`);
  }

  async updateAudioTrack(id: number, updates: Partial<AudioTrack>): Promise<AudioTrack> {
    return this.request<AudioTrack>(`/audio/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteAudioTrack(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/audio/${id}`, {
      method: "DELETE",
    });
  }

  async getUniverseAudioSettings(universeId: number): Promise<UniverseAudioSettings> {
    return this.request<UniverseAudioSettings>(`/universes/${universeId}/audio-settings`);
  }

  async updateUniverseAudioSettings(universeId: number, settings: Partial<UniverseAudioSettings>): Promise<UniverseAudioSettings> {
    return this.request<UniverseAudioSettings>(`/universes/${universeId}/audio-settings`, {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }
}

export interface ImportValidationResult {
  valid: boolean;
  universe: string;
  visualMode?: string;
  createdCards: number;
  createdCharacters: number;
  cardsWithImagePrompts?: number;
  cardsMissingImagePrompts?: number;
  warnings: string[];
  errors: string[];
  schedule: { day: number; title: string; date: string; hasImagePrompt?: boolean }[];
}

export interface ImportExecutionResult {
  success: boolean;
  universeId: number;
  universeName: string;
  visualMode?: string;
  createdCards: number;
  createdCharacters: number;
  warnings: string[];
}

export interface PendingImagesResult {
  universeId: number;
  universeName: string;
  visualMode: string;
  totalCards: number;
  pendingCount: number;
  generatedCount: number;
  pendingCards: {
    id: number;
    title: string;
    dayIndex: number;
    sceneDescription?: string;
    imageGeneration?: any;
  }[];
}

export interface GenerateImageResult {
  cardId: number;
  cardTitle: string;
  composedPrompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  status: string;
  message: string;
}

export interface GenerateVideoResult {
  cardId: number;
  cardTitle: string;
  status: string;
  message: string;
  generatedVideoUrl?: string;
}

export interface FeedCard extends Card {
  isVisible: boolean;
  isLocked: boolean;
  unlockAt: string | null;
  isIntroCard: boolean;
}

export interface FeedResponse {
  universe: {
    id: number;
    name: string;
    slug: string | null;
    releaseMode: string;
    introCardsCount: number;
    dailyReleaseStartsAtDayIndex: number;
  };
  cards: FeedCard[];
  visibleCount: number;
  lockedCount: number;
  nextUnlock: string | null;
}

export interface AudioTrack {
  id: number;
  title: string;
  artist?: string | null;
  source: string;
  licence?: string | null;
  licenceUrl?: string | null;
  attributionRequired: boolean;
  attributionText?: string | null;
  filePath?: string | null;
  fileUrl: string;
  durationSeconds?: number | null;
  moodTags: string[];
  genreTags: string[];
  createdByUserId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UniverseAudioSettings {
  id?: number;
  universeId: number;
  audioMode: string;
  defaultTrackId: number | null;
  allowedTrackIds: number[];
  fadeInMs: number;
  fadeOutMs: number;
  crossfadeMs: number;
  duckingDuringVoiceOver: boolean;
  duckDb: number;
}

export interface ScannedAudioFile {
  filename: string;
  path: string;
  url: string;
  suggestedTitle: string;
}

export const api = new ApiClient();
