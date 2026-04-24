const QRCode = require('../models/QRCode');
const Analytics = require('../models/Analytics');
const UAParser = require('ua-parser-js');

// @desc    Handle QR code redirect
// @route   GET /r/:id
exports.handleRedirect = async (req, res) => {
  try {
    const { id } = req.params;

    // Find by customAlias first, then shortId
    const qr = await QRCode.findOne({
      $or: [{ customAlias: id.toLowerCase() }, { shortId: id }]
    });

    if (!qr) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>Not Found</title></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#0f172a;color:#e2e8f0;">
          <div style="text-align:center;">
            <h1 style="font-size:4rem;margin:0;">404</h1>
            <p>This QR code link does not exist.</p>
          </div>
        </body></html>
      `);
    }

    // Check if active
    if (!qr.isActive) {
      return res.status(410).send(`
        <!DOCTYPE html>
        <html><head><title>Deactivated</title></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#0f172a;color:#e2e8f0;">
          <div style="text-align:center;">
            <h1 style="font-size:2rem;margin:0;">Link Deactivated</h1>
            <p>This QR code has been deactivated by its owner.</p>
          </div>
        </body></html>
      `);
    }

    // Check expiry
    if (qr.isExpired()) {
      return res.status(410).send(`
        <!DOCTYPE html>
        <html><head><title>Expired</title></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#0f172a;color:#e2e8f0;">
          <div style="text-align:center;">
            <h1 style="font-size:2rem;margin:0;">Link Expired</h1>
            <p>This QR code has expired.</p>
          </div>
        </body></html>
      `);
    }

    // Parse user agent
    const ua = new UAParser(req.headers['user-agent']);
    const device = ua.getDevice();
    const browser = ua.getBrowser();
    const os = ua.getOS();

    let deviceType = 'desktop';
    if (device.type === 'mobile') deviceType = 'mobile';
    else if (device.type === 'tablet') deviceType = 'tablet';

    // Determine destination URL based on redirect rules
    let destinationUrl = qr.destinationUrl;

    if (qr.redirectRules && qr.redirectRules.length > 0) {
      for (const rule of qr.redirectRules) {
        if (rule.condition === 'device' && rule.value.toLowerCase() === deviceType) {
          destinationUrl = rule.destinationUrl;
          break;
        }
        if (rule.condition === 'time') {
          const now = new Date();
          const currentHour = now.getHours();
          const [startHour, endHour] = rule.value.split('-').map(Number);
          if (currentHour >= startHour && currentHour <= endHour) {
            destinationUrl = rule.destinationUrl;
            break;
          }
        }
      }
    }

    // Get IP-based location
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.socket?.remoteAddress || 
               req.ip || 'unknown';

    let country = 'unknown', city = 'unknown', region = 'unknown';
    try {
      const geoip = require('geoip-lite');
      const geo = geoip.lookup(ip);
      if (geo) {
        country = geo.country || 'unknown';
        city = geo.city || 'unknown';
        region = geo.region || 'unknown';
      }
    } catch (e) { /* ignore geo errors */ }

    // Record analytics (async, don't block redirect)
    Analytics.create({
      qrCodeId: qr._id,
      shortId: qr.shortId,
      ip: ip.replace(/::ffff:/, ''),
      userAgent: req.headers['user-agent'] || '',
      deviceType,
      browser: browser.name || 'unknown',
      os: os.name || 'unknown',
      country,
      city,
      region,
      referrer: req.headers['referer'] || '',
      redirectedTo: destinationUrl
    }).catch(err => console.error('Analytics save error:', err));

    // Increment scan count (async)
    QRCode.updateOne({ _id: qr._id }, { $inc: { totalScans: 1 } })
      .catch(err => console.error('Scan count error:', err));

    // Perform redirect
    res.redirect(302, destinationUrl);
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).send('Server error');
  }
};
