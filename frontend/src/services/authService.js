import api from './api';

const authService = {
  register: async (schoolData) => {
    const response = await api.post('/schools/register', schoolData);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('school', JSON.stringify(response.data.school));
    }
    return response.data;
  },

  login: async (credentials) => {
    const response = await api.post('/schools/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('school', JSON.stringify(response.data.school));
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('school');
    window.location.href = '/login';
  },

  getCurrentSchool: () => {
    const school = localStorage.getItem('school');
    return school ? JSON.parse(school) : null;
  },

  getToken: () => {
    return localStorage.getItem('token');
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },
};

export default authService;