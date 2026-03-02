import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated, isAdmin } from '../utils/auth'

const routes = [
  {
    path: '/',
    component: () => import('../views/MainView.vue')
  },
  {
    path: '/preparation',
    component: () => import('../components/preparation/PreparationPage.vue')
  },
  {
    path: '/login',
    component: () => import('../components/login/LoginPageComponent.vue')
  },
  {
    path: '/signup',
    component: () => import('../components/login/LoginComponent.vue')
  },
  {
    path: '/signup-email',
    component: () => import('../components/login/SignupComponent.vue')
  },
  {
    path: '/signup-agreement',
    component: () => import('../components/login/SignupAgreementComponent.vue')
  },
  {
    path: '/signup-password',
    component: () => import('../components/login/SignupPasswordComponent.vue')
  },
  {
    path: '/signup-form',
    component: () => import('../components/login/SignupPersonalInfoFormComponent.vue')
  },
  {
    path: '/signup-complete',
    component: () => import('../components/login/SignupCompleteComponent.vue')
  },
  {
    path: '/chat/:chatId?',
    component: () => import('../components/chat/index.vue'),
    meta: { requiresAuth: true },
    props: true
  },
  {
    path: '/bug-report',
    component: () => import('../views/BugReportView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/ready/:service',
    component: () => import('../components/common/ReadyBar.vue'),
    props: true
  },
  {
    path: '/lotte-preview',
    component: () => import('../views/LottiePreview.vue')
  },
  {
    path: '/crew',
    component: () => import('../components/crew/index.vue')
  },
  {
    path: '/crew/apply',
    component: () => import('../views/CrewApplyView.vue')
  },
  {
    path: '/crew/explore',
    component: () => import('../views/CrewExploreView.vue')
  },
  {
    path: '/development-status',
    component: () => import('../views/DevelopmentStatusView.vue')
  },
  {
    path: '/status',
    component: () => import('../views/StatusView.vue')
  },
  {
    path: '/pro-verification',
    component: () => import('../views/ProVerificationView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/kakao/callback',
    component: () => import('../views/KakaoCallbackView.vue')
  },
  {
    path: '/admin',
    component: () => import('../views/AdminView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/privacy-policy',
    component: () => import('../views/PrivacyPolicyView.vue')
  },
  {
    path: '/terms-of-service',
    component: () => import('../views/TermsOfServiceView.vue')
  },
  // 404 페이지 - 모든 정의되지 않은 경로를 처리
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundView.vue')
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 인증 가드 추가
router.beforeEach((to, _from, next) => {
  // 이메일 회원가입 라우트 차단 (카카오 전용)
  const blockedEmailSignupRoutes = [
    '/signup-email',
    '/signup-agreement',
    '/signup-password',
    '/signup-form',
    '/signup-complete'
  ]

  if (blockedEmailSignupRoutes.includes(to.path)) {
    console.log('Email signup route blocked - redirecting to /signup')
    next({ path: '/signup' })
    return
  }

  // requiresAuth 메타 필드가 true인 경로 체크
  if (to.meta.requiresAuth) {
    if (!isAuthenticated()) {
      // 인증되지 않았으면 로그인 페이지로 리다이렉트
      console.log('Unauthenticated user - redirecting to login')
      next({
        path: '/login',
        query: { redirect: to.fullPath } // 로그인 후 돌아갈 경로 저장
      })
      return
    }

    // requiresAdmin 메타 필드가 true인 경로 체크
    if (to.meta.requiresAdmin && !isAdmin()) {
      console.log('Non-admin user - redirecting to main page')
      next({ path: '/' })
      return
    }

    // 인증되어 있으면 진행
    next()
  } else {
    // 인증이 필요없는 경로는 그냥 진행
    next()
  }
})

export default router
