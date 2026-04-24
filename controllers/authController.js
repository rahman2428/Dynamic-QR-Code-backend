const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  });
  return { accessToken, refreshToken };
};

// @desc    Register new user
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }

    const user = await User.create({ name, email, password });
    const tokens = generateTokens(user._id);

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      ...tokens
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated.' });
    }

    const tokens = generateTokens(user._id);

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      ...tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required.' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }

    const tokens = generateTokens(user._id);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired refresh token.' });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
};
