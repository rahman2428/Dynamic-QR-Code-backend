const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  qrCodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QRCode',
    required: true,
    index: true
  },
  shortId: {
    type: String,
    required: true,
    index: true
  },
  ip: {
    type: String,
    default: 'unknown'
  },
  userAgent: {
    type: String,
    default: ''
  },
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  },
  browser: {
    type: String,
    default: 'unknown'
  },
  os: {
    type: String,
    default: 'unknown'
  },
  country: {
    type: String,
    default: 'unknown'
  },
  city: {
    type: String,
    default: 'unknown'
  },
  region: {
    type: String,
    default: 'unknown'
  },
  referrer: {
    type: String,
    default: ''
  },
  redirectedTo: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient analytics queries
analyticsSchema.index({ createdAt: -1 });
analyticsSchema.index({ qrCodeId: 1, createdAt: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema);
