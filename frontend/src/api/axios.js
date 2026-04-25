import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle 401 errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Ignore 401 for login endpoint to allow form error handling
            if (error.config.url && error.config.url.includes('/auth/login')) {
                return Promise.reject(error);
            }

            // Token expired or invalid — clean up and redirect
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login?session_expired=true';
        }
        return Promise.reject(error);
    }
);

export default api;
