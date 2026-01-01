import {
  registerBaseButton,
  registerBaseCard,
  registerBaseDrawer,
  registerBaseInput,
  registerBaseTextarea,
  registerThemeToggle
} from '@cal.macconnachie/web-components'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

// Register web components
registerBaseButton()
registerBaseInput()
registerBaseTextarea()
registerBaseCard()
registerThemeToggle()
registerBaseDrawer()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')

// Register service worker only in production
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(reg => console.log('Service Worker registered:', reg))
    .catch(err => console.error('Service Worker registration failed:', err))
}
