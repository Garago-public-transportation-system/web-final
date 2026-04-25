import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../api/axios';
import { useSettingsStore } from '../store/settingsStore';

const AuthContext = createContext(null);

// Helper — apply preferred_language from user profile to the settings store
const applyUserLanguage = (userData) => {
    if (userData?.preferred_language) {
        const setLanguage = useSettingsStore.getState().setLanguage;
        const currentLang = useSettingsStore.getState().language;
        if (userData.preferred_language !== currentLang) {
            setLanguage(userData.preferred_language);
        }
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    const login = async (email, password) => {
        try {
            // Login to get token
            // Note: Backend expects form data for OAuth2
            const formData = new FormData();
            formData.append('username', email);
            formData.append('password', password);

            const response = await api.post('/auth/login', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const { access_token, refresh_token } = response.data;
            localStorage.setItem('token', access_token);
            if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
            setToken(access_token);

            // Fetch user profile immediately
            const userRes = await api.get('/auth/me');
            setUser(userRes.data);
            localStorage.setItem('user', JSON.stringify(userRes.data));
            applyUserLanguage(userRes.data);

            return userRes.data;
        } catch (error) {
            throw error;
        }
    };

    const signup = async (userData) => {
        try {
            const response = await api.post('/auth/signup', userData);
            return response.data;
        } catch (error) {
            throw error;
        }
    };

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    }, []);

    const refreshAccessToken = useCallback(async () => {
        const stored = localStorage.getItem('refresh_token');
        if (!stored) throw new Error('No refresh token available');
        const res = await api.post('/auth/refresh', { refresh_token: stored });
        const { access_token } = res.data;
        localStorage.setItem('token', access_token);
        setToken(access_token);
        return access_token;
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            if (token) {
                try {
                    // Verify token and get user details
                    const response = await api.get('/auth/me');
                    setUser(response.data);
                    applyUserLanguage(response.data);
                } catch (error) {
                    console.error("Auth check failed:", error);
                    logout();
                }
            }
            setLoading(false);
        };

        initAuth();
    }, [token, logout]);

    return (
        <AuthContext.Provider value={{ user, token, login, signup, logout, loading, refreshAccessToken }}>
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#111827', color: 'white' }}>
                    <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.3)', borderRadius: '50%', borderTop: '4px solid #3b82f6', animation: 'spin 1s linear infinite' }}></div>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    <span style={{ fontFamily: 'sans-serif', fontSize: '1.2rem' }}>Loading Application...</span>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
