import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useGameStore } from './stores/game';
import { useAuthStore } from './stores/auth';
import './style.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
useGameStore(pinia).bind();
useAuthStore(pinia).load();
app.mount('#app');
