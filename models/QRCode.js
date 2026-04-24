const mongoose = require('mongoose');
const crypto = require('crypto');

const redirectRuleSchema = new mongoose.Schema({
  condition: {
    type: String,
    enum: ['device', 'location', 'time'],
    required: true
  },
  value: {
    type: String,
    required: true
  },
  destinationUrl: {
    type: String,
    required: true
  }
}, { _id: false });

const qrCodeSchema = new mongoose.Schema({
  shortId: {
    type: String,
    unique: true,
    required: true,
    index: true,
    default: () => crypto.randomBytes(4).toString('hex')
  },
  customAlias: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: 200
  },
  destinationUrl: {
    type: String,
    required: [true, 'Destination URL is required'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null
  },
  totalScans: {
    type: Number,
    default: 0
  },
  redirectRules: [redirectRuleSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Check expiry
qrCodeSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

// Get the short URL
qrCodeSchema.methods.getShortUrl = function(baseUrl) {
  const id = this.customAlias || this.shortId;
  return `${baseUrl}/r/${id}`;
};

module.exports = mongoose.model('QRCode', qrCodeSchema);
