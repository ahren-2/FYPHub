import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/',
});

// 请求拦截器：自动注入 JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：处理 Token 过期
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // 如果后端返回 401（未授权），说明 Token 挂了，强制登出
      localStorage.clear();
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;