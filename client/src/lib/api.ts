import type { User, Universe, Character, Card, UserProgress, ChatThread, ChatMessage } from "@shared/schema";

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
}

export const api = new ApiClient();
