const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const multer = require('multer');
const qrCodeController = require('../controllers/qrCodeController');
const auth = require('../middleware/auth');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

const validateQR = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('destinationUrl').trim().isURL().withMessage('Valid destination URL is required'),
  body('customAlias')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Alias must be 3-50 characters')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Alias can only contain letters, numbers, hyphens, and underscores')
];

router.use(auth);

router.get('/', qrCodeController.getQRCodes);
router.get('/:id', qrCodeController.getQRCode);
router.post('/', validateQR, qrCodeController.createQRCode);
router.put('/:id', validateQR.map(v => v.optional()), qrCodeController.updateQRCode);
router.delete('/:id', qrCodeController.deleteQRCode);
router.get('/:id/download', qrCodeController.downloadQRCode);
router.post('/bulk/upload', upload.single('csv'), qrCodeController.bulkCreateQRCodes);

module.exports = router;
