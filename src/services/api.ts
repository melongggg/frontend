import { createLogger } from '../utils/logger';
const log = createLogger('API');

// API 기본 설정 및 서비스
import { getApiBaseUrl } from '../utils/ports-config';
import { getUserInfo } from '../utils/auth';

const API_BASE_URL = getApiBaseUrl();

// 사용자 정보를 헤더로 가져오는 헬퍼 함수
const getUserHeaders = (): Record<string, string> => {
  const userInfo = getUserInfo();
  if (userInfo) {
    return {
      'X-User-Email': userInfo.email || '',
      'X-User-Name': userInfo.name || userInfo.nickname || '',
    };
  }
  return {};
};

// API 요청을 위한 기본 fetch 함수
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 토큰이 있다면 Authorization 헤더 추가
  const token = localStorage.getItem('accessToken');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// 회원 관리 API
export const memberAPI = {
  // 회원가입
  register: async (userData: {
    name: string;
    nickname: string;
    email: string;
    phone_number: string;
    birth_date: string;
    password: string;
    policy_agree_1: boolean;
    policy_agree_2: boolean;
  }) => {
    return apiRequest('/members/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  // 로그인
  login: async (credentials: { email: string; password: string }) => {
    return apiRequest<{ access_token: string; refresh_token: string; user: any }>('/members/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  // 회원 정보 조회
  getProfile: async () => {
    return apiRequest('/members/profile', {
      method: 'GET',
    });
  },

  // 토큰 새로고침
  refreshToken: async (refreshToken: string) => {
    return apiRequest<{ access_token: string }>('/members/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  // Pro 인증용 이메일 발송 (카카오 회원 등 기존 회원용)
  sendProVerification: async (email: string) => {
    return apiRequest<{ message: string }>('/members/send-pro-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Pro 인증 코드 확인
  verifyPro: async (email: string, code: number) => {
    return apiRequest<{ message: string; is_pro: boolean; verified_email: string }>('/members/verify-pro', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  },

  // 회원 탈퇴
  deleteAccount: async () => {
    return apiRequest<{ status: string; message: string }>('/member/me', {
      method: 'DELETE',
    });
  },
};

// 강의실 예약 API
export const classroomAPI = {
  // 강의실 목록 조회
  getClassrooms: async () => {
    return apiRequest('/classrooms/', {
      method: 'GET',
    });
  },

  // 강의실 예약
  createReservation: async (reservationData: {
    classroom_id: number;
    reserv_date: string;
    start_hour: number;
    end_hour: number;
    purpose?: string;
  }) => {
    return apiRequest('/classrooms/reservations/', {
      method: 'POST',
      body: JSON.stringify(reservationData),
    });
  },

  // 내 예약 목록 조회
  getMyReservations: async () => {
    return apiRequest('/classrooms/reservations/my', {
      method: 'GET',
    });
  },
};

// 챗봇 API
export const chatAPI = {
  // 채팅 히스토리 목록
  getChatHistories: async () => {
    return apiRequest('/chat/histories', {
      method: 'GET',
    });
  },

  // 새 채팅 시작
  createChatHistory: async (title: string) => {
    return apiRequest('/chat/histories', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  // 메시지 전송
  sendMessage: async (chatHistoryId: number, message: string) => {
    return apiRequest('/chat/messages', {
      method: 'POST',
      body: JSON.stringify({
        chat_history_id: chatHistoryId,
        message,
      }),
    });
  },

  // 개별 채팅 히스토리 삭제
  deleteChat: async (chatId: string | number) => {
    return apiRequest(`/chat/histories/${chatId}`, {
      method: 'DELETE',
    });
  },

  // 모든 채팅 히스토리 삭제 (루프 방식)
  deleteAllChats: async () => {
    try {
      const histories = await chatAPI.getChatHistories() as any[];
      const errors: string[] = [];

      for (const history of histories) {
        try {
          await chatAPI.deleteChat(history.id);
        } catch (error) {
          console.error(`Failed to delete chat ${history.id}:`, error);
          errors.push(`채팅 ${history.id} 삭제 실패`);
        }
      }

      if (errors.length > 0) {
        throw new Error(`일부 채팅 삭제 실패: ${errors.join(', ')}`);
      }

      return { message: '모든 채팅이 삭제되었습니다' };
    } catch (error) {
      console.error('Failed to delete all chats:', error);
      throw error;
    }
  },
};

// 급식실 혼잡도 API
export const cafeteriaAPI = {
  // 현재 혼잡도 조회
  getCurrentCongestion: async () => {
    return apiRequest('/cafeteria/congestion/current', {
      method: 'GET',
    });
  },

  // 혼잡도 기록 조회
  getCongestionHistory: async (date?: string) => {
    const endpoint = date ? `/cafeteria/congestion/history?date=${date}` : '/cafeteria/congestion/history';
    return apiRequest(endpoint, {
      method: 'GET',
    });
  },
};

// 헬스체크 API
export const healthAPI = {
  checkHealth: async () => {
    return apiRequest('/', {
      method: 'GET',
    });
  },
};

// 관리자 API 타입
export type AdminRole = 'dev' | 'admin' | null;

export interface UserListItem {
  id: number;
  name: string;
  email: string;
  nickname: string;
  is_pro: boolean;
  is_admin: boolean;
  admin_role: AdminRole;
  oauth_provider: string | null;
  created_at: string;
}

export interface UserDetail {
  id: number;
  name: string;
  email: string;
  nickname: string;
  phone_number: string | null;
  birth_date: string | null;
  is_pro: boolean;
  is_admin: boolean;
  admin_role: AdminRole;
  verified_email: string | null;
  oauth_provider: string | null;
  oauth_id: string | null;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface PaginatedResponse {
  items: UserListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface PlatformStats {
  total_users: number;
  pro_users: number;
  admin_users: number;
  kakao_users: number;
  today_signups: number;
}

// DB 브라우저 관련 타입
export interface TableInfo {
  name: string;
  display_name: string;
  row_count: number;
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  primary_key: boolean;
}

export interface TableDataResponse {
  table_name: string;
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface TablesListResponse {
  tables: TableInfo[];
}

// 채팅 기록 관리 관련 타입 (Admin 전용)
export interface ChatHistoryUserInfo {
  id: number;
  name: string;
  email: string;
  nickname: string;
}

export interface ChatHistoryListItem {
  id: string;  // UUID
  title: string;
  user_id: number;
  user: ChatHistoryUserInfo | null;
  message_count: number;
  last_message_at: string | null;
  created_at: string | null;
}

export interface ChatHistoryAdminResponse {
  items: ChatHistoryListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ChatMessageAdminItem {
  id: number;
  is_user: boolean;
  message: string;
  model_name: string | null;
  created_at: string | null;
}

export interface ChatHistoryDetailAdmin {
  id: string;  // UUID
  title: string;
  user_id: number;
  user: ChatHistoryUserInfo | null;
  messages: ChatMessageAdminItem[];
  created_at: string | null;
}

export interface ChatHistoryExportItem {
  id: string;
  title: string;
  user: ChatHistoryUserInfo | null;
  created_at: string | null;
  messages: {
    is_user: boolean;
    message: string;
    model_name: string | null;
    created_at: string | null;
  }[];
}

export interface ChatHistoryExportResponse {
  export_date: string;
  period: {
    start: string;
    end: string;
  };
  total_sessions: number;
  total_messages: number;
  data: ChatHistoryExportItem[];
}

// 관리자 API
export const adminAPI = {
  // 회원 목록 조회
  getUsers: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    filter_pro?: boolean;
    filter_admin?: boolean;
  } = {}): Promise<PaginatedResponse> => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.filter_pro !== undefined) queryParams.append('filter_pro', params.filter_pro.toString());
    if (params.filter_admin !== undefined) queryParams.append('filter_admin', params.filter_admin.toString());

    const queryString = queryParams.toString();
    const endpoint = `/admin/users${queryString ? `?${queryString}` : ''}`;

    return apiRequest<PaginatedResponse>(endpoint, {
      method: 'GET',
    });
  },

  // 회원 상세 정보 조회
  getUserDetail: async (userId: number): Promise<UserDetail> => {
    return apiRequest<UserDetail>(`/admin/users/${userId}`, {
      method: 'GET',
    });
  },

  // 회원 권한 수정
  updateUser: async (userId: number, data: {
    is_pro?: boolean;
    admin_role?: AdminRole;
  }): Promise<UserDetail> => {
    return apiRequest<UserDetail>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 회원 삭제
  deleteUser: async (userId: number): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  // 플랫폼 통계 조회
  getStats: async (): Promise<PlatformStats> => {
    return apiRequest<PlatformStats>('/admin/stats', {
      method: 'GET',
    });
  },

  // DB 브라우저 - 테이블 목록 조회
  getTables: async (): Promise<TablesListResponse> => {
    return apiRequest<TablesListResponse>('/admin/db/tables', {
      method: 'GET',
    });
  },

  // DB 브라우저 - 테이블 데이터 조회
  getTableData: async (tableName: string, params: {
    page?: number;
    limit?: number;
    search?: string;
    filter_column?: string;
    filter_value?: string;
  } = {}): Promise<TableDataResponse> => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.filter_column) queryParams.append('filter_column', params.filter_column);
    if (params.filter_value) queryParams.append('filter_value', params.filter_value);

    const queryString = queryParams.toString();
    const endpoint = `/admin/db/tables/${tableName}${queryString ? `?${queryString}` : ''}`;

    return apiRequest<TableDataResponse>(endpoint, {
      method: 'GET',
    });
  },

  // DB 브라우저 - 레코드 삭제
  deleteTableRow: async (tableName: string, rowId: number): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/admin/db/tables/${tableName}/${rowId}`, {
      method: 'DELETE',
    });
  },

  // ========== 채팅 기록 관리 (Admin 전용) ==========

  // 채팅 기록 목록 조회
  getChatHistories: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    user_id?: number;
    start_date?: string;
    end_date?: string;
  } = {}): Promise<ChatHistoryAdminResponse> => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.user_id) queryParams.append('user_id', params.user_id.toString());
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);

    const queryString = queryParams.toString();
    const endpoint = `/admin/chat-histories${queryString ? `?${queryString}` : ''}`;

    return apiRequest<ChatHistoryAdminResponse>(endpoint, {
      method: 'GET',
    });
  },

  // 채팅 기록 상세 조회
  getChatHistoryDetail: async (chatId: string): Promise<ChatHistoryDetailAdmin> => {
    return apiRequest<ChatHistoryDetailAdmin>(`/admin/chat-histories/${chatId}`, {
      method: 'GET',
    });
  },

  // 채팅 기록 삭제
  deleteChatHistory: async (chatId: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/admin/chat-histories/${chatId}`, {
      method: 'DELETE',
    });
  },

  // 채팅 기록 대량 내보내기
  exportChatHistories: async (startDate: string, endDate: string): Promise<ChatHistoryExportResponse> => {
    const queryParams = new URLSearchParams();
    queryParams.append('start_date', startDate);
    queryParams.append('end_date', endDate);

    return apiRequest<ChatHistoryExportResponse>(`/admin/chat-histories/export/bulk?${queryParams.toString()}`, {
      method: 'GET',
    });
  },

  // ========== 데이터베이스 백업 (Admin 전용) ==========

  // 전체 데이터베이스 백업 (JSON)
  createFullBackup: async (): Promise<Record<string, unknown>> => {
    return apiRequest<Record<string, unknown>>('/admin/backup/full', {
      method: 'GET',
    });
  },

  // 특정 테이블 백업 (JSON)
  backupTable: async (tableName: string): Promise<Record<string, unknown>> => {
    return apiRequest<Record<string, unknown>>(`/admin/backup/table/${tableName}`, {
      method: 'GET',
    });
  },
};

// Bug Report API 타입
export interface BugReportSubmitResponse {
  success: boolean;
  message: string;
  report_id: number;
}

export interface BugReportResponse {
  id: number;
  title: string;
  description: string;
  reproduction_steps: string;
  category: string;
  screenshot_url: string | null;
  user_id: number;
  user_email: string;
  user_name: string;
  created_at: string;
  updated_at: string | null;
}

export interface BugReportListResponse {
  total: number;
  bug_reports: BugReportResponse[];
}

// Bug Report API
export const bugReportAPI = {
  // 버그 제보 생성 (FormData 사용)
  createBugReport: async (formData: FormData): Promise<BugReportSubmitResponse> => {
    const url = `${API_BASE_URL}/api/bug-reports/`;

    // 토큰 가져오기
    const token = localStorage.getItem('accessToken');
    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // FormData는 Content-Type을 자동으로 설정하므로 헤더에 포함하지 않음
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Bug report creation failed:', error);
      throw error;
    }
  },

  // 버그 제보 목록 조회 (Admin only)
  getBugReports: async (params: {
    skip?: number;
    limit?: number;
    category?: string;
  } = {}): Promise<BugReportListResponse> => {
    const queryParams = new URLSearchParams();
    if (params.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params.category) queryParams.append('category', params.category);

    const queryString = queryParams.toString();
    const endpoint = `/api/bug-reports/${queryString ? `?${queryString}` : ''}`;

    return apiRequest<BugReportListResponse>(endpoint, {
      method: 'GET',
    });
  },

  // 버그 제보 상세 조회 (Admin only)
  getBugReport: async (bugReportId: number): Promise<BugReportResponse> => {
    return apiRequest<BugReportResponse>(`/api/bug-reports/${bugReportId}`, {
      method: 'GET',
    });
  },

  // 내 버그 제보 목록 조회
  getMyBugReports: async (): Promise<BugReportResponse[]> => {
    return apiRequest<BugReportResponse[]>('/api/bug-reports/my/reports', {
      method: 'GET',
    });
  },

  // 버그 제보 삭제 (Admin only)
  deleteBugReport: async (bugReportId: number): Promise<void> => {
    return apiRequest<void>(`/api/bug-reports/${bugReportId}`, {
      method: 'DELETE',
    });
  },
};

// ==================== AI Settings API ====================

// AI Settings 타입 정의
export interface PromptSettings {
  university: string;
  study: string;
  career: string;
  cot: string;
  general: string;
}

export interface RAGConfig {
  initial_top_k: number;
  final_top_k: number;
  search_method: 'dense' | 'sparse' | 'hybrid';
  alpha: number;
  use_reranker: boolean;
  use_llm_reranker: boolean;
}

export interface ModelParams {
  temperature: number;
  max_tokens: number;
  top_p: number;
}

export interface AISettingsResponse {
  prompts: PromptSettings;
  rag_config: RAGConfig;
  model_params: ModelParams;
}

export interface SettingsSaveResponse {
  status: string;  // "success" or "partial"
  warning?: string;  // 207 시 warning 메시지
  message?: string;  // 성공 메시지
}

export interface PromptParams {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface PromptWithParamsUpdate {
  template: string;
  params?: PromptParams;
}

// AI Settings API
export const aiSettingsAPI = {
  // GET /admin/ai-settings - 모든 설정 조회
  getAllSettings: (): Promise<AISettingsResponse> => {
    return apiRequest<AISettingsResponse>('/admin/ai-settings', {
      method: 'GET'
    });
  },

  // GET /admin/ai-settings/prompts - 프롬프트 5개 조회
  getPrompts: (): Promise<PromptSettings> => {
    return apiRequest<PromptSettings>('/admin/ai-settings/prompts', {
      method: 'GET'
    });
  },

  // PUT /admin/ai-settings/prompts/{name} - 프롬프트 + 파라미터 수정
  updatePrompt: (name: string, data: PromptWithParamsUpdate): Promise<SettingsSaveResponse> => {
    return apiRequest<SettingsSaveResponse>(`/admin/ai-settings/prompts/${name}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // GET /admin/ai-settings/prompts/{name}/params - 프롬프트별 파라미터 조회
  getPromptParams: (name: string): Promise<PromptParams> => {
    return apiRequest<PromptParams>(`/admin/ai-settings/prompts/${name}/params`, {
      method: 'GET'
    });
  },

  // PUT /admin/ai-settings/prompts/{name}/params - 프롬프트별 파라미터 수정
  updatePromptParams: (name: string, params: PromptParams): Promise<SettingsSaveResponse> => {
    return apiRequest<SettingsSaveResponse>(`/admin/ai-settings/prompts/${name}/params`, {
      method: 'PUT',
      body: JSON.stringify(params)
    });
  },

  // GET /admin/ai-settings/rag-config - RAG 설정 조회
  getRAGConfig: (): Promise<RAGConfig> => {
    return apiRequest<RAGConfig>('/admin/ai-settings/rag-config', {
      method: 'GET'
    });
  },

  // PUT /admin/ai-settings/rag-config - RAG 설정 수정
  updateRAGConfig: (config: RAGConfig): Promise<SettingsSaveResponse> => {
    return apiRequest<SettingsSaveResponse>('/admin/ai-settings/rag-config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  },

  // GET /admin/ai-settings/model-params - 모델 파라미터 조회
  getModelParams: (): Promise<ModelParams> => {
    return apiRequest<ModelParams>('/admin/ai-settings/model-params', {
      method: 'GET'
    });
  },

  // PUT /admin/ai-settings/model-params - 모델 파라미터 수정
  updateModelParams: (params: ModelParams): Promise<SettingsSaveResponse> => {
    return apiRequest<SettingsSaveResponse>('/admin/ai-settings/model-params', {
      method: 'PUT',
      body: JSON.stringify(params)
    });
  },

  // POST /admin/restart-services - AI 서비스 재시작
  restartServices: (): Promise<SettingsSaveResponse> => {
    return apiRequest<SettingsSaveResponse>('/admin/restart-services', {
      method: 'POST'
    });
  },

  // POST /admin/sync-notion - Notion 데이터 재임베딩
  syncNotion: (): Promise<{
    success: boolean;
    message: string;
    sync_time: string;
    stats: {
      notion_documents: number;
      local_documents: number;
      total_documents: number;
    };
    errors: string[];
  }> => {
    let AI_RAG_URL = import.meta.env.VITE_GEMINI_FASTAPI_URL || '/gemini-api';

    // 프로덕션 환경에서 직접 Railway URL 사용 (커스텀 도메인 지원)
    if (!AI_RAG_URL || AI_RAG_URL === '/gemini-api' || AI_RAG_URL.includes('.railway.internal')) {
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname.includes('railway.app') ||
            hostname.includes('euljigpt.com') ||
            hostname === 'www.euljigpt.com') {
          AI_RAG_URL = 'https://ai-rag-production.up.railway.app';
        }
      }
    }

    return apiRequest(`${AI_RAG_URL}/admin/sync-notion`, {
      method: 'POST'
    });
  }
};

// ==================== Knowledge Management API ====================

// Knowledge 관련 타입 정의
export interface KnowledgeFile {
  name: string;
  display_name: string;
  entry_count: number;
}

export interface KnowledgeEntry {
  id: string;
  db_id: number;
  index: number;
  title: string;
  content: string;
  category: string;
  subcategory: string;
  campus: string;
  source_file: string;
  raw_data: Record<string, unknown>;
  is_indexed: boolean;
  // 업로더 정보
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: string | null;
}

export interface KnowledgeEntriesResponse {
  items: KnowledgeEntry[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ReindexStatus {
  status: 'idle' | 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string | null;
  last_indexed: string | null;
  document_count: number;
  error: string | null;
}

export interface ReindexResponse {
  success: boolean;
  message?: string;
  error?: string;
  document_count: number;
  status?: ReindexStatus;
}

// Knowledge Management API (PostgreSQL 기반 - Backend 경유)
export const knowledgeAPI = {
  // GET /knowledge/files - 파일 목록 조회
  getFiles: (): Promise<KnowledgeFile[]> => {
    return apiRequest<KnowledgeFile[]>('/knowledge/files', {
      method: 'GET'
    });
  },

  // GET /knowledge/files/{file_name} - 항목 목록 조회
  getEntries: (fileName: string, params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    campus?: string;
  } = {}): Promise<KnowledgeEntriesResponse> => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.category) queryParams.append('category', params.category);
    if (params.campus) queryParams.append('campus', params.campus);

    const queryString = queryParams.toString();
    const endpoint = `/knowledge/files/${fileName}${queryString ? `?${queryString}` : ''}`;

    return apiRequest<KnowledgeEntriesResponse>(endpoint, {
      method: 'GET'
    });
  },

  // GET /knowledge/files/{file_name}/entries/{entry_id} - 항목 상세 조회
  getEntry: (fileName: string, entryId: string): Promise<KnowledgeEntry> => {
    return apiRequest<KnowledgeEntry>(`/knowledge/files/${fileName}/entries/${entryId}`, {
      method: 'GET'
    });
  },

  // POST /knowledge/files/{file_name}/entries - 항목 생성
  createEntry: (fileName: string, data: Record<string, unknown>): Promise<{ success: boolean; entry: KnowledgeEntry }> => {
    return apiRequest<{ success: boolean; entry: KnowledgeEntry }>(`/knowledge/files/${fileName}/entries`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: getUserHeaders()
    });
  },

  // PUT /knowledge/files/{file_name}/entries/{entry_id} - 항목 수정
  updateEntry: (fileName: string, entryId: string, data: Record<string, unknown>): Promise<{ success: boolean; entry: KnowledgeEntry }> => {
    return apiRequest<{ success: boolean; entry: KnowledgeEntry }>(`/knowledge/files/${fileName}/entries/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: getUserHeaders()
    });
  },

  // DELETE /knowledge/files/{file_name}/entries/{entry_id} - 항목 삭제
  deleteEntry: (fileName: string, entryId: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/knowledge/files/${fileName}/entries/${entryId}`, {
      method: 'DELETE'
    });
  },

  // GET /knowledge/files/{file_name}/categories - 카테고리 목록 조회
  getCategories: (fileName: string): Promise<{ categories: string[] }> => {
    return apiRequest<{ categories: string[] }>(`/knowledge/files/${fileName}/categories`, {
      method: 'GET'
    });
  },

  // GET /knowledge/files/{file_name}/campuses - 캠퍼스 목록 조회
  getCampuses: (fileName: string): Promise<{ campuses: string[] }> => {
    return apiRequest<{ campuses: string[] }>(`/knowledge/files/${fileName}/campuses`, {
      method: 'GET'
    });
  },

  // POST /knowledge/import - JSON 파일 임포트
  importJsonFiles: (): Promise<{ success: boolean; message: string; results: Record<string, number | string> }> => {
    return apiRequest<{ success: boolean; message: string; results: Record<string, number | string> }>('/knowledge/import', {
      method: 'POST'
    });
  },

  // POST /knowledge/reindex - 재인덱싱 실행
  reindex: (): Promise<ReindexResponse> => {
    return apiRequest<ReindexResponse>('/knowledge/reindex', {
      method: 'POST'
    });
  },

  // GET /knowledge/reindex/status - 재인덱싱 상태 조회
  getReindexStatus: async (): Promise<ReindexStatus> => {
    // AI-RAG 백엔드에서 상태 조회
    let AI_RAG_URL = import.meta.env.VITE_GEMINI_FASTAPI_URL || '/gemini-api';

    // 프로덕션 환경에서 직접 Railway URL 사용 (커스텀 도메인 지원)
    if (!AI_RAG_URL || AI_RAG_URL === '/gemini-api' || AI_RAG_URL.includes('.railway.internal')) {
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname.includes('railway.app') ||
            hostname.includes('euljigpt.com') ||
            hostname === 'www.euljigpt.com') {
          AI_RAG_URL = 'https://ai-rag-production.up.railway.app';
        }
      }
    }

    const response = await fetch(`${AI_RAG_URL}/admin/knowledge/reindex/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
};