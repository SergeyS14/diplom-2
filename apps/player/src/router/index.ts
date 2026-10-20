import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import PlayView from '../views/PlayView.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import VerifyView from '../views/VerifyView.vue';
import ProfileView from '../views/ProfileView.vue';
import StudioListView from '../views/StudioListView.vue';
import StudioQuizView from '../views/StudioQuizView.vue';
import RatingView from '../views/RatingView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/join/:code?', name: 'join', component: HomeView },
    { path: '/play', name: 'play', component: PlayView, meta: { play: true } },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/register', name: 'register', component: RegisterView },
    { path: '/verify', name: 'verify', component: VerifyView },
    { path: '/me', name: 'profile', component: ProfileView },
    { path: '/rating', name: 'rating', component: RatingView },
    { path: '/studio', name: 'studio', component: StudioListView, meta: { wide: true } },
    { path: '/studio/:id', name: 'studio-quiz', component: StudioQuizView, meta: { wide: true } },
  ],
});
