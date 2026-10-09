import { createRouter, createWebHashHistory } from 'vue-router'
import OverviewView      from '@/views/OverviewView.vue'
import AccessibilityView from '@/views/AccessibilityView.vue'
import RestaurantsView   from '@/views/RestaurantsView.vue'
import AboutView         from '@/views/AboutView.vue'

const routes = [
  { path: '/',              redirect: '/overview' },
  { path: '/overview',      name: 'overview',      component: OverviewView },
  { path: '/accessibility', name: 'accessibility', component: AccessibilityView },
  { path: '/restaurants',   name: 'restaurants',   component: RestaurantsView },
  { path: '/about',         name: 'about',         component: AboutView },
  { path: '/:pathMatch(.*)*', redirect: '/overview' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() { return { top: 0 } }
})

export default router