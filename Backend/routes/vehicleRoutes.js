const express = require('express');
const router = express.Router();
const {
  getVehicles, getVehicleById, getVehiclesByOwner, getAvailableVehicles, getVehiclesByLocation,
  addVehicle, updateVehicle, deleteVehicle, approveVehicle, updateStatus, uploadImage
} = require('../controllers/vehicleController');
const { protect, admin, ownerOrAdmin, ownerOnly } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.route('/')
  .get(getVehicles)
  .post(protect, ownerOnly, addVehicle);

router.get('/available', getAvailableVehicles);
router.get('/location/:location', getVehiclesByLocation);
router.get('/owner/:ownerId', protect, getVehiclesByOwner);

router.post('/upload', protect, upload.single('image'), uploadImage);

router.route('/:id')
  .get(getVehicleById)
  .put(protect, ownerOnly, updateVehicle)
  .delete(protect, ownerOnly, deleteVehicle);

router.put('/:id/approve', protect, admin, approveVehicle);
router.put('/:id/status', protect, ownerOnly, updateStatus);

module.exports = router;
