import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AvatarConfig, GameHistoryItem, PublicUser } from '@quiz/shared';
import { api, ApiError } from '../api';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<PublicUser | null>(null);
  const token = ref(localStorage.getItem('quiz_access') || '');
  const error = ref('');

  function setSession(accessToken: string, next: PublicUser) {
    token.value = accessToken;
    user.value = next;
    localStorage.setItem('quiz_access', accessToken);
  }

  async function load() {
    if (!token.value) {
      return;
    }
    try {
      user.value = await api<PublicUser>('/auth/me');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        token.value = '';
        user.value = null;
        localStorage.removeItem('quiz_access');
      }
    }
  }

  async function register(payload: { email: string; password: string; name: string }) {
    error.value = '';
    const res = await api<{ accessToken: string; user: PublicUser; verifyUrl: string }>('/auth/register', {
      method: 'POST',
      json: payload,
    });
    setSession(res.accessToken, res.user);
    return res;
  }

  async function login(payload: { email: string; password: string }) {
    error.value = '';
    const res = await api<{ accessToken: string; user: PublicUser }>('/auth/login', {
      method: 'POST',
      json: payload,
    });
    setSession(res.accessToken, res.user);
    return res;
  }

  async function verify(verifyToken: string) {
    const res = await api<{ accessToken: string; user: PublicUser }>('/auth/verify', {
      method: 'POST',
      json: { token: verifyToken },
    });
    setSession(res.accessToken, res.user);
    return res;
  }

  async function saveProfile(payload: { name?: string; nickname?: string; avatar?: AvatarConfig }) {
    user.value = await api<PublicUser>('/auth/me', { method: 'PATCH', json: payload });
  }

  async function resend() {
    return api<{ ok: boolean; verifyUrl: string }>('/auth/resend', { method: 'POST' });
  }

  async function games() {
    return api<GameHistoryItem[]>('/auth/me/games');
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('quiz_access');
  }

  return { user, token, error, load, register, login, verify, saveProfile, resend, games, logout };
});
