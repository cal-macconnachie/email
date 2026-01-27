import {
  registerBaseButton,
  registerBaseCard,
  registerBaseDatePicker,
  registerBaseDateTimePicker,
  registerBaseDrawer,
  registerBaseIcon,
  registerBaseInput,
  registerBaseList,
  registerBaseListItem,
  registerBaseSelect,
  registerBaseTab,
  registerBaseTabs,
  registerBaseTextarea,
  registerBaseTimePicker,
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
registerBaseDateTimePicker()
registerBaseDatePicker()
registerBaseTimePicker()
registerBaseTab()
registerBaseTabs()
registerBaseSelect()
registerBaseIcon()
registerBaseList()
registerBaseListItem()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')

// Register service worker only in production
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
}

// Listen for messages from service worker (e.g., notification clicks)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NAVIGATE_TO_EMAIL') {
      const url = event.data.url
      if (url && router) {
        // Navigate to the email using Vue Router
        router.push(url)
      }
    }
  })
}
