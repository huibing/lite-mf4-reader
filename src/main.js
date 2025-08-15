import { createApp } from 'vue'
import Vue3ColorPicker from "vue3-colorpicker";
import "vue3-colorpicker/style.css";
import './style.css'
import App from './App.vue'

/* import the fontawesome core */
import { library } from '@fortawesome/fontawesome-svg-core'

/* import font awesome icon component */
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

/* import specific icons */
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'

/* add icons to the library */
library.add(fas, far);
const app = createApp(App);
app.use(Vue3ColorPicker);
app.component('font-awesome-icon', FontAwesomeIcon);
app.mount('#app')


