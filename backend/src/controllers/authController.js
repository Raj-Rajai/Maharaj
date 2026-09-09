import * as authService from '../services/authService.js';

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshAccessToken(refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    // Client might send token in body or we get it from elsewhere, 
    // depending on implementation, let's look for refreshToken in body
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    const result = await authService.getProfile(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
