import {
  registerBaseButton,
  registerBaseCard,
  registerBaseDatePicker,
  registerBaseDateTimePicker,
  registerBaseDrawer,
  registerBaseInput,
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

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')

// Register service worker only in production
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
}
