const QRCode = require('../models/QRCode');
const qrcode = require('qrcode');
const { validationResult } = require('express-validator');
const fs = require('fs');
const csv = require('csv-parser');
const { Readable } = require('stream');

// @desc    Create a new QR code
// @route   POST /api/qrcodes
exports.createQRCode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, destinationUrl, customAlias, expiresAt, redirectRules, tags } = req.body;

    // Check if custom alias is taken
    if (customAlias) {
      const existing = await QRCode.findOne({ customAlias: customAlias.toLowerCase() });
      if (existing) {
        return res.status(400).json({ message: 'Custom alias is already taken.' });
      }
    }

    const qr = await QRCode.create({
      title,
      destinationUrl,
      customAlias: customAlias || undefined,
      expiresAt: expiresAt || undefined,
      redirectRules: redirectRules || [],
      tags: tags || [],
      createdBy: req.user._id
    });

    const shortUrl = qr.getShortUrl(process.env.BASE_URL);

    res.status(201).json({
      message: 'QR Code created successfully',
      qrCode: {
        ...qr.toObject(),
        shortUrl
      }
    });
  } catch (error) {
    console.error('Create QR error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Duplicate short ID or alias. Please try again.' });
    }
    res.status(500).json({ message: 'Server error creating QR code.' });
  }
};

// @desc    Get all QR codes for the authenticated user
// @route   GET /api/qrcodes
exports.getQRCodes = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, sort = '-createdAt' } = req.query;

    const filter = { createdBy: req.user._id };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { destinationUrl: { $regex: search, $options: 'i' } },
        { customAlias: { $regex: search, $options: 'i' } },
        { shortId: { $regex: search, $options: 'i' } }
      ];
    }

    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;
    if (status === 'expired') filter.expiresAt = { $lt: new Date() };

    const total = await QRCode.countDocuments(filter);
    const qrCodes = await QRCode.find(filter)
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const baseUrl = process.env.BASE_URL;
    const enriched = qrCodes.map(qr => ({
      ...qr,
      shortUrl: `${baseUrl}/r/${qr.customAlias || qr.shortId}`,
      isExpired: qr.expiresAt ? new Date() > new Date(qr.expiresAt) : false
    }));

    res.json({
      qrCodes: enriched,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get QR codes error:', error);
    res.status(500).json({ message: 'Server error fetching QR codes.' });
  }
};

// @desc    Get single QR code
// @route   GET /api/qrcodes/:id
exports.getQRCode = async (req, res) => {
  try {
    const qr = await QRCode.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!qr) {
      return res.status(404).json({ message: 'QR Code not found.' });
    }

    res.json({
      qrCode: {
        ...qr.toObject(),
        shortUrl: qr.getShortUrl(process.env.BASE_URL),
        isExpired: qr.isExpired()
      }
    });
  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(500).json({ message: 'Server error fetching QR code.' });
  }
};

// @desc    Update QR code
// @route   PUT /api/qrcodes/:id
exports.updateQRCode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, destinationUrl, customAlias, expiresAt, isActive, redirectRules, tags } = req.body;

    const qr = await QRCode.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!qr) {
      return res.status(404).json({ message: 'QR Code not found.' });
    }

    // Check alias uniqueness if changed
    if (customAlias && customAlias.toLowerCase() !== qr.customAlias) {
      const existing = await QRCode.findOne({ customAlias: customAlias.toLowerCase(), _id: { $ne: qr._id } });
      if (existing) {
        return res.status(400).json({ message: 'Custom alias is already taken.' });
      }
    }

    if (title !== undefined) qr.title = title;
    if (destinationUrl !== undefined) qr.destinationUrl = destinationUrl;
    if (customAlias !== undefined) qr.customAlias = customAlias || undefined;
    if (expiresAt !== undefined) qr.expiresAt = expiresAt || null;
    if (isActive !== undefined) qr.isActive = isActive;
    if (redirectRules !== undefined) qr.redirectRules = redirectRules;
    if (tags !== undefined) qr.tags = tags;

    await qr.save();

    res.json({
      message: 'QR Code updated successfully',
      qrCode: {
        ...qr.toObject(),
        shortUrl: qr.getShortUrl(process.env.BASE_URL)
      }
    });
  } catch (error) {
    console.error('Update QR error:', error);
    res.status(500).json({ message: 'Server error updating QR code.' });
  }
};

// @desc    Delete QR code
// @route   DELETE /api/qrcodes/:id
exports.deleteQRCode = async (req, res) => {
  try {
    const qr = await QRCode.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!qr) {
      return res.status(404).json({ message: 'QR Code not found.' });
    }

    // Also delete analytics
    const Analytics = require('../models/Analytics');
    await Analytics.deleteMany({ qrCodeId: qr._id });

    res.json({ message: 'QR Code deleted successfully.' });
  } catch (error) {
    console.error('Delete QR error:', error);
    res.status(500).json({ message: 'Server error deleting QR code.' });
  }
};

// @desc    Generate QR code image
// @route   GET /api/qrcodes/:id/download
exports.downloadQRCode = async (req, res) => {
  try {
    const { format = 'png' } = req.query;
    const qr = await QRCode.findOne({ _id: req.params.id, createdBy: req.user._id });
    
    if (!qr) {
      return res.status(404).json({ message: 'QR Code not found.' });
    }

    const shortUrl = qr.getShortUrl(process.env.BASE_URL);

    if (format === 'svg') {
      const svg = await qrcode.toString(shortUrl, {
        type: 'svg',
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      res.set('Content-Type', 'image/svg+xml');
      res.set('Content-Disposition', `attachment; filename="qr-${qr.shortId}.svg"`);
      return res.send(svg);
    }

    // Default PNG
    const pngBuffer = await qrcode.toBuffer(shortUrl, {
      type: 'png',
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `attachment; filename="qr-${qr.shortId}.png"`);
    res.send(pngBuffer);
  } catch (error) {
    console.error('Download QR error:', error);
    res.status(500).json({ message: 'Server error generating QR image.' });
  }
};

// @desc    Bulk create QR codes from CSV
// @route   POST /api/qrcodes/bulk
exports.bulkCreateQRCodes = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'CSV file is required.' });
    }

    const results = [];
    const errors = [];

    const stream = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          results.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (results.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty or invalid format.' });
    }

    if (results.length > 500) {
      return res.status(400).json({ message: 'Maximum 500 QR codes per bulk upload.' });
    }

    const created = [];
    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      try {
        if (!row.title || !row.destinationUrl) {
          errors.push({ row: i + 1, message: 'Missing title or destinationUrl' });
          continue;
        }

        const qr = await QRCode.create({
          title: row.title.trim(),
          destinationUrl: row.destinationUrl.trim(),
          customAlias: row.customAlias ? row.customAlias.trim() : undefined,
          expiresAt: row.expiresAt ? new Date(row.expiresAt) : undefined,
          tags: row.tags ? row.tags.split(';').map(t => t.trim()) : [],
          createdBy: req.user._id
        });
        created.push(qr);
      } catch (err) {
        errors.push({ row: i + 1, message: err.message });
      }
    }

    res.status(201).json({
      message: `Bulk upload complete. ${created.length} created, ${errors.length} errors.`,
      created: created.length,
      errors
    });
  } catch (error) {
    console.error('Bulk create error:', error);
    res.status(500).json({ message: 'Server error during bulk upload.' });
  }
};
