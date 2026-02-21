import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('noshow_token');
    if (savedToken) {
      setToken(savedToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      fetchMe(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchMe = async (t) => {
    try {
      const res = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      setUser(res.data);
    } catch (e) {
      localStorage.removeItem('noshow_token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    const { token: t, user: u } = res.data;
    localStorage.setItem('noshow_token', t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t);
    setUser(u);
    return u;
  };

  const register = async (email, password, full_name) => {
    const res = await axios.post(`${API}/auth/register`, {
      email, password, full_name, role: 'business_owner'
    });
    const { token: t, user: u } = res.data;
    localStorage.setItem('noshow_token', t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t);
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('noshow_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export { API, BACKEND_URL };
