import { createApp } from 'vue';
import App from './App.vue';
import './assets/styles.css';
import { startAnimatedFavicon } from './animatedFavicon';

createApp(App).mount('#app');
startAnimatedFavicon();
