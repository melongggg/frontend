import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_PORT) || 3001

  // 환경변수에서 백엔드 URL 가져오기
  const backendUrl = env.VITE_FASTAPI_URL || 'http://127.0.0.1:8000'
  const geminiUrl = env.VITE_GEMINI_FASTAPI_URL || 'http://127.0.0.1:8001'

  // 디버그 로그
  console.log('[Vite Config] Backend URL:', backendUrl)
  console.log('[Vite Config] Gemini URL:', geminiUrl)

  // 프록시 활성화 조건: localhost/127.0.0.1이 포함되거나 /api 같은 상대경로인 경우
  const useProxy = backendUrl.startsWith('/') || backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')

  return {
    plugins: [vue()],
    envDir: process.cwd(), // 현재 디렉토리의 .env 파일 사용
    build: {
      minify: 'esbuild',
      // Remove console logs in production (keep error and warn)
      esbuild: mode === 'production' ? {
        drop: ['console'],
        pure: ['console.log', 'console.debug', 'console.info'],
      } : {},
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      allowedHosts: ['eulgpt-dev.duckdns.org', 'localhost'], // DuckDNS 도메인 허용
      host: '0.0.0.0', // 모든 네트워크 인터페이스에서 접속 허용
      port: port,
      strictPort: false, // 포트가 사용 중이면 다른 포트 자동 선택
      // Proxy는 로컬 백엔드를 사용할 때만 활성화
      ...(useProxy && {
        proxy: {
          '/api': {
            target: backendUrl.startsWith('/') ? 'http://localhost:8000' : backendUrl,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/api/, ''),
            timeout: 30000, // 30초 타임아웃
          },
          '/gemini-api': {
            target: geminiUrl.startsWith('/') ? 'http://localhost:8001' : geminiUrl,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/gemini-api/, ''),
            timeout: 60000, // 60초 타임아웃 (AI 응답 대기)
            proxyTimeout: 60000,
          },
        },
      }),
    },
    preview: {
      host: '0.0.0.0', // 프로덕션 미리보기도 외부 접속 허용
      port: port,
    },
  }
})
