const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/overview', analyticsController.getOverviewAnalytics);
router.get('/:qrCodeId', analyticsController.getQRAnalytics);

module.exports = router;
