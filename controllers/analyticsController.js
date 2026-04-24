const Analytics = require('../models/Analytics');
const QRCode = require('../models/QRCode');
const mongoose = require('mongoose');

// @desc    Get analytics for a specific QR code
// @route   GET /api/analytics/:qrCodeId
exports.getQRAnalytics = async (req, res) => {
  try {
    const { qrCodeId } = req.params;
    const { days = 30 } = req.query;

    // Verify ownership
    const qr = await QRCode.findOne({ _id: qrCodeId, createdBy: req.user._id });
    if (!qr) {
      return res.status(404).json({ message: 'QR Code not found.' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Total scans
    const totalScans = await Analytics.countDocuments({
      qrCodeId: new mongoose.Types.ObjectId(qrCodeId),
      createdAt: { $gte: startDate }
    });

    // Scans per day
    const scansPerDay = await Analytics.aggregate([
      {
        $match: {
          qrCodeId: new mongoose.Types.ObjectId(qrCodeId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Device breakdown
    const deviceBreakdown = await Analytics.aggregate([
      {
        $match: {
          qrCodeId: new mongoose.Types.ObjectId(qrCodeId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$deviceType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Browser breakdown
    const browserBreakdown = await Analytics.aggregate([
      {
        $match: {
          qrCodeId: new mongoose.Types.ObjectId(qrCodeId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$browser',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // OS breakdown
    const osBreakdown = await Analytics.aggregate([
      {
        $match: {
          qrCodeId: new mongoose.Types.ObjectId(qrCodeId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$os',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Country breakdown
    const countryBreakdown = await Analytics.aggregate([
      {
        $match: {
          qrCodeId: new mongoose.Types.ObjectId(qrCodeId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$country',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // Recent scans
    const recentScans = await Analytics.find({ qrCodeId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      totalScans,
      scansPerDay: scansPerDay.map(d => ({ date: d._id, count: d.count })),
      deviceBreakdown: deviceBreakdown.map(d => ({ device: d._id, count: d.count })),
      browserBreakdown: browserBreakdown.map(d => ({ browser: d._id, count: d.count })),
      osBreakdown: osBreakdown.map(d => ({ os: d._id, count: d.count })),
      countryBreakdown: countryBreakdown.map(d => ({ country: d._id, count: d.count })),
      recentScans
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Server error fetching analytics.' });
  }
};

// @desc    Get dashboard overview analytics
// @route   GET /api/analytics/overview
exports.getOverviewAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get all user's QR codes
    const userQRCodes = await QRCode.find({ createdBy: userId }).select('_id').lean();
    const qrCodeIds = userQRCodes.map(q => q._id);

    const totalQRCodes = userQRCodes.length;
    const activeQRCodes = await QRCode.countDocuments({ createdBy: userId, isActive: true });

    const totalScans = await Analytics.countDocuments({
      qrCodeId: { $in: qrCodeIds },
      createdAt: { $gte: startDate }
    });

    // Scans over time
    const scansOverTime = await Analytics.aggregate([
      {
        $match: {
          qrCodeId: { $in: qrCodeIds },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Top performing QR codes
    const topQRCodes = await QRCode.find({ createdBy: userId })
      .sort({ totalScans: -1 })
      .limit(5)
      .lean();

    // Device distribution across all QR codes
    const deviceDistribution = await Analytics.aggregate([
      {
        $match: {
          qrCodeId: { $in: qrCodeIds },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$deviceType',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      totalQRCodes,
      activeQRCodes,
      totalScans,
      scansOverTime: scansOverTime.map(d => ({ date: d._id, count: d.count })),
      topQRCodes: topQRCodes.map(q => ({
        id: q._id,
        title: q.title,
        shortId: q.shortId,
        totalScans: q.totalScans
      })),
      deviceDistribution: deviceDistribution.map(d => ({ device: d._id, count: d.count }))
    });
  } catch (error) {
    console.error('Overview analytics error:', error);
    res.status(500).json({ message: 'Server error fetching overview.' });
  }
};
